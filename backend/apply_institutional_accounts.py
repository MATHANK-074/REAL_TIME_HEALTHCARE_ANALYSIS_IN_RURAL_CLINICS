import os
import sys
from datetime import datetime
from pymongo import MongoClient

# Ensure backend package is imported
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.config import settings
from app.utils.auth import hash_password

print("Connecting to MongoDB:", settings.DATABASE_URL.split("@")[-1])
client = MongoClient(settings.DATABASE_URL)
db = client["rural_healthcare"]

print("Connected to database:", db.name)

# 1. Inspect existing districts, subdistricts, villages
districts = list(db.districts.find())
print("Districts found:", len(districts), [d.get("name") for d in districts])

subdistricts = list(db.subdistricts.find())
print("Subdistricts found:", len(subdistricts), [s.get("name") for s in subdistricts])

villages = list(db.villages.find())
print("Villages found:", len(villages), [v.get("name") for v in villages])

def resolve_district_id(name: str):
    d = db.districts.find_one({"name": {"$regex": f"^{name}$", "$options": "i"}})
    return str(d["_id"]) if d else None

def resolve_subdistrict_id(name: str):
    s = db.subdistricts.find_one({"name": {"$regex": f"^{name}$", "$options": "i"}})
    return str(s["_id"]) if s else None

def resolve_village_id(name: str):
    v = db.villages.find_one({"name": {"$regex": f"^{name}$", "$options": "i"}})
    return str(v["_id"]) if v else None

ACCOUNT_DEFINITIONS = [
    {
        "email": "erode.admin@ruralcare.com",
        "name": "Erode District Admin",
        "role": "ADMIN",
        "district": "Erode",
        "subdistrict": None,
        "village": None,
    },
    {
        "email": "perundurai.doctor@ruralcare.com",
        "name": "Dr. Perundurai",
        "role": "DOCTOR",
        "district": "Erode",
        "subdistrict": "Perundurai",
        "village": None,
    },
    {
        "email": "bhavani.doctor@ruralcare.com",
        "name": "Dr. Bhavani",
        "role": "DOCTOR",
        "district": "Erode",
        "subdistrict": "Bhavani",
        "village": None,
    },
    {
        "email": "perundurai-east.nurse@ruralcare.com",
        "name": "Nurse Perundurai East",
        "role": "NURSE",
        "district": "Erode",
        "subdistrict": "Perundurai",
        "village": "Perundurai East",
    },
    {
        "email": "perundurai-west.nurse@ruralcare.com",
        "name": "Nurse Perundurai West",
        "role": "NURSE",
        "district": "Erode",
        "subdistrict": "Perundurai",
        "village": "Perundurai West",
    },
]

DEFAULT_PASSWORD = "password123"
hashed_pwd = hash_password(DEFAULT_PASSWORD)

for acct in ACCOUNT_DEFINITIONS:
    dist_id = resolve_district_id(acct["district"]) if acct["district"] else None
    sub_id = resolve_subdistrict_id(acct["subdistrict"]) if acct["subdistrict"] else None
    vil_id = resolve_village_id(acct["village"]) if acct["village"] else None
    
    # If village not found with exact name, try to find any village in that subdistrict
    if acct["role"] == "NURSE" and not vil_id and sub_id:
        v_match = db.villages.find_one({"subdistrict_id": {"$in": [sub_id, None]}})
        if v_match:
            vil_id = str(v_match["_id"])
            print(f"Assigned fallback village {v_match.get('name')} to {acct['email']}")

    user_data = {
        "name": acct["name"],
        "email": acct["email"],
        "password_hash": hashed_pwd,
        "role": acct["role"],
        "phone": "9876543210",
        "district_id": dist_id,
        "subdistrict_id": sub_id,
        "village_id": vil_id,
        "area_id": None,
        "clinic_id": None,
        "qualification": "MBBS" if acct["role"] == "DOCTOR" else "B.Sc Nursing",
        "is_active": True,
        "updated_at": datetime.utcnow()
    }

    existing = db.users.find_one({"email": acct["email"]})
    if existing:
        db.users.update_one({"_id": existing["_id"]}, {"$set": user_data})
        print(f"[UPDATED] {acct['email']} (Role: {acct['role']}, Subdistrict: {sub_id}, Village: {vil_id})")
    else:
        user_data["created_at"] = datetime.utcnow()
        res = db.users.insert_one(user_data)
        print(f"[CREATED] {acct['email']} (ID: {res.inserted_id}, Role: {acct['role']})")

print("\n--- Verification ---")
for acct in ACCOUNT_DEFINITIONS:
    u = db.users.find_one({"email": acct["email"]})
    from app.utils.auth import verify_password
    is_valid = verify_password(DEFAULT_PASSWORD, u["password_hash"])
    print(f"User: {u['email']} | Active: {u['is_active']} | Password 'password123' valid: {is_valid}")
