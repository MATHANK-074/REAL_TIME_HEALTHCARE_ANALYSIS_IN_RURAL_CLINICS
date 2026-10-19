import pytest
import uuid
from bson import ObjectId
from backend.app.utils.auth import hash_password, create_access_token

def test_unauthenticated_request_rejected(test_client):
    """Verify protected endpoints reject requests without Authorization token."""
    resp = test_client.get("/api/auth/me")
    assert resp.status_code == 401

def test_rbac_admin_vs_nurse_permissions(test_client, real_db, auth_headers_factory):
    """Verify Admin can access admin routes, while Nurse is forbidden."""
    suffix = uuid.uuid4().hex[:6]
    admin_email = f"admin_{suffix}@ruralcare.test"
    nurse_email = f"nurse_{suffix}@ruralcare.test"

    admin_res = real_db.users.insert_one({
        "name": "Admin Tester", "email": admin_email, "password_hash": hash_password("pass"),
        "role": "ADMIN", "is_active": True
    })
    nurse_res = real_db.users.insert_one({
        "name": "Nurse Tester", "email": nurse_email, "password_hash": hash_password("pass"),
        "role": "NURSE", "is_active": True
    })

    try:
        admin_headers = auth_headers_factory(admin_email, "ADMIN")
        nurse_headers = auth_headers_factory(nurse_email, "NURSE")

        # Admin dashboard
        admin_resp = test_client.get("/api/dashboard/admin", headers=admin_headers)
        assert admin_resp.status_code == 200

        # Nurse attempting admin dashboard -> Forbidden
        nurse_resp = test_client.get("/api/dashboard/admin", headers=nurse_headers)
        assert nurse_resp.status_code == 403

    finally:
        real_db.users.delete_one({"_id": admin_res.inserted_id})
        real_db.users.delete_one({"_id": nurse_res.inserted_id})

def test_cross_jurisdiction_isolation(test_client, real_db, auth_headers_factory):
    """Verify Doctor cannot access patient outside their assigned clinic or jurisdiction."""
    suffix = uuid.uuid4().hex[:6]
    clinic_a_id = str(ObjectId())
    clinic_b_id = str(ObjectId())

    # Patient in clinic B
    patient_res = real_db.patients.insert_one({
        "name": f"Patient Clinic B {suffix}",
        "patient_code": f"RH-TST{suffix[:4]}",
        "age": 45,
        "gender": "Male",
        "clinic_id": clinic_b_id
    })
    patient_id = str(patient_res.inserted_id)

    # Doctor assigned to clinic A
    doc_email = f"doc_{suffix}@ruralcare.test"
    doc_res = real_db.users.insert_one({
        "name": "Doctor Clinic A", "email": doc_email, "password_hash": hash_password("pass"),
        "role": "DOCTOR", "clinic_id": clinic_a_id, "is_active": True
    })

    try:
        doc_headers = auth_headers_factory(doc_email, "DOCTOR")
        resp = test_client.get(f"/api/patients/{patient_id}", headers=doc_headers)
        assert resp.status_code == 403
        assert "Access denied" in resp.json().get("detail", "")
    finally:
        real_db.patients.delete_one({"_id": patient_res.inserted_id})
        real_db.users.delete_one({"_id": doc_res.inserted_id})
