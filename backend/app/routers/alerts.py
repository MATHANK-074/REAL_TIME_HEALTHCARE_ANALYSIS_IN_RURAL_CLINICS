from fastapi import APIRouter, Depends, HTTPException, status
from pymongo.database import Database
from typing import List, Optional
from bson import ObjectId

from ..database import get_db
from ..schemas import Alert as AlertSchema, User
from .auth import get_current_user

router = APIRouter(prefix="/alerts", tags=["Alerts"])

def serialize_doc(doc):
    if doc and "_id" in doc:
        doc["id"] = str(doc["_id"])
    return doc

@router.get("", response_model=List[AlertSchema])
def get_alerts(
    status_param: Optional[str] = None, 
    db: Database = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    filter_query = {}
    
    if current_user.get("role") == 'NURSE':
        patients_in_area = list(db.patients.find({"village_id": str(current_user.get("village_id"))}, {"_id": 1}))
        p_ids = [str(p["_id"]) for p in patients_in_area]
        filter_query["patient_id"] = {"$in": p_ids}
        filter_query["recipient_type"] = {"$in": ['NURSE', 'PATIENT']}
    elif current_user.get("role") == 'DOCTOR':
        assigned_villages = list(db.villages.find({"subdistrict_id": str(current_user.get("subdistrict_id"))}))
        v_ids = [str(v["_id"]) for v in assigned_villages]
        patients_in_area = list(db.patients.find({"village_id": {"$in": v_ids}}, {"_id": 1}))
        p_ids = [str(p["_id"]) for p in patients_in_area]
        filter_query["patient_id"] = {"$in": p_ids}
        filter_query["recipient_type"] = 'DOCTOR'
        
    if status_param:
        filter_query["status"] = status_param.upper()
        
    alerts = list(db.alerts.find(filter_query).sort("_id", -1))
    return [serialize_doc(a) for a in alerts]

@router.patch("/{alert_id}/read", response_model=AlertSchema)
def mark_alert_read(
    alert_id: str, 
    db: Database = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    alert = db.alerts.find_one({"_id": ObjectId(alert_id)})
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
        
    patient = db.patients.find_one({"_id": ObjectId(alert["patient_id"])}) if alert.get("patient_id") else None
    if patient:
        if current_user.get("role") == 'NURSE' and str(patient.get("village_id")) != str(current_user.get("village_id")):
            raise HTTPException(status_code=403, detail="Insufficient permission")
        elif current_user.get("role") == 'DOCTOR':
            assigned_villages = list(db.villages.find({"subdistrict_id": str(current_user.get("subdistrict_id"))}))
            v_ids = [str(v["_id"]) for v in assigned_villages]
            if str(patient.get("village_id")) not in v_ids:
                raise HTTPException(status_code=403, detail="Insufficient permission")
                
    db.alerts.update_one({"_id": ObjectId(alert_id)}, {"$set": {"status": "READ"}})
    alert["status"] = "READ"
    return serialize_doc(alert)
