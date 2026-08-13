from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from decimal import Decimal

from ..database import get_db
from ..models import HealthRecord, Patient, User
from ..schemas import HealthRecord as HealthRecordSchema, HealthRecordCreate
from .auth import get_current_user
from .patients import enforce_patient_area_access
from ..services.audit import log_audit

router = APIRouter(prefix="/health-records", tags=["Health Records"])

@router.post("", response_model=HealthRecordSchema, status_code=status.HTTP_201_CREATED)
def create_health_record(
    record_data: HealthRecordCreate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    """Log health measurements for a patient. Automatically calculates BMI and enforces area restrictions."""
    # Check permissions
    if current_user.role not in ['NURSE', 'ADMIN']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Nurses and Admins can log health records"
        )
        
    patient = db.query(Patient).filter(Patient.id == record_data.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
        
    enforce_patient_area_access(current_user, patient)
    
    # Auto calculate BMI if height (in meters) and weight (in kg) are provided
    bmi = record_data.bmi
    if record_data.weight and record_data.height:
        h = float(record_data.height)
        w = float(record_data.weight)
        if h > 0:
            # Check if height is entered in cm (e.g. 170 instead of 1.7)
            if h > 3.0:
                h = h / 100.0  # Convert to meters
            bmi = Decimal(w / (h * h))
            
    db_record = HealthRecord(
        patient_id=record_data.patient_id,
        recorded_by=current_user.id,
        weight=record_data.weight,
        height=record_data.height,
        bmi=bmi,
        blood_pressure=record_data.blood_pressure,
        systolic_bp=record_data.systolic_bp,
        diastolic_bp=record_data.diastolic_bp,
        heart_rate=record_data.heart_rate,
        temperature=record_data.temperature,
        blood_glucose=record_data.blood_glucose,
        cholesterol=record_data.cholesterol,
        insulin=record_data.insulin,
        pregnancies=record_data.pregnancies,
        smoking_status=record_data.smoking_status
    )
    
    db.add(db_record)
    db.commit()
    db.refresh(db_record)
    
    log_audit(db, current_user.id, "CREATE_HEALTH_RECORD", "health_records", db_record.id, f"Created health record for patient {patient.name} ({patient.patient_code})")
    
    return db_record

@router.get("/patient/{patient_id}", response_model=List[HealthRecordSchema])
def get_patient_health_records(
    patient_id: int, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    """Retrieve all health records for a specific patient, with area access checks."""
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
        
    enforce_patient_area_access(current_user, patient)
    return patient.health_records
