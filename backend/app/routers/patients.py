from fastapi import APIRouter, Depends, HTTPException, status
from pymongo.database import Database
from typing import List, Optional
from bson import ObjectId
import datetime

from ..database import get_db
from ..schemas import Patient as PatientSchema, PatientCreate, User
from .auth import get_current_user
from ..utils.auth import hash_password
from ..services.audit import log_audit

router = APIRouter(prefix="/patients", tags=["Patients"])

def enforce_patient_area_access(current_user: User, patient: dict, db: Database):
    """Enforce that nurse/doctor only access patients in their assigned locations."""
    if current_user.get("role") == 'ADMIN':
        return
        
    if current_user.get("role") == 'NURSE':
        user_area = current_user.get("area_id")
        user_village = current_user.get("village_id")
        
        if user_area:
            if str(patient.get("area_id")) != str(user_area):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied. Patient is in a different Area."
                )
        elif user_village:
            if str(patient.get("village_id")) != str(user_village):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied. Patient belongs to another nurse's assigned village."
                )
            
    elif current_user.get("role") == 'DOCTOR':
        user_clinic = current_user.get("clinic_id")
        user_sub = current_user.get("subdistrict_id")
        
        if user_clinic:
            if str(patient.get("clinic_id")) != str(user_clinic):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied. Patient does not belong to your assigned Clinic."
                )
        elif user_sub:
            assigned_villages = list(db.villages.find({"subdistrict_id": str(user_sub)}))
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
    """Retrieve patients accessible to the current user (based on role/assigned location)."""
    filter_query = {}
    
    # 1. Enforce Role-Based Area Restrictions
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
    """Retrieve a specific patient's details with location access checking."""
    patient = db.patients.find_one({"_id": ObjectId(patient_id)})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
        
    enforce_patient_area_access(current_user, patient, db)
    
    # Enrich with Location Names
    if patient.get("village_id"):
        v = db.villages.find_one({"_id": ObjectId(patient["village_id"])})
        if v:
            patient["village"] = v.get("name")
            sub = db.subdistricts.find_one({"_id": ObjectId(v.get("subdistrict_id"))})
            if sub:
                patient["subdistrict"] = sub.get("name")
                dist = db.districts.find_one({"_id": ObjectId(sub.get("district_id"))})
                if dist:
                    patient["district"] = dist.get("name")
                    
    if patient.get("area_id"):
        a = db.areas.find_one({"_id": ObjectId(patient["area_id"])})
        if a:
            patient["area_name"] = a.get("name")
            
    if patient.get("clinic_id"):
        c = db.clinics.find_one({"_id": ObjectId(patient["clinic_id"])})
        if c:
            patient["clinic_name"] = c.get("clinic_name")
            
    # Enrich with Assigned Nurse / Doctor
    # Find Nurse for this patient's area/village
    nurse_query = {"role": "NURSE"}
    if patient.get("area_id"):
        nurse_query["area_id"] = patient["area_id"]
    elif patient.get("village_id"):
        nurse_query["village_id"] = patient["village_id"]
    nurses = list(db.users.find(nurse_query))
    if nurses:
        patient["assigned_nurse"] = ", ".join([n.get("name") for n in nurses])
        
    doctor_query = {"role": "DOCTOR"}
    if patient.get("clinic_id"):
        doctor_query["clinic_id"] = patient["clinic_id"]
    elif v and v.get("subdistrict_id"):
        doctor_query["subdistrict_id"] = v.get("subdistrict_id")
    doctors = list(db.users.find(doctor_query))
    if doctors:
        patient["assigned_doctor"] = ", ".join([d.get("name") for d in doctors])
        
    return serialize_doc(patient)

@router.post("", response_model=PatientSchema, status_code=status.HTTP_201_CREATED)
def create_patient(patient_data: PatientCreate, db: Database = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Register a new patient. Auto-generates patient code and enforces location restrictions."""
    if current_user.get("role") not in ['NURSE', 'ADMIN']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Nurses and Admins can register patients"
        )
        
    target_village_id = patient_data.village_id
    if current_user.get("role") == 'NURSE':
        target_village_id = current_user.get("village_id")
        
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
    patient_id_str = str(result.inserted_id)
    
    # Auto-create User account for patient portal
    patient_email = f"{patient_code.lower()}@ruralcare.com"
    raw_password = patient_data.phone if patient_data.phone else "password123"
    hashed_pw = hash_password(raw_password)
    
    new_user = {
        "name": patient_data.name,
        "email": patient_email,
        "password_hash": hashed_pw,
        "role": "PATIENT",
        "phone": patient_data.phone,
        "village_id": str(target_village_id),
        "area_id": patient_data.area_id,
        "clinic_id": patient_data.clinic_id,
        "patient_id": patient_id_str,
        "is_active": True,
        "created_at": datetime.datetime.utcnow(),
        "updated_at": datetime.datetime.utcnow()
    }
    db.users.insert_one(new_user)
    
    log_audit(db, str(current_user.id) if hasattr(current_user, 'id') else str(current_user.get("id", "sys")), "CREATE_PATIENT", "patients", str(db_patient["_id"]), f"Registered patient {db_patient['name']} ({patient_code})")
    
    return serialize_doc(db_patient)

@router.put("/{patient_id}", response_model=PatientSchema)
def update_patient(patient_id: str, patient_data: PatientCreate, db: Database = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Update patient demographics. Enforces location checks."""
    patient = db.patients.find_one({"_id": ObjectId(patient_id)})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
        
    enforce_patient_area_access(current_user, patient, db)
    
    update_data = patient_data.dict(exclude_unset=True)
    if current_user.get("role") != 'ADMIN':
        update_data.pop("village_id", None)
    if "village_id" in update_data:
        update_data["village_id"] = str(update_data["village_id"])
        
    db.patients.update_one({"_id": ObjectId(patient_id)}, {"$set": update_data})
    patient.update(update_data)
    
    log_audit(db, str(current_user.id) if hasattr(current_user, 'id') else str(current_user.get("id", "sys")), "UPDATE_PATIENT", "patients", patient_id, f"Updated patient {patient.get('name')} ({patient.get('patient_code', '')})")
    return serialize_doc(patient)
