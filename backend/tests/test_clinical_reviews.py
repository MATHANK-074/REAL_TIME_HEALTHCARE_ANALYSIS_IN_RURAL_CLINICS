import pytest
import uuid
from bson import ObjectId
from backend.app.utils.auth import hash_password

def test_doctor_clinical_review_flow(test_client, real_db, auth_headers_factory):
    """Verify doctor can retrieve queue, inspect patient review, and submit approval decision."""
    suffix = uuid.uuid4().hex[:6]
    clinic_id = str(ObjectId())

    # 1. Create Patient
    patient_res = real_db.patients.insert_one({
        "name": f"Review Patient {suffix}",
        "patient_code": f"RH-REV{suffix[:4]}",
        "age": 55,
        "gender": "Male",
        "clinic_id": clinic_id
    })
    patient_id = str(patient_res.inserted_id)

    # 2. Create Recommendation
    rec_res = real_db.clinical_recommendations.insert_one({
        "patient_id": patient_id,
        "overall_priority": "HIGH",
        "status": "PENDING_REVIEW",
        "condition_results": [{"disease": "Diabetes", "risk_level": "HIGH", "probability": 0.78}]
    })
    rec_id = str(rec_res.inserted_id)

    # 3. Create Doctor
    doc_email = f"doc_rev_{suffix}@ruralcare.test"
    doc_res = real_db.users.insert_one({
        "name": "Doctor Reviewer",
        "email": doc_email,
        "password_hash": hash_password("pass"),
        "role": "DOCTOR",
        "clinic_id": clinic_id,
        "is_active": True
    })
    doc_headers = auth_headers_factory(doc_email, "DOCTOR")

    try:
        # A. Queue
        queue_resp = test_client.get("/api/reviews/queue", headers=doc_headers)
        assert queue_resp.status_code == 200
        queue = queue_resp.json()
        assert any(item.get("patient_id") == patient_id for item in queue)

        # B. Details
        detail_resp = test_client.get(f"/api/reviews/{patient_id}", headers=doc_headers)
        assert detail_resp.status_code == 200
        detail = detail_resp.json()
        assert "recommendation" in detail
        assert "patient" in detail

        # C. Decision (APPROVE)
        decision_resp = test_client.post(
            f"/api/reviews/{rec_id}/decision",
            json={"decision": "APPROVE", "doctor_notes": "Reviewed and confirmed management plan."},
            headers=doc_headers
        )
        assert decision_resp.status_code == 200
        dec_data = decision_resp.json()
        assert dec_data.get("decision") == "APPROVE"

        # Verify DB updated
        updated_rec = real_db.clinical_recommendations.find_one({"_id": ObjectId(rec_id)})
        assert updated_rec.get("status") == "APPROVE"
        assert updated_rec.get("reviewed_by") is not None

    finally:
        real_db.patients.delete_one({"_id": patient_res.inserted_id})
        real_db.users.delete_one({"_id": doc_res.inserted_id})
        real_db.clinical_recommendations.delete_one({"_id": rec_res.inserted_id})
        real_db.doctor_reviews.delete_many({"recommendation_id": rec_id})
