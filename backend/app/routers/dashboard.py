from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import List, Dict, Any
import datetime

from ..database import get_db
from ..models import Patient, Followup, Prediction, District, SubDistrict, Village, User, HealthRecord
from .auth import get_current_user, require_role

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/doctor", status_code=status.HTTP_200_OK)
def get_doctor_dashboard(
    db: Session = Depends(get_db), 
    current_user: User = Depends(require_role(["DOCTOR", "ADMIN"]))
):
    """Retrieve KPIs and analytics for the Doctor Dashboard, scoped to assigned areas."""
    # 1. Resolve Doctor Location Boundary
    if current_user.role == 'ADMIN':
        villages = db.query(Village).all()
        village_ids = [v.id for v in villages]
    else:
        # Doctor sees all villages in their subdistrict
        if not current_user.subdistrict_id:
            village_ids = []
        else:
            villages = db.query(Village).filter(Village.subdistrict_id == current_user.subdistrict_id).all()
            village_ids = [v.id for v in villages]

    # If Doctor has no assigned villages, return empty metrics
    if not village_ids:
        return {
            "kpis": {
                "total_patients": 0,
                "high_risk": 0,
                "medium_risk": 0,
                "low_risk": 0,
                "pending_followups": 0
            },
            "high_risk_patients": [],
            "location_breakdown": []
        }

    # 2. Query KPIs
    total_patients = db.query(Patient).filter(Patient.village_id.in_(village_ids)).count()
    
    # We fetch the latest predictions for patients in our assigned areas
    subq_latest_preds = db.query(
        Prediction.patient_id,
        func.max(Prediction.predicted_at).label("max_date")
    ).group_by(Prediction.patient_id).subquery()
    
    latest_predictions_query = db.query(Prediction).join(
        subq_latest_preds,
        (Prediction.patient_id == subq_latest_preds.c.patient_id) &
        (Prediction.predicted_at == subq_latest_preds.c.max_date)
    ).join(Patient).filter(Patient.village_id.in_(village_ids))
    
    risk_counts = latest_predictions_query.with_entities(
        Prediction.risk_level, 
        func.count(Prediction.id)
    ).group_by(Prediction.risk_level).all()
    
    risk_map = {r[0]: r[1] for r in risk_counts}
    high_risk_count = risk_map.get('HIGH', 0)
    medium_risk_count = risk_map.get('MEDIUM', 0)
    low_risk_count = risk_map.get('LOW', 0)
    
    pending_followups = db.query(Followup).join(Patient).filter(
        Patient.village_id.in_(village_ids),
        Followup.status == 'PENDING'
    ).count()

    # 3. Retrieve high risk patients table
    # Get patients who have a HIGH risk prediction currently
    high_risk_list = latest_predictions_query.filter(
        Prediction.risk_level == 'HIGH'
    ).order_by(desc(Prediction.predicted_at)).limit(15).all()

    formatted_high_risk = []
    for pred in high_risk_list:
        p = pred.patient
        formatted_high_risk.append({
            "patient_id": p.id,
            "patient_code": p.patient_code,
            "name": p.name,
            "location": p.village.name if p.village else "Unknown",
            "disease": pred.disease,
            "probability": float(pred.probability),
            "risk_level": pred.risk_level,
            "predicted_at": pred.predicted_at,
            "prediction_id": pred.id
        })

    # 4. Monthly history trends (disease distributions)
    # Return count of patients per village
    village_patient_counts = db.query(
        Village.name,
        func.count(Patient.id)
    ).join(Patient).filter(Patient.village_id.in_(village_ids)).group_by(Village.name).all()
    
    location_breakdown = [{"location": item[0], "patients": item[1]} for item in village_patient_counts]

    return {
        "kpis": {
            "total_patients": total_patients,
            "high_risk": high_risk_count,
            "medium_risk": medium_risk_count,
            "low_risk": low_risk_count,
            "pending_followups": pending_followups
        },
        "high_risk_patients": formatted_high_risk,
        "location_breakdown": location_breakdown
    }


@router.get("/admin", status_code=status.HTTP_200_OK)
def get_admin_dashboard(
    db: Session = Depends(get_db), 
    current_user: User = Depends(require_role(["ADMIN"]))
):
    """Retrieve full district-wide metrics and subdistrict comparison statistics for District Admins."""
    total_locations = db.query(SubDistrict).count()
    total_patients = db.query(Patient).count()
    total_doctors = db.query(User).filter(User.role == 'DOCTOR').count()
    total_nurses = db.query(User).filter(User.role == 'NURSE').count()
    
    # 1. Total pending followups district-wide
    pending_followups = db.query(Followup).filter(Followup.status == 'PENDING').count()
    
    # 2. Risk Distribution
    subq_latest_preds = db.query(
        Prediction.patient_id,
        func.max(Prediction.predicted_at).label("max_date")
    ).group_by(Prediction.patient_id).subquery()
    
    latest_predictions = db.query(Prediction).join(
        subq_latest_preds,
        (Prediction.patient_id == subq_latest_preds.c.patient_id) &
        (Prediction.predicted_at == subq_latest_preds.c.max_date)
    )
    
    risk_counts = latest_predictions.with_entities(
        Prediction.risk_level, 
        func.count(Prediction.id)
    ).group_by(Prediction.risk_level).all()
    risk_dist = {r[0]: r[1] for r in risk_counts}

    # 3. Disease-specific counts
    disease_counts = latest_predictions.with_entities(
        Prediction.model_name, 
        func.count(Prediction.id)
    ).group_by(Prediction.model_name).all()
    disease_dist = {d[0]: d[1] for d in disease_counts}
    
    # High-risk specific breakdown
    high_risk_by_model = latest_predictions.filter(Prediction.risk_level == 'HIGH').with_entities(
        Prediction.model_name, 
        func.count(Prediction.id)
    ).group_by(Prediction.model_name).all()
    high_risk_models = {h[0]: h[1] for h in high_risk_by_model}

    # 4. Subdistrict Comparison (Subdistrict Name -> Patient Count, High Risk Count)
    subdistricts_comparison = []
    all_subdistricts = db.query(SubDistrict).all()
    for s in all_subdistricts:
        s_villages = db.query(Village).filter(Village.subdistrict_id == s.id).all()
        s_v_ids = [v.id for v in s_villages]
        
        s_patients = db.query(Patient).filter(Patient.village_id.in_(s_v_ids)).count() if s_v_ids else 0
        s_high_risk = latest_predictions.join(Patient).filter(
            Patient.village_id.in_(s_v_ids), 
            Prediction.risk_level == 'HIGH'
        ).count() if s_v_ids else 0
        subdistricts_comparison.append({
            "name": s.name,
            "patients": s_patients,
            "high_risk": s_high_risk
        })

    # 5. Village-wise breakdown
    village_wise_risk = []
    all_villages = db.query(Village).all()
    for v in all_villages:
        v_patients = db.query(Patient).filter(Patient.village_id == v.id).count()
        v_high_risk = latest_predictions.join(Patient).filter(
            Patient.village_id == v.id,
            Prediction.risk_level == 'HIGH'
        ).count()
        village_wise_risk.append({
            "id": v.id,
            "name": v.name,
            "parent_name": v.subdistrict.name if v.subdistrict else "Unknown",
            "patients": v_patients,
            "high_risk": v_high_risk
        })

    # 6. Monthly Patient Registrations (last 6 months)
    today = datetime.date.today()
    six_months_ago = today - datetime.timedelta(days=180)
    monthly_registrations = db.query(
        func.date_format(Patient.created_at, '%b %Y').label('month'),
        func.count(Patient.id)
    ).filter(Patient.created_at >= six_months_ago).group_by('month').order_by(func.min(Patient.created_at)).all()
    
    monthly_trend = [{"month": r[0], "count": r[1]} for r in monthly_registrations]

    return {
        "kpis": {
            "total_locations": total_locations,
            "total_patients": total_patients,
            "total_doctors": total_doctors,
            "total_nurses": total_nurses,
            "pending_followups": pending_followups,
            "high_risk_patients": risk_dist.get('HIGH', 0)
        },
        "risk_distribution": {
            "high": risk_dist.get('HIGH', 0),
            "medium": risk_dist.get('MEDIUM', 0),
            "low": risk_dist.get('LOW', 0)
        },
        "disease_distribution": {
            "diabetes": disease_dist.get('DIABETES', 0),
            "hypertension": disease_dist.get('HYPERTENSION', 0),
            "maternal": disease_dist.get('MATERNAL', 0)
        },
        "high_risk_by_disease": {
            "diabetes": high_risk_models.get('DIABETES', 0),
            "hypertension": high_risk_models.get('HYPERTENSION', 0),
            "maternal": high_risk_models.get('MATERNAL', 0)
        },
        "subdistrict_comparison": subdistricts_comparison,
        "village_wise_risk": village_wise_risk,
        "monthly_trend": monthly_trend
    }

@router.post("/simulate", status_code=status.HTTP_201_CREATED)
def simulate_live_screening(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["ADMIN", "DOCTOR", "NURSE"]))
):
    """
    Simulates a live screening submission from a remote nurse tablet on-field.
    Creates a random realistic patient, logs health measurements, triggers ML risk assessment,
    saves the prediction, dispatches real-time alerts, and returns the result.
    """
    import random
    
    # 1. Randomly select a village
    villages_db = db.query(Village).all()
    if not villages_db:
        raise HTTPException(status_code=400, detail="No villages seeded")
    village_obj = random.choice(villages_db)
    village_id = village_obj.id

    # 2. Select a model to simulate
    model_name = random.choice(['DIABETES', 'HYPERTENSION', 'MATERNAL'])
    
    # 3. Create realistic patient name and characteristics
    first_names = ["Ramesh", "Sita", "Rajesh", "Anitha", "Gopal", "Lakshmi", "Manoj", "Vijay", "Sandhiya", "Karthik", "Preethi", "Suresh", "Radha", "Arjun", "Kavitha"]
    last_names = ["Kumar", "Devi", "Pillai", "Raj", "Krishnan", "Selvam", "Singh", "Sharma", "Nair", "Reddy", "Patel", "Murugan", "Subramanian"]
    patient_name = f"{random.choice(first_names)} {random.choice(last_names)}"
    
    if model_name == 'MATERNAL':
        gender = 'Female'
        age = random.randint(18, 40)
        pregnancies = random.randint(1, 4)
    else:
        gender = random.choice(['Male', 'Female'])
        age = random.randint(25, 78)
        pregnancies = random.randint(1, 4) if (gender == 'Female' and random.random() > 0.5) else 0

    # 4. Generate unique patient code
    num_patients = db.query(Patient).count()
    patient_code = f"RH-{1000 + num_patients + 1:04d}"
    
    phone = f"+91 {random.randint(60000, 99999)} {random.randint(10000, 99999)}"
    villages = ["Perundurai", "Bhavani", "Pallipalayam", "Anthiyur", "Kodumudi", "Gobichettipalayam", "Sathyamangalam"]
    village = random.choice(villages)
    blood_groups = ["O+", "A+", "B+", "AB+", "O-", "A-", "B-"]
    blood_group = random.choice(blood_groups)
    
    db_patient = Patient(
        patient_code=patient_code,
        name=patient_name,
        age=age,
        gender=gender,
        phone=phone,
        village_id=village_id,
        address=f"House {random.randint(1, 100)}, Ward {random.randint(1, 10)}, {village_obj.name}",
        blood_group=blood_group,
        emergency_contact=f"+91 {random.randint(60000, 99999)} 00000",
        existing_disease="None",
        allergies="None"
    )
    db.add(db_patient)
    db.commit()
    db.refresh(db_patient)

    # 5. Generate realistic health record measurements
    risk_profile = random.choice(['NORMAL', 'ELEVATED', 'HIGH_RISK'])
    
    if risk_profile == 'NORMAL':
        systolic = random.randint(110, 125)
        diastolic = random.randint(70, 80)
        glucose = random.randint(80, 105)
        cholesterol = random.randint(150, 195)
        insulin = random.choice([0, random.randint(15, 60)])
        weight = float(f"{random.uniform(55.0, 72.0):.2f}")
        height = float(f"{random.uniform(1.58, 1.76):.2f}")
        temp = float(f"{random.uniform(97.8, 98.6):.1f}")
        hr = random.randint(68, 78)
    elif risk_profile == 'ELEVATED':
        systolic = random.randint(128, 138)
        diastolic = random.randint(82, 88)
        glucose = random.randint(110, 135)
        cholesterol = random.randint(200, 225)
        insulin = random.choice([0, random.randint(40, 90)])
        weight = float(f"{random.uniform(68.0, 85.0):.2f}")
        height = float(f"{random.uniform(1.55, 1.78):.2f}")
        temp = float(f"{random.uniform(98.4, 99.2):.1f}")
        hr = random.randint(76, 88)
    else: # HIGH_RISK
        systolic = random.randint(142, 178)
        diastolic = random.randint(92, 108)
        glucose = random.randint(145, 230)
        cholesterol = random.randint(235, 290)
        insulin = random.choice([0, random.randint(70, 180)])
        weight = float(f"{random.uniform(75.0, 98.0):.2f}")
        height = float(f"{random.uniform(1.52, 1.80):.2f}")
        temp = float(f"{random.uniform(99.0, 100.8):.1f}")
        hr = random.randint(85, 106)
        
    bmi = round(weight / (height * height), 1)

    nurse = db.query(User).filter(User.role == 'NURSE').first()
    nurse_id = nurse.id if nurse else 2

    db_record = HealthRecord(
        patient_id=db_patient.id,
        recorded_by=nurse_id,
        weight=weight,
        height=height,
        bmi=bmi,
        blood_pressure=f"{systolic}/{diastolic}",
        systolic_bp=systolic,
        diastolic_bp=diastolic,
        heart_rate=hr,
        temperature=temp,
        blood_glucose=glucose,
        cholesterol=cholesterol,
        insulin=insulin,
        pregnancies=pregnancies,
        smoking_status=random.choice(['NEVER', 'FORMER', 'CURRENT']),
        recorded_at=datetime.datetime.utcnow()
    )
    db.add(db_record)
    db.commit()
    db.refresh(db_record)

    # 6. Run actual prediction
    from ..ml.predictor import predict_risk
    prediction = predict_risk(db, db_record, db_patient, model_name)
    
    # 7. Calculate simulated server latency and network stats for telemetry
    latency_ms = random.randint(10, 24)
    
    return {
        "status": "success",
        "patient": {
            "id": db_patient.id,
            "patient_code": db_patient.patient_code,
            "name": db_patient.name,
            "age": db_patient.age,
            "gender": db_patient.gender,
            "village": village_obj.name,
            "subdistrict": village_obj.subdistrict.name if village_obj.subdistrict else "Unknown",
            "district": village_obj.subdistrict.district.name if village_obj.subdistrict and village_obj.subdistrict.district else "Unknown"
        },
        "health_record": {
            "blood_pressure": db_record.blood_pressure,
            "blood_glucose": db_record.blood_glucose,
            "bmi": float(db_record.bmi),
            "heart_rate": db_record.heart_rate,
            "temperature": float(db_record.temperature)
        },
        "prediction": {
            "id": prediction.id,
            "model_name": prediction.model_name,
            "disease": prediction.disease,
            "probability": float(prediction.probability),
            "risk_level": prediction.risk_level,
            "prediction_result": prediction.prediction_result,
            "predicted_at": prediction.predicted_at.isoformat()
        },
        "telemetry": {
            "server_latency_ms": latency_ms,
            "ingestion_rate_spm": round(random.uniform(4.5, 6.2), 1),
            "node_status": "Connected",
            "offline_queue": 0
        }
    }

