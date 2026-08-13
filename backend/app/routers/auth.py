from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from typing import List
import datetime

from ..database import get_db
from ..models import User, District, SubDistrict, Village
from ..schemas import Token, UserLogin, UserCreate, User as UserSchema
from ..utils.auth import hash_password, verify_password, create_access_token, decode_access_token
from ..services.audit import log_audit

router = APIRouter(prefix="/auth", tags=["Authentication"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
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
        
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise credentials_exception
        
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="User account is deactivated"
        )
        
    return user

def require_role(roles: List[str]):
    """Role-based authorization check decorator."""
    def role_dependency(current_user: User = Depends(get_current_user)):
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {', '.join(roles)}"
            )
        return current_user
    return role_dependency


@router.post("/register", response_model=UserSchema, status_code=status.HTTP_201_CREATED)
def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """Register a new system user (Nurse, Doctor, Admin)."""
    # Check if email exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email address already registered"
        )
        
    # Check if district exists if specified
    if user_data.district_id:
        district = db.query(District).filter(District.id == user_data.district_id).first()
        if not district:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Selected district does not exist"
            )

    # Check if subdistrict exists if specified
    if user_data.subdistrict_id:
        subdistrict = db.query(SubDistrict).filter(SubDistrict.id == user_data.subdistrict_id).first()
        if not subdistrict:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Selected subdistrict does not exist"
            )
            
    # Check if village exists if specified
    if user_data.village_id:
        village = db.query(Village).filter(Village.id == user_data.village_id).first()
        if not village:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Selected village does not exist"
            )

    hashed_pw = hash_password(user_data.password)
    
    new_user = User(
        name=user_data.name,
        email=user_data.email,
        password_hash=hashed_pw,
        role=user_data.role.upper(),
        phone=user_data.phone,
        district_id=user_data.district_id,
        subdistrict_id=user_data.subdistrict_id,
        village_id=user_data.village_id,
        qualification=user_data.qualification,
        is_active=True
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Audit log registration
    log_audit(db, new_user.id, "REGISTER_USER", "users", new_user.id, f"Registered user email={new_user.email} role={new_user.role}")
    
    return new_user


@router.post("/login", response_model=Token)
def login(login_data: UserLogin, db: Session = Depends(get_db)):
    """Authenticate credentials and return a JWT access token."""
    user = db.query(User).filter(User.email == login_data.email).first()
    if not user or not verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated"
        )

    # Issue access token
    access_token = create_access_token(
        data={"sub": user.email, "role": user.role}
    )
    
    log_audit(db, user.id, "LOGIN", "users", user.id, f"Successful login from email={user.email}")
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role,
        "name": user.name,
        "email": user.email
    }


@router.get("/me", response_model=UserSchema)
def get_me(current_user: User = Depends(get_current_user)):
    """Get profile details of the current logged-in user."""
    return current_user
