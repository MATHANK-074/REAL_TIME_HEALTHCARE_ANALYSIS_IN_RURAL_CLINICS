import datetime
from sqlalchemy import (
    Column, Integer, String, Boolean, Enum, DateTime, ForeignKey, 
    Text, Numeric, Date, Table, PrimaryKeyConstraint
)
from sqlalchemy.orm import relationship
from .database import Base

class District(Base):
    __tablename__ = "districts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    subdistricts = relationship("SubDistrict", back_populates="district", cascade="all, delete-orphan")
    users = relationship("User", back_populates="district")


class SubDistrict(Base):
    __tablename__ = "subdistricts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    district_id = Column(Integer, ForeignKey("districts.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    district = relationship("District", back_populates="subdistricts")
    villages = relationship("Village", back_populates="subdistrict", cascade="all, delete-orphan")
    users = relationship("User", back_populates="subdistrict")


class Village(Base):
    __tablename__ = "villages"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    subdistrict_id = Column(Integer, ForeignKey("subdistricts.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    subdistrict = relationship("SubDistrict", back_populates="villages")
    users = relationship("User", back_populates="village")
    patients = relationship("Patient", back_populates="village")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum('NURSE', 'DOCTOR', 'ADMIN', name='user_roles'), nullable=False)
    phone = Column(String(20), nullable=True)
    district_id = Column(Integer, ForeignKey("districts.id", ondelete="SET NULL"), nullable=True)
    subdistrict_id = Column(Integer, ForeignKey("subdistricts.id", ondelete="SET NULL"), nullable=True)
    village_id = Column(Integer, ForeignKey("villages.id", ondelete="SET NULL"), nullable=True)
    qualification = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    # Relationships
    district = relationship("District", back_populates="users")
    subdistrict = relationship("SubDistrict", back_populates="users")
    village = relationship("Village", back_populates="users")
    records_logged = relationship("HealthRecord", back_populates="recorded_by_user")
    followups_scheduled = relationship("Followup", back_populates="doctor")
    audit_logs = relationship("AuditLog", back_populates="user", cascade="all, delete-orphan")


class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    patient_code = Column(String(20), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    age = Column(Integer, nullable=False)
    gender = Column(Enum('Male', 'Female', 'Other', name='genders'), nullable=False)
    phone = Column(String(20), nullable=True)
    village_id = Column(Integer, ForeignKey("villages.id", ondelete="SET NULL"), nullable=True)
    address = Column(Text, nullable=True)
    blood_group = Column(String(5), nullable=True)
    emergency_contact = Column(String(20), nullable=True)
    existing_disease = Column(String(100), nullable=True)
    allergies = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    # Relationships
    village = relationship("Village", back_populates="patients")
    health_records = relationship("HealthRecord", back_populates="patient", cascade="all, delete-orphan", order_by="desc(HealthRecord.recorded_at)")
    predictions = relationship("Prediction", back_populates="patient", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="patient", cascade="all, delete-orphan")
    followups = relationship("Followup", back_populates="patient", cascade="all, delete-orphan")


class HealthRecord(Base):
    __tablename__ = "health_records"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    recorded_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    weight = Column(Numeric(5, 2), nullable=True)
    height = Column(Numeric(5, 2), nullable=True)
    bmi = Column(Numeric(4, 1), nullable=True)
    blood_pressure = Column(String(20), nullable=True)
    systolic_bp = Column(Integer, nullable=True)
    diastolic_bp = Column(Integer, nullable=True)
    heart_rate = Column(Integer, nullable=True)
    temperature = Column(Numeric(4, 1), nullable=True)
    blood_glucose = Column(Integer, nullable=True)
    cholesterol = Column(Integer, nullable=True)
    insulin = Column(Integer, nullable=True)
    pregnancies = Column(Integer, default=0)
    smoking_status = Column(Enum('NEVER', 'FORMER', 'CURRENT', name='smoking_statuses'), default='NEVER')
    recorded_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    patient = relationship("Patient", back_populates="health_records")
    recorded_by_user = relationship("User", back_populates="records_logged")
    predictions = relationship("Prediction", back_populates="health_record", cascade="all, delete-orphan")


class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    health_record_id = Column(Integer, ForeignKey("health_records.id", ondelete="CASCADE"), nullable=False)
    model_name = Column(String(50), nullable=False)
    disease = Column(String(50), nullable=False)
    probability = Column(Numeric(4, 3), nullable=False)
    risk_level = Column(Enum('LOW', 'MEDIUM', 'HIGH', name='risk_levels'), nullable=False)
    prediction_result = Column(String(50), nullable=True)
    model_version = Column(String(20), nullable=False)
    predicted_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    patient = relationship("Patient", back_populates="predictions")
    health_record = relationship("HealthRecord", back_populates="predictions")
    factors = relationship("PredictionFactor", back_populates="prediction", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="prediction")


class PredictionFactor(Base):
    __tablename__ = "prediction_factors"

    id = Column(Integer, primary_key=True, index=True)
    prediction_id = Column(Integer, ForeignKey("predictions.id", ondelete="CASCADE"), nullable=False)
    feature_name = Column(String(50), nullable=False)
    feature_value = Column(String(50), nullable=False)
    importance = Column(Numeric(6, 4), nullable=False)
    direction = Column(Integer, nullable=False) # -1 or 1

    # Relationships
    prediction = relationship("Prediction", back_populates="factors")


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    prediction_id = Column(Integer, ForeignKey("predictions.id", ondelete="SET NULL"), nullable=True)
    alert_type = Column(String(50), nullable=False)
    recipient_type = Column(Enum('DOCTOR', 'NURSE', 'PATIENT', name='recipient_types'), nullable=False)
    message = Column(Text, nullable=False)
    channel = Column(String(20), default='DASHBOARD')
    status = Column(Enum('UNREAD', 'READ', 'ARCHIVED', name='alert_statuses'), default='UNREAD')
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    sent_at = Column(DateTime, nullable=True)

    # Relationships
    patient = relationship("Patient", back_populates="alerts")
    prediction = relationship("Prediction", back_populates="alerts")


class Followup(Base):
    __tablename__ = "followups"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    doctor_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    followup_date = Column(Date, nullable=False)
    status = Column(Enum('PENDING', 'COMPLETED', 'MISSED', name='followup_statuses'), default='PENDING')
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    # Relationships
    patient = relationship("Patient", back_populates="followups")
    doctor = relationship("User", back_populates="followups_scheduled")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    action = Column(String(100), nullable=False)
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(Integer, nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    details = Column(Text, nullable=True)

    # Relationships
    user = relationship("User", back_populates="audit_logs")
