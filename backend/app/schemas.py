from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Any
from datetime import datetime, date
from decimal import Decimal

# Base model to handle MongoDB ObjectId as string
class MongoBaseModel(BaseModel):
    id: Optional[str] = None

    class Config:
        orm_mode = True
        from_attributes = True


# Location Schemas
class DistrictBase(BaseModel):
    name: str

class DistrictCreate(DistrictBase):
    pass

class District(DistrictBase, MongoBaseModel):
    created_at: datetime

class SubDistrictBase(BaseModel):
    name: str
    district_id: str

class SubDistrictCreate(SubDistrictBase):
    pass

class SubDistrict(SubDistrictBase, MongoBaseModel):
    created_at: datetime

class VillageBase(BaseModel):
    name: str
    subdistrict_id: str

class VillageCreate(VillageBase):
    pass

class Village(VillageBase, MongoBaseModel):
    created_at: datetime


# Area Schemas (New)
class AreaBase(BaseModel):
    name: str
    village_id: str

class AreaCreate(AreaBase):
    pass

class Area(AreaBase, MongoBaseModel):
    created_at: datetime


# Clinic Schemas (New)
class ClinicBase(BaseModel):
    clinic_code: str
    clinic_name: str
    district_id: str
    subdistrict_id: str
    village_id: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    address: Optional[str] = None
    contact_number: Optional[str] = None
    is_active: Optional[bool] = True

class ClinicCreate(ClinicBase):
    pass

class Clinic(ClinicBase, MongoBaseModel):
    pass


# User Schemas
class UserBase(BaseModel):
    name: str
    email: EmailStr
    role: str
    phone: Optional[str] = None
    district_id: Optional[str] = None
    subdistrict_id: Optional[str] = None
    village_id: Optional[str] = None
    area_id: Optional[str] = None
    clinic_id: Optional[str] = None
    qualification: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    district_id: Optional[str] = None
    subdistrict_id: Optional[str] = None
    village_id: Optional[str] = None
    area_id: Optional[str] = None
    clinic_id: Optional[str] = None
    qualification: Optional[str] = None
    is_active: Optional[bool] = None

class User(UserBase, MongoBaseModel):
    is_active: bool
    created_at: datetime
    updated_at: datetime

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
    village_id: Optional[str] = None
    area_id: Optional[str] = None
    clinic_id: Optional[str] = None
    address: Optional[str] = None
    blood_group: Optional[str] = None
    emergency_contact: Optional[str] = None
    existing_disease: Optional[str] = None
    allergies: Optional[str] = None

class PatientCreate(PatientBase):
    pass

class Patient(PatientBase, MongoBaseModel):
    patient_code: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    village: Optional[Village] = None


# Health Record Schemas
class HealthRecordBase(BaseModel):
    patient_id: str
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
    symptoms: Optional[str] = None
    clinical_notes: Optional[str] = None
    review_status: Optional[str] = 'PENDING_REVIEW'
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    doctor_notes: Optional[str] = None

class HealthRecordReviewUpdate(BaseModel):
    review_status: str
    doctor_notes: Optional[str] = None

class HealthRecordCreate(HealthRecordBase):
    pass

class HealthRecord(HealthRecordBase, MongoBaseModel):
    recorded_by: str
    recorded_at: datetime


# Prediction Factors
class PredictionFactorBase(BaseModel):
    feature_name: str
    feature_value: str
    importance: Decimal
    direction: int

class PredictionFactor(PredictionFactorBase, MongoBaseModel):
    prediction_id: str


# Prediction Schemas
class PredictionBase(BaseModel):
    patient_id: str
    health_record_id: str
    model_name: str
    disease: str
    probability: Decimal
    risk_level: str
    prediction_result: Optional[str] = None
    model_version: str

class PredictionCreate(PredictionBase):
    pass

class Prediction(PredictionBase, MongoBaseModel):
    predicted_at: datetime
    factors: List[PredictionFactor] = []


# Alert Schemas
class AlertBase(BaseModel):
    patient_id: str
    prediction_id: Optional[str] = None
    alert_type: str
    recipient_type: str
    message: str
    channel: Optional[str] = 'DASHBOARD'
    status: Optional[str] = 'UNREAD'

class Alert(AlertBase, MongoBaseModel):
    created_at: datetime
    sent_at: Optional[datetime] = None


# Followup Schemas
class FollowupBase(BaseModel):
    patient_id: str
    followup_date: date
    notes: Optional[str] = None
    status: Optional[str] = 'PENDING'
    priority: Optional[str] = 'MEDIUM'
    reason: Optional[str] = None

class FollowupCreate(FollowupBase):
    pass

class FollowupUpdate(BaseModel):
    followup_date: Optional[date] = None
    notes: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    reason: Optional[str] = None

class Followup(FollowupBase, MongoBaseModel):
    doctor_id: str
    nurse_id: Optional[str] = None
    clinic_id: Optional[str] = None
    area_id: Optional[str] = None
    village_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None
    patient: Optional[Patient] = None


# Audit Log Schemas
class AuditLogBase(BaseModel):
    user_id: str
    action: str
    entity_type: str
    entity_id: Optional[str] = None
    details: Optional[str] = None

class AuditLog(AuditLogBase, MongoBaseModel):
    timestamp: datetime


# FieldVisit Schemas (New)
class FieldVisitBase(BaseModel):
    nurse_id: str
    patient_id: str
    clinic_id: Optional[str] = None
    area_id: Optional[str] = None
    village_id: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    accuracy: Optional[float] = None
    visit_type: Optional[str] = 'REGULAR'
    notes: Optional[str] = None
    status: Optional[str] = 'STARTED'
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

class FieldVisitCreate(FieldVisitBase):
    pass

class FieldVisit(FieldVisitBase, MongoBaseModel):
    created_at: datetime

# Notification Schema
class Notification(BaseModel):
    id: Optional[str] = None
    recipient_id: str
    type: str
    title: str
    message: str
    priority: str = "MEDIUM"
    is_read: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    patient_id: Optional[str] = None
    health_record_id: Optional[str] = None
    followup_id: Optional[str] = None
    link: Optional[str] = None

    created_at: datetime
# --- Geography Schemas ---

class DistrictBase(BaseModel):
    official_name: str
    display_name: Optional[str] = None
    state: str
    country: str
    source_type: str = "OFFICIAL_GOVERNMENT"
    source_url: Optional[str] = None
    source_verified_at: Optional[datetime] = None
    status: str = "ACTIVE"

class DistrictCreate(DistrictBase):
    pass

class District(DistrictBase, MongoBaseModel):
    created_at: datetime
    updated_at: Optional[datetime] = None

class RevenueDivisionBase(BaseModel):
    official_name: str
    display_name: Optional[str] = None
    district_id: str
    source_type: str = "OFFICIAL_GOVERNMENT"
    source_url: Optional[str] = None
    source_verified_at: Optional[datetime] = None
    status: str = "ACTIVE"

class RevenueDivisionCreate(RevenueDivisionBase):
    pass

class RevenueDivision(RevenueDivisionBase, MongoBaseModel):
    created_at: datetime
    updated_at: Optional[datetime] = None

class RevenueTalukBase(BaseModel):
    official_name: str
    display_name: Optional[str] = None
    division_id: str
    district_id: str
    source_type: str = "OFFICIAL_GOVERNMENT"
    source_url: Optional[str] = None
    source_verified_at: Optional[datetime] = None
    status: str = "ACTIVE"

class RevenueTalukCreate(RevenueTalukBase):
    pass

class RevenueTaluk(RevenueTalukBase, MongoBaseModel):
    created_at: datetime
    updated_at: Optional[datetime] = None

class RevenueFirkaBase(BaseModel):
    official_name: str
    display_name: Optional[str] = None
    taluk_id: str
    division_id: str
    district_id: str
    source_type: str = "OFFICIAL_GOVERNMENT"
    source_url: Optional[str] = None
    source_verified_at: Optional[datetime] = None
    status: str = "ACTIVE"

class RevenueFirkaCreate(RevenueFirkaBase):
    pass

class RevenueFirka(RevenueFirkaBase, MongoBaseModel):
    created_at: datetime
    updated_at: Optional[datetime] = None

class RevenueVillageBase(BaseModel):
    official_name: str
    local_name_ta: Optional[str] = None
    display_name: Optional[str] = None
    alias: Optional[str] = None
    taluk_id: str
    firka_id: str
    division_id: str
    district_id: str
    village_code: Optional[str] = None
    pincode: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    source_type: str = "OFFICIAL_GOVERNMENT"
    source_url: Optional[str] = None
    source_verified_at: Optional[datetime] = None
    status: str = "PENDING_OFFICIAL_VERIFICATION"

class RevenueVillageCreate(RevenueVillageBase):
    pass

class RevenueVillage(RevenueVillageBase, MongoBaseModel):
    created_at: datetime
    updated_at: Optional[datetime] = None

# --- Development Block Schema ---

class DevelopmentBlockBase(BaseModel):
    official_name: str
    district_id: str
    source_type: str = "OFFICIAL_GOVERNMENT"
    source_url: Optional[str] = None
    source_verified_at: Optional[datetime] = None
    status: str = "ACTIVE"

class DevelopmentBlockCreate(DevelopmentBlockBase):
    pass

class DevelopmentBlock(DevelopmentBlockBase, MongoBaseModel):
    created_at: datetime
    updated_at: Optional[datetime] = None

# --- Healthcare Area Schema ---

class HealthcareAreaBase(BaseModel):
    name: str
    village_id: str
    firka_id: str
    taluk_id: str
    division_id: str
    district_id: str
    source_type: str = "ADMIN_VERIFIED"
    source_url: Optional[str] = None
    source_verified_at: Optional[datetime] = None
    status: str = "ACTIVE"

class HealthcareAreaCreate(HealthcareAreaBase):
    pass

class HealthcareArea(HealthcareAreaBase, MongoBaseModel):
    created_at: datetime
    updated_at: Optional[datetime] = None

# --- Healthcare Facility Schema ---

class HealthcareFacilityBase(BaseModel):
    facility_name: str
    facility_type: str
    district_id: str
    division_id: str
    taluk_id: str
    firka_id: str
    village_id: Optional[str] = None
    development_block_id: Optional[str] = None
    address: Optional[str] = None
    pincode: Optional[str] = None
    phone: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    source_type: str = "ADMIN_VERIFIED"
    source_url: Optional[str] = None
    source_verified_at: Optional[datetime] = None
    status: str = "PENDING_VERIFICATION"

class HealthcareFacilityCreate(HealthcareFacilityBase):
    pass

class HealthcareFacility(HealthcareFacilityBase, MongoBaseModel):
    created_at: datetime
    updated_at: Optional[datetime] = None

# --- Doctor Schema ---

class DoctorBase(BaseModel):
    user_id: str
    full_name: str
    designation: Optional[str] = None
    medical_registration_number: str
    specialization: Optional[str] = None
    phone: Optional[str] = None
    email: EmailStr
    facility_id: str
    district_id: str
    taluk_id: str
    firka_id: str
    status: str = "ACTIVE"
    verification_status: str = "PENDING_VERIFICATION"
    source_type: str = "ADMIN_VERIFIED"
    source_url: Optional[str] = None
    source_verified_at: Optional[datetime] = None

class DoctorCreate(DoctorBase):
    pass

class Doctor(DoctorBase, MongoBaseModel):
    verified_by_admin: Optional[str] = None
    verified_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

# --- Nurse Schema ---

class NurseBase(BaseModel):
    user_id: str
    full_name: str
    designation: Optional[str] = None
    phone: Optional[str] = None
    email: EmailStr
    facility_id: str
    area_id: str
    village_id: str
    firka_id: str
    taluk_id: str
    district_id: str
    status: str = "ACTIVE"
    verification_status: str = "PENDING_VERIFICATION"
    source_type: str = "ADMIN_VERIFIED"
    source_url: Optional[str] = None
    source_verified_at: Optional[datetime] = None

class NurseCreate(NurseBase):
    pass

class Nurse(NurseBase, MongoBaseModel):
    verified_by_admin: Optional[str] = None
    verified_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

# --- Staff Assignment Schema ---

class StaffAssignmentBase(BaseModel):
    staff_id: str
    staff_role: str  # "DOCTOR" or "NURSE"
    facility_id: Optional[str] = None
    area_id: Optional[str] = None
    village_id: Optional[str] = None
    firka_id: Optional[str] = None
    taluk_id: Optional[str] = None
    district_id: str
    assigned_from: datetime
    assigned_to: Optional[datetime] = None
    status: str = "ACTIVE"
    assigned_by: str
    source_type: str = "ADMIN_VERIFIED"
    source_url: Optional[str] = None
    source_verified_at: Optional[datetime] = None

class StaffAssignmentCreate(StaffAssignmentBase):
    pass

class StaffAssignment(StaffAssignmentBase, MongoBaseModel):
    created_at: datetime
    updated_at: Optional[datetime] = None
