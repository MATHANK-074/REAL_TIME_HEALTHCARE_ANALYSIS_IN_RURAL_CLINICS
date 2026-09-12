from fastapi import APIRouter, Depends, HTTPException, status
from pymongo.database import Database
from typing import List, Optional, Dict, Any
from bson import ObjectId
import datetime

from ..database import get_db
from .auth import get_current_user, require_role

router = APIRouter(prefix="/patient", tags=["Patient Portal"])

def serialize_doc(doc):
    if doc and "_id" in doc:
        doc["id"] = str(doc.pop("_id"))
    return doc

def get_patient_id(current_user: dict):
    patient_id = current_user.get("patient_id")
    if not patient_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Your account is not currently linked to a patient profile. Please contact the healthcare administrator."
        )
    return patient_id

@router.get("/dashboard")
def get_patient_dashboard(current_user: dict = Depends(require_role(["PATIENT"])), db: Database = Depends(get_db)):
    patient_id = get_patient_id(current_user)

    latest_prediction = db.predictions.find_one(
        {"patient_id": patient_id}, 
        sort=[("predicted_at", -1)]
    )
    
    next_followup = db.followups.find_one(
        {"patient_id": patient_id, "status": {"$in": ["PENDING", "SCHEDULED"]}}, 
        sort=[("followup_date", 1)]
    )
    
    last_record = db.health_records.find_one(
        {"patient_id": patient_id}, 
        sort=[("recorded_at", -1)]
    )
    
    latest_assessment_status = "No recent assessment available."
    if latest_prediction:
        latest_assessment_status = "Completed"
        
    health_attention = "Normal"
    if latest_prediction:
        risk_level = latest_prediction.get("risk_level", "").upper()
        if risk_level == "HIGH":
            health_attention = "Follow-up Recommended"
        elif risk_level == "MODERATE":
            health_attention = "Monitor"

    return {
        "latest_assessment_status": latest_assessment_status,
        "health_attention": health_attention,
        "next_followup_date": next_followup.get("followup_date") if next_followup else None,
        "last_visit_date": last_record.get("recorded_at") if last_record else None
    }

@router.get("/health")
def get_patient_health(current_user: dict = Depends(require_role(["PATIENT"])), db: Database = Depends(get_db)):
    patient_id = get_patient_id(current_user)

    last_record = db.health_records.find_one({"patient_id": patient_id}, sort=[("recorded_at", -1)])
    
    pipeline = [
        {"$match": {"patient_id": patient_id}},
        {"$sort": {"predicted_at": -1}},
        {"$group": {
            "_id": "$model_name",
            "latest_prediction": {"$first": "$$ROOT"}
        }}
    ]
    predictions = list(db.predictions.aggregate(pipeline))
    safe_predictions = []
    for p in predictions:
        pred = p["latest_prediction"]
        safe_predictions.append({
            "model_name": pred.get("model_name"),
            "risk_level": pred.get("risk_level"),
            "predicted_at": pred.get("predicted_at"),
            "safe_message": f"Your assessment indicates a {pred.get('risk_level', '').lower()} risk. Please follow your healthcare professional's advice."
        })
    
    return {
        "latest_visit": serialize_doc(last_record),
        "predictions": safe_predictions
    }
    
@router.get("/history")
def get_patient_history(current_user: dict = Depends(require_role(["PATIENT"])), db: Database = Depends(get_db)):
    patient_id = get_patient_id(current_user)

    records = list(db.health_records.find({"patient_id": patient_id}).sort("recorded_at", -1))
    
    history = []
    for r in records:
        record_id = str(r["_id"])
        preds = list(db.predictions.find({"record_id": record_id}))
        
        safe_preds = []
        for pred in preds:
             safe_preds.append({
                "model_name": pred.get("model_name"),
                "risk_level": pred.get("risk_level")
            })

        history.append({
            "record": serialize_doc(r),
            "predictions": safe_preds
        })
        
    return history

@router.get("/predictions")
def get_patient_predictions(current_user: dict = Depends(require_role(["PATIENT"])), db: Database = Depends(get_db)):
    patient_id = get_patient_id(current_user)
    
    predictions = list(db.predictions.find({"patient_id": patient_id}).sort("predicted_at", -1))
    safe_predictions = []
    for pred in predictions:
        safe_predictions.append({
            "model_name": pred.get("model_name"),
            "risk_level": pred.get("risk_level"),
            "predicted_at": pred.get("predicted_at"),
            "safe_message": f"Your assessment indicates a {pred.get('risk_level', '').lower()} risk. Please follow your healthcare professional's advice."
        })
    return safe_predictions
    

@router.get("/profile")
def get_patient_profile(current_user: dict = Depends(require_role(["PATIENT"])), db: Database = Depends(get_db)):
    patient_id = get_patient_id(current_user)

    patient = db.patients.find_one({"_id": ObjectId(patient_id)})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found in database")
        
    profile = serialize_doc(patient)
    
    if patient.get("village_id"):
        v = db.villages.find_one({"_id": ObjectId(patient["village_id"])})
        if v: profile["village_name"] = v.get("name")
            
    if patient.get("area_id"):
        a = db.areas.find_one({"_id": ObjectId(patient["area_id"])})
        if a: profile["area_name"] = a.get("name")
            
    if patient.get("clinic_id"):
        c = db.clinics.find_one({"_id": ObjectId(patient["clinic_id"])})
        if c: profile["clinic_name"] = c.get("clinic_name")
            
    if patient.get("doctor_id"):
        d = db.users.find_one({"_id": ObjectId(patient["doctor_id"])})
        if d: profile["doctor_name"] = d.get("name")
            
    if patient.get("nurse_id"):
        n = db.users.find_one({"_id": ObjectId(patient["nurse_id"])})
        if n: profile["nurse_name"] = n.get("name")

    return profile
