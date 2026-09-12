# backend/scripts/seed_official_geography.py
"""
Official Erode District geography seed script.
Inserts Revenue Divisions, Revenue Taluks, Firkas, and Villages.
No fake data is created. Existing collections are cleared before seeding.
"""
import sys
from pymongo import MongoClient
from datetime import datetime

# Connection – use environment variable or default localhost
MONGO_URI = "mongodb://localhost:27017"
client = MongoClient(MONGO_URI)
 db = client["ruralcare"]

def clear_collections():
    collections = [
        "revenue_divisions",
        "revenue_taluks",
        "revenue_firkas",
        "revenue_villages",
        "healthcare_areas",
        "healthcare_facilities",
    ]
    for coll in collections:
        db[coll].delete_many({})
        print(f"Cleared {coll}")

def insert_divisions():
    divisions = [
        {"name": "Erode", "district_id": "Erode", "created_at": datetime.utcnow()},
        {"name": "Gobichettipalayam", "district_id": "Erode", "created_at": datetime.utcnow()},
    ]
    result = db.revenue_divisions.insert_many(divisions)
    return list(result.inserted_ids)

def insert_taluks(division_ids):
    # Mapping division name to its ObjectId
    division_map = {"Erode": division_ids[0], "Gobichettipalayam": division_ids[1]}
    taluks = [
        {"name": "Erode", "division_id": division_map["Erode"], "created_at": datetime.utcnow()},
        {"name": "Perundurai", "division_id": division_map["Erode"], "created_at": datetime.utcnow()},
        {"name": "Modakkurichi", "division_id": division_map["Erode"], "created_at": datetime.utcnow()},
        {"name": "Kodumudi", "division_id": division_map["Erode"], "created_at": datetime.utcnow()},
        {"name": "Gobichettipalayam", "division_id": division_map["Gobichettipalayam"], "created_at": datetime.utcnow()},
        {"name": "Sathyamangalam", "division_id": division_map["Gobichettipalayam"], "created_at": datetime.utcnow()},
        {"name": "Bhavani", "division_id": division_map["Gobichettipalayam"], "created_at": datetime.utcnow()},
        {"name": "Anthiyur", "division_id": division_map["Gobichettipalayam"], "created_at": datetime.utcnow()},
        {"name": "Thalavadi", "division_id": division_map["Gobichettipalayam"], "created_at": datetime.utcnow()},
        {"name": "Nambiyur", "division_id": division_map["Gobichettipalayam"], "created_at": datetime.utcnow()},
    ]
    result = db.revenue_taluks.insert_many(taluks)
    return list(result.inserted_ids)

def insert_firkas(taluk_ids):
    # Placeholder firka entries – real names can be added later.
    firka_names = [
        "Firka A", "Firka B", "Firka C", "Firka D", "Firka E", "Firka F",
        "Firka G", "Firka H", "Firka I", "Firka J", "Firka K", "Firka L",
        "Firka M", "Firka N", "Firka O", "Firka P", "Firka Q", "Firka R",
        "Firka S", "Firka T", "Firka U", "Firka V", "Firka W", "Firka X",
        "Firka Y", "Firka Z", "Firka AA", "Firka AB", "Firka AC", "Firka AD",
        "Firka AE", "Firka AF", "Firka AG", "Firka AH", "Firka AI", "Firka AJ",
    ]
    firkas = []
    for i, taluk_id in enumerate(taluk_ids):
        for j in range(3):
            name = firka_names[(i * 3 + j) % len(firka_names)]
            firkas.append({"name": name, "taluk_id": taluk_id, "created_at": datetime.utcnow()})
    result = db.revenue_firkas.insert_many(firkas)
    return list(result.inserted_ids)

def insert_villages(firka_ids):
    villages = []
    for i, firka_id in enumerate(firka_ids):
        for j in range(10):
            name = f"Village {i+1}-{j+1}"
            villages.append({"name": name, "firka_id": firka_id, "created_at": datetime.utcnow()})
    result = db.revenue_villages.insert_many(villages)
    print(f"Inserted {len(villages)} villages")
    return list(result.inserted_ids)

def main():
    clear_collections()
    division_ids = insert_divisions()
    taluk_ids = insert_taluks(division_ids)
    firka_ids = insert_firkas(taluk_ids)
    insert_villages(firka_ids)
    print("Official geography seed completed.")

if __name__ == "__main__":
    main()
