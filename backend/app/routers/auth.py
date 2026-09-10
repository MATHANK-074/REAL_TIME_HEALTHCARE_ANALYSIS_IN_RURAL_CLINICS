from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from typing import List
import datetime
from bson import ObjectId

from ..database import get_db
from ..schemas import Token, UserLogin, UserCreate, User as UserSchema
from ..utils.auth import hash_password, verify_password, create_access_token, decode_access_token
from ..services.audit import log_audit

router = APIRouter(prefix="/auth", tags=["Authentication"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

def serialize_user(user: dict) -> dict:
    if user and "_id" in user:
        user["id"] = str(user.pop("_id"))
    return user

def get_current_user(token: str = Depends(oauth2_scheme), db = Depends(get_db)):
    """Dependency to retrieve and validate the currently authenticated user."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception
        
    email: str = payload.get("sub")
    if email is None:
        raise credentials_exception
        
    user = db.users.find_one({"email": email})
    if user is None:
        raise credentials_exception
        
    if not user.get("is_active"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="User account is deactivated"
        )
        
    return serialize_user(user)

def require_role(roles: List[str]):
    """Role-based authorization check decorator."""
    def role_dependency(current_user: dict = Depends(get_current_user)):
        if current_user.get("role") not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {', '.join(roles)}"
            )
        return current_user
    return role_dependency


@router.post("/register", response_model=UserSchema, status_code=status.HTTP_201_CREATED)
def register(user_data: UserCreate, db = Depends(get_db)):
    """Register a new system user (Nurse, Doctor, Admin)."""
    # Check if email exists
    existing_user = db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email address already registered"
        )
        
    # Check if district exists if specified
    if user_data.district_id:
        try:
            district_obj_id = ObjectId(user_data.district_id)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid district ID")
        district = db.districts.find_one({"_id": district_obj_id})
        if not district:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Selected district does not exist"
            )

    # Check if subdistrict exists if specified
    if user_data.subdistrict_id:
        try:
            subdistrict_obj_id = ObjectId(user_data.subdistrict_id)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid subdistrict ID")
        subdistrict = db.subdistricts.find_one({"_id": subdistrict_obj_id})
        if not subdistrict:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Selected subdistrict does not exist"
            )
            
    # Check if village exists if specified
    if user_data.village_id:
        try:
            village_obj_id = ObjectId(user_data.village_id)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid village ID")
        village = db.villages.find_one({"_id": village_obj_id})
        if not village:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Selected village does not exist"
            )

    # Check if area exists if specified
    if user_data.area_id:
        try:
            area_obj_id = ObjectId(user_data.area_id)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid area ID")
        area = db.areas.find_one({"_id": area_obj_id})
        if not area:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Selected area does not exist"
            )

    # Check if clinic exists if specified
    if user_data.clinic_id:
        try:
            clinic_obj_id = ObjectId(user_data.clinic_id)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid clinic ID")
        clinic = db.clinics.find_one({"_id": clinic_obj_id})
        if not clinic:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Selected clinic does not exist"
            )

    hashed_pw = hash_password(user_data.password)
    
    new_user = {
        "name": user_data.name,
        "email": user_data.email,
        "password_hash": hashed_pw,
        "role": user_data.role.upper(),
        "phone": user_data.phone,
        "district_id": user_data.district_id,
        "subdistrict_id": user_data.subdistrict_id,
        "village_id": user_data.village_id,
        "area_id": user_data.area_id,
        "clinic_id": user_data.clinic_id,
        "qualification": user_data.qualification,
        "is_active": True,
        "created_at": datetime.datetime.utcnow(),
        "updated_at": datetime.datetime.utcnow()
    }
    
    result = db.users.insert_one(new_user)
    new_user["_id"] = result.inserted_id
    new_user_serialized = serialize_user(new_user)
    
    # Audit log registration
    log_audit(db, new_user_serialized["id"], "REGISTER_USER", "users", new_user_serialized["id"], f"Registered user email={new_user_serialized['email']} role={new_user_serialized['role']}")
    
    return new_user_serialized


@router.post("/login", response_model=Token)
def login(login_data: UserLogin, db = Depends(get_db)):
    """Authenticate credentials and return a JWT access token."""
    user = db.users.find_one({"email": login_data.email})
    if not user or not verify_password(login_data.password, user.get("password_hash")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    if not user.get("is_active"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated"
        )

    user = serialize_user(user)

    # Issue access token
    access_token = create_access_token(
        data={"sub": user["email"], "role": user["role"]}
    )
    
    log_audit(db, user["id"], "LOGIN", "users", user["id"], f"Successful login from email={user['email']}")
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user["role"],
        "name": user["name"],
        "email": user["email"]
    }


@router.get("/me", response_model=UserSchema)
def get_me(current_user: dict = Depends(get_current_user)):
    """Get profile details of the current logged-in user."""
    return current_user
