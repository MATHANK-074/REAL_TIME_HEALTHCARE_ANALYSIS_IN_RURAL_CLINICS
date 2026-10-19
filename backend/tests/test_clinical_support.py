import pytest
import pandas as pd
from backend.app.ml.explainability import explain_prediction
from backend.app.services.clinical_support_service import generate_recommendation
from bson import ObjectId

def test_local_explainability_factors():
    """Verify local explainability returns contributing factors with correct format."""
    df = pd.DataFrame([{
        "Pregnancies": 2,
        "Glucose": 160,
        "BloodPressure": 90,
        "SkinThickness": 20.0,
        "Insulin": 100,
        "BMI": 32.0,
        "DiabetesPedigreeFunction": 0.5,
        "Age": 45
    }])
    factors = explain_prediction("DIABETES", df)
    assert isinstance(factors, list)
    assert len(factors) > 0
    top = factors[0]
    assert "feature_name" in top
    assert "importance" in top
    assert "direction" in top

def test_clinical_recommendation_generation(real_db):
    """Verify generate_recommendation aggregates risks safely without crashing."""
    patient = {
        "_id": ObjectId(),
        "name": "Clinical Test Patient",
        "age": 48,
        "gender": "Female",
        "patient_code": "RH-CS01"
    }
    record = {
        "_id": ObjectId(),
        "patient_id": str(patient["_id"]),
        "blood_glucose": 135,
        "systolic_bp": 140,
        "diastolic_bp": 90,
        "weight": 72.0,
        "height": 165.0,
        "bmi": 26.4
    }
    rec = generate_recommendation(real_db, record, patient)
    assert rec is not None
    assert "overall_priority" in rec
    assert rec.get("overall_priority") in ["LOW", "MODERATE", "HIGH", "URGENT", "UNAVAILABLE"]
    assert "patient_safe_summary" in rec
    assert "condition_results" in rec

    # Clean up generated test records
    if "_id" in rec:
        real_db.clinical_recommendations.delete_one({"_id": rec["_id"]})
    real_db.predictions.delete_many({"health_record_id": str(record["_id"])})
