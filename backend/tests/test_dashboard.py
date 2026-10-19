import pytest
import uuid
from backend.app.utils.auth import hash_password

def test_admin_dashboard_metrics(test_client, real_db, auth_headers_factory):
    """Verify admin dashboard returns non-fabricated real KPIs calculated from DB."""
    suffix = uuid.uuid4().hex[:6]
    admin_email = f"admin_dash_{suffix}@ruralcare.test"
    admin_res = real_db.users.insert_one({
        "name": "Admin Dash Tester",
        "email": admin_email,
        "password_hash": hash_password("pass"),
        "role": "ADMIN",
        "is_active": True
    })
    admin_headers = auth_headers_factory(admin_email, "ADMIN")

    try:
        resp = test_client.get("/api/dashboard/admin", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "kpis" in data
        kpis = data["kpis"]
        assert "total_patients" in kpis
        assert "total_doctors" in kpis
        assert "total_nurses" in kpis
        assert "risk_distribution" in data
        assert "subdistrict_comparison" in data
    finally:
        real_db.users.delete_one({"_id": admin_res.inserted_id})
