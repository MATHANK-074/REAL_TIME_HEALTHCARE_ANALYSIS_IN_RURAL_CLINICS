from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date

from ..database import get_db
from ..models import Followup, Patient, User
from ..schemas import Followup as FollowupSchema, FollowupCreate, FollowupUpdate
from .auth import get_current_user, require_role
from .patients import enforce_patient_area_access
from ..services.audit import log_audit

router = APIRouter(prefix="/followups", tags=["Followups"])

@router.post("", response_model=FollowupSchema, status_code=status.HTTP_201_CREATED)
def create_followup(
    followup_data: FollowupCreate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(require_role(["DOCTOR", "ADMIN"]))
):
    """Schedule a new patient follow-up review (Doctor only)."""
    patient = db.query(Patient).filter(Patient.id == followup_data.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
        
    enforce_patient_area_access(current_user, patient)
    
    db_followup = Followup(
        patient_id=followup_data.patient_id,
        doctor_id=current_user.id if current_user.role == 'DOCTOR' else 1, # default admin id
        followup_date=followup_data.followup_date,
        status=followup_data.status or 'PENDING',
        notes=followup_data.notes
    )
    
    db.add(db_followup)
    db.commit()
    db.refresh(db_followup)
    
    log_audit(db, current_user.id, "CREATE_FOLLOWUP", "followups", db_followup.id, f"Scheduled followup for {patient.name} on {db_followup.followup_date}")
    
    return db_followup

@router.get("", response_model=List[FollowupSchema])
def get_followups(
    status: Optional[str] = None, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    """Retrieve follow-ups filtered by role-based area permissions."""
    query = db.query(Followup).join(Patient)
    
    # 1. Enforce Area Restrictions
    if current_user.role == 'NURSE':
        query = query.filter(Patient.area_id == current_user.area_id)
    elif current_user.role == 'DOCTOR':
        assigned_area_ids = [a.id for a in current_user.assigned_areas]
        query = query.filter(Patient.area_id.in_(assigned_area_ids))
    # ADMIN sees all
        
    # 2. Filter by status if specified
    if status:
        query = query.filter(Followup.status == status.upper())
        
    return query.order_by(Followup.followup_date.asc()).all()

@router.put("/{followup_id}", response_model=FollowupSchema)
def update_followup(
    followup_id: int, 
    followup_data: FollowupUpdate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(require_role(["DOCTOR", "ADMIN"]))
):
    """Update follow-up status and clinic notes (Doctor only)."""
    followup = db.query(Followup).filter(Followup.id == followup_id).first()
    if not followup:
        raise HTTPException(status_code=404, detail="Followup not found")
        
    patient = followup.patient
    enforce_patient_area_access(current_user, patient)
    
    if followup_data.status:
        followup.status = followup_data.status.upper()
    if followup_data.notes is not None:
        followup.notes = followup_data.notes
    if followup_data.followup_date:
        followup.followup_date = followup_data.followup_date
        
    db.commit()
    db.refresh(followup)
    
    log_audit(db, current_user.id, "UPDATE_FOLLOWUP", "followups", followup.id, f"Updated followup status={followup.status} for patient {patient.name}")
    return followup
