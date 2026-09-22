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
        
    try:
        patient_obj_id = ObjectId(record_data.patient_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid patient ID format")

    patient = db.patients.find_one({"_id": patient_obj_id})
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
    if db_record.get("weight") is not None: db_record["weight"] = float(db_record["weight"])
    if db_record.get("height") is not None: db_record["height"] = float(db_record["height"])
    if db_record.get("temperature") is not None: db_record["temperature"] = float(db_record["temperature"])
    db_record["bmi"] = float(bmi) if bmi else None
    
    # Parse blood_pressure into systolic and diastolic for ML models
    bp = db_record.get("blood_pressure")
    if bp and "/" in bp:
        try:
            sys_val, dia_val = bp.split("/")
            db_record["systolic_bp"] = int(sys_val.strip())
            db_record["diastolic_bp"] = int(dia_val.strip())
        except Exception:
            pass
            
    # Map blood sugar to blood_glucose for ML models
    if db_record.get("blood_sugar_fasting"):
        db_record["blood_glucose"] = int(float(db_record["blood_sugar_fasting"]))
    elif db_record.get("blood_sugar_random"):
        db_record["blood_glucose"] = int(float(db_record["blood_sugar_random"]))

    db_record["recorded_by"] = str(current_user.id) if hasattr(current_user, 'id') else str(current_user.get("id", "sys"))
    db_record["recorded_at"] = datetime.datetime.utcnow()
    db_record["review_status"] = "PENDING_REVIEW"
    db_record["reviewed_by"] = None
    db_record["reviewed_at"] = None
    db_record["doctor_notes"] = None
    
    result = db.health_records.insert_one(db_record)
    db_record["_id"] = result.inserted_id
    
    log_audit(db, db_record["recorded_by"], "CREATE_HEALTH_RECORD", "health_records", str(db_record["_id"]), f"Created health record for patient {patient.get('name')} ({patient.get('patient_code')})")
    
    # Step 1: Run Clinical Support Engine (Triggers predictions + recommendation)
    try:
        from ..services.clinical_support_service import generate_recommendation
        generate_recommendation(db, db_record, patient)
    except Exception as e:
        print(f"[REC_ERROR] Failed to generate recommendation: {e}")
    
    # Step 2: Notify assigned doctor
    try:
        from ..services.notification_service import notify_health_review_required
        notify_health_review_required(db, db_record, patient)
    except Exception as e:
        print(f"[NOTIF_ERROR] Failed to send notification: {e}")

    return serialize_doc(db_record)


@router.get("/patient/{patient_id}", response_model=List[HealthRecordSchema])
def get_patient_health_records(
    patient_id: str, 
    db: Database = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    try:
        patient_obj_id = ObjectId(patient_id)
    except Exception:
        patient_obj_id = patient_id

    patient = db.patients.find_one({"_id": patient_obj_id})
    if not patient:
        patient = db.patients.find_one({"_id": str(patient_id)})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
        
    enforce_patient_area_access(current_user, patient, db)
    
    p_id_query = [str(patient_id)]
    if ObjectId.is_valid(str(patient_id)):
        p_id_query.append(ObjectId(str(patient_id)))

    records = list(db.health_records.find({"patient_id": {"$in": p_id_query}}).sort("recorded_at", -1))
    return [serialize_doc(r) for r in records]

@router.get("/pending-review", response_model=List[HealthRecordSchema])
def get_pending_reviews(
    db: Database = Depends(get_db), 
    current_user: User = Depends(require_role(["DOCTOR", "ADMIN"]))
):
    """Retrieve all health records pending review for the Doctor's assigned location."""
    filter_query = {"review_status": "PENDING_REVIEW"}
    
    if current_user.get("role") == 'DOCTOR':
        clinic_id = current_user.get("clinic_id")
        subdistrict_id = current_user.get("subdistrict_id")
        
        if clinic_id and not subdistrict_id:
            try:
                c = db.clinics.find_one({"_id": ObjectId(clinic_id)})
                if not c:
                    c = db.clinics.find_one({"_id": str(clinic_id)})
                if c and c.get("subdistrict_id"):
                    subdistrict_id = str(c["subdistrict_id"])
            except Exception:
                pass

        query_conditions = []
        if clinic_id:
            c_str = str(clinic_id)
            c_query = [c_str]
            if ObjectId.is_valid(c_str):
                c_query.append(ObjectId(c_str))
            query_conditions.append({"clinic_id": {"$in": c_query}})
        if subdistrict_id:
            sub_str = str(subdistrict_id)
            sub_query = [sub_str]
            if ObjectId.is_valid(sub_str):
                sub_query.append(ObjectId(sub_str))
            assigned_villages = list(db.villages.find({"subdistrict_id": {"$in": sub_query}}))
            assigned_village_ids = []
            for v in assigned_villages:
                vid_str = str(v["_id"])
                assigned_village_ids.append(vid_str)
                if ObjectId.is_valid(vid_str):
                    assigned_village_ids.append(ObjectId(vid_str))
            if assigned_village_ids:
                query_conditions.append({"village_id": {"$in": assigned_village_ids}})
            query_conditions.append({"subdistrict_id": {"$in": sub_query}})

        if query_conditions:
            patients = list(db.patients.find({"$or": query_conditions}, {"_id": 1}))
            p_ids = []
            for p in patients:
                pid_str = str(p["_id"])
                p_ids.append(pid_str)
                if ObjectId.is_valid(pid_str):
                    p_ids.append(ObjectId(pid_str))
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
