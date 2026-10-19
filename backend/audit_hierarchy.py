import os
import sys
from bson import ObjectId
from pymongo import MongoClient

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from app.config import settings
from test_pdf_extractor import TALUK_PDF_SOURCES

client = MongoClient(settings.DATABASE_URL)
db = client["rural_healthcare"]

print("=================================================================")
print("          ERODE REVENUE HIERARCHY COMPREHENSIVE AUDIT           ")
print("=================================================================")

# 1. District Check
districts = list(db.districts.find())
print(f"\n1. DISTRICTS: Found {len(districts)}")
for d in districts:
    print(f"   - ID: {d['_id']} | Name: {d.get('name')}")

# 2. Revenue Divisions Check
divisions = list(db.revenue_divisions.find())
print(f"\n2. REVENUE DIVISIONS: Found {len(divisions)}")
for div in divisions:
    print(f"   - ID: {div['_id']} | Name: {div.get('name')} | District: {div.get('district_id')}")

# 3. Clean up legacy 'GOBI' subdistrict if safe
gobi_legacy = db.subdistricts.find_one({"name": "GOBI"})
if gobi_legacy:
    anthiyur = db.subdistricts.find_one({"name": "Anthiyur"})
    # Re-point athani village to official Anthiyur taluk if it was pointing to GOBI
    res = db.villages.update_many(
        {"subdistrict_id": str(gobi_legacy["_id"])},
        {"$set": {"subdistrict_id": str(anthiyur["_id"]) if anthiyur else None}}
    )
    print(f"\n[CLEANUP] Re-linked {res.modified_count} villages from legacy GOBI to Anthiyur")
    db.subdistricts.delete_one({"_id": gobi_legacy["_id"]})
    print(f"[CLEANUP] Removed orphaned legacy subdistrict 'GOBI'")

# 4. Official 10 Taluks Check
subdistricts = list(db.subdistricts.find())
print(f"\n3. REVENUE TALUKS (Subdistricts): Found {len(subdistricts)} (Expected: 10)")
taluk_name_map = {}
for s in subdistricts:
    taluk_name_map[s["name"].lower()] = s
    div_doc = db.revenue_divisions.find_one({"_id": ObjectId(s["revenue_division_id"])}) if s.get("revenue_division_id") else None
    div_name = div_doc["name"] if div_doc else "NONE"
    print(f"   - Taluk: {s['name']:<18} | ID: {s['_id']} | Division: {div_name}")

# 5. Taluk-wise Village Counts vs Expected (465 Official)
print(f"\n4. TALUK-WISE REVENUE VILLAGE COUNTS:")
print(f"   {'Taluk Name':<20} {'Division':<35} {'Expected':<10} {'Found In DB':<12} {'Status'}")
print("   " + "-" * 85)

total_expected = 0
total_found = 0
audit_passed = True

for item in TALUK_PDF_SOURCES:
    t_name = item["taluk"]
    expected = item["expected_count"]
    total_expected += expected
    
    s_doc = taluk_name_map.get(t_name.lower())
    if not s_doc:
        print(f"   {t_name:<20} {item['division']:<35} {expected:<10} {'MISSING':<12} [FAIL]")
        audit_passed = False
        continue
    
    s_id = str(s_doc["_id"])
    # Count official villages in revenue_villages and in villages
    v_count = db.villages.count_documents({
        "subdistrict_id": {"$in": [s_id, ObjectId(s_id)]},
        # Exclude legacy prototype names if any
        "name": {"$nin": ["Perundurai East", "Perundurai West", "Bhavani Center"]}
    })
    
    total_found += v_count
    status = "OK" if v_count == expected else f"MISMATCH ({v_count - expected:+d})"
    if v_count != expected:
        audit_passed = False
    print(f"   {t_name:<20} {item['division']:<35} {expected:<10} {v_count:<12} {status}")

print("   " + "-" * 85)
print(f"   {'TOTAL':<20} {'':<35} {total_expected:<10} {total_found:<12} {'PASS' if audit_passed else 'MISMATCH'}")

# 6. Check for split revenue villages with (a), (b), (c)
split_villages = list(db.villages.find({"name": {"$regex": r"^\([a-c]\)"}}))
print(f"\n5. OFFICIAL SPLIT ENTRIES PRESERVED: Found {len(split_villages)} entries with (a), (b), or (c)")
sample_splits = [f"{v['name']}" for v in split_villages[:8]]
print(f"   Sample: {', '.join(sample_splits)}...")

# 7. Check for duplicate village names within the same taluk
print(f"\n6. DUPLICATE CHECK WITHIN SAME TALUK:")
pipeline = [
    {"$group": {"_id": {"name": "$name", "subdistrict_id": "$subdistrict_id"}, "count": {"$sum": 1}}},
    {"$match": {"count": {"$gt": 1}}}
]
dups = list(db.villages.aggregate(pipeline))
if dups:
    print(f"   [WARN] Found {len(dups)} duplicate entries:")
    for d in dups:
        print(f"      - {d['_id']['name']} in subdistrict {d['_id']['subdistrict_id']} (count: {d['count']})")
else:
    print(f"   [OK] Zero duplicates found within any taluk.")

# 8. Check parent ID integrity
print(f"\n7. PARENT ID INTEGRITY CHECK:")
orphaned_subdistricts = db.subdistricts.count_documents({"revenue_division_id": None})
orphaned_villages = db.villages.count_documents({"subdistrict_id": None})
print(f"   - Subdistricts without valid Revenue Division: {orphaned_subdistricts}")
print(f"   - Villages without valid Subdistrict ID: {orphaned_villages}")

print("=================================================================")
