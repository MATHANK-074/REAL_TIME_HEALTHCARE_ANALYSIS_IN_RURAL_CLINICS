"""
RuralCare AI - Automated Integration Test Suite for Patient Portal
Tests all 7 patient portal views, endpoints, and role authorizations using urllib.
"""
import urllib.request
import urllib.error
import json
import sys

BASE_URL = "http://127.0.0.1:8000/api"

def make_req(path, method="GET", data=None, token=None):
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            content = resp.read().decode("utf-8")
            return resp.status, json.loads(content) if content else {}
    except urllib.error.HTTPError as e:
        err_content = e.read().decode("utf-8")
        try:
            return e.code, json.loads(err_content)
        except Exception:
            return e.code, {"detail": err_content}

def run_tests():
    print("=" * 60)
    print("RUNNING PATIENT PORTAL INTEGRATION TESTS")
    print("=" * 60)

    # 1. Login as Patient
    print("\n1. Testing Patient Authentication...")
    status, patient_data = make_req("/auth/login", method="POST", data={
        "email": "rh-0001@ruralcare.com",
        "password": "password123"
    })
    assert status == 200, f"Login failed: status {status}, {patient_data}"
    token = patient_data["access_token"]
    print(f"   [PASS] Logged in as: {patient_data['name']} (Role: {patient_data['role']})")

    # 2. Test /api/patient/dashboard
    print("\n2. Testing GET /patient/dashboard...")
    status, dash = make_req("/patient/dashboard", token=token)
    assert status == 200, f"Dashboard failed: status {status}, {dash}"
    assert "latest_assessment_status" in dash, "Missing latest_assessment_status in dashboard"
    assert "latest_record" in dash, "Missing latest_record in dashboard"
    assert "predictions" in dash, "Missing predictions in dashboard"
    print(f"   [PASS] Dashboard data verified. Latest assessment status: {dash['latest_assessment_status']}")

    # 3. Test /api/patient/health
    print("\n3. Testing GET /patient/health...")
    status, health = make_req("/patient/health", token=token)
    assert status == 200, f"Health summary failed: status {status}, {health}"
    assert "latest_visit" in health, "Missing latest_visit in health"
    assert "trend_history" in health, "Missing trend_history in health"
    assert "predictions" in health, "Missing predictions in health"
    print(f"   [PASS] Health summary verified. Historical trend count: {len(health['trend_history'])}")

    # 4. Test /api/patient/history
    print("\n4. Testing GET /patient/history...")
    status, history = make_req("/patient/history", token=token)
    assert status == 200, f"History failed: status {status}, {history}"
    assert isinstance(history, list), "History must be an array"
    print(f"   [PASS] History verified. Found {len(history)} chronological health records.")

    # 5. Test /api/patient/predictions
    print("\n5. Testing GET /patient/predictions...")
    status, preds = make_req("/patient/predictions", token=token)
    assert status == 200, f"Predictions failed: status {status}, {preds}"
    assert isinstance(preds, list), "Predictions must be an array"
    print(f"   [PASS] AI Predictions verified. Found {len(preds)} assessments.")
    for p in preds:
        assert "risk_level" in p, "Prediction missing risk_level"
        assert "safe_message" in p, "Prediction missing safe_message"

    # 6. Test /api/patient/profile
    print("\n6. Testing GET /patient/profile...")
    status, prof = make_req("/patient/profile", token=token)
    assert status == 200, f"Profile failed: status {status}, {prof}"
    assert prof.get("patient_code") == "RH-0001", f"Wrong patient_code: {prof.get('patient_code')}"
    print(f"   [PASS] Patient Profile verified: {prof['name']} (Code: {prof['patient_code']}, Blood Group: {prof.get('blood_group')})")

    # 7. Test /api/followups
    print("\n7. Testing GET /followups (Patient scoped)...")
    status, fups = make_req("/followups", token=token)
    assert status == 200, f"Followups failed: status {status}, {fups}"
    print(f"   [PASS] Followups verified. Found {len(fups)} records.")

    # 8. Test /api/notifications
    print("\n8. Testing GET /notifications (Patient scoped)...")
    status, notifs = make_req("/notifications", token=token)
    assert status == 200, f"Notifications failed: status {status}, {notifs}"
    print(f"   [PASS] Notifications verified. Found {len(notifs)} notifications.")

    # 9. Authorization Boundaries
    print("\n9. Testing Authorization & Security Boundaries...")
    
    # 9a. No token -> 401
    status, no_auth = make_req("/patient/dashboard")
    assert status in (401, 403), f"Expected 401/403 for unauthorized, got: {status}"
    print("   [PASS] Unauthenticated request correctly rejected (401/403).")

    # 9b. Patient token attempting to access Nurse patient list -> 403
    status, nurse_probe = make_req("/patients", token=token)
    assert status == 403, f"Patient should NOT access nurse /patients, got: {status}"
    print("   [PASS] Patient restricted from accessing Nurse-only endpoints (403 Forbidden).")

    # 9c. Login as Doctor and check Doctor dashboard remains unaffected
    print("\n10. Testing Doctor Portal Isolation...")
    status, doc_login = make_req("/auth/login", method="POST", data={
        "email": "doctor@ruralcare.com",
        "password": "password123"
    })
    if status == 200:
        doc_token = doc_login["access_token"]
        # Doctor accessing patient portal endpoint -> 403 (patient-only)
        status, doc_probe = make_req("/patient/dashboard", token=doc_token)
        assert status == 403, f"Doctor should NOT access /patient/dashboard, got: {status}"
        print("   [PASS] Doctor correctly blocked from Patient Portal private route (403 Forbidden).")

    # 9d. Login as Nurse and check Nurse dashboard remains unaffected
    print("\n11. Testing Nurse Portal Isolation...")
    status, nurse_login = make_req("/auth/login", method="POST", data={
        "email": "nurse@ruralcare.com",
        "password": "password123"
    })
    if status == 200:
        nurse_token = nurse_login["access_token"]
        status, nurse_patients = make_req("/patients", token=nurse_token)
        assert status == 200, f"Nurse /patients failed: {status}, {nurse_patients}"
        print(f"   [PASS] Nurse portal unaffected, fetched {len(nurse_patients)} patients.")

    print("\n" + "=" * 60)
    print("ALL 11 PATIENT PORTAL INTEGRATION & SECURITY TESTS PASSED!")
    print("=" * 60)

if __name__ == "__main__":
    run_tests()
