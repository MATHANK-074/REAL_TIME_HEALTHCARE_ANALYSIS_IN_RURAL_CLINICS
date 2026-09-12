from fastapi import APIRouter, Depends, HTTPException, status
from pymongo.database import Database
from typing import List, Optional
from datetime import date
from bson import ObjectId

from ..database import get_db
from ..schemas import Followup as FollowupSchema, FollowupCreate, FollowupUpdate, User
from .auth import get_current_user, require_role
from .patients import enforce_patient_area_access
from ..services.notification_service import (
    notify_followup_created,
    notify_followup_completed,
    notify_followup_missed,
)

import datetime

router = APIRouter(prefix="/followups", tags=["Followups"])

def serialize_doc(doc):
    if doc and "_id" in doc:
        doc["id"] = str(doc["_id"])
    return doc

@router.post("", response_model=FollowupSchema, status_code=status.HTTP_201_CREATED)
def create_followup(
    followup_data: FollowupCreate, 
    db: Database = Depends(get_db), 
    current_user: User = Depends(require_role(["DOCTOR", "ADMIN"]))
):
    patient = db.patients.find_one({"_id": ObjectId(followup_data.patient_id)})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
        
    enforce_patient_area_access(current_user, patient, db)
    
    db_followup = followup_data.dict()
    db_followup["doctor_id"] = str(current_user.id) if current_user.get("role") == 'DOCTOR' else str(patient.get("doctor_id", "1"))
    db_followup["nurse_id"] = str(patient.get("nurse_id")) if patient.get("nurse_id") else None
    db_followup["clinic_id"] = str(patient.get("clinic_id")) if patient.get("clinic_id") else None
    db_followup["area_id"] = str(patient.get("area_id")) if patient.get("area_id") else None
    db_followup["village_id"] = str(patient.get("village_id")) if patient.get("village_id") else None
    
    db_followup["status"] = followup_data.status or 'PENDING'
    db_followup["priority"] = followup_data.priority or 'MEDIUM'
    
    db_followup["created_at"] = datetime.datetime.utcnow()
    db_followup["updated_at"] = datetime.datetime.utcnow()
    db_followup["completed_at"] = None
    
    result = db.followups.insert_one(db_followup)
    db_followup["_id"] = result.inserted_id
    
    # Notify nurse about new follow‑up
    notify_followup_created(db, db_followup, patient)
    log_audit(db, str(current_user.id) if hasattr(current_user, 'id') else str(current_user.get("id", "sys")), "CREATE_FOLLOWUP", "followups", str(db_followup["_id"]), f"Scheduled followup for {patient.get('name')} on {db_followup['followup_date']}")
    
    return serialize_doc(db_followup)

@router.get("", response_model=List[FollowupSchema])
def get_followups(
    status_param: Optional[str] = None, 
    patient_id: Optional[str] = None,
    priority: Optional[str] = None,
    db: Database = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    filter_query = {}
    
    if current_user.get("role") == 'NURSE':
        if current_user.get("area_id"):
            filter_query["area_id"] = str(current_user.get("area_id"))
        elif current_user.get("village_id"):
            filter_query["village_id"] = str(current_user.get("village_id"))
            
    elif current_user.get("role") == 'DOCTOR':
        if current_user.get("clinic_id"):
            filter_query["clinic_id"] = str(current_user.get("clinic_id"))
        elif current_user.get("subdistrict_id"):
            assigned_villages = list(db.villages.find({"subdistrict_id": str(current_user.get("subdistrict_id"))}))
            assigned_village_ids = [str(v["_id"]) for v in assigned_villages]
            filter_query["village_id"] = {"$in": assigned_village_ids}
            
    elif current_user.get("role") == 'PATIENT':
        # Patient can ONLY see their own followups
        if not current_user.get("patient_id"):
            return []
        filter_query["patient_id"] = str(current_user.get("patient_id"))
            
    if status_param:
        filter_query["status"] = status_param.upper()
        
    if current_user.get("role") != 'PATIENT' and patient_id:
        filter_query["patient_id"] = str(patient_id)
        
    if priority:
        filter_query["priority"] = priority.upper()
        
    followups = list(db.followups.find(filter_query).sort("followup_date", 1))
    return [serialize_doc(f) for f in followups]

@router.put("/{followup_id}", response_model=FollowupSchema)
def update_followup(
    followup_id: str, 
    followup_data: FollowupUpdate, 
    db: Database = Depends(get_db), 
    current_user: User = Depends(require_role(["DOCTOR", "ADMIN", "NURSE"]))
):
    followup = db.followups.find_one({"_id": ObjectId(followup_id)})
    if not followup:
        raise HTTPException(status_code=404, detail="Followup not found")
        
    patient = db.patients.find_one({"_id": ObjectId(followup["patient_id"])})
    if patient:
        enforce_patient_area_access(current_user, patient, db)
    
    update_fields = {"updated_at": datetime.datetime.utcnow()}
    if followup_data.status:
        update_fields["status"] = followup_data.status.upper()
        followup["status"] = followup_data.status.upper()
        if update_fields["status"] == "COMPLETED":
            update_fields["completed_at"] = datetime.datetime.utcnow()
            followup["completed_at"] = update_fields["completed_at"]
            
    if followup_data.notes is not None:
        update_fields["notes"] = followup_data.notes
        followup["notes"] = followup_data.notes
    if followup_data.followup_date:
        update_fields["followup_date"] = followup_data.followup_date
        followup["followup_date"] = followup_data.followup_date
    if followup_data.priority:
        update_fields["priority"] = followup_data.priority.upper()
        followup["priority"] = followup_data.priority.upper()
    if followup_data.reason is not None:
        update_fields["reason"] = followup_data.reason
        followup["reason"] = followup_data.reason
        
    db.followups.update_one({"_id": ObjectId(followup_id)}, {"$set": update_fields})
    # Trigger notifications based on status changes
    if followup_data.status:
        new_status = followup_data.status.upper()
        if new_status == "COMPLETED":
            notify_followup_completed(db, followup, patient)
        elif new_status == "MISSED":
            notify_followup_missed(db, followup, patient)
    log_audit(db, str(current_user.id) if hasattr(current_user, 'id') else str(current_user.get("id", "sys")), "UPDATE_FOLLOWUP", "followups", followup_id, f"Updated followup status={followup.get('status')} for patient {patient.get('name') if patient else 'Unknown'}")
    return serialize_doc(followup)
