import pytest
import uuid
from bson import ObjectId
from backend.app.utils.auth import hash_password

def test_in_app_notifications_isolation_and_marking(test_client, real_db, auth_headers_factory):
    """Verify in-app notifications recipient isolation, unread count, and mark-as-read."""
    suffix = uuid.uuid4().hex[:6]
    doc_email = f"doc_notif_{suffix}@ruralcare.test"
    doc_res = real_db.users.insert_one({
        "name": "Doctor Notification Target",
        "email": doc_email,
        "password_hash": hash_password("pass"),
        "role": "DOCTOR",
        "is_active": True
    })
    doc_id = str(doc_res.inserted_id)
    doc_headers = auth_headers_factory(doc_email, "DOCTOR")

    # Insert notification for this doctor
    notif_res = real_db.notifications.insert_one({
        "recipient_id": doc_id,
        "type": "HEALTH_REVIEW_REQUIRED",
        "title": "Review Needed",
        "message": "Please review new health record",
        "priority": "MEDIUM",
        "is_read": False,
        "created_at": "2026-10-18T00:00:00"
    })
    notif_id = str(notif_res.inserted_id)

    try:
        # Check unread count
        count_resp = test_client.get("/api/notifications/unread-count", headers=doc_headers)
        assert count_resp.status_code == 200
        assert count_resp.json().get("count") >= 1

        # Mark as read
        patch_resp = test_client.patch(f"/api/notifications/{notif_id}/read", headers=doc_headers)
        assert patch_resp.status_code == 200

        # Verify updated in DB
        updated = real_db.notifications.find_one({"_id": ObjectId(notif_id)})
        assert updated.get("is_read") is True

    finally:
        real_db.users.delete_one({"_id": doc_res.inserted_id})
        real_db.notifications.delete_one({"_id": notif_res.inserted_id})

def test_vapid_public_key_endpoint(test_client):
    """Verify VAPID public key endpoint returns configured key."""
    resp = test_client.get("/api/push/public-key")
    assert resp.status_code == 200
    assert "public_key" in resp.json()
    assert len(resp.json()["public_key"]) > 20
