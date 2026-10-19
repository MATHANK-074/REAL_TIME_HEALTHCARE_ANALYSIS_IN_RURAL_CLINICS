import pytest
import math
from backend.app.schemas import Patient, HealthRecord
from backend.app.ml.predictor import predict_risk
from backend.app.ml.model_registry import get_model_metrics

def test_model_metrics_available():
    """Verify evaluation metrics come from real evaluation file."""
    metrics = get_model_metrics()
    assert isinstance(metrics, dict)
    assert "DIABETES" in metrics
    assert "HYPERTENSION" in metrics
    assert "accuracy" in metrics["DIABETES"]
    assert metrics["DIABETES"]["accuracy"] is not None

def test_diabetes_prediction(real_db):
    """Verify Diabetes prediction produces valid probability [0, 1] and risk level."""
    patient = Patient(name="Test Patient", age=45, gender="Female", patient_code="RH-T01")
    record = HealthRecord(
        patient_id="dummy_patient",
        recorded_by="sys",
        recorded_at="2026-10-18T00:00:00",
        blood_glucose=140,
        diastolic_bp=85,
        bmi=28.5,
        pregnancies=2,
        insulin=80
    )
    res = predict_risk(real_db, record, patient, "DIABETES")
    prob = float(res.get("probability", -1))
    assert 0.0 <= prob <= 1.0
    assert not math.isnan(prob)
    assert res.get("risk_level") in ["LOW", "MEDIUM", "HIGH"]
    if "_id" in res:
        real_db.predictions.delete_one({"_id": res["_id"]})
        real_db.prediction_factors.delete_many({"prediction_id": str(res["_id"])})

def test_hypertension_prediction(real_db):
    """Verify Hypertension prediction produces valid probability and risk level."""
    patient = Patient(name="Test Patient Cardio", age=55, gender="Male", patient_code="RH-T02")
    record = HealthRecord(
        patient_id="dummy_patient",
        recorded_by="sys",
        recorded_at="2026-10-18T00:00:00",
        systolic_bp=150,
        diastolic_bp=95,
        height=170.0,
        weight=80.0,
        cholesterol=210,
        blood_glucose=105,
        smoking_status="CURRENT"
    )
    res = predict_risk(real_db, record, patient, "HYPERTENSION")
    prob = float(res.get("probability", -1))
    assert 0.0 <= prob <= 1.0
    assert not math.isnan(prob)
    assert res.get("risk_level") in ["LOW", "MEDIUM", "HIGH"]
    if "_id" in res:
        real_db.predictions.delete_one({"_id": res["_id"]})
        real_db.prediction_factors.delete_many({"prediction_id": str(res["_id"])})

def test_heart_disease_prediction(real_db):
    """Verify Heart Disease model execution."""
    patient = Patient(name="Heart Patient", age=60, gender="Male", patient_code="RH-T03")
    record = HealthRecord(
        patient_id="dummy_patient",
        recorded_by="sys",
        recorded_at="2026-10-18T00:00:00",
        systolic_bp=145,
        heart_rate=80,
        cholesterol=230,
        symptoms="chest pain"
    )
    res = predict_risk(real_db, record, patient, "HEART_DISEASE")
    prob = float(res.get("probability", -1))
    assert 0.0 <= prob <= 1.0
    assert res.get("risk_level") in ["LOW", "MEDIUM", "HIGH", "UNAVAILABLE"]
    if "_id" in res:
        real_db.predictions.delete_one({"_id": res["_id"]})
        real_db.prediction_factors.delete_many({"prediction_id": str(res["_id"])})

def test_stroke_prediction(real_db):
    """Verify Stroke risk prediction model."""
    patient = Patient(name="Stroke Patient", age=68, gender="Female", patient_code="RH-T04")
    record = HealthRecord(
        patient_id="dummy_patient",
        recorded_by="sys",
        recorded_at="2026-10-18T00:00:00",
        systolic_bp=160,
        diastolic_bp=95,
        blood_glucose=130,
        bmi=27.0
    )
    res = predict_risk(real_db, record, patient, "STROKE")
    prob = float(res.get("probability", -1))
    assert 0.0 <= prob <= 1.0
    assert res.get("risk_level") in ["LOW", "MEDIUM", "HIGH", "UNAVAILABLE"]
    if "_id" in res:
        real_db.predictions.delete_one({"_id": res["_id"]})
        real_db.prediction_factors.delete_many({"prediction_id": str(res["_id"])})

def test_kidney_prediction(real_db):
    """Verify Kidney disease model execution."""
    patient = Patient(name="Kidney Patient", age=52, gender="Male", patient_code="RH-T05")
    record = HealthRecord(
        patient_id="dummy_patient",
        recorded_by="sys",
        recorded_at="2026-10-18T00:00:00",
        diastolic_bp=85,
        systolic_bp=135,
        blood_glucose=115
    )
    res = predict_risk(real_db, record, patient, "KIDNEY")
    prob = float(res.get("probability", -1))
    assert 0.0 <= prob <= 1.0
    assert res.get("risk_level") in ["LOW", "MEDIUM", "HIGH", "UNAVAILABLE"]
    if "_id" in res:
        real_db.predictions.delete_one({"_id": res["_id"]})
        real_db.prediction_factors.delete_many({"prediction_id": str(res["_id"])})
