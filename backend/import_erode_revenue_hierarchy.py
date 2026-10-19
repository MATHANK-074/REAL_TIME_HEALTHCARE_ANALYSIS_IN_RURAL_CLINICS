import os
import sys
import io
import re
import urllib.request
from datetime import datetime
from bson import ObjectId
import pypdf
from pymongo import MongoClient

# Ensure app package is importable
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from app.config import settings

print("Connecting to MongoDB:", settings.DATABASE_URL.split("@")[-1])
client = MongoClient(settings.DATABASE_URL)
db = client["rural_healthcare"]

TALUK_PDF_SOURCES = [
    {
        "division": "Erode Revenue Division",
        "taluk": "Erode",
        "expected_count": 47,
        "url": "https://cdn.s3waas.gov.in/s3bca82e41ee7b0833588399b1fcd177c7/uploads/2026/09/17896255569241.pdf"
    },
    {
        "division": "Erode Revenue Division",
        "taluk": "Perundurai",
        "expected_count": 89,
        "url": "https://cdn.s3waas.gov.in/s3bca82e41ee7b0833588399b1fcd177c7/uploads/2026/09/17896255636442.pdf"
    },
    {
        "division": "Erode Revenue Division",
        "taluk": "Modakkurichi",
        "expected_count": 50,
        "url": "https://cdn.s3waas.gov.in/s3bca82e41ee7b0833588399b1fcd177c7/uploads/2026/09/17896255597387.pdf"
    },
    {
        "division": "Erode Revenue Division",
        "taluk": "Kodumudi",
        "expected_count": 37,
        "url": "https://cdn.s3waas.gov.in/s3bca82e41ee7b0833588399b1fcd177c7/uploads/2026/09/17896255588943.pdf"
    },
    {
        "division": "Gobichettipalayam Revenue Division",
        "taluk": "Gobichettipalayam",
        "expected_count": 61,
        "url": "https://cdn.s3waas.gov.in/s3bca82e41ee7b0833588399b1fcd177c7/uploads/2026/09/17896255571591.pdf"
    },
    {
        "division": "Gobichettipalayam Revenue Division",
        "taluk": "Sathyamangalam",
        "expected_count": 57,
        "url": "https://cdn.s3waas.gov.in/s3bca82e41ee7b0833588399b1fcd177c7/uploads/2026/09/17896255645229.pdf"
    },
    {
        "division": "Gobichettipalayam Revenue Division",
        "taluk": "Bhavani",
        "expected_count": 38,
        "url": "https://cdn.s3waas.gov.in/s3bca82e41ee7b0833588399b1fcd177c7/uploads/2026/09/17896255562054.pdf"
    },
    {
        "division": "Gobichettipalayam Revenue Division",
        "taluk": "Anthiyur",
        "expected_count": 34,
        "url": "https://cdn.s3waas.gov.in/s3bca82e41ee7b0833588399b1fcd177c7/uploads/2026/09/17896255554098.pdf"
    },
    {
        "division": "Gobichettipalayam Revenue Division",
        "taluk": "Thalavadi",
        "expected_count": 19,
        "url": "https://cdn.s3waas.gov.in/s3bca82e41ee7b0833588399b1fcd177c7/uploads/2026/09/17896255658734.pdf"
    },
    {
        "division": "Gobichettipalayam Revenue Division",
        "taluk": "Nambiyur",
        "expected_count": 33,
        "url": "https://cdn.s3waas.gov.in/s3bca82e41ee7b0833588399b1fcd177c7/uploads/2026/09/17896255617651.pdf"
    }
]

def extract_villages(pdf_bytes, taluk_name):
    reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
    full_text = ""
    for page in reader.pages:
        txt = page.extract_text()
        if txt:
            full_text += txt + "\n"
    
    lines = [line.strip() for line in full_text.splitlines() if line.strip()]
    villages = []
    
    header_pattern = re.compile(r"^(Taluk\s+Village\s+Name|S\.?No|Sl\.?\s*No|Village\s*Name)", re.IGNORECASE)
    
    for line in lines:
        if header_pattern.match(line):
            continue
        
        # Check if line is just the Taluk header itself (e.g. "PERUNDURAI TALUK", "GOBICHETTIPALAYAM TALUK")
        if re.match(rf"^{taluk_name}\s+TALUK$", line, re.IGNORECASE) or re.match(r"^[A-Z\s]+TALUK$", line, re.IGNORECASE):
            continue
            
        # Strip taluk prefix
        generic_prefix = re.compile(r"^[A-Z\s]+\s+TALUK\s+", re.IGNORECASE)
        cleaned = generic_prefix.sub("", line).strip()
        
        # Strip serial number if any
        sno_prefix = re.compile(r"^\d+[\.\)\s]+\s*")
        cleaned = sno_prefix.sub("", cleaned).strip()
        
        if cleaned and not cleaned.lower().startswith("village name") and not cleaned.lower().startswith("taluk"):
            villages.append(cleaned)
            
    return villages

def run_import():
    now = datetime.utcnow()

    # 1. Ensure District "Erode"
    erode_district = db.districts.find_one({"name": {"$regex": "^Erode$", "$options": "i"}})
    if not erode_district:
        res = db.districts.insert_one({"name": "Erode", "created_at": now})
        district_id = str(res.inserted_id)
        print(f"[CREATED] District Erode: {district_id}")
    else:
        district_id = str(erode_district["_id"])
        print(f"[FOUND] District Erode: {district_id}")

    # 2. Ensure Revenue Divisions
    divisions = [
        "Erode Revenue Division",
        "Gobichettipalayam Revenue Division"
    ]
    division_ids = {}
    for div_name in divisions:
        div_doc = db.revenue_divisions.find_one({"name": div_name, "district_id": district_id})
        if not div_doc:
            res = db.revenue_divisions.insert_one({
                "name": div_name,
                "district_id": district_id,
                "created_at": now
            })
            division_ids[div_name] = str(res.inserted_id)
            print(f"[CREATED] Division {div_name}: {division_ids[div_name]}")
        else:
            division_ids[div_name] = str(div_doc["_id"])
            print(f"[FOUND] Division {div_name}: {division_ids[div_name]}")

    # 3. Process each taluk and villages
    total_villages_inserted = 0
    taluk_ids = {}

    for item in TALUK_PDF_SOURCES:
        taluk_name = item["taluk"]
        div_name = item["division"]
        div_id = division_ids[div_name]
        
        # Find or create subdistrict / revenue_taluk
        # Check in subdistricts
        sub_doc = db.subdistricts.find_one({"name": {"$regex": f"^{taluk_name}$", "$options": "i"}, "district_id": district_id})
        if not sub_doc:
            res = db.subdistricts.insert_one({
                "name": taluk_name,
                "district_id": district_id,
                "revenue_division_id": div_id,
                "created_at": now
            })
            sub_id = str(res.inserted_id)
            print(f"\n[CREATED] Subdistrict/Taluk {taluk_name}: {sub_id} (under {div_name})")
        else:
            sub_id = str(sub_doc["_id"])
            db.subdistricts.update_one({"_id": sub_doc["_id"]}, {"$set": {"revenue_division_id": div_id}})
            print(f"\n[FOUND] Subdistrict/Taluk {taluk_name}: {sub_id} (linked to {div_name})")
            
        # Also ensure in revenue_taluks collection for geo_hierarchy router
        rt_doc = db.revenue_taluks.find_one({"name": {"$regex": f"^{taluk_name}$", "$options": "i"}})
        if not rt_doc:
            db.revenue_taluks.insert_one({
                "_id": ObjectId(sub_id),
                "name": taluk_name,
                "district_id": district_id,
                "division_id": div_id,
                "created_at": now
            })
        else:
            db.revenue_taluks.update_one({"_id": rt_doc["_id"]}, {"$set": {"division_id": div_id, "district_id": district_id}})

        taluk_ids[taluk_name] = sub_id

        # Download PDF and extract villages
        print(f"Downloading official village PDF for {taluk_name}...")
        req = urllib.request.Request(item["url"], headers={"User-Agent": "Mozilla/5.0"})
        pdf_bytes = urllib.request.urlopen(req, timeout=20).read()
        village_names = extract_villages(pdf_bytes, taluk_name)
        print(f"Extracted {len(village_names)} official villages for {taluk_name} (Expected: {item['expected_count']})")
        
        for v_name in village_names:
            # Check if village already exists under this subdistrict
            existing_v = db.villages.find_one({
                "name": v_name,
                "subdistrict_id": {"$in": [sub_id, ObjectId(sub_id)]}
            })
            if not existing_v:
                # Also check case-insensitive
                existing_v = db.villages.find_one({
                    "name": {"$regex": f"^{re.escape(v_name)}$", "$options": "i"},
                    "subdistrict_id": {"$in": [sub_id, ObjectId(sub_id)]}
                })

            if not existing_v:
                v_res = db.villages.insert_one({
                    "name": v_name,
                    "subdistrict_id": sub_id,
                    "district_id": district_id,
                    "division_id": div_id,
                    "created_at": now
                })
                v_id = v_res.inserted_id
                total_villages_inserted += 1
            else:
                v_id = existing_v["_id"]
                db.villages.update_one(
                    {"_id": v_id},
                    {"$set": {"subdistrict_id": sub_id, "district_id": district_id, "division_id": div_id}}
                )

            # Also maintain sync with revenue_villages collection
            db.revenue_villages.update_one(
                {"name": v_name, "taluk_id": sub_id},
                {"$set": {"name": v_name, "taluk_id": sub_id, "district_id": district_id, "created_at": now}},
                upsert=True
            )

    print("\n=======================================================")
    print("IMPORT COMPLETE!")
    print(f"Districts in DB: {db.districts.count_documents({})}")
    print(f"Revenue Divisions in DB: {db.revenue_divisions.count_documents({})}")
    print(f"Subdistricts (Taluks) in DB: {db.subdistricts.count_documents({})}")
    print(f"Villages in DB: {db.villages.count_documents({})}")
    print(f"New villages inserted: {total_villages_inserted}")
    print("=======================================================")

if __name__ == "__main__":
    run_import()
