import os

BASE_DIR = r"c:\Users\mathankumar\OneDrive\Desktop\SEM-5\mulit project\backend\app\routers"

def write_file(filename, content):
    with open(os.path.join(BASE_DIR, filename), "w", encoding="utf-8") as f:
        f.write(content)

patients_content = """from fastapi import APIRouter, Depends, HTTPException, status
from pymongo.database import Database
from typing import List, Optional
from bson import ObjectId

from ..database import get_db
from ..schemas import Patient as PatientSchema, PatientCreate, User
from .auth import get_current_user
from ..services.audit import log_audit

router = APIRouter(prefix="/patients", tags=["Patients"])

def enforce_patient_area_access(current_user: User, patient: dict, db: Database):
    \"\"\"Enforce that nurse/doctor only access patients in their assigned locations.\"\"\"
    if current_user.role == 'ADMIN':
        return
        
    if current_user.role == 'NURSE':
        if str(patient.get("village_id")) != str(current_user.village_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. Patient belongs to another nurse's assigned village."
            )
            
    elif current_user.role == 'DOCTOR':
        assigned_villages = list(db.villages.find({"subdistrict_id": str(current_user.subdistrict_id)}))
        assigned_village_ids = [str(v["_id"]) for v in assigned_villages]
        if str(patient.get("village_id")) not in assigned_village_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. Patient belongs to a village outside your jurisdiction."
            )

def serialize_doc(doc):
    if doc and "_id" in doc:
        doc["id"] = str(doc["_id"])
    return doc

@router.get("", response_model=List[PatientSchema])
def get_patients(
    search: Optional[str] = None, 
    village_id: Optional[str] = None,
    db: Database = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    \"\"\"Retrieve patients accessible to the current user (based on role/assigned location).\"\"\"
    filter_query = {}
    
    # 1. Enforce Role-Based Area Restrictions
    if current_user.role == 'NURSE':
        filter_query["village_id"] = str(current_user.village_id)
    elif current_user.role == 'DOCTOR':
        assigned_villages = list(db.villages.find({"subdistrict_id": str(current_user.subdistrict_id)}))
        assigned_village_ids = [str(v["_id"]) for v in assigned_villages]
        filter_query["village_id"] = {"$in": assigned_village_ids}
    
    # 2. Apply optional filters
    if village_id:
        filter_query["village_id"] = str(village_id)
        
    if search:
        filter_query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"patient_code": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}}
        ]
        
    patients = list(db.patients.find(filter_query).sort("_id", -1))
    return [serialize_doc(p) for p in patients]

@router.get("/{patient_id}", response_model=PatientSchema)
def get_patient(patient_id: str, db: Database = Depends(get_db), current_user: User = Depends(get_current_user)):
    \"\"\"Retrieve a specific patient's details with location access checking.\"\"\"
    patient = db.patients.find_one({"_id": ObjectId(patient_id)})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
        
    enforce_patient_area_access(current_user, patient, db)
    return serialize_doc(patient)

@router.post("", response_model=PatientSchema, status_code=status.HTTP_201_CREATED)
def create_patient(patient_data: PatientCreate, db: Database = Depends(get_db), current_user: User = Depends(get_current_user)):
    \"\"\"Register a new patient. Auto-generates patient code and enforces location restrictions.\"\"\"
    if current_user.role not in ['NURSE', 'ADMIN']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Nurses and Admins can register patients"
        )
        
    target_village_id = patient_data.village_id
    if current_user.role == 'NURSE':
        target_village_id = current_user.village_id
        
    if not target_village_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A village must be specified for the patient"
        )
        
    # Generate Patient ID
    last_patient = db.patients.find_one({}, sort=[("_id", -1)])
    if last_patient and "patient_code" in last_patient and last_patient["patient_code"].startswith("RH-"):
        try:
            next_num = int(last_patient["patient_code"].split("-")[1]) + 1
        except:
            next_num = 1
    else:
        next_num = 1
    patient_code = f"RH-{next_num:04d}"

    if patient_data.phone:
        dup = db.patients.find_one({"phone": patient_data.phone})
        if dup:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"A patient is already registered with mobile number {patient_data.phone}"
            )
            
    db_patient = patient_data.dict()
    db_patient["patient_code"] = patient_code
    db_patient["village_id"] = str(target_village_id)
    
    result = db.patients.insert_one(db_patient)
    db_patient["_id"] = result.inserted_id
    
    log_audit(db, str(current_user.id) if hasattr(current_user, 'id') else str(current_user.get("id", "sys")), "CREATE_PATIENT", "patients", str(db_patient["_id"]), f"Registered patient {db_patient['name']} ({patient_code})")
    
    return serialize_doc(db_patient)

@router.put("/{patient_id}", response_model=PatientSchema)
def update_patient(patient_id: str, patient_data: PatientCreate, db: Database = Depends(get_db), current_user: User = Depends(get_current_user)):
    \"\"\"Update patient demographics. Enforces location checks.\"\"\"
    patient = db.patients.find_one({"_id": ObjectId(patient_id)})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
        
    enforce_patient_area_access(current_user, patient, db)
    
    update_data = patient_data.dict(exclude_unset=True)
    if current_user.role != 'ADMIN':
        update_data.pop("village_id", None)
    if "village_id" in update_data:
        update_data["village_id"] = str(update_data["village_id"])
        
    db.patients.update_one({"_id": ObjectId(patient_id)}, {"$set": update_data})
    patient.update(update_data)
    
    log_audit(db, str(current_user.id) if hasattr(current_user, 'id') else str(current_user.get("id", "sys")), "UPDATE_PATIENT", "patients", patient_id, f"Updated patient {patient.get('name')} ({patient.get('patient_code', '')})")
    return serialize_doc(patient)
"""
write_file("patients.py", patients_content)


health_records_content = """from fastapi import APIRouter, Depends, HTTPException, status
from pymongo.database import Database
from typing import List
from decimal import Decimal
from bson import ObjectId
import datetime

from ..database import get_db
from ..schemas import HealthRecord as HealthRecordSchema, HealthRecordCreate, User
from .auth import get_current_user
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
    if current_user.role not in ['NURSE', 'ADMIN']:
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
    
    result = db.health_records.insert_one(db_record)
    db_record["_id"] = result.inserted_id
    
    log_audit(db, db_record["recorded_by"], "CREATE_HEALTH_RECORD", "health_records", str(db_record["_id"]), f"Created health record for patient {patient.get('name')} ({patient.get('patient_code')})")
    
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
    
    records = list(db.health_records.find({"patient_id": patient_id}))
    return [serialize_doc(r) for r in records]
"""
write_file("health_records.py", health_records_content)

predictions_content = """from fastapi import APIRouter, Depends, HTTPException, status
from pymongo.database import Database
from typing import List
from bson import ObjectId

from ..database import get_db
from ..schemas import Prediction as PredictionSchema, User
from .auth import get_current_user
from .patients import enforce_patient_area_access
from ..ml.predictor import predict_risk
from ..ml.model_registry import ModelNotConfiguredException, get_model_metrics
from ..services.audit import log_audit

router = APIRouter(prefix="/predictions", tags=["Predictions"])

def serialize_doc(doc):
    if doc and "_id" in doc:
        doc["id"] = str(doc["_id"])
    return doc

@router.post("/{patient_id}", response_model=PredictionSchema, status_code=status.HTTP_201_CREATED)
def trigger_prediction(
    patient_id: str, 
    model_name: str, 
    db: Database = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    patient = db.patients.find_one({"_id": ObjectId(patient_id)})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
        
    enforce_patient_area_access(current_user, patient, db)
    
    latest_record = db.health_records.find_one(
        {"patient_id": patient_id},
        sort=[("recorded_at", -1)]
    )
    
    if not latest_record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No health records found for this patient. Please enter health measurements first."
        )

    try:
        prediction = predict_risk(db, latest_record, patient, model_name)
        if "_id" not in prediction and "id" not in prediction:
            result = db.predictions.insert_one(prediction)
            prediction["_id"] = result.inserted_id
            prediction_id = str(result.inserted_id)
        else:
            prediction_id = str(prediction.get("_id", prediction.get("id")))
        
        log_audit(
            db, 
            str(current_user.id) if hasattr(current_user, 'id') else str(current_user.get("id", "sys")), 
            "TRIGGER_PREDICTION", 
            "predictions", 
            prediction_id, 
            f"Triggered {model_name} prediction. Risk={prediction.get('risk_level')} Prob={float(prediction.get('probability', 0)):.2f}"
        )
        return serialize_doc(prediction)
        
    except ModelNotConfiguredException as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.get("/patient/{patient_id}", response_model=List[PredictionSchema])
def get_patient_predictions(
    patient_id: str, 
    db: Database = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    patient = db.patients.find_one({"_id": ObjectId(patient_id)})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
        
    enforce_patient_area_access(current_user, patient, db)
    predictions = list(db.predictions.find({"patient_id": patient_id}).sort("predicted_at", -1))
    return [serialize_doc(p) for p in predictions]

@router.get("/metrics", status_code=status.HTTP_200_OK)
def get_model_evaluation_metrics(
    current_user: User = Depends(get_current_user)
):
    metrics = get_model_metrics()
    if not metrics:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Evaluation metrics are not available. Ensure ML training has run successfully."
        )
    return metrics

@router.get("/{prediction_id}", response_model=PredictionSchema)
def get_prediction_detail(
    prediction_id: str, 
    db: Database = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    prediction = db.predictions.find_one({"_id": ObjectId(prediction_id)})
    if not prediction:
        raise HTTPException(status_code=404, detail="Prediction record not found")
        
    patient = db.patients.find_one({"_id": ObjectId(prediction["patient_id"])})
    if patient:
        enforce_patient_area_access(current_user, patient, db)
    return serialize_doc(prediction)
"""
write_file("predictions.py", predictions_content)

dashboard_content = """from fastapi import APIRouter, Depends, HTTPException, status
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
    if current_user.role == 'ADMIN':
        villages = list(db.villages.find({}))
        village_ids = [str(v["_id"]) for v in villages]
    else:
        if not getattr(current_user, 'subdistrict_id', None) and not current_user.get("subdistrict_id"):
            village_ids = []
        else:
            subdistrict_id = getattr(current_user, 'subdistrict_id', current_user.get("subdistrict_id"))
            villages = list(db.villages.find({"subdistrict_id": str(subdistrict_id)}))
            village_ids = [str(v["_id"]) for v in villages]

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
    patient_ids = [str(p["_id"]) for p in patients_in_area]

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

@router.post("/simulate", status_code=status.HTTP_201_CREATED)
def simulate_live_screening(
    db: Database = Depends(get_db),
    current_user: User = Depends(require_role(["ADMIN", "DOCTOR", "NURSE"]))
):
    villages_db = list(db.villages.find({}))
    if not villages_db:
        raise HTTPException(status_code=400, detail="No villages seeded")
    village_obj = random.choice(villages_db)
    village_id = str(village_obj["_id"])

    model_name = random.choice(['DIABETES', 'HYPERTENSION', 'MATERNAL'])
    
    first_names = ["Ramesh", "Sita", "Rajesh", "Anitha", "Gopal", "Lakshmi", "Manoj", "Vijay", "Sandhiya", "Karthik", "Preethi", "Suresh", "Radha", "Arjun", "Kavitha"]
    last_names = ["Kumar", "Devi", "Pillai", "Raj", "Krishnan", "Selvam", "Singh", "Sharma", "Nair", "Reddy", "Patel", "Murugan", "Subramanian"]
    patient_name = f"{random.choice(first_names)} {random.choice(last_names)}"
    
    if model_name == 'MATERNAL':
        gender = 'Female'
        age = random.randint(18, 40)
        pregnancies = random.randint(1, 4)
    else:
        gender = random.choice(['Male', 'Female'])
        age = random.randint(25, 78)
        pregnancies = random.randint(1, 4) if (gender == 'Female' and random.random() > 0.5) else 0

    num_patients = db.patients.count_documents({})
    patient_code = f"RH-{1000 + num_patients + 1:04d}"
    
    phone = f"+91 {random.randint(60000, 99999)} {random.randint(10000, 99999)}"
    blood_group = random.choice(["O+", "A+", "B+", "AB+", "O-", "A-", "B-"])
    
    db_patient = {
        "patient_code": patient_code,
        "name": patient_name,
        "age": age,
        "gender": gender,
        "phone": phone,
        "village_id": village_id,
        "address": f"House {random.randint(1, 100)}, Ward {random.randint(1, 10)}, {village_obj.get('name')}",
        "blood_group": blood_group,
        "emergency_contact": f"+91 {random.randint(60000, 99999)} 00000",
        "existing_disease": "None",
        "allergies": "None",
        "created_at": datetime.datetime.utcnow()
    }
    result = db.patients.insert_one(db_patient)
    db_patient["_id"] = result.inserted_id

    risk_profile = random.choice(['NORMAL', 'ELEVATED', 'HIGH_RISK'])
    if risk_profile == 'NORMAL':
        systolic, diastolic, glucose, cholesterol, insulin = random.randint(110, 125), random.randint(70, 80), random.randint(80, 105), random.randint(150, 195), random.choice([0, random.randint(15, 60)])
        weight, height, temp, hr = float(f"{random.uniform(55.0, 72.0):.2f}"), float(f"{random.uniform(1.58, 1.76):.2f}"), float(f"{random.uniform(97.8, 98.6):.1f}"), random.randint(68, 78)
    elif risk_profile == 'ELEVATED':
        systolic, diastolic, glucose, cholesterol, insulin = random.randint(128, 138), random.randint(82, 88), random.randint(110, 135), random.randint(200, 225), random.choice([0, random.randint(40, 90)])
        weight, height, temp, hr = float(f"{random.uniform(68.0, 85.0):.2f}"), float(f"{random.uniform(1.55, 1.78):.2f}"), float(f"{random.uniform(98.4, 99.2):.1f}"), random.randint(76, 88)
    else:
        systolic, diastolic, glucose, cholesterol, insulin = random.randint(142, 178), random.randint(92, 108), random.randint(145, 230), random.randint(235, 290), random.choice([0, random.randint(70, 180)])
        weight, height, temp, hr = float(f"{random.uniform(75.0, 98.0):.2f}"), float(f"{random.uniform(1.52, 1.80):.2f}"), float(f"{random.uniform(99.0, 100.8):.1f}"), random.randint(85, 106)
        
    bmi = round(weight / (height * height), 1)

    nurse = db.users.find_one({"role": "NURSE"})
    nurse_id = str(nurse["_id"]) if nurse else "2"

    db_record = {
        "patient_id": str(db_patient["_id"]),
        "recorded_by": nurse_id,
        "weight": weight,
        "height": height,
        "bmi": float(bmi),
        "blood_pressure": f"{systolic}/{diastolic}",
        "systolic_bp": systolic,
        "diastolic_bp": diastolic,
        "heart_rate": hr,
        "temperature": temp,
        "blood_glucose": glucose,
        "cholesterol": cholesterol,
        "insulin": insulin,
        "pregnancies": pregnancies,
        "smoking_status": random.choice(['NEVER', 'FORMER', 'CURRENT']),
        "recorded_at": datetime.datetime.utcnow()
    }
    r_result = db.health_records.insert_one(db_record)
    db_record["_id"] = r_result.inserted_id

    from ..ml.predictor import predict_risk
    prediction = predict_risk(db, db_record, db_patient, model_name)
    if "_id" not in prediction and "id" not in prediction:
        p_res = db.predictions.insert_one(prediction)
        prediction["_id"] = p_res.inserted_id
    
    latency_ms = random.randint(10, 24)
    
    sub_name = "Unknown"
    dist_name = "Unknown"
    try:
        if village_obj.get("subdistrict_id"):
            sub = db.subdistricts.find_one({"_id": ObjectId(village_obj["subdistrict_id"])})
            if sub:
                sub_name = sub.get("name")
                if sub.get("district_id"):
                    dist = db.districts.find_one({"_id": ObjectId(sub["district_id"])})
                    if dist:
                        dist_name = dist.get("name")
    except:
        pass

    return {
        "status": "success",
        "patient": {
            "id": str(db_patient["_id"]),
            "patient_code": db_patient["patient_code"],
            "name": db_patient["name"],
            "age": db_patient["age"],
            "gender": db_patient["gender"],
            "village": village_obj.get("name"),
            "subdistrict": sub_name,
            "district": dist_name
        },
        "health_record": {
            "blood_pressure": db_record["blood_pressure"],
            "blood_glucose": db_record["blood_glucose"],
            "bmi": float(db_record["bmi"]),
            "heart_rate": db_record["heart_rate"],
            "temperature": float(db_record["temperature"])
        },
        "prediction": {
            "id": str(prediction.get("_id", prediction.get("id", ""))),
            "model_name": prediction.get("model_name"),
            "disease": prediction.get("disease"),
            "probability": float(prediction.get("probability", 0)),
            "risk_level": prediction.get("risk_level"),
            "prediction_result": prediction.get("prediction_result"),
            "predicted_at": prediction.get("predicted_at", datetime.datetime.utcnow()).isoformat() if isinstance(prediction.get("predicted_at"), datetime.datetime) else prediction.get("predicted_at")
        },
        "telemetry": {
            "server_latency_ms": latency_ms,
            "ingestion_rate_spm": round(random.uniform(4.5, 6.2), 1),
            "node_status": "Connected",
            "offline_queue": 0
        }
    }
"""
write_file("dashboard.py", dashboard_content)

alerts_content = """from fastapi import APIRouter, Depends, HTTPException, status
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
    
    if current_user.role == 'NURSE':
        patients_in_area = list(db.patients.find({"village_id": str(current_user.village_id)}, {"_id": 1}))
        p_ids = [str(p["_id"]) for p in patients_in_area]
        filter_query["patient_id"] = {"$in": p_ids}
        filter_query["recipient_type"] = {"$in": ['NURSE', 'PATIENT']}
    elif current_user.role == 'DOCTOR':
        assigned_villages = list(db.villages.find({"subdistrict_id": str(current_user.subdistrict_id)}))
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
        if current_user.role == 'NURSE' and str(patient.get("village_id")) != str(current_user.village_id):
            raise HTTPException(status_code=403, detail="Insufficient permission")
        elif current_user.role == 'DOCTOR':
            assigned_villages = list(db.villages.find({"subdistrict_id": str(current_user.subdistrict_id)}))
            v_ids = [str(v["_id"]) for v in assigned_villages]
            if str(patient.get("village_id")) not in v_ids:
                raise HTTPException(status_code=403, detail="Insufficient permission")
                
    db.alerts.update_one({"_id": ObjectId(alert_id)}, {"$set": {"status": "READ"}})
    alert["status"] = "READ"
    return serialize_doc(alert)
"""
write_file("alerts.py", alerts_content)

followups_content = """from fastapi import APIRouter, Depends, HTTPException, status
from pymongo.database import Database
from typing import List, Optional
from datetime import date
from bson import ObjectId

from ..database import get_db
from ..schemas import Followup as FollowupSchema, FollowupCreate, FollowupUpdate, User
from .auth import get_current_user, require_role
from .patients import enforce_patient_area_access
from ..services.audit import log_audit

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
    db_followup["doctor_id"] = str(current_user.id) if current_user.role == 'DOCTOR' else "1"
    db_followup["status"] = followup_data.status or 'PENDING'
    
    result = db.followups.insert_one(db_followup)
    db_followup["_id"] = result.inserted_id
    
    log_audit(db, str(current_user.id) if hasattr(current_user, 'id') else str(current_user.get("id", "sys")), "CREATE_FOLLOWUP", "followups", str(db_followup["_id"]), f"Scheduled followup for {patient.get('name')} on {db_followup['followup_date']}")
    
    return serialize_doc(db_followup)

@router.get("", response_model=List[FollowupSchema])
def get_followups(
    status_param: Optional[str] = None, 
    db: Database = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    filter_query = {}
    
    if current_user.role == 'NURSE':
        patients_in_area = list(db.patients.find({"village_id": str(current_user.village_id)}, {"_id": 1}))
        p_ids = [str(p["_id"]) for p in patients_in_area]
        filter_query["patient_id"] = {"$in": p_ids}
    elif current_user.role == 'DOCTOR':
        assigned_villages = list(db.villages.find({"subdistrict_id": str(current_user.subdistrict_id)}))
        v_ids = [str(v["_id"]) for v in assigned_villages]
        patients_in_area = list(db.patients.find({"village_id": {"$in": v_ids}}, {"_id": 1}))
        p_ids = [str(p["_id"]) for p in patients_in_area]
        filter_query["patient_id"] = {"$in": p_ids}
        
    if status_param:
        filter_query["status"] = status_param.upper()
        
    followups = list(db.followups.find(filter_query).sort("followup_date", 1))
    return [serialize_doc(f) for f in followups]

@router.put("/{followup_id}", response_model=FollowupSchema)
def update_followup(
    followup_id: str, 
    followup_data: FollowupUpdate, 
    db: Database = Depends(get_db), 
    current_user: User = Depends(require_role(["DOCTOR", "ADMIN"]))
):
    followup = db.followups.find_one({"_id": ObjectId(followup_id)})
    if not followup:
        raise HTTPException(status_code=404, detail="Followup not found")
        
    patient = db.patients.find_one({"_id": ObjectId(followup["patient_id"])})
    if patient:
        enforce_patient_area_access(current_user, patient, db)
    
    update_fields = {}
    if followup_data.status:
        update_fields["status"] = followup_data.status.upper()
        followup["status"] = followup_data.status.upper()
    if followup_data.notes is not None:
        update_fields["notes"] = followup_data.notes
        followup["notes"] = followup_data.notes
    if followup_data.followup_date:
        update_fields["followup_date"] = followup_data.followup_date
        followup["followup_date"] = followup_data.followup_date
        
    db.followups.update_one({"_id": ObjectId(followup_id)}, {"$set": update_fields})
    
    log_audit(db, str(current_user.id) if hasattr(current_user, 'id') else str(current_user.get("id", "sys")), "UPDATE_FOLLOWUP", "followups", followup_id, f"Updated followup status={followup.get('status')} for patient {patient.get('name') if patient else 'Unknown'}")
    return serialize_doc(followup)
"""
write_file("followups.py", followups_content)

print("Migration completed!")
