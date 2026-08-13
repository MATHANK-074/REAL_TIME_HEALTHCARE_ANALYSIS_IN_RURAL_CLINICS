from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

from ..database import get_db
from ..models import Alert, Patient, User
from ..schemas import Alert as AlertSchema
from .auth import get_current_user

router = APIRouter(prefix="/alerts", tags=["Alerts"])

@router.get("", response_model=List[AlertSchema])
def get_alerts(
    status: Optional[str] = None, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    """Retrieve alerts based on user role and area permissions."""
    query = db.query(Alert).join(Patient)
    
    # 1. Enforce Area Permissions
    if current_user.role == 'NURSE':
        query = query.filter(Patient.area_id == current_user.area_id)
        # Nurses see alerts relevant to nurses/patients
        query = query.filter(Alert.recipient_type.in_(['NURSE', 'PATIENT']))
    elif current_user.role == 'DOCTOR':
        assigned_area_ids = [a.id for a in current_user.assigned_areas]
        query = query.filter(Patient.area_id.in_(assigned_area_ids))
        # Doctors see doctor-directed alerts
        query = query.filter(Alert.recipient_type == 'DOCTOR')
    # ADMIN sees everything
        
    # 2. Filter by status if specified
    if status:
        query = query.filter(Alert.status == status.upper())
        
    return query.order_by(Alert.id.desc()).all()

@router.patch("/{alert_id}/read", response_model=AlertSchema)
def mark_alert_read(
    alert_id: int, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    """Mark a notification alert as read."""
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
        
    # Check patient area access
    patient = alert.patient
    if current_user.role == 'NURSE' and patient.area_id != current_user.area_id:
        raise HTTPException(status_code=403, detail="Insufficient permission")
    elif current_user.role == 'DOCTOR':
        assigned_ids = [a.id for a in current_user.assigned_areas]
        if patient.area_id not in assigned_ids:
            raise HTTPException(status_code=403, detail="Insufficient permission")
            
    alert.status = 'READ'
    db.commit()
    db.refresh(alert)
    return alert
