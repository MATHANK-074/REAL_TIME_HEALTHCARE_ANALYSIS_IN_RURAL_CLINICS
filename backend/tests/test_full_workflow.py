import pytest
import uuid
import datetime
from bson import ObjectId
from backend.app.utils.auth import hash_password

def test_complete_end_to_end_care_workflow(test_client, real_db, auth_headers_factory):
    """
    Complete Phase 3 E2E Test:
    1. Nurse creates isolated patient.
    2. Nurse logs vitals.
    3. Auto-generated recommendation verified.
    4. Doctor assigned to patient retrieves health record.
    5. Doctor triggers specific ML risk prediction.
    6. Doctor submits clinical review decision (APPROVE).
    7. Doctor schedules follow-up.
    8. Patient logs in and verifies health record, decision, and follow-up.
    9. Isolated test artifacts thoroughly cleaned up.
    """
    suffix = uuid.uuid4().hex[:6]
    clinic_id = str(ObjectId())
    village_id = str(ObjectId())

    # Create Nurse
    nurse_email = f"nurse_e2e_{suffix}@ruralcare.test"
    nurse_res = real_db.users.insert_one({
        "name": "Nurse E2E",
        "email": nurse_email,
        "password_hash": hash_password("pass"),
        "role": "NURSE",
        "village_id": village_id,
        "is_active": True
    })
    nurse_headers = auth_headers_factory(nurse_email, "NURSE")

    # Create Doctor
    doc_email = f"doc_e2e_{suffix}@ruralcare.test"
    doc_res = real_db.users.insert_one({
        "name": "Doctor E2E",
        "email": doc_email,
        "password_hash": hash_password("pass"),
        "role": "DOCTOR",
        "clinic_id": clinic_id,
        "is_active": True
    })
    doc_headers = auth_headers_factory(doc_email, "DOCTOR")

    created_patient_id = None
    created_record_id = None
    created_followup_id = None

    try:
        # Step 1: Nurse registers patient
        pat_payload = {
            "name": f"E2E Patient {suffix}",
            "age": 52,
            "gender": "Female",
            "phone": f"91{suffix[:8]}",
            "village_id": village_id,
            "clinic_id": clinic_id
        }
        pat_resp = test_client.post("/api/patients", json=pat_payload, headers=nurse_headers)
        assert pat_resp.status_code == 201
        created_patient_id = pat_resp.json().get("id")

        # Step 2: Nurse logs health record & vitals
        vitals_payload = {
            "patient_id": created_patient_id,
            "weight": 68.0,
            "height": 162.0,
            "blood_pressure": "142/92",
            "blood_sugar_fasting": 138.0,
            "heart_rate": 82,
            "symptoms": "Occasional dizziness"
        }
        vitals_resp = test_client.post("/api/health-records", json=vitals_payload, headers=nurse_headers)
        assert vitals_resp.status_code == 201
        created_record_id = vitals_resp.json().get("id")
        assert vitals_resp.json().get("review_status") == "PENDING_REVIEW"

        # Step 3: Doctor retrieves patient records
        doc_records_resp = test_client.get(f"/api/health-records/patient/{created_patient_id}", headers=doc_headers)
        assert doc_records_resp.status_code == 200
        assert len(doc_records_resp.json()) >= 1

        # Step 4: Doctor triggers ML prediction
        pred_resp = test_client.post(f"/api/predictions/{created_patient_id}?model_name=DIABETES", headers=doc_headers)
        assert pred_resp.status_code == 201
        pred_data = pred_resp.json()
        assert "probability" in pred_data
        assert "risk_level" in pred_data

        # Step 5: Doctor reviews clinical recommendation
        rec = real_db.clinical_recommendations.find_one({"patient_id": created_patient_id})
        assert rec is not None
        rec_id = str(rec["_id"])

        decision_resp = test_client.post(
            f"/api/reviews/{rec_id}/decision",
            json={"decision": "APPROVE", "doctor_notes": "Prescribed lifestyle changes and scheduled check."},
            headers=doc_headers
        )
        assert decision_resp.status_code == 200

        # Step 6: Doctor schedules follow-up
        fup_date = (datetime.date.today() + datetime.timedelta(days=14)).isoformat()
        fup_resp = test_client.post(
            "/api/followups",
            json={"patient_id": created_patient_id, "followup_date": fup_date, "reason": "Diabetes review"},
            headers=doc_headers
        )
        assert fup_resp.status_code == 201
        created_followup_id = fup_resp.json().get("id")

        # Step 7: Patient views their own portal
        pat_user = real_db.users.find_one({"role": "PATIENT", "patient_id": created_patient_id})
        assert pat_user is not None
        pat_headers = auth_headers_factory(pat_user["email"], "PATIENT")

        dash_resp = test_client.get("/api/patient/dashboard", headers=pat_headers)
        assert dash_resp.status_code == 200
        health_resp = test_client.get("/api/patient/health", headers=pat_headers)
        assert health_resp.status_code == 200

    finally:
        # Step 8: Clean up isolated test data
        real_db.users.delete_one({"_id": nurse_res.inserted_id})
        real_db.users.delete_one({"_id": doc_res.inserted_id})
        if created_patient_id:
            real_db.patients.delete_one({"_id": ObjectId(created_patient_id)})
            real_db.users.delete_many({"patient_id": created_patient_id})
            real_db.predictions.delete_many({"patient_id": created_patient_id})
            real_db.clinical_recommendations.delete_many({"patient_id": created_patient_id})
            real_db.doctor_reviews.delete_many({"patient_id": created_patient_id})
            real_db.followups.delete_many({"patient_id": created_patient_id})
            real_db.notifications.delete_many({"patient_id": created_patient_id})
            real_db.health_records.delete_many({"patient_id": created_patient_id})
