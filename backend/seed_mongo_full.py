import os
from pymongo import MongoClient
from datetime import datetime, timezone
from bson import ObjectId

DATABASE_URL = os.getenv("DATABASE_URL", "mongodb://localhost:27017/")
client = MongoClient(DATABASE_URL)
db = client["rural_healthcare"]

# Clean all collections (except users which we already seeded correctly)
db.districts.drop()
db.subdistricts.drop()
db.villages.drop()
db.patients.drop()
db.health_records.drop()
db.predictions.drop()
db.prediction_factors.drop()
db.alerts.drop()
db.followups.drop()

# Seed Districts
district1 = {"_id": ObjectId(), "name": "Erode", "created_at": datetime.now(timezone.utc)}
db.districts.insert_one(district1)
dist_id = str(district1["_id"])

# Seed Subdistricts
sub1 = {"_id": ObjectId(), "name": "Perundurai", "district_id": dist_id, "created_at": datetime.now(timezone.utc)}
sub2 = {"_id": ObjectId(), "name": "Bhavani", "district_id": dist_id, "created_at": datetime.now(timezone.utc)}
db.subdistricts.insert_many([sub1, sub2])
sub1_id, sub2_id = str(sub1["_id"]), str(sub2["_id"])

# Seed Villages
v1 = {"_id": ObjectId(), "name": "Perundurai East", "subdistrict_id": sub1_id, "created_at": datetime.now(timezone.utc)}
v2 = {"_id": ObjectId(), "name": "Perundurai West", "subdistrict_id": sub1_id, "created_at": datetime.now(timezone.utc)}
v3 = {"_id": ObjectId(), "name": "Pallipalayam", "subdistrict_id": sub2_id, "created_at": datetime.now(timezone.utc)}
v4 = {"_id": ObjectId(), "name": "Bhavani Center", "subdistrict_id": sub2_id, "created_at": datetime.now(timezone.utc)}
db.villages.insert_many([v1, v2, v3, v4])
v1_id, v2_id, v3_id, v4_id = str(v1["_id"]), str(v2["_id"]), str(v3["_id"]), str(v4["_id"])

# Update the seeded users with location IDs
# District Admin -> Erode (dist_id)
# Dr. Arun -> Perundurai (sub1_id)
# Nurse 01 -> Perundurai East (v1_id)
db.users.update_one({"email": "admin@ruralcare.com"}, {"$set": {"district_id": dist_id}})
db.users.update_one({"email": "doctor@ruralcare.com"}, {"$set": {"subdistrict_id": sub1_id}})
db.users.update_one({"email": "nurse@ruralcare.com"}, {"$set": {"village_id": v1_id}})
nurse_id = str(db.users.find_one({"email": "nurse@ruralcare.com"})["_id"])
doctor_id = str(db.users.find_one({"email": "doctor@ruralcare.com"})["_id"])

# Seed Patients
patients = [
    {"_id": ObjectId(), "patient_code": "RH-0001", "name": "Kumar", "age": 45, "gender": "Male", "phone": "9876543210", "village_id": v1_id, "address": "12 Ward 3, Perundurai East", "blood_group": "O+", "emergency_contact": "9876543290", "existing_disease": "None", "allergies": "None", "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc)},
    {"_id": ObjectId(), "patient_code": "RH-0002", "name": "Ravi", "age": 52, "gender": "Male", "phone": "9876543211", "village_id": v1_id, "address": "34 East Cross, Perundurai East", "blood_group": "A+", "emergency_contact": "9876543291", "existing_disease": "Hypertension", "allergies": "Penicillin", "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc)},
    {"_id": ObjectId(), "patient_code": "RH-0003", "name": "Priya", "age": 28, "gender": "Female", "phone": "9876543212", "village_id": v3_id, "address": "7 South St, Pallipalayam", "blood_group": "B+", "emergency_contact": "9876543292", "existing_disease": "None", "allergies": "Dust", "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc)},
    {"_id": ObjectId(), "patient_code": "RH-0004", "name": "Meena", "age": 32, "gender": "Female", "phone": "9876543213", "village_id": v3_id, "address": "18 North St, Pallipalayam", "blood_group": "O-", "emergency_contact": "9876543293", "existing_disease": "None", "allergies": "None", "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc)},
    {"_id": ObjectId(), "patient_code": "RH-0005", "name": "Balan", "age": 60, "gender": "Male", "phone": "9876543214", "village_id": v4_id, "address": "88 Main Bazaar, Bhavani Center", "blood_group": "AB+", "emergency_contact": "9876543294", "existing_disease": "Diabetes", "allergies": "None", "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc)}
]
db.patients.insert_many(patients)
p1_id = str(patients[0]["_id"])
p2_id = str(patients[1]["_id"])
p3_id = str(patients[2]["_id"])
p4_id = str(patients[3]["_id"])
p5_id = str(patients[4]["_id"])

# Seed Health Records
records = [
    {"_id": ObjectId(), "patient_id": p1_id, "recorded_by": nurse_id, "weight": "78.00", "height": "1.70", "bmi": "27.0", "blood_pressure": "130/85", "systolic_bp": 130, "diastolic_bp": 85, "heart_rate": 76, "temperature": "98.4", "blood_glucose": 130, "cholesterol": 180, "insulin": 0, "pregnancies": 0, "smoking_status": "NEVER", "recorded_at": datetime.now(timezone.utc)},
    {"_id": ObjectId(), "patient_id": p1_id, "recorded_by": nurse_id, "weight": "78.50", "height": "1.70", "bmi": "27.2", "blood_pressure": "150/95", "systolic_bp": 150, "diastolic_bp": 95, "heart_rate": 84, "temperature": "99.0", "blood_glucose": 180, "cholesterol": 210, "insulin": 0, "pregnancies": 0, "smoking_status": "NEVER", "recorded_at": datetime.now(timezone.utc)},
    {"_id": ObjectId(), "patient_id": p2_id, "recorded_by": nurse_id, "weight": "85.00", "height": "1.75", "bmi": "27.8", "blood_pressure": "160/100", "systolic_bp": 160, "diastolic_bp": 100, "heart_rate": 88, "temperature": "98.6", "blood_glucose": 110, "cholesterol": 240, "insulin": 0, "pregnancies": 0, "smoking_status": "CURRENT", "recorded_at": datetime.now(timezone.utc)},
    {"_id": ObjectId(), "patient_id": p3_id, "recorded_by": nurse_id, "weight": "68.00", "height": "1.62", "bmi": "25.9", "blood_pressure": "135/90", "systolic_bp": 135, "diastolic_bp": 90, "heart_rate": 90, "temperature": "98.8", "blood_glucose": 170, "cholesterol": 190, "insulin": 0, "pregnancies": 2, "smoking_status": "NEVER", "recorded_at": datetime.now(timezone.utc)},
]
db.health_records.insert_many(records)
hr_p1_last = str(records[1]["_id"])
hr_p2 = str(records[2]["_id"])
hr_p3 = str(records[3]["_id"])

# Seed Predictions
preds = [
    {"_id": ObjectId(), "patient_id": p1_id, "health_record_id": hr_p1_last, "model_name": "DIABETES", "disease": "Diabetes Risk", "probability": "0.870", "risk_level": "HIGH", "prediction_result": "Positive", "model_version": "1.0.0", "predicted_at": datetime.now(timezone.utc)},
    {"_id": ObjectId(), "patient_id": p2_id, "health_record_id": hr_p2, "model_name": "HYPERTENSION", "disease": "Hypertension/Cardiovascular Risk", "probability": "0.810", "risk_level": "HIGH", "prediction_result": "Positive", "model_version": "1.0.0", "predicted_at": datetime.now(timezone.utc)},
    {"_id": ObjectId(), "patient_id": p3_id, "health_record_id": hr_p3, "model_name": "MATERNAL", "disease": "Maternal Health Risk", "probability": "0.920", "risk_level": "HIGH", "prediction_result": "Positive", "model_version": "1.0.0", "predicted_at": datetime.now(timezone.utc)}
]
db.predictions.insert_many(preds)

# Alerts
alerts = [
    {"_id": ObjectId(), "patient_id": p1_id, "prediction_id": str(preds[0]["_id"]), "alert_type": "RISK_ALERT", "recipient_type": "DOCTOR", "message": "High Risk Alert: Patient Kumar (RH-0001) has an 87% predicted risk of Diabetes.", "channel": "DASHBOARD", "status": "UNREAD", "created_at": datetime.now(timezone.utc)},
    {"_id": ObjectId(), "patient_id": p3_id, "prediction_id": str(preds[2]["_id"]), "alert_type": "RISK_ALERT", "recipient_type": "DOCTOR", "message": "High Risk Alert: Patient Priya (RH-0003) has a 92% predicted risk of Maternal Health Risk.", "channel": "DASHBOARD", "status": "UNREAD", "created_at": datetime.now(timezone.utc)}
]
db.alerts.insert_many(alerts)

print("MongoDB full seed completed!")
