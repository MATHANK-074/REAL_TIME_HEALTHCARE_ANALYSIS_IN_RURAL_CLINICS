from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from bson import ObjectId

from ..database import get_db
from ..schemas import User as UserSchema, UserUpdate
from .auth import get_current_user, require_role
from ..services.audit import log_audit

router = APIRouter(prefix="/users", tags=["Users"])

def serialize_user(user: dict) -> dict:
    if user and "_id" in user:
        user["id"] = str(user.pop("_id"))
    return user

@router.get("", response_model=List[UserSchema])
def get_users(db = Depends(get_db), current_user = Depends(require_role(["ADMIN", "DOCTOR"]))):
    """Retrieve all users in the system (Admin/Doctor only)."""
    users = list(db.users.find({}))
    for user in users:
        serialize_user(user)
    return users

@router.put("/{user_id}", response_model=UserSchema)
def update_user_details(
    user_id: str, 
    update_data: UserUpdate, 
    db = Depends(get_db), 
    current_user = Depends(require_role(["ADMIN"]))
):
    """Update user information (Admin only)."""
    try:
        user_obj_id = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user ID format")

    user = db.users.find_one({"_id": user_obj_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    update_fields = {}
    if update_data.name:
        update_fields["name"] = update_data.name
    if update_data.email:
        # Check duplicate
        dup = db.users.find_one({"email": update_data.email, "_id": {"$ne": user_obj_id}})
        if dup:
            raise HTTPException(status_code=400, detail="Email already registered")
        update_fields["email"] = update_data.email
    if update_data.phone is not None:
        update_fields["phone"] = update_data.phone
    if update_data.district_id is not None:
        update_fields["district_id"] = update_data.district_id
    if update_data.subdistrict_id is not None:
        update_fields["subdistrict_id"] = update_data.subdistrict_id
    if update_data.village_id is not None:
        update_fields["village_id"] = update_data.village_id
    if update_data.area_id is not None:
        update_fields["area_id"] = update_data.area_id
    if update_data.clinic_id is not None:
        update_fields["clinic_id"] = update_data.clinic_id
    if update_data.is_active is not None:
        update_fields["is_active"] = update_data.is_active
        
    if update_fields:
        db.users.update_one({"_id": user_obj_id}, {"$set": update_fields})
        user.update(update_fields)
        
    log_audit(db, current_user.get("id"), "UPDATE_USER", "users", user_id, f"Updated user {user.get('email')}")
    return serialize_user(user)
