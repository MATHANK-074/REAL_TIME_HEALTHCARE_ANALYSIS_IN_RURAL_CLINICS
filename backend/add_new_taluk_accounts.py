import os
import sys
from datetime import datetime
from pymongo import MongoClient

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from app.config import settings
from app.utils.auth import hash_password

client = MongoClient(settings.DATABASE_URL)
db = client["rural_healthcare"]

pwd = hash_password("password123")
now = datetime.utcnow()

# Let's create institutional accounts for several newly imported taluks
NEW_STAFF = [
    # Sathyamangalam Taluk & its official village Rajan Nagar
    {
        "taluk": "Sathyamangalam",
        "doctor_email": "sathyamangalam.doctor@ruralcare.com",
        "doctor_name": "Dr. Sathyamangalam",
        "nurse_email": "rajan-nagar.nurse@ruralcare.com",
        "nurse_name": "Nurse Rajan Nagar",
        "village_name": "Rajan Nagar"
    },
    # Gobichettipalayam Taluk & its official village Modachur
    {
        "taluk": "Gobichettipalayam",
        "doctor_email": "gobi.doctor@ruralcare.com",
        "doctor_name": "Dr. Gobichettipalayam",
        "nurse_email": "modachur.nurse@ruralcare.com",
        "nurse_name": "Nurse Modachur",
        "village_name": "Modachur"
    },
    # Anthiyur Taluk & its official village Ammapettai
    {
        "taluk": "Anthiyur",
        "doctor_email": "anthiyur.doctor@ruralcare.com",
        "doctor_name": "Dr. Anthiyur",
        "nurse_email": "ammapettai.nurse@ruralcare.com",
        "nurse_name": "Nurse Ammapettai",
        "village_name": "(a) Ammapettai"
    },
    # Thalavadi Taluk & its official village Mallankuli
    {
        "taluk": "Thalavadi",
        "doctor_email": "thalavadi.doctor@ruralcare.com",
        "doctor_name": "Dr. Thalavadi",
        "nurse_email": "mallankuli.nurse@ruralcare.com",
        "nurse_name": "Nurse Mallankuli",
        "village_name": "Mallankuli"
    }
]

created = []

for staff in NEW_STAFF:
    taluk_doc = db.subdistricts.find_one({"name": staff["taluk"]})
    if not taluk_doc:
        print(f"[WARN] Taluk {staff['taluk']} not found in DB")
        continue

    taluk_id = str(taluk_doc["_id"])
    dist_id = str(taluk_doc.get("district_id"))

    village_doc = db.villages.find_one({
        "name": staff["village_name"],
        "subdistrict_id": taluk_id,
        "is_official": True
    })
    village_id = str(village_doc["_id"]) if village_doc else None

    # Upsert Doctor
    doc_data = {
        "name": staff["doctor_name"],
        "email": staff["doctor_email"],
        "password_hash": pwd,
        "role": "DOCTOR",
        "district_id": dist_id,
        "subdistrict_id": taluk_id,
        "village_id": None,
        "qualification": "MBBS, MD",
        "is_active": True,
        "updated_at": now
    }
    db.users.update_one({"email": staff["doctor_email"]}, {"$set": doc_data}, upsert=True)
    created.append({"role": "DOCTOR", "email": staff["doctor_email"], "name": staff["doctor_name"], "taluk": staff["taluk"]})

    # Upsert Nurse
    if village_id:
        nurse_data = {
            "name": staff["nurse_name"],
            "email": staff["nurse_email"],
            "password_hash": pwd,
            "role": "NURSE",
            "district_id": dist_id,
            "subdistrict_id": taluk_id,
            "village_id": village_id,
            "qualification": "B.Sc Nursing",
            "is_active": True,
            "updated_at": now
        }
        db.users.update_one({"email": staff["nurse_email"]}, {"$set": nurse_data}, upsert=True)
        created.append({"role": "NURSE", "email": staff["nurse_email"], "name": staff["nurse_name"], "village": staff["village_name"], "taluk": staff["taluk"]})

print("=== Successfully Created Accounts for Newly Added Subdistricts & Villages ===")
for c in created:
    if c["role"] == "DOCTOR":
        print(f"DOCTOR : {c['email']} | {c['taluk']} Taluk | Password: password123")
    else:
        print(f"NURSE  : {c['email']} | {c['village']} Village ({c['taluk']} Taluk) | Password: password123")
