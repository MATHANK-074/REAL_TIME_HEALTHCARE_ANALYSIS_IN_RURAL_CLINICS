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

def find_by_id(collection, doc_id_str):
    if not doc_id_str:
        return None
    try:
        doc = collection.find_one({"_id": ObjectId(str(doc_id_str))})
        if doc:
            return doc
    except Exception:
        pass
    return collection.find_one({"_id": str(doc_id_str)})

def get_pid_query(patient_id):
    pid_str = str(patient_id)
    query = [pid_str]
    if ObjectId.is_valid(pid_str):
        query.append(ObjectId(pid_str))
    return {"$in": query}

def get_patient_id(current_user: dict):
    patient_id = current_user.get("patient_id")
    if not patient_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Your account is not currently linked to a patient profile. Please contact the healthcare administrator."
        )
    return str(patient_id)

@router.get("/dashboard")
def get_patient_dashboard(current_user: dict = Depends(require_role(["PATIENT"])), db: Database = Depends(get_db)):
    patient_id = get_patient_id(current_user)
    pid_q = get_pid_query(patient_id)

    latest_prediction = db.predictions.find_one(
        {"patient_id": pid_q}, 
        sort=[("predicted_at", -1)]
    )
    
    next_followup = db.followups.find_one(
        {"patient_id": pid_q, "status": {"$in": ["PENDING", "SCHEDULED"]}}, 
        sort=[("followup_date", 1)]
    )
    
    last_record = db.health_records.find_one(
        {"patient_id": pid_q}, 
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
        elif risk_level in ["MODERATE", "MEDIUM"]:
            health_attention = "Monitor"

    # Distinct latest predictions across models
    pipeline = [
        {"$match": {"patient_id": pid_q}},
        {"$sort": {"predicted_at": -1}},
        {"$group": {
            "_id": "$model_name",
            "latest_prediction": {"$first": "$$ROOT"}
        }}
    ]
    preds_agg = list(db.predictions.aggregate(pipeline))
    dashboard_predictions = []
    for p in preds_agg:
        pred = p["latest_prediction"]
        dashboard_predictions.append({
            "model_name": pred.get("model_name"),
            "risk_level": pred.get("risk_level"),
            "predicted_at": pred.get("predicted_at")
        })

    return {
        "latest_assessment_status": latest_assessment_status,
        "health_attention": health_attention,
        "next_followup_date": next_followup.get("followup_date") if next_followup else None,
        "next_followup_reason": next_followup.get("reason") if next_followup else None,
        "next_followup_priority": next_followup.get("priority") if next_followup else "ROUTINE",
        "last_visit_date": last_record.get("recorded_at") if last_record else None,
        "latest_record": serialize_doc(last_record) if last_record else None,
        "predictions": dashboard_predictions
    }

@router.get("/health")
def get_patient_health(current_user: dict = Depends(require_role(["PATIENT"])), db: Database = Depends(get_db)):
    patient_id = get_patient_id(current_user)
    pid_q = get_pid_query(patient_id)

    last_record = db.health_records.find_one({"patient_id": pid_q}, sort=[("recorded_at", -1)])
    
    # Chronological records for historical trend charts (oldest to newest, max 12)
    history_records = list(db.health_records.find({"patient_id": pid_q}).sort("recorded_at", 1).limit(12))
    trend_history = [serialize_doc(r) for r in history_records]
    
    pipeline = [
        {"$match": {"patient_id": pid_q}},
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
        "latest_visit": serialize_doc(last_record) if last_record else None,
        "predictions": safe_predictions,
        "trend_history": trend_history
    }
    
@router.get("/history")
def get_patient_history(current_user: dict = Depends(require_role(["PATIENT"])), db: Database = Depends(get_db)):
    patient_id = get_patient_id(current_user)
    pid_q = get_pid_query(patient_id)

    records = list(db.health_records.find({"patient_id": pid_q}).sort("recorded_at", -1))
    
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
    pid_q = get_pid_query(patient_id)
    
    predictions = list(db.predictions.find({"patient_id": pid_q}).sort("predicted_at", -1))
    safe_predictions = []
    for pred in predictions:
        pred_id_str = str(pred.get("_id", ""))
        # Check if explainability factors exist
        factors = []
        if pred_id_str:
            factors_docs = list(db.prediction_factors.find({"prediction_id": pred_id_str}))
            for f in factors_docs:
                factors.append({
                    "factor": f.get("feature") or f.get("factor"),
                    "impact": f.get("impact"),
                    "description": f.get("description")
                })
        
        safe_predictions.append({
            "id": pred_id_str,
            "model_name": pred.get("model_name"),
            "risk_level": pred.get("risk_level"),
            "probability": pred.get("probability"),
            "predicted_at": pred.get("predicted_at"),
            "safe_message": f"Your assessment indicates a {pred.get('risk_level', '').lower()} risk. Please follow your healthcare professional's advice.",
            "factors": factors
        })
    return safe_predictions

@router.get("/profile")
def get_patient_profile(current_user: dict = Depends(require_role(["PATIENT"])), db: Database = Depends(get_db)):
    patient_id = get_patient_id(current_user)

    patient = find_by_id(db.patients, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found in database")
        
    profile = serialize_doc(patient)
    
    v = None
    if patient.get("village_id"):
        v = find_by_id(db.villages, patient["village_id"])
        if v: profile["village_name"] = v.get("name")
            
    if patient.get("area_id"):
        a = find_by_id(db.areas, patient["area_id"])
        if a: profile["area_name"] = a.get("name")
            
    if patient.get("clinic_id"):
        c = find_by_id(db.clinics, patient["clinic_id"])
        if c: profile["clinic_name"] = c.get("clinic_name")
            
    nurse_query = {"role": "NURSE"}
    if patient.get("area_id"): nurse_query["area_id"] = str(patient["area_id"])
    elif patient.get("village_id"): nurse_query["village_id"] = str(patient["village_id"])
    nurses = list(db.users.find(nurse_query))
    if nurses: profile["nurse_name"] = ", ".join([n.get("name") for n in nurses])
        
    doctor_query = {"role": "DOCTOR"}
    if patient.get("clinic_id"): doctor_query["clinic_id"] = str(patient["clinic_id"])
    elif v and v.get("subdistrict_id"): doctor_query["subdistrict_id"] = str(v.get("subdistrict_id"))
    doctors = list(db.users.find(doctor_query))
    if doctors: profile["doctor_name"] = ", ".join([d.get("name") for d in doctors])

    return profile
