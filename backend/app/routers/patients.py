from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

from ..database import get_db
from ..models import Patient, User, Village
from ..schemas import Patient as PatientSchema, PatientCreate
from .auth import get_current_user
from ..services.audit import log_audit

router = APIRouter(prefix="/patients", tags=["Patients"])

def enforce_patient_area_access(current_user: User, patient: Patient, db: Session):
    """Enforce that nurse/doctor only access patients in their assigned locations."""
    if current_user.role == 'ADMIN':
        return
        
    if current_user.role == 'NURSE':
        if patient.village_id != current_user.village_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. Patient belongs to another nurse's assigned village."
            )
            
    elif current_user.role == 'DOCTOR':
        assigned_villages = db.query(Village).filter(Village.subdistrict_id == current_user.subdistrict_id).all()
        assigned_village_ids = [v.id for v in assigned_villages]
        if patient.village_id not in assigned_village_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. Patient belongs to a village outside your jurisdiction."
            )

@router.get("", response_model=List[PatientSchema])
def get_patients(
    search: Optional[str] = None, 
    village_id: Optional[int] = None,
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    """Retrieve patients accessible to the current user (based on role/assigned location)."""
    query = db.query(Patient)
    
    # 1. Enforce Role-Based Area Restrictions
    if current_user.role == 'NURSE':
        query = query.filter(Patient.village_id == current_user.village_id)
    elif current_user.role == 'DOCTOR':
        assigned_villages = db.query(Village).filter(Village.subdistrict_id == current_user.subdistrict_id).all()
        assigned_village_ids = [v.id for v in assigned_villages]
        query = query.filter(Patient.village_id.in_(assigned_village_ids))
    # ADMIN has no filters
    
    # 2. Apply optional filters
    if village_id:
        query = query.filter(Patient.village_id == village_id)
        
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (Patient.name.like(search_filter)) | 
            (Patient.patient_code.like(search_filter)) |
            (Patient.phone.like(search_filter))
        )
        
    return query.order_by(Patient.id.desc()).all()

@router.get("/{patient_id}", response_model=PatientSchema)
def get_patient(patient_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Retrieve a specific patient's details with location access checking."""
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
        
    enforce_patient_area_access(current_user, patient, db)
    return patient

@router.post("", response_model=PatientSchema, status_code=status.HTTP_201_CREATED)
def create_patient(patient_data: PatientCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Register a new patient. Auto-generates patient code and enforces location restrictions."""
    # Check permissions
    if current_user.role not in ['NURSE', 'ADMIN']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Nurses and Admins can register patients"
        )
        
    # Enforce Nurse registration is limited to their own village
    target_village_id = patient_data.village_id
    
    if current_user.role == 'NURSE':
        target_village_id = current_user.village_id
        
    if not target_village_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A village must be specified for the patient"
        )
        
    # Generate Patient ID (RH-XXXX)
    last_patient = db.query(Patient).order_by(Patient.id.desc()).first()
    next_num = (last_patient.id + 1) if last_patient else 1
    patient_code = f"RH-{next_num:04d}"

    # Verify patient phone doesn't exist
    if patient_data.phone:
        dup = db.query(Patient).filter(Patient.phone == patient_data.phone).first()
        if dup:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"A patient is already registered with mobile number {patient_data.phone}"
            )
            
    db_patient = Patient(
        patient_code=patient_code,
        name=patient_data.name,
        age=patient_data.age,
        gender=patient_data.gender,
        phone=patient_data.phone,
        village_id=target_village_id,
        address=patient_data.address,
        blood_group=patient_data.blood_group,
        emergency_contact=patient_data.emergency_contact,
        existing_disease=patient_data.existing_disease,
        allergies=patient_data.allergies
    )
    
    db.add(db_patient)
    db.commit()
    db.refresh(db_patient)
    
    # Audit log patient creation
    log_audit(db, current_user.id, "CREATE_PATIENT", "patients", db_patient.id, f"Registered patient {db_patient.name} ({db_patient.patient_code})")
    
    return db_patient

@router.put("/{patient_id}", response_model=PatientSchema)
def update_patient(patient_id: int, patient_data: PatientCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Update patient demographics. Enforces location checks."""
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
        
    enforce_patient_area_access(current_user, patient, db)
    
    # Update fields
    patient.name = patient_data.name
    patient.age = patient_data.age
    patient.gender = patient_data.gender
    patient.phone = patient_data.phone
    patient.address = patient_data.address
    patient.blood_group = patient_data.blood_group
    patient.emergency_contact = patient_data.emergency_contact
    patient.existing_disease = patient_data.existing_disease
    patient.allergies = patient_data.allergies
    
    if current_user.role == 'ADMIN':
        patient.village_id = patient_data.village_id
        
    db.commit()
    db.refresh(patient)
    
    log_audit(db, current_user.id, "UPDATE_PATIENT", "patients", patient.id, f"Updated patient {patient.name} ({patient.patient_code})")
    return patient
