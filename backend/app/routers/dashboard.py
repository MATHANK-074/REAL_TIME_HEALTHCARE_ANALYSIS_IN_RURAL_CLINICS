from fastapi import APIRouter, Depends, HTTPException, status
from pymongo.database import Database
from typing import List, Dict, Any
from bson import ObjectId
import datetime
import random

from ..database import get_db
from ..schemas import User
from .auth import get_current_user, require_role

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/doctor", status_code=status.HTTP_200_OK)
def get_doctor_dashboard(
    db: Database = Depends(get_db), 
    current_user: User = Depends(require_role(["DOCTOR", "ADMIN"]))
):
    if current_user.get("role") == 'ADMIN':
        villages = list(db.villages.find({}))
        village_ids = []
        for v in villages:
            vid_str = str(v["_id"])
            village_ids.append(vid_str)
            if ObjectId.is_valid(vid_str):
                village_ids.append(ObjectId(vid_str))
    else:
        if not getattr(current_user, 'subdistrict_id', None) and not current_user.get("subdistrict_id"):
            village_ids = []
        else:
            subdistrict_id = str(getattr(current_user, 'subdistrict_id', current_user.get("subdistrict_id")))
            sub_query = [subdistrict_id]
            if ObjectId.is_valid(subdistrict_id):
                sub_query.append(ObjectId(subdistrict_id))
            villages = list(db.villages.find({"subdistrict_id": {"$in": sub_query}}))
            village_ids = []
            for v in villages:
                vid_str = str(v["_id"])
                village_ids.append(vid_str)
                if ObjectId.is_valid(vid_str):
                    village_ids.append(ObjectId(vid_str))

    if not village_ids:
        return {
            "kpis": {
                "total_patients": 0,
                "high_risk": 0,
                "medium_risk": 0,
                "low_risk": 0,
                "pending_followups": 0
            },
            "high_risk_patients": [],
            "location_breakdown": []
        }

    total_patients = db.patients.count_documents({"village_id": {"$in": village_ids}})
    
    patients_in_area = list(db.patients.find({"village_id": {"$in": village_ids}}, {"_id": 1}))
    patient_ids = []
    for p in patients_in_area:
        pid_str = str(p["_id"])
        patient_ids.append(pid_str)
        if ObjectId.is_valid(pid_str):
            patient_ids.append(ObjectId(pid_str))

    pipeline = [
        {"$match": {"patient_id": {"$in": patient_ids}}},
        {"$sort": {"predicted_at": -1}},
        {"$group": {
            "_id": "$patient_id",
            "latest_prediction": {"$first": "$$ROOT"}
        }},
        {"$replaceRoot": {"newRoot": "$latest_prediction"}}
    ]

    latest_predictions = list(db.predictions.aggregate(pipeline)) if patient_ids else []
    
    risk_map = {}
    for pred in latest_predictions:
        rl = pred.get("risk_level")
        risk_map[rl] = risk_map.get(rl, 0) + 1
        
    high_risk_count = risk_map.get('HIGH', 0)
    medium_risk_count = risk_map.get('MEDIUM', 0)
    low_risk_count = risk_map.get('LOW', 0)
    
    pending_followups = db.followups.count_documents({
        "patient_id": {"$in": patient_ids},
        "status": "PENDING"
    })

    high_risk_preds = [p for p in latest_predictions if p.get("risk_level") == "HIGH"]
    high_risk_preds.sort(key=lambda x: x.get("predicted_at", datetime.datetime.min), reverse=True)
    high_risk_preds = high_risk_preds[:15]

    formatted_high_risk = []
    for pred in high_risk_preds:
        p = db.patients.find_one({"_id": ObjectId(pred["patient_id"])})
        if p:
            v = db.villages.find_one({"_id": ObjectId(p.get("village_id"))}) if p.get("village_id") else None
            v_name = v["name"] if v else "Unknown"
            formatted_high_risk.append({
                "patient_id": str(p["_id"]),
                "patient_code": p.get("patient_code"),
                "name": p.get("name"),
                "location": v_name,
                "disease": pred.get("disease"),
                "probability": float(pred.get("probability", 0)),
                "risk_level": pred.get("risk_level"),
                "predicted_at": pred.get("predicted_at"),
                "prediction_id": str(pred["_id"])
            })

    village_patient_counts = []
    for vid in village_ids:
        try:
            v = db.villages.find_one({"_id": ObjectId(vid)})
            count = db.patients.count_documents({"village_id": vid})
            if count > 0 and v:
                village_patient_counts.append({"location": v["name"], "patients": count})
        except:
            pass

    return {
        "kpis": {
            "total_patients": total_patients,
            "high_risk": high_risk_count,
            "medium_risk": medium_risk_count,
            "low_risk": low_risk_count,
            "pending_followups": pending_followups
        },
        "high_risk_patients": formatted_high_risk,
        "location_breakdown": village_patient_counts
    }


@router.get("/admin", status_code=status.HTTP_200_OK)
def get_admin_dashboard(
    db: Database = Depends(get_db), 
    current_user: User = Depends(require_role(["ADMIN"]))
):
    total_locations = db.subdistricts.count_documents({})
    total_patients = db.patients.count_documents({})
    total_doctors = db.users.count_documents({"role": "DOCTOR"})
    total_nurses = db.users.count_documents({"role": "NURSE"})
    
    pending_followups = db.followups.count_documents({"status": "PENDING"})
    
    pipeline = [
        {"$sort": {"predicted_at": -1}},
        {"$group": {
            "_id": "$patient_id",
            "latest_prediction": {"$first": "$$ROOT"}
        }},
        {"$replaceRoot": {"newRoot": "$latest_prediction"}}
    ]
    latest_predictions = list(db.predictions.aggregate(pipeline))
    
    risk_dist = {}
    disease_dist = {}
    high_risk_models = {}
    
    for pred in latest_predictions:
        rl = pred.get("risk_level")
        model_name = pred.get("model_name")
        risk_dist[rl] = risk_dist.get(rl, 0) + 1
        disease_dist[model_name] = disease_dist.get(model_name, 0) + 1
        if rl == 'HIGH':
            high_risk_models[model_name] = high_risk_models.get(model_name, 0) + 1

    subdistricts_comparison = []
    all_subdistricts = list(db.subdistricts.find({}))
    for s in all_subdistricts:
        s_villages = list(db.villages.find({"subdistrict_id": str(s["_id"])}))
        s_v_ids = [str(v["_id"]) for v in s_villages]
        
        s_patients = db.patients.count_documents({"village_id": {"$in": s_v_ids}})
        s_patient_ids = [str(p["_id"]) for p in db.patients.find({"village_id": {"$in": s_v_ids}}, {"_id": 1})]
        s_high_risk = sum(1 for p in latest_predictions if p.get("patient_id") in s_patient_ids and p.get("risk_level") == 'HIGH')
        
        subdistricts_comparison.append({
            "name": s.get("name"),
            "patients": s_patients,
            "high_risk": s_high_risk
        })

    village_wise_risk = []
    all_villages = list(db.villages.find({}))
    for v in all_villages:
        v_id_str = str(v["_id"])
        v_patients = db.patients.count_documents({"village_id": v_id_str})
        v_patient_ids = [str(p["_id"]) for p in db.patients.find({"village_id": v_id_str}, {"_id": 1})]
        v_high_risk = sum(1 for p in latest_predictions if p.get("patient_id") in v_patient_ids and p.get("risk_level") == 'HIGH')
        
        try:
            parent_sub = db.subdistricts.find_one({"_id": ObjectId(v.get("subdistrict_id"))}) if v.get("subdistrict_id") else None
        except:
            parent_sub = None
            
        village_wise_risk.append({
            "id": v_id_str,
            "name": v.get("name"),
            "parent_name": parent_sub.get("name") if parent_sub else "Unknown",
            "patients": v_patients,
            "high_risk": v_high_risk
        })

    six_months_ago = datetime.datetime.utcnow() - datetime.timedelta(days=180)
    pipeline_monthly = [
        {"$match": {"created_at": {"$gte": six_months_ago}}},
        {"$project": {
            "month": {"$dateToString": {"format": "%b %Y", "date": "$created_at"}}
        }},
        {"$group": {"_id": "$month", "count": {"$sum": 1}}}
    ]
    monthly_registrations = list(db.patients.aggregate(pipeline_monthly))
    # Sorting roughly by date could be complex with string group, but let's leave it simple
    monthly_trend = [{"month": r["_id"], "count": r["count"]} for r in monthly_registrations]

    return {
        "kpis": {
            "total_locations": total_locations,
            "total_patients": total_patients,
            "total_doctors": total_doctors,
            "total_nurses": total_nurses,
            "pending_followups": pending_followups,
            "high_risk_patients": risk_dist.get('HIGH', 0)
        },
        "risk_distribution": {
            "high": risk_dist.get('HIGH', 0),
            "medium": risk_dist.get('MEDIUM', 0),
            "low": risk_dist.get('LOW', 0)
        },
        "disease_distribution": {
            "diabetes": disease_dist.get('DIABETES', 0),
            "hypertension": disease_dist.get('HYPERTENSION', 0),
            "maternal": disease_dist.get('MATERNAL', 0)
        },
        "high_risk_by_disease": {
            "diabetes": high_risk_models.get('DIABETES', 0),
            "hypertension": high_risk_models.get('HYPERTENSION', 0),
            "maternal": high_risk_models.get('MATERNAL', 0)
        },
        "subdistrict_comparison": subdistricts_comparison,
        "village_wise_risk": village_wise_risk,
        "monthly_trend": monthly_trend
    }


