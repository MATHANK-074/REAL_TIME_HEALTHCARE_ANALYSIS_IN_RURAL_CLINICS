import pytest
import uuid
from bson import ObjectId
from backend.app.utils.auth import hash_password

def test_patient_crud_and_duplicate_handling(test_client, real_db, auth_headers_factory):
    """Verify creating a patient, preventing duplicates, retrieving, and updating."""
    suffix = uuid.uuid4().hex[:6]
    nurse_email = f"nurse_pat_{suffix}@ruralcare.test"
    dummy_village_id = str(ObjectId())

    nurse_res = real_db.users.insert_one({
        "name": "Nurse Patient Manager",
        "email": nurse_email,
        "password_hash": hash_password("pass"),
        "role": "NURSE",
        "village_id": dummy_village_id,
        "is_active": True
    })
    headers = auth_headers_factory(nurse_email, "NURSE")

    patient_payload = {
        "name": f"Test Patient {suffix}",
        "age": 42,
        "gender": "Female",
        "phone": f"98{suffix[:8]}",
        "village_id": dummy_village_id
    }

    created_patient_id = None
    try:
        # 1. Create Patient
        create_resp = test_client.post("/api/patients", json=patient_payload, headers=headers)
        assert create_resp.status_code == 201
        pat_data = create_resp.json()
        assert pat_data.get("name") == patient_payload["name"]
        assert pat_data.get("patient_code", "").startswith("RH-")
        created_patient_id = pat_data.get("id")

        # 2. Reject duplicate phone
        dup_resp = test_client.post("/api/patients", json=patient_payload, headers=headers)
        assert dup_resp.status_code == 400
        assert "already registered" in dup_resp.json().get("detail", "")

        # 3. Retrieve Patient
        get_resp = test_client.get(f"/api/patients/{created_patient_id}", headers=headers)
        assert get_resp.status_code == 200
        assert get_resp.json().get("id") == created_patient_id

        # 4. Update Patient
        update_payload = dict(patient_payload)
        update_payload["name"] = f"Updated Patient {suffix}"
        put_resp = test_client.put(f"/api/patients/{created_patient_id}", json=update_payload, headers=headers)
        assert put_resp.status_code == 200
        assert put_resp.json().get("name") == f"Updated Patient {suffix}"

    finally:
        if created_patient_id:
            real_db.patients.delete_one({"_id": ObjectId(created_patient_id)})
            real_db.users.delete_one({"patient_id": created_patient_id})
        real_db.users.delete_one({"_id": nurse_res.inserted_id})
