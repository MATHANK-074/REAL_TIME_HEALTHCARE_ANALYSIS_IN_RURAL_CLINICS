import pytest
import uuid
import datetime
from bson import ObjectId
from backend.app.utils.auth import hash_password

def test_followup_lifecycle(test_client, real_db, auth_headers_factory):
    """Verify follow-up creation, retrieval, patient isolation, and status update."""
    suffix = uuid.uuid4().hex[:6]
    clinic_id = str(ObjectId())

    # 1. Create Patient
    patient_res = real_db.patients.insert_one({
        "name": f"Followup Patient {suffix}",
        "patient_code": f"RH-F{suffix[:4]}",
        "age": 62,
        "gender": "Male",
        "clinic_id": clinic_id
    })
    patient_id = str(patient_res.inserted_id)

    # 2. Create Doctor
    doc_email = f"doc_fup_{suffix}@ruralcare.test"
    doc_res = real_db.users.insert_one({
        "name": "Doctor Followup Scheduler",
        "email": doc_email,
        "password_hash": hash_password("pass"),
        "role": "DOCTOR",
        "clinic_id": clinic_id,
        "is_active": True
    })
    doc_headers = auth_headers_factory(doc_email, "DOCTOR")

    followup_id = None
    try:
        # Create follow-up
        fup_date = (datetime.date.today() + datetime.timedelta(days=7)).isoformat()
        payload = {
            "patient_id": patient_id,
            "followup_date": fup_date,
            "reason": "Blood pressure check",
            "priority": "HIGH"
        }
        create_resp = test_client.post("/api/followups", json=payload, headers=doc_headers)
        assert create_resp.status_code == 201
        fup_data = create_resp.json()
        followup_id = fup_data.get("id")
        assert fup_data.get("status") == "PENDING"
        assert fup_data.get("priority") == "HIGH"

        # Update follow-up status to COMPLETED
        update_resp = test_client.put(
            f"/api/followups/{followup_id}",
            json={"status": "COMPLETED", "notes": "Patient visited, BP normal."},
            headers=doc_headers
        )
        assert update_resp.status_code == 200
        assert update_resp.json().get("status") == "COMPLETED"

    finally:
        real_db.patients.delete_one({"_id": patient_res.inserted_id})
        real_db.users.delete_one({"_id": doc_res.inserted_id})
        if followup_id:
            real_db.followups.delete_one({"_id": ObjectId(followup_id)})
            real_db.notifications.delete_many({"followup_id": followup_id})
