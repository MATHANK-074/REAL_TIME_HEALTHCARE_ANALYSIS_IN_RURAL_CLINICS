from fastapi import APIRouter, Depends, HTTPException, status
from pymongo.database import Database
from typing import List
from decimal import Decimal
from bson import ObjectId
import datetime

from ..database import get_db
from ..schemas import HealthRecord as HealthRecordSchema, HealthRecordCreate, HealthRecordReviewUpdate, User
from .auth import get_current_user, require_role
from .patients import enforce_patient_area_access
from ..services.audit import log_audit

router = APIRouter(prefix="/health-records", tags=["Health Records"])

def serialize_doc(doc):
    if doc and "_id" in doc:
        doc["id"] = str(doc["_id"])
    return doc

@router.post("", response_model=HealthRecordSchema, status_code=status.HTTP_201_CREATED)
def create_health_record(
    record_data: HealthRecordCreate, 
    db: Database = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    if current_user.get("role") not in ['NURSE', 'ADMIN']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Nurses and Admins can log health records"
        )
        
    patient = db.patients.find_one({"_id": ObjectId(record_data.patient_id)})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
        
    enforce_patient_area_access(current_user, patient, db)
    
    bmi = record_data.bmi
    if record_data.weight and record_data.height:
        h = float(record_data.height)
        w = float(record_data.weight)
        if h > 0:
            if h > 3.0:
                h = h / 100.0
            bmi = float(Decimal(w / (h * h)))
            
    db_record = record_data.dict()
    db_record["bmi"] = float(bmi) if bmi else None
    db_record["recorded_by"] = str(current_user.id) if hasattr(current_user, 'id') else str(current_user.get("id", "sys"))
    db_record["recorded_at"] = datetime.datetime.utcnow()
    db_record["review_status"] = "PENDING_REVIEW"
    db_record["reviewed_by"] = None
    db_record["reviewed_at"] = None
    db_record["doctor_notes"] = None
    
    result = db.health_records.insert_one(db_record)
    db_record["_id"] = result.inserted_id
    
    log_audit(db, db_record["recorded_by"], "CREATE_HEALTH_RECORD", "health_records", str(db_record["_id"]), f"Created health record for patient {patient.get('name')} ({patient.get('patient_code')})")
    
    # After creating health record, notify assigned doctor
    from ..services.notification_service import notify_health_review_required
    notify_health_review_required(db, db_record, patient)
    return serialize_doc(db_record)

@router.get("/patient/{patient_id}", response_model=List[HealthRecordSchema])
def get_patient_health_records(
    patient_id: str, 
    db: Database = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    patient = db.patients.find_one({"_id": ObjectId(patient_id)})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
        
    enforce_patient_area_access(current_user, patient, db)
    
    records = list(db.health_records.find({"patient_id": patient_id}).sort("recorded_at", -1))
    return [serialize_doc(r) for r in records]

@router.get("/pending-review", response_model=List[HealthRecordSchema])
def get_pending_reviews(
    db: Database = Depends(get_db), 
    current_user: User = Depends(require_role(["DOCTOR", "ADMIN"]))
):
    """Retrieve all health records pending review for the Doctor's assigned location."""
    filter_query = {"review_status": "PENDING_REVIEW"}
    
    if current_user.get("role") == 'DOCTOR':
        if current_user.get("clinic_id"):
            patients_in_clinic = list(db.patients.find({"clinic_id": str(current_user.get("clinic_id"))}, {"_id": 1}))
            p_ids = [str(p["_id"]) for p in patients_in_clinic]
            filter_query["patient_id"] = {"$in": p_ids}
        elif current_user.get("subdistrict_id"):
            assigned_villages = list(db.villages.find({"subdistrict_id": str(current_user.get("subdistrict_id"))}))
            assigned_village_ids = [str(v["_id"]) for v in assigned_villages]
            patients_in_villages = list(db.patients.find({"village_id": {"$in": assigned_village_ids}}, {"_id": 1}))
            p_ids = [str(p["_id"]) for p in patients_in_villages]
            filter_query["patient_id"] = {"$in": p_ids}
            
    records = list(db.health_records.find(filter_query).sort("recorded_at", -1))
    return [serialize_doc(r) for r in records]

@router.patch("/{record_id}/review", response_model=HealthRecordSchema)
def review_health_record(
    record_id: str,
    review_data: HealthRecordReviewUpdate,
    db: Database = Depends(get_db),
    current_user: User = Depends(require_role(["DOCTOR", "ADMIN"]))
):
    record = db.health_records.find_one({"_id": ObjectId(record_id)})
    if not record:
        raise HTTPException(status_code=404, detail="Health record not found")
        
    patient = db.patients.find_one({"_id": ObjectId(record["patient_id"])})
    if patient:
        enforce_patient_area_access(current_user, patient, db)
        
    update_fields = {
        "review_status": review_data.review_status.upper(),
        "doctor_notes": review_data.doctor_notes,
        "reviewed_by": str(current_user.id) if hasattr(current_user, 'id') else str(current_user.get("id", "sys")),
        "reviewed_at": datetime.datetime.utcnow()
    }
    
    db.health_records.update_one({"_id": ObjectId(record_id)}, {"$set": update_fields})
    
    log_audit(db, update_fields["reviewed_by"], "REVIEW_HEALTH_RECORD", "health_records", record_id, f"Reviewed record status={update_fields['review_status']} for patient {patient.get('name') if patient else 'Unknown'}")
    
    record.update(update_fields)
    return serialize_doc(record)
