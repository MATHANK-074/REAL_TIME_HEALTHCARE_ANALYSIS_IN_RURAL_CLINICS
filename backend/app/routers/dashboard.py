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

    def get_pred_sort_key(pred_item):
        val = pred_item.get("predicted_at") or pred_item.get("created_at")
        if isinstance(val, datetime.datetime):
            return val.isoformat()
        if isinstance(val, str):
            return val
        if "_id" in pred_item and hasattr(pred_item["_id"], "generation_time"):
            return pred_item["_id"].generation_time.isoformat()
        return ""

    high_risk_preds = [p for p in latest_predictions if p.get("risk_level") == "HIGH"]
    high_risk_preds.sort(key=get_pred_sort_key, reverse=True)
    high_risk_preds = high_risk_preds[:15]

    formatted_high_risk = []
    for pred in high_risk_preds:
        p = db.patients.find_one({"_id": ObjectId(pred["patient_id"])})
        if p:
            v = db.villages.find_one({"_id": ObjectId(p.get("village_id"))}) if p.get("village_id") else None
            v_name = v["name"] if v else "Unknown"

            predicted_at = pred.get("predicted_at") or pred.get("created_at")
            if not predicted_at and "_id" in pred:
                try:
                    if isinstance(pred["_id"], ObjectId):
                        predicted_at = pred["_id"].generation_time.isoformat()
                    elif ObjectId.is_valid(str(pred["_id"])):
                        predicted_at = ObjectId(str(pred["_id"])).generation_time.isoformat()
                except Exception:
                    pass
            if not predicted_at:
                predicted_at = datetime.datetime.utcnow().isoformat()

            formatted_high_risk.append({
                "patient_id": str(p["_id"]),
                "patient_code": p.get("patient_code"),
                "name": p.get("name"),
                "location": v_name,
                "disease": pred.get("disease"),
                "probability": float(pred.get("probability", 0)),
                "risk_level": pred.get("risk_level"),
                "predicted_at": predicted_at,
                "prediction_id": str(pred["_id"])
            })

    village_patient_counts = []
    if village_ids:
        # Batch query patient counts for relevant villages using aggregation
        valid_obj_ids = [ObjectId(str(vid)) for vid in village_ids if ObjectId.is_valid(str(vid))]
        v_docs = list(db.villages.find({"_id": {"$in": valid_obj_ids}}, {"name": 1}))
        v_name_map = {str(v["_id"]): v.get("name", "Unknown") for v in v_docs}
        
        village_pipe = [
            {"$match": {"village_id": {"$in": [str(v) for v in village_ids]}}},
            {"$group": {"_id": "$village_id", "count": {"$sum": 1}}}
        ]
        for item in db.patients.aggregate(village_pipe):
            vid_str = str(item["_id"])
            if vid_str in v_name_map:
                village_patient_counts.append({"location": v_name_map[vid_str], "patients": item["count"]})

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
    high_risk_patient_ids = set()
    
    for pred in latest_predictions:
        rl = pred.get("risk_level")
        model_name = pred.get("model_name")
        risk_dist[rl] = risk_dist.get(rl, 0) + 1
        disease_dist[model_name] = disease_dist.get(model_name, 0) + 1
        if rl == 'HIGH':
            high_risk_models[model_name] = high_risk_models.get(model_name, 0) + 1
            if pred.get("patient_id"):
                high_risk_patient_ids.add(str(pred["patient_id"]))

    # FAST IN-MEMORY AGGREGATION: Preload lookups in 3 single queries instead of 1,400+ loops!
    all_subdistricts = list(db.subdistricts.find({}))
    subdistrict_name_map = {str(s["_id"]): s.get("name", "Unknown") for s in all_subdistricts}
    
    all_villages = list(db.villages.find({}))
    
    # Preload all patients with their village_id in ONE query
    all_patients = list(db.patients.find({}, {"_id": 1, "village_id": 1}))
    
    # Map village_id -> count of patients and list of patient IDs
    village_patient_count = {}
    village_patient_ids = {}
    for p in all_patients:
        vid = str(p.get("village_id", ""))
        pid = str(p["_id"])
        village_patient_count[vid] = village_patient_count.get(vid, 0) + 1
        if vid not in village_patient_ids:
            village_patient_ids[vid] = set()
        village_patient_ids[vid].add(pid)

    # Pre-group villages by subdistrict_id
    subdistrict_villages_map = {}
    for v in all_villages:
        sid = str(v.get("subdistrict_id", ""))
        if sid not in subdistrict_villages_map:
            subdistrict_villages_map[sid] = []
        subdistrict_villages_map[sid].append(str(v["_id"]))

    subdistricts_comparison = []
    for s in all_subdistricts:
        sid = str(s["_id"])
        s_v_ids = subdistrict_villages_map.get(sid, [])
        s_patients = sum(village_patient_count.get(vid, 0) for vid in s_v_ids)
        s_high_risk = 0
        for vid in s_v_ids:
            p_ids = village_patient_ids.get(vid, set())
            s_high_risk += len(p_ids.intersection(high_risk_patient_ids))
        
        subdistricts_comparison.append({
            "name": s.get("name"),
            "patients": s_patients,
            "high_risk": s_high_risk
        })

    village_wise_risk = []
    for v in all_villages:
        v_id_str = str(v["_id"])
        sub_id_str = str(v.get("subdistrict_id", ""))
        v_pts = village_patient_count.get(v_id_str, 0)
        v_p_ids = village_patient_ids.get(v_id_str, set())
        v_high = len(v_p_ids.intersection(high_risk_patient_ids))
        
        village_wise_risk.append({
            "id": v_id_str,
            "name": v.get("name"),
            "parent_name": subdistrict_name_map.get(sub_id_str, "Unknown"),
            "patients": v_pts,
            "high_risk": v_high
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


@router.post("/simulate", status_code=status.HTTP_200_OK)
def simulate_field_screening(
    db: Database = Depends(get_db),
    current_user: User = Depends(require_role(["ADMIN"]))
):
    """Simulate a live patient screening submitted by a field nurse from a remote village."""
    patient = db.patients.find_one({})
    if not patient:
        # Create a sample patient if none exists
        patient = {
            "name": "Kavitha Selvam",
            "patient_code": "P-ERD-1001",
            "age": 34,
            "gender": "FEMALE",
            "village_id": None
        }
    
    village_name = "Thalaiyampalayam"
    subdistrict_name = "Perundurai"
    if patient.get("village_id"):
        try:
            v_doc = db.villages.find_one({"_id": ObjectId(patient["village_id"])})
            if v_doc:
                village_name = v_doc.get("name", village_name)
                s_doc = db.subdistricts.find_one({"_id": ObjectId(v_doc.get("subdistrict_id"))}) if v_doc.get("subdistrict_id") else None
                if s_doc:
                    subdistrict_name = s_doc.get("name", subdistrict_name)
        except Exception:
            pass

    diseases = ["DIABETES", "HYPERTENSION", "MATERNAL"]
    selected_disease = random.choice(diseases)
    
    risk_level = random.choices(["LOW", "MEDIUM", "HIGH"], weights=[0.5, 0.3, 0.2])[0]
    prob = round(random.uniform(0.75, 0.96) if risk_level == "HIGH" else random.uniform(0.45, 0.74) if risk_level == "MEDIUM" else random.uniform(0.10, 0.44), 2)
    
    systolic = random.randint(110, 165)
    diastolic = random.randint(70, 105)
    glucose = random.randint(85, 230)
    bmi = round(random.uniform(20.5, 32.0), 1)

    now_iso = datetime.datetime.utcnow().isoformat()
    
    return {
        "status": "success",
        "patient": {
            "name": patient.get("name", "Screened Patient"),
            "patient_code": patient.get("patient_code", "RC-PAT-001"),
            "village": village_name,
            "subdistrict": subdistrict_name
        },
        "prediction": {
            "id": str(ObjectId()),
            "risk_level": risk_level,
            "disease": selected_disease,
            "probability": prob,
            "predicted_at": now_iso
        },
        "health_record": {
            "blood_pressure": f"{systolic}/{diastolic}",
            "blood_glucose": glucose,
            "bmi": bmi
        },
        "telemetry": {
            "server_latency_ms": random.randint(12, 28),
            "ingestion_rate_spm": round(random.uniform(4.5, 6.2), 1),
            "offline_queue": 0
        }
    }


