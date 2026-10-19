import pytest
import uuid
from bson import ObjectId
from backend.app.utils.auth import hash_password

def test_nurse_vitals_logging_and_persistence(test_client, real_db, auth_headers_factory):
    """Verify nurse can enter vitals, calculate BMI, parse BP, and store with status PENDING_REVIEW."""
    suffix = uuid.uuid4().hex[:6]
    village_id = str(ObjectId())
    
    # 1. Create Patient
    patient_res = real_db.patients.insert_one({
        "name": f"Vitals Patient {suffix}",
        "patient_code": f"RH-V{suffix[:4]}",
        "age": 50,
        "gender": "Male",
        "village_id": village_id
    })
    patient_id = str(patient_res.inserted_id)

    # 2. Create Nurse
    nurse_email = f"nurse_vitals_{suffix}@ruralcare.test"
    nurse_res = real_db.users.insert_one({
        "name": "Nurse Vitals Logger",
        "email": nurse_email,
        "password_hash": hash_password("pass"),
        "role": "NURSE",
        "village_id": village_id,
        "is_active": True
    })
    nurse_headers = auth_headers_factory(nurse_email, "NURSE")

    record_payload = {
        "patient_id": patient_id,
        "weight": 70.0,
        "height": 175.0,
        "blood_pressure": "130/85",
        "blood_sugar_fasting": 110.0,
        "heart_rate": 78,
        "temperature": 98.4,
        "symptoms": "Mild headache",
        "clinical_notes": "Routine checkup"
    }

    created_record_id = None
    try:
        resp = test_client.post("/api/health-records", json=record_payload, headers=nurse_headers)
        assert resp.status_code == 201
        rec_data = resp.json()
        created_record_id = rec_data.get("id")

        assert rec_data.get("systolic_bp") == 130
        assert rec_data.get("diastolic_bp") == 85
        assert rec_data.get("blood_glucose") == 110
        assert rec_data.get("bmi") is not None
        assert round(rec_data.get("bmi"), 1) == 22.9
        assert rec_data.get("review_status") == "PENDING_REVIEW"
        assert rec_data.get("recorded_by") is not None

        # Verify retrieval via patient endpoint
        fetch_resp = test_client.get(f"/api/health-records/patient/{patient_id}", headers=nurse_headers)
        assert fetch_resp.status_code == 200
        records = fetch_resp.json()
        assert any(r.get("id") == created_record_id for r in records)

    finally:
        real_db.patients.delete_one({"_id": patient_res.inserted_id})
        real_db.users.delete_one({"_id": nurse_res.inserted_id})
        if created_record_id:
            real_db.health_records.delete_one({"_id": ObjectId(created_record_id)})
            real_db.predictions.delete_many({"health_record_id": created_record_id})
            real_db.clinical_recommendations.delete_many({"health_record_id": created_record_id})
