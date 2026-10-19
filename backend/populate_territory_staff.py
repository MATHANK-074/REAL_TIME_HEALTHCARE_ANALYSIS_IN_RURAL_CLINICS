import os
import sys
import re
from datetime import datetime
from pymongo import MongoClient

# Ensure backend app imports work
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from app.config import settings
from app.utils.auth import hash_password

client = MongoClient(settings.DATABASE_URL)
db = client["rural_healthcare"]

pwd = hash_password("password123")
now = datetime.utcnow()

dist = db.districts.find_one()
dist_id = str(dist["_id"]) if dist else None

subdistricts = list(db.subdistricts.find())
print(f"Loaded {len(subdistricts)} Taluks from Erode district.")

def slugify(text: str) -> str:
    cleaned = re.sub(r'[^a-zA-Z0-9]+', '-', text.lower()).strip('-')
    return cleaned or "territory"

created_doctors = 0
created_nurses = 0

for sub in subdistricts:
    sub_id = str(sub["_id"])
    taluk_name = sub.get("name", "").strip()
    slug = slugify(taluk_name)
    
    # 1. Ensure Taluk Medical Officer (Primary Doctor)
    primary_doc_email = f"{slug}.doctor@ruralcare.com"
    existing_primary = db.users.find_one({"email": primary_doc_email})
    if not existing_primary:
        primary_doc = {
            "name": f"Dr. {taluk_name} (Medical Officer)",
            "email": primary_doc_email,
            "password_hash": pwd,
            "role": "DOCTOR",
            "phone": "+91 94440 " + str(abs(hash(primary_doc_email)) % 90000 + 10000),
            "district_id": dist_id,
            "subdistrict_id": sub_id,
            "village_id": None,
            "qualification": "MBBS, MD (Community Medicine)",
            "is_active": True,
            "created_at": now,
            "updated_at": now
        }
        db.users.insert_one(primary_doc)
        created_doctors += 1
        print(f"  [+] Created Taluk Doctor: {primary_doc_email} ({taluk_name} Taluk)")
    else:
        # Ensure correct jurisdiction
        db.users.update_one({"_id": existing_primary["_id"]}, {"$set": {"subdistrict_id": sub_id, "district_id": dist_id, "is_active": True}})
    
    # 2. Ensure Secondary Taluk Specialist / Consultant
    specialist_email = f"{slug}.specialist@ruralcare.com"
    existing_spec = db.users.find_one({"email": specialist_email})
    if not existing_spec:
        spec_doc = {
            "name": f"Dr. {taluk_name} (OB/GYN Consultant)",
            "email": specialist_email,
            "password_hash": pwd,
            "role": "DOCTOR",
            "phone": "+91 94441 " + str(abs(hash(specialist_email)) % 90000 + 10000),
            "district_id": dist_id,
            "subdistrict_id": sub_id,
            "village_id": None,
            "qualification": "MBBS, MS (OBG)",
            "is_active": True,
            "created_at": now,
            "updated_at": now
        }
        db.users.insert_one(spec_doc)
        created_doctors += 1
        print(f"  [+] Created Taluk Specialist: {specialist_email} ({taluk_name} Taluk)")
    
    # 3. Ensure At Least 3 Nurses for Top Official Villages in this Taluk
    villages = list(db.villages.find({"subdistrict_id": sub_id}).limit(4))
    if not villages:
        # Fallback if villages have subdistrict_id stored as ObjectId or none
        villages = list(db.villages.find({"subdistrict_id": sub["_id"]}).limit(4))
    
    for idx, vil in enumerate(villages[:3]):
        vil_id = str(vil["_id"])
        vil_name = vil.get("name", "Village").strip()
        vil_slug = slugify(vil_name)
        nurse_email = f"nurse.{slug}.{vil_slug}@ruralcare.com"
        
        existing_nurse = db.users.find_one({"email": nurse_email})
        if not existing_nurse:
            nurse_data = {
                "name": f"Nurse {vil_name}",
                "email": nurse_email,
                "password_hash": pwd,
                "role": "NURSE",
                "phone": "+91 98880 " + str(abs(hash(nurse_email)) % 90000 + 10000),
                "district_id": dist_id,
                "subdistrict_id": sub_id,
                "village_id": vil_id,
                "qualification": "B.Sc Nursing (Community Health)",
                "is_active": True,
                "created_at": now,
                "updated_at": now
            }
            db.users.insert_one(nurse_data)
            created_nurses += 1
            print(f"  [+] Created Nurse: {nurse_email} ({vil_name}, {taluk_name})")

print(f"\n=======================================================")
print(f"Successfully Added Territory Staff:")
print(f"  - New Doctors Created: {created_doctors}")
print(f"  - New Nurses Created : {created_nurses}")
print(f"=======================================================")
