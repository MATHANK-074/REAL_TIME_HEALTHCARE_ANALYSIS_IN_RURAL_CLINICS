from pydantic import BaseModel, EmailStr
from typing import Optional, List, Any
from datetime import datetime, date
from decimal import Decimal

# Location Schemas
class DistrictBase(BaseModel):
    name: str

class DistrictCreate(DistrictBase):
    pass

class District(DistrictBase):
    id: int
    created_at: datetime

    class Config:
        orm_mode = True
        from_attributes = True

class SubDistrictBase(BaseModel):
    name: str
    district_id: int

class SubDistrictCreate(SubDistrictBase):
    pass

class SubDistrict(SubDistrictBase):
    id: int
    created_at: datetime

    class Config:
        orm_mode = True
        from_attributes = True

class VillageBase(BaseModel):
    name: str
    subdistrict_id: int

class VillageCreate(VillageBase):
    pass

class Village(VillageBase):
    id: int
    created_at: datetime

    class Config:
        orm_mode = True
        from_attributes = True


# User Schemas
class UserBase(BaseModel):
    name: str
    email: EmailStr
    role: str
    phone: Optional[str] = None
    district_id: Optional[int] = None
    subdistrict_id: Optional[int] = None
    village_id: Optional[int] = None
    qualification: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    district_id: Optional[int] = None
    subdistrict_id: Optional[int] = None
    village_id: Optional[int] = None
    qualification: Optional[str] = None
    is_active: Optional[bool] = None

class User(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True
        from_attributes = True

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    name: str
    email: str

class TokenData(BaseModel):
    email: Optional[str] = None
    role: Optional[str] = None


# Patient Schemas
class PatientBase(BaseModel):
    name: str
    age: int
    gender: str
    phone: Optional[str] = None
    village_id: Optional[int] = None
    address: Optional[str] = None
    blood_group: Optional[str] = None
    emergency_contact: Optional[str] = None
    existing_disease: Optional[str] = None
    allergies: Optional[str] = None

class PatientCreate(PatientBase):
    pass

class Patient(PatientBase):
    id: int
    patient_code: str
    created_at: datetime
    updated_at: datetime
    village: Optional[Village] = None

    class Config:
        orm_mode = True
        from_attributes = True


# Health Record Schemas
class HealthRecordBase(BaseModel):
    patient_id: int
    weight: Optional[Decimal] = None
    height: Optional[Decimal] = None
    bmi: Optional[Decimal] = None
    blood_pressure: Optional[str] = None
    systolic_bp: Optional[int] = None
    diastolic_bp: Optional[int] = None
    heart_rate: Optional[int] = None
    temperature: Optional[Decimal] = None
    blood_glucose: Optional[int] = None
    cholesterol: Optional[int] = None
    insulin: Optional[int] = None
    pregnancies: Optional[int] = 0
    smoking_status: Optional[str] = 'NEVER'

class HealthRecordCreate(HealthRecordBase):
    pass

class HealthRecord(HealthRecordBase):
    id: int
    recorded_by: int
    recorded_at: datetime

    class Config:
        orm_mode = True
        from_attributes = True


# Prediction Factors
class PredictionFactorBase(BaseModel):
    feature_name: str
    feature_value: str
    importance: Decimal
    direction: int

class PredictionFactor(PredictionFactorBase):
    id: int
    prediction_id: int

    class Config:
        orm_mode = True
        from_attributes = True


# Prediction Schemas
class PredictionBase(BaseModel):
    patient_id: int
    health_record_id: int
    model_name: str
    disease: str
    probability: Decimal
    risk_level: str
    prediction_result: Optional[str] = None
    model_version: str

class PredictionCreate(PredictionBase):
    pass

class Prediction(PredictionBase):
    id: int
    predicted_at: datetime
    factors: List[PredictionFactor] = []

    class Config:
        orm_mode = True
        from_attributes = True


# Alert Schemas
class AlertBase(BaseModel):
    patient_id: int
    prediction_id: Optional[int] = None
    alert_type: str
    recipient_type: str
    message: str
    channel: Optional[str] = 'DASHBOARD'
    status: Optional[str] = 'UNREAD'

class Alert(AlertBase):
    id: int
    created_at: datetime
    sent_at: Optional[datetime] = None

    class Config:
        orm_mode = True
        from_attributes = True


# Followup Schemas
class FollowupBase(BaseModel):
    patient_id: int
    followup_date: date
    notes: Optional[str] = None
    status: Optional[str] = 'PENDING'

class FollowupCreate(FollowupBase):
    pass

class FollowupUpdate(BaseModel):
    followup_date: Optional[date] = None
    notes: Optional[str] = None
    status: Optional[str] = None

class Followup(FollowupBase):
    id: int
    doctor_id: int
    created_at: datetime
    updated_at: datetime
    patient: Optional[Patient] = None

    class Config:
        orm_mode = True
        from_attributes = True


# Audit Log Schemas
class AuditLogBase(BaseModel):
    user_id: int
    action: str
    entity_type: str
    entity_id: Optional[int] = None
    details: Optional[str] = None

class AuditLog(AuditLogBase):
    id: int
    timestamp: datetime

    class Config:
        orm_mode = True
        from_attributes = True


