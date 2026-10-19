import os
import sys
import io
import re
import urllib.request
from datetime import datetime
from bson import ObjectId
import pypdf
from pymongo import MongoClient

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

def extract_villages_with_index(pdf_bytes, taluk_name):
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
        
        # Check if line is just the Taluk header itself
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

def make_idempotent_import():
    now = datetime.utcnow()

    # 1. Ensure District "Erode"
    erode_district = db.districts.find_one({"name": {"$regex": "^Erode$", "$options": "i"}})
    if not erode_district:
        res = db.districts.insert_one({"name": "Erode", "created_at": now})
        district_id = str(res.inserted_id)
    else:
        district_id = str(erode_district["_id"])
    print(f"District Erode ID: {district_id}")

    # 2. Ensure Revenue Divisions
    division_ids = {}
    for div_name in ["Erode Revenue Division", "Gobichettipalayam Revenue Division"]:
        div_doc = db.revenue_divisions.find_one({"name": div_name, "district_id": district_id})
        if not div_doc:
            res = db.revenue_divisions.insert_one({"name": div_name, "district_id": district_id, "created_at": now})
            division_ids[div_name] = str(res.inserted_id)
        else:
            division_ids[div_name] = str(div_doc["_id"])
    print(f"Revenue Divisions: {division_ids}")

    # 3. Clean up any remaining legacy GOBI subdistrict
    legacy_gobi = db.subdistricts.find_one({"name": "GOBI"})
    anthiyur_taluk = db.subdistricts.find_one({"name": "Anthiyur"})
    if legacy_gobi:
        if anthiyur_taluk:
            db.villages.update_many({"subdistrict_id": str(legacy_gobi["_id"])}, {"$set": {"subdistrict_id": str(anthiyur_taluk["_id"])}})
        db.subdistricts.delete_one({"_id": legacy_gobi["_id"]})
        print("Removed legacy 'GOBI' subdistrict entry.")

    # 4. Mark legacy prototype villages explicitly so they do not conflict with official statistics
    legacy_names = ["Perundurai East", "Perundurai West", "Bhavani Center", "Pallipalayam", "athani"]
    db.villages.update_many(
        {"name": {"$in": legacy_names}},
        {"$set": {"is_official": False, "is_legacy": True}}
    )
    print("Marked prototype villages as is_legacy=True, is_official=False")

    # 5. Process the 10 Taluks and their official revenue villages
    grand_total_official = 0

    for item in TALUK_PDF_SOURCES:
        taluk_name = item["taluk"]
        div_name = item["division"]
        div_id = division_ids[div_name]
        expected_count = item["expected_count"]

        # Ensure subdistrict exists
        sub_doc = db.subdistricts.find_one({"name": {"$regex": f"^{taluk_name}$", "$options": "i"}, "district_id": district_id})
        if not sub_doc:
            res = db.subdistricts.insert_one({
                "name": taluk_name,
                "district_id": district_id,
                "revenue_division_id": div_id,
                "created_at": now
            })
            sub_id = str(res.inserted_id)
        else:
            sub_id = str(sub_doc["_id"])
            db.subdistricts.update_one({"_id": sub_doc["_id"]}, {"$set": {"revenue_division_id": div_id}})

        # Also sync revenue_taluks
        db.revenue_taluks.update_one(
            {"name": {"$regex": f"^{taluk_name}$", "$options": "i"}},
            {"$set": {"name": taluk_name, "district_id": district_id, "division_id": div_id, "created_at": now}},
            upsert=True
        )

        # Download & parse PDF
        req = urllib.request.Request(item["url"], headers={"User-Agent": "Mozilla/5.0"})
        pdf_bytes = urllib.request.urlopen(req, timeout=20).read()
        v_list = extract_villages_with_index(pdf_bytes, taluk_name)

        if len(v_list) != expected_count:
            print(f"[ERROR] Extracted {len(v_list)} entries for {taluk_name}, expected {expected_count}!")

        # Upsert each official village by (taluk_id + official_index) to guarantee 100% idempotency
        for idx, v_name in enumerate(v_list, start=1):
            village_doc = {
                "name": v_name,
                "subdistrict_id": sub_id,
                "taluk_id": sub_id,
                "district_id": district_id,
                "division_id": div_id,
                "official_index": idx,
                "is_official": True,
                "is_legacy": False,
                "source_pdf": item["url"],
                "updated_at": now
            }
            # Match by taluk_id + official_index to guarantee exact entry preservation (even for repeating names like Thindal)
            existing_match = db.villages.find_one({
                "subdistrict_id": sub_id,
                "official_index": idx,
                "is_official": True
            })

            if existing_match:
                db.villages.update_one({"_id": existing_match["_id"]}, {"$set": village_doc})
            else:
                # If an entry exists with the exact name and is_official and no official_index, update it
                name_match = db.villages.find_one({
                    "subdistrict_id": sub_id,
                    "name": v_name,
                    "official_index": {"$exists": False},
                    "is_official": {"$ne": False}
                })
                if name_match:
                    db.villages.update_one({"_id": name_match["_id"]}, {"$set": village_doc})
                else:
                    village_doc["created_at"] = now
                    db.villages.insert_one(village_doc)

            # Sync revenue_villages collection
            db.revenue_villages.update_one(
                {"taluk_id": sub_id, "official_index": idx},
                {"$set": {
                    "name": v_name,
                    "taluk_id": sub_id,
                    "district_id": district_id,
                    "official_index": idx,
                    "created_at": now
                }},
                upsert=True
            )

        official_in_taluk = db.villages.count_documents({"subdistrict_id": sub_id, "is_official": True})
        print(f"Taluk: {taluk_name:<18} | Expected: {expected_count:<3} | Official Count: {official_in_taluk:<3} | Status: {'OK' if official_in_taluk == expected_count else 'FAIL'}")
        grand_total_official += official_in_taluk

    print(f"\nTotal Official Revenue Villages in DB: {grand_total_official} (Expected: 465)")

if __name__ == "__main__":
    make_idempotent_import()
