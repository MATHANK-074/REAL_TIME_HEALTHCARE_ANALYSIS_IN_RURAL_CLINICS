import requests

BASE_URL = "http://127.0.0.1:8000/api"

def test_login(email, password="password123"):
    res = requests.post(f"{BASE_URL}/auth/login", json={"email": email, "password": password})
    if res.status_code != 200:
        print(f"[FAIL] Login failed for {email}: {res.status_code} {res.text}")
        return None
    return res.json()

print("--- Testing RBAC & Location-based Scoping ---")

# 1. Nurse Test
nurse = test_login("perundurai-east.nurse@ruralcare.com")
if nurse:
    headers = {"Authorization": f"Bearer {nurse['access_token']}"}
    pts = requests.get(f"{BASE_URL}/patients", headers=headers).json()
    print(f"Perundurai East Nurse:")
    print(f"  - Role: {nurse.get('role')}")
    print(f"  - Assigned Village ID: {nurse.get('village_id')}")
    print(f"  - Patients visible: {len(pts)}")
    # Verify every returned patient has the nurse's village_id
    all_match = all(p.get("village_id") == nurse.get("village_id") for p in pts)
    print(f"  - Strict village scoping enforced: {all_match}")

# 2. Doctor Test (Perundurai)
doc_perundurai = test_login("perundurai.doctor@ruralcare.com")
if doc_perundurai:
    headers = {"Authorization": f"Bearer {doc_perundurai['access_token']}"}
    pts = requests.get(f"{BASE_URL}/patients", headers=headers).json()
    print(f"\nPerundurai Doctor:")
    print(f"  - Role: {doc_perundurai.get('role')}")
    print(f"  - Assigned Subdistrict ID: {doc_perundurai.get('subdistrict_id')}")
    print(f"  - Patients visible in jurisdiction: {len(pts)}")

# 3. Doctor Test (Bhavani)
doc_bhavani = test_login("bhavani.doctor@ruralcare.com")
if doc_bhavani:
    headers = {"Authorization": f"Bearer {doc_bhavani['access_token']}"}
    pts = requests.get(f"{BASE_URL}/patients", headers=headers).json()
    print(f"\nBhavani Doctor:")
    print(f"  - Role: {doc_bhavani.get('role')}")
    print(f"  - Assigned Subdistrict ID: {doc_bhavani.get('subdistrict_id')}")
    print(f"  - Patients visible in jurisdiction: {len(pts)}")

# 4. District Admin Test
admin = test_login("erode.admin@ruralcare.com")
if admin:
    headers = {"Authorization": f"Bearer {admin['access_token']}"}
    pts = requests.get(f"{BASE_URL}/patients", headers=headers).json()
    print(f"\nDistrict Admin:")
    print(f"  - Role: {admin.get('role')}")
    print(f"  - Total district-wide patients visible: {len(pts)}")

print("\n--- Testing Form Cascading Hierarchy Endpoints ---")
districts = requests.get(f"{BASE_URL}/locations/districts").json()
subdistricts = requests.get(f"{BASE_URL}/locations/subdistricts").json()
print(f"Districts available to forms: {len(districts)} -> {[d['name'] for d in districts]}")
print(f"Subdistricts (Taluks) available to forms: {len(subdistricts)} -> {[s['name'] for s in subdistricts]}")

if len(subdistricts) > 0:
    t_id = subdistricts[0]["id"]
    t_name = subdistricts[0]["name"]
    villages = requests.get(f"{BASE_URL}/locations/villages?subdistrict_id={t_id}").json()
    print(f"Sample cascading villages for {t_name} (ID: {t_id}): {len(villages)} villages retrieved")
