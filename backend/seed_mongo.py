import os
from pymongo import MongoClient
from datetime import datetime

# Connect to MongoDB
DATABASE_URL = os.getenv("DATABASE_URL", "mongodb://localhost:27017/")
client = MongoClient(DATABASE_URL)
db = client["rural_healthcare"]

# Drop existing to start fresh
db.users.drop()

users = [
    {
        "_id": "1",
        "name": "District Admin",
        "email": "admin@ruralcare.com",
        "password_hash": "$2b$12$Z3LVDCXo/ICeKxPwbWysROoZDSFHIUbNxgidZTComlsBi3rkC38Sy",
        "role": "ADMIN",
        "phone": "+91 90000 11111",
        "is_active": True,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    },
    {
        "_id": "2",
        "name": "Dr. Arun",
        "email": "doctor@ruralcare.com",
        "password_hash": "$2b$12$Z3LVDCXo/ICeKxPwbWysROoZDSFHIUbNxgidZTComlsBi3rkC38Sy",
        "role": "DOCTOR",
        "phone": "+91 90000 33333",
        "is_active": True,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    },
    {
        "_id": "3",
        "name": "Nurse 01",
        "email": "nurse@ruralcare.com",
        "password_hash": "$2b$12$Z3LVDCXo/ICeKxPwbWysROoZDSFHIUbNxgidZTComlsBi3rkC38Sy",
        "role": "NURSE",
        "phone": "+91 90000 22222",
        "is_active": True,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
]

db.users.insert_many(users)
print("Seeded MongoDB with users.")
