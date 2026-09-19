from fastapi import APIRouter, Depends, HTTPException, status
from pymongo.database import Database
from typing import List, Optional
from bson import ObjectId
import datetime

from ..database import get_db
from ..schemas import User, ClinicalRecommendation, DoctorReview
from .auth import get_current_user, require_role
from .patients import enforce_patient_area_access
from ..services.clinical_support_service import submit_doctor_decision

router = APIRouter(prefix="/reviews", tags=["Clinical Reviews"])

def serialize_doc(doc):
    if doc and "_id" in doc:
        doc["id"] = str(doc["_id"])
        del doc["_id"]
    return doc

@router.get("/queue", response_model=List[dict])
def get_clinical_review_queue(
    db: Database = Depends(get_db), 
    current_user: User = Depends(require_role(["DOCTOR", "ADMIN"]))
):
    """
    Retrieve the prioritized clinical review queue for the Doctor.
    Strictly filters by the Doctor's assigned facility/clinic.
    """
    # 1. Authorize Clinic
    if current_user.get("role") == 'DOCTOR':
        if not current_user.get("clinic_id") and not current_user.get("subdistrict_id"):
            return [] # No assignment, no queue
            
    # 2. Build Patient Filter with clinic + subdistrict village fallback
    p_ids = []
    if current_user.get("role") == 'DOCTOR':
        clinic_id = current_user.get("clinic_id")
        subdistrict_id = current_user.get("subdistrict_id")
        
        if clinic_id and not subdistrict_id:
            try:
                c = db.clinics.find_one({"_id": ObjectId(clinic_id)})
                if c and c.get("subdistrict_id"):
                    subdistrict_id = str(c["subdistrict_id"])
            except Exception:
                pass

        query_conditions = []
        if clinic_id:
            query_conditions.append({"clinic_id": str(clinic_id)})
        if subdistrict_id:
            assigned_villages = list(db.villages.find({"subdistrict_id": str(subdistrict_id)}))
            assigned_village_ids = [str(v["_id"]) for v in assigned_villages]
            if assigned_village_ids:
                query_conditions.append({"village_id": {"$in": assigned_village_ids}})

        if query_conditions:
            patients = list(db.patients.find({"$or": query_conditions}, {"_id": 1}))
            p_ids = [str(p["_id"]) for p in patients]
        else:
            patients = list(db.patients.find({}, {"_id": 1}))
            p_ids = [str(p["_id"]) for p in patients]
        
    # 3. Fetch Recommendations
    filter_query = {}
    if current_user.get("role") == 'DOCTOR':
        filter_query["patient_id"] = {"$in": p_ids}
        
    recs = list(db.clinical_recommendations.find(filter_query).sort("generated_at", -1))
    
    print(f"[DOCTOR_ASSESSMENT_QUERY] doctor_id={current_user.get('id')} clinic_id={current_user.get('clinic_id')} patient_ids_found={len(p_ids)} recs_found={len(recs)}")
    
    # 4. Enrich and Sort Queue
    queue = []
    for r in recs:
        p = db.patients.find_one({"_id": ObjectId(r["patient_id"])})
        if not p:
            continue
        
        queue.append({
            "id": str(r["_id"]),
            "patient_id": r["patient_id"],
            "patient_name": p.get("name"),
            "patient_code": p.get("patient_code"),
            "age": p.get("age"),
            "gender": p.get("gender"),
            "overall_priority": r.get("overall_priority"),
            "status": r.get("status"),
            "generated_at": r.get("generated_at"),
            "condition_results": r.get("condition_results", [])
        })
        
    # Sort URGENT > HIGH > MODERATE > LOW (approximate by status)
    priority_scores = {"URGENT": 4, "HIGH": 3, "MODERATE": 2, "LOW": 1}
    queue.sort(key=lambda x: (priority_scores.get(x["overall_priority"], 0), x["generated_at"]), reverse=True)
    
    return queue

@router.get("/{patient_id}", response_model=dict)
def get_patient_clinical_review(
    patient_id: str,
    db: Database = Depends(get_db),
    current_user: User = Depends(require_role(["DOCTOR", "ADMIN"]))
):
    """
    Get the comprehensive review data for a specific patient.
    """
    patient = db.patients.find_one({"_id": ObjectId(patient_id)})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
        
    enforce_patient_area_access(current_user, patient, db)
    
    # Get latest recommendation
    rec = db.clinical_recommendations.find_one(
        {"patient_id": patient_id},
        sort=[("generated_at", -1)]
    )
    
    if not rec:
        raise HTTPException(status_code=404, detail="No clinical recommendations found for this patient.")
        
    # Get health record safely (support both ObjectId and string ID)
    record = None
    if rec.get("health_record_id"):
        try:
            record = db.health_records.find_one({"_id": ObjectId(rec["health_record_id"])})
        except Exception:
            pass
        if not record:
            record = db.health_records.find_one({"_id": rec["health_record_id"]})

    if not record:
        record = db.health_records.find_one({"patient_id": patient_id}, sort=[("recorded_at", -1)])
        
    return {
        "patient": serialize_doc(patient),
        "health_record": serialize_doc(record),
        "recommendation": serialize_doc(rec)
    }

from pydantic import BaseModel
class DecisionUpdate(BaseModel):
    decision: str
    doctor_notes: Optional[str] = None
    
@router.post("/{recommendation_id}/decision", response_model=dict)
def submit_review_decision(
    recommendation_id: str,
    payload: DecisionUpdate,
    db: Database = Depends(get_db),
    current_user: User = Depends(require_role(["DOCTOR"]))
):
    """
    Submit a doctor's decision (APPROVE, MODIFY, DISMISS) with notes.
    """
    if payload.decision.upper() not in ["APPROVE", "MODIFY", "DISMISS"]:
        raise HTTPException(status_code=400, detail="Invalid decision.")
        
    if payload.decision.upper() in ["MODIFY", "DISMISS"] and not payload.doctor_notes:
        raise HTTPException(status_code=400, detail="Doctor notes are required when modifying or dismissing.")
        
    rec = db.clinical_recommendations.find_one({"_id": ObjectId(recommendation_id)})
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")
        
    if rec.get("status") in ["APPROVE", "MODIFY", "DISMISS"]:
        raise HTTPException(status_code=400, detail="This assessment has already been reviewed.")
        
    patient = db.patients.find_one({"_id": ObjectId(rec["patient_id"])})
    enforce_patient_area_access(current_user, patient, db)
    
    doctor_id = str(current_user.id) if hasattr(current_user, 'id') else str(current_user.get("id"))
    review = submit_doctor_decision(db, recommendation_id, doctor_id, payload.decision, payload.doctor_notes)
    
    return serialize_doc(review)
