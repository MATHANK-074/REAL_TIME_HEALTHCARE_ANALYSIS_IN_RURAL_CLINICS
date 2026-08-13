from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from ..models import User, Village, SubDistrict, District
from ..schemas import User as UserSchema, UserUpdate
from .auth import get_current_user, require_role
from ..services.audit import log_audit

router = APIRouter(prefix="/users", tags=["Users"])

@router.get("", response_model=List[UserSchema])
def get_users(db: Session = Depends(get_db), current_user = Depends(require_role(["ADMIN", "DOCTOR"]))):
    """Retrieve all users in the system (Admin/Doctor only)."""
    return db.query(User).all()

@router.put("/{user_id}", response_model=UserSchema)
def update_user_details(
    user_id: int, 
    update_data: UserUpdate, 
    db: Session = Depends(get_db), 
    current_user = Depends(require_role(["ADMIN"]))
):
    """Update user information (Admin only)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if update_data.name:
        user.name = update_data.name
    if update_data.email:
        # Check duplicate
        dup = db.query(User).filter(User.email == update_data.email, User.id != user_id).first()
        if dup:
            raise HTTPException(status_code=400, detail="Email already registered")
        user.email = update_data.email
    if update_data.phone is not None:
        user.phone = update_data.phone
    if update_data.district_id is not None:
        user.district_id = update_data.district_id
    if update_data.subdistrict_id is not None:
        user.subdistrict_id = update_data.subdistrict_id
    if update_data.village_id is not None:
        user.village_id = update_data.village_id
    if update_data.is_active is not None:
        user.is_active = update_data.is_active
        
    db.commit()
    db.refresh(user)
    log_audit(db, current_user.id, "UPDATE_USER", "users", user.id, f"Updated user {user.email}")
    return user

