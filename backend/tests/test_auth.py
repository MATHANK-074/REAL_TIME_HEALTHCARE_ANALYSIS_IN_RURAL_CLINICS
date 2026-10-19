import pytest
import uuid
from bson import ObjectId
from backend.app.utils.auth import hash_password, verify_password, create_access_token, decode_access_token

def test_password_hashing_and_verification():
    """Verify password hashing creates secure bcrypt hashes and verifies correctly."""
    raw_pw = "TestSecurePassword123!"
    hashed = hash_password(raw_pw)
    assert hashed != raw_pw
    assert verify_password(raw_pw, hashed) is True
    assert verify_password("WrongPassword!", hashed) is False

def test_jwt_creation_and_decoding():
    """Verify JWT tokens encode claims and decode correctly."""
    email = f"test_{uuid.uuid4().hex[:6]}@example.com"
    token = create_access_token({"sub": email, "role": "DOCTOR"})
    assert isinstance(token, str)
    decoded = decode_access_token(token)
    assert decoded is not None
    assert decoded.get("sub") == email
    assert decoded.get("role") == "DOCTOR"

def test_invalid_or_expired_jwt_rejected():
    """Verify corrupted or invalid tokens return None."""
    assert decode_access_token("corrupted.token.value") is None
    assert decode_access_token("") is None

def test_login_flow_with_isolated_user(test_client, real_db):
    """Verify login succeeds with valid credentials, rejects invalid password and unknown users."""
    unique_suffix = uuid.uuid4().hex[:6]
    test_email = f"test_auth_{unique_suffix}@ruralcare.com"
    password = "CorrectPassword123"

    user_doc = {
        "name": f"Test Auth User {unique_suffix}",
        "email": test_email,
        "password_hash": hash_password(password),
        "role": "NURSE",
        "is_active": True
    }
    res = real_db.users.insert_one(user_doc)
    user_id = res.inserted_id

    try:
        # 1. Valid login
        login_resp = test_client.post("/api/auth/login", json={"email": test_email, "password": password})
        assert login_resp.status_code == 200
        token_data = login_resp.json()
        assert "access_token" in token_data
        assert token_data.get("role") == "NURSE"
        assert "password" not in token_data
        assert "password_hash" not in token_data

        # 2. Invalid password
        bad_pw_resp = test_client.post("/api/auth/login", json={"email": test_email, "password": "WrongPassword"})
        assert bad_pw_resp.status_code == 401
        assert "detail" in bad_pw_resp.json()

        # 3. Unknown user
        unknown_resp = test_client.post("/api/auth/login", json={"email": "nonexistent_user@ruralcare.com", "password": password})
        assert unknown_resp.status_code == 401

        # 4. Missing credentials
        missing_resp = test_client.post("/api/auth/login", json={"email": test_email})
        assert missing_resp.status_code == 422

        # 5. Profile endpoint /api/auth/me
        auth_headers = {"Authorization": f"Bearer {token_data['access_token']}"}
        me_resp = test_client.get("/api/auth/me", headers=auth_headers)
        assert me_resp.status_code == 200
        profile = me_resp.json()
        assert profile.get("email") == test_email
        assert "password" not in profile
        assert "password_hash" not in profile

    finally:
        # Clean up isolated test user
        real_db.users.delete_one({"_id": user_id})
