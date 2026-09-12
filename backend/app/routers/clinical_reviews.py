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
            
    # 2. Build Patient Filter
    p_ids = []
    if current_user.get("clinic_id"):
        patients = list(db.patients.find({"clinic_id": str(current_user.get("clinic_id"))}, {"_id": 1}))
        p_ids = [str(p["_id"]) for p in patients]
    elif current_user.get("subdistrict_id"):
        assigned_villages = list(db.villages.find({"subdistrict_id": str(current_user.get("subdistrict_id"))}))
        assigned_village_ids = [str(v["_id"]) for v in assigned_villages]
        patients = list(db.patients.find({"village_id": {"$in": assigned_village_ids}}, {"_id": 1}))
        p_ids = [str(p["_id"]) for p in patients]
        
    if current_user.get("role") == 'DOCTOR' and not p_ids:
        return []

    # 3. Fetch Recommendations
    filter_query = {}
    if current_user.get("role") == 'DOCTOR':
        filter_query["patient_id"] = {"$in": p_ids}
        
    recs = list(db.clinical_recommendations.find(filter_query).sort("generated_at", -1))
    
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
        
    # Get latest health record
    record = db.health_records.find_one({"_id": ObjectId(rec["health_record_id"])})
    
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
