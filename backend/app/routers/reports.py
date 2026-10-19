import csv
import io
import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Response
from fastapi.responses import StreamingResponse
from pymongo.database import Database
from bson import ObjectId
from typing import List, Optional

from ..database import get_db
from ..schemas import User
from .auth import get_current_user, require_role

router = APIRouter(prefix="/reports", tags=["Reports & Analytics Export"])

@router.get("/patient-summary/{patient_id}")
def get_patient_clinical_summary(
    patient_id: str,
    db: Database = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns a unified, comprehensive payload for official printable clinical report.
    Includes patient demographics, latest vitals, AI prediction results with SHAP factors,
    doctor's clinical reviews, and assigned clinic/location hierarchy.
    """
    try:
        p_obj = ObjectId(patient_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid patient ID")

    patient = db.patients.find_one({"_id": p_obj})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    # Demographic enrichment
    village_name = "N/A"
    subdistrict_name = "N/A"
    district_name = "N/A"
    if patient.get("village_id"):
        v = db.villages.find_one({"_id": ObjectId(patient["village_id"]) if ObjectId.is_valid(patient["village_id"]) else patient["village_id"]})
        if v:
            village_name = v.get("name", "N/A")
            if v.get("subdistrict_id"):
                sub = db.subdistricts.find_one({"_id": ObjectId(v["subdistrict_id"]) if ObjectId.is_valid(v["subdistrict_id"]) else v["subdistrict_id"]})
                if sub:
                    subdistrict_name = sub.get("name", "N/A")
                    if sub.get("district_id"):
                        d = db.districts.find_one({"_id": ObjectId(sub["district_id"]) if ObjectId.is_valid(sub["district_id"]) else sub["district_id"]})
                        if d:
                            district_name = d.get("name", "N/A")

    # Assigned Clinic
    clinic_name = "Primary Health Centre (PHC)"
    if patient.get("clinic_id"):
        c = db.clinics.find_one({"_id": ObjectId(patient["clinic_id"]) if ObjectId.is_valid(patient["clinic_id"]) else patient["clinic_id"]})
        if c:
            clinic_name = c.get("clinic_name", clinic_name)

    # Health Records (Latest 5)
    records = list(db.health_records.find({"patient_id": patient_id}).sort("recorded_at", -1).limit(5))
    for r in records:
        r["id"] = str(r["_id"])
        del r["_id"]

    # Predictions
    preds = list(db.predictions.find({"patient_id": {"$in": [patient_id, ObjectId(patient_id)]}}).sort("predicted_at", -1).limit(5))
    for pr in preds:
        pr["id"] = str(pr["_id"])
        del pr["_id"]

    # Follow-ups
    followups = list(db.followups.find({"patient_id": patient_id}).sort("followup_date", -1).limit(3))
    for f in followups:
        f["id"] = str(f["_id"])
        del f["_id"]

    # Doctor Review info
    latest_review = None
    if records and records[0].get("doctor_notes"):
        latest_review = {
            "doctor_notes": records[0].get("doctor_notes"),
            "review_status": records[0].get("review_status", "REVIEWED"),
            "reviewed_at": records[0].get("reviewed_at"),
            "reviewed_by": records[0].get("reviewed_by")
        }

    report_id = f"RPT-{patient.get('patient_code', 'PAT')}-{datetime.datetime.utcnow().strftime('%Y%m%d%H%M')}"

    return {
        "report_id": report_id,
        "generated_at": datetime.datetime.utcnow().isoformat(),
        "generated_by": current_user.get("name", "Medical Officer"),
        "patient": {
            "id": str(patient["_id"]),
            "patient_code": patient.get("patient_code", "N/A"),
            "name": patient.get("name", "N/A"),
            "age": patient.get("age"),
            "gender": patient.get("gender"),
            "phone": patient.get("phone", "N/A"),
            "blood_group": patient.get("blood_group", "N/A"),
            "emergency_contact": patient.get("emergency_contact", "N/A"),
            "address": patient.get("address", "N/A"),
            "existing_disease": patient.get("existing_disease", "None"),
            "allergies": patient.get("allergies", "None"),
            "village": village_name,
            "subdistrict": subdistrict_name,
            "district": district_name,
            "clinic": clinic_name
        },
        "latest_vitals": records[0] if records else None,
        "vitals_history": records,
        "latest_prediction": preds[0] if preds else None,
        "predictions_history": preds,
        "followups": followups,
        "clinical_review": latest_review
    }


@router.get("/export/patients")
def export_patients_csv(
    db: Database = Depends(get_db),
    current_user: User = Depends(require_role(["ADMIN", "DOCTOR"]))
):
    """Export patient population with latest vitals and AI risk flags to CSV."""
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Headers
    writer.writerow([
        "Patient Code", "Name", "Age", "Gender", "Phone", "Blood Group", 
        "Village", "Subdistrict", "Existing Disease", "Allergies",
        "Latest Systolic BP", "Latest Diastolic BP", "Latest Blood Glucose", 
        "Latest BMI", "Latest Heart Rate", "AI Risk Level", "AI Risk Probability", 
        "AI Assessed Disease", "Registration Date"
    ])

    patients = list(db.patients.find({}).sort("created_at", -1))
    
    # Preload location maps
    villages = {str(v["_id"]): v for v in db.villages.find({})}
    subdistricts = {str(s["_id"]): s for s in db.subdistricts.find({})}

    for p in patients:
        pid_str = str(p["_id"])
        
        # Location
        v_name = "N/A"
        sub_name = "N/A"
        if p.get("village_id") and p["village_id"] in villages:
            v = villages[p["village_id"]]
            v_name = v.get("name", "N/A")
            if v.get("subdistrict_id") and v["subdistrict_id"] in subdistricts:
                sub_name = subdistricts[v["subdistrict_id"]].get("name", "N/A")

        # Latest record
        hr = db.health_records.find_one({"patient_id": pid_str}, sort=[("recorded_at", -1)])
        # Latest prediction
        pred = db.predictions.find_one({"patient_id": {"$in": [pid_str, p["_id"]]}}, sort=[("predicted_at", -1)])

        writer.writerow([
            p.get("patient_code", "N/A"),
            p.get("name", "N/A"),
            p.get("age", "N/A"),
            p.get("gender", "N/A"),
            p.get("phone", "N/A"),
            p.get("blood_group", "N/A"),
            v_name,
            sub_name,
            p.get("existing_disease", "None"),
            p.get("allergies", "None"),
            hr.get("systolic_bp", "N/A") if hr else "N/A",
            hr.get("diastolic_bp", "N/A") if hr else "N/A",
            hr.get("blood_glucose", "N/A") if hr else "N/A",
            hr.get("bmi", "N/A") if hr else "N/A",
            hr.get("heart_rate", "N/A") if hr else "N/A",
            pred.get("risk_level", "UNASSESSED") if pred else "UNASSESSED",
            f"{float(pred.get('probability', 0))*100:.1f}%" if pred and pred.get("probability") else "N/A",
            pred.get("disease", "N/A") if pred else "N/A",
            p.get("created_at", "N/A")
        ])

    output.seek(0)
    filename = f"ruralcare_patients_{datetime.date.today().isoformat()}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/export/field-visits")
def export_field_visits_csv(
    db: Database = Depends(get_db),
    current_user: User = Depends(require_role(["ADMIN", "DOCTOR"]))
):
    """Export GPS field visits with coordinates, timestamps, and status to CSV."""
    output = io.StringIO()
    writer = csv.writer(output)
    
    writer.writerow([
        "Visit ID", "Patient Code", "Patient Name", "Healthcare Worker", 
        "Village", "Latitude", "Longitude", "Accuracy (m)", "Visit Type", 
        "Status", "Started At", "Completed At", "Notes"
    ])

    visits = list(db.field_visits.find({}).sort("created_at", -1))
    
    # Preload maps
    nurses = {str(u["_id"]): u.get("name", "Nurse") for u in db.users.find({"role": "NURSE"})}
    villages = {str(v["_id"]): v.get("name", "Village") for v in db.villages.find({})}

    for fv in visits:
        patient = db.patients.find_one({"_id": ObjectId(fv["patient_id"]) if ObjectId.is_valid(fv.get("patient_id")) else fv.get("patient_id")})
        p_code = patient.get("patient_code", "N/A") if patient else "N/A"
        p_name = patient.get("name", "N/A") if patient else "N/A"
        n_name = nurses.get(fv.get("nurse_id"), "Health Worker")
        v_name = villages.get(fv.get("village_id"), "Village")

        writer.writerow([
            str(fv["_id"]),
            p_code,
            p_name,
            n_name,
            v_name,
            fv.get("latitude", "N/A"),
            fv.get("longitude", "N/A"),
            fv.get("accuracy", "N/A"),
            fv.get("visit_type", "REGULAR"),
            fv.get("status", "STARTED"),
            fv.get("started_at", "N/A"),
            fv.get("completed_at", "N/A"),
            fv.get("notes", "N/A")
        ])

    output.seek(0)
    filename = f"ruralcare_gps_field_visits_{datetime.date.today().isoformat()}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/export/village-summary")
def export_village_summary_csv(
    db: Database = Depends(get_db),
    current_user: User = Depends(require_role(["ADMIN", "DOCTOR"]))
):
    """Export aggregated village health metrics and high-risk case loads to CSV."""
    output = io.StringIO()
    writer = csv.writer(output)
    
    writer.writerow([
        "Village Name", "Taluk / Subdistrict", "District", 
        "Total Registered Patients", "High Risk Patients", 
        "Medium Risk Patients", "Low Risk Patients", "Pending Follow-ups"
    ])

    villages = list(db.villages.find({}))
    subdistricts = {str(s["_id"]): s for s in db.subdistricts.find({})}
    districts = {str(d["_id"]): d for d in db.districts.find({})}

    for v in villages:
        vid_str = str(v["_id"])
        sub_name = "N/A"
        dist_name = "N/A"
        
        if v.get("subdistrict_id") and v["subdistrict_id"] in subdistricts:
            sub = subdistricts[v["subdistrict_id"]]
            sub_name = sub.get("name", "N/A")
            if sub.get("district_id") and sub["district_id"] in districts:
                dist_name = districts[sub["district_id"]].get("name", "N/A")

        p_query = [vid_str]
        if ObjectId.is_valid(vid_str):
            p_query.append(ObjectId(vid_str))
            
        patients = list(db.patients.find({"village_id": {"$in": p_query}}, {"_id": 1}))
        total_p = len(patients)
        p_ids = [str(p["_id"]) for p in patients]

        high_c = 0
        med_c = 0
        low_c = 0
        if p_ids:
            for pid in p_ids:
                pred = db.predictions.find_one({"patient_id": {"$in": [pid, ObjectId(pid)]}}, sort=[("predicted_at", -1)])
                if pred:
                    rl = pred.get("risk_level")
                    if rl == "HIGH": high_c += 1
                    elif rl == "MEDIUM": med_c += 1
                    elif rl == "LOW": low_c += 1

        pending_fu = db.followups.count_documents({"patient_id": {"$in": p_ids}, "status": "PENDING"}) if p_ids else 0

        writer.writerow([
            v.get("name", "N/A"),
            sub_name,
            dist_name,
            total_p,
            high_c,
            med_c,
            low_c,
            pending_fu
        ])

    output.seek(0)
    filename = f"ruralcare_village_health_summary_{datetime.date.today().isoformat()}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
