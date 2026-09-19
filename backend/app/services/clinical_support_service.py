from typing import List, Dict, Any
from bson import ObjectId
import datetime
from pymongo.database import Database

from ..ml.predictor import predict_risk
from ..schemas import ClinicalRecommendation, DoctorReview, Patient, HealthRecord as HealthRecordSchema

# All model names supported by the ML registry
SUPPORTED_MODELS = [
    "diabetes",
    "hypertension",
    "maternal",
    "heart_disease",
    "stroke",
    "kidney",
]

def generate_recommendation(db: Database, health_record: dict, patient: dict) -> dict:
    """
    Runs all 5 AI models for a given health record, stores the predictions,
    and generates a unified rule-based Clinical Recommendation.
    """
    patient_id = str(patient["_id"])
    record_id = str(health_record["_id"])
    
    # 1. Run the existing 5 ML models
    predictions = []
    condition_results = []
    
    patient_obj = Patient(**patient)
    record_obj = HealthRecordSchema(**health_record)
    
    print(f"[NURSE_ASSESSMENT] patient_id={patient_id} record_id={record_id} name={patient.get('name')}")

    for model_name in SUPPORTED_MODELS:
        try:
            # Reuses the exact existing predict_risk from ML pipeline
            prediction = predict_risk(db, record_obj, patient_obj, model_name)
            
            # Store original immutable prediction
            if "_id" not in prediction and "id" not in prediction:
                result = db.predictions.insert_one(prediction)
                prediction["_id"] = result.inserted_id
            
            predictions.append(prediction)
            
            pred_id_str = str(prediction.get("_id", prediction.get("id")))
            prob_val = float(prediction.get("probability", 0))
            risk_val = prediction.get("risk_level")

            print(f"[PREDICTION] record_id={record_id} model={model_name} risk={risk_val} prob={prob_val:.4f} pred_id={pred_id_str}")

            condition_results.append({
                "model_name": prediction.get("model_name"),
                "disease": prediction.get("disease"),
                "risk_level": risk_val,
                "probability": prob_val,
                "prediction_id": pred_id_str,
                "factors": prediction.get("factors", [])
            })
        except Exception as e:
            print(f"[PREDICTION] record_id={record_id} model={model_name} status=failure error={str(e)}")
            # Model failed (e.g. missing fields), mark as unavailable
            condition_results.append({
                "disease": model_name.capitalize(),
                "risk_level": "UNAVAILABLE",
                "probability": None,
                "factors": [],
                "error": str(e)
            })

    # 2. Rule-Based Risk Aggregation (DO NOT MODIFY AI OUTPUT)
    overall_priority = "LOW"
    clinical_attention = []
    
    # Priorities mapping — UNAVAILABLE is scored 0 so it never raises priority
    priority_scores = {"URGENT": 4, "HIGH": 3, "MODERATE": 2, "LOW": 1, "UNAVAILABLE": 0}
    highest_score = 1
    unavailable_count = 0
    
    for cond in condition_results:
        risk = str(cond.get("risk_level")).upper()
        if risk == "UNAVAILABLE":
            unavailable_count += 1
            clinical_attention.append(
                f"{cond.get('disease')} assessment was unavailable — "
                f"additional clinical/laboratory data required."
            )
            continue  # Do NOT affect priority scoring
        if risk in ["HIGH", "URGENT"]:
            clinical_attention.append(f"Elevated {cond.get('disease')} risk detected. Clinical review recommended.")
            
        score = priority_scores.get(risk, 0)
        if score > highest_score:
            highest_score = score
            overall_priority = risk

    if unavailable_count == len(condition_results):
        # ALL models were unavailable — cannot determine risk
        clinical_attention.append("Insufficient data to determine clinical priority. Additional assessment is required.")

    if not clinical_attention and overall_priority not in ["HIGH", "URGENT"]:
        clinical_attention.append("No elevated risks detected. Routine follow-up may be sufficient.")

    patient_safe_summary = (
        "Your latest health assessment has been reviewed by the AI system and sent to your doctor for final clinical review."
        if overall_priority in ["HIGH", "URGENT"] else
        "Your latest health assessment shows stable indicators. It has been sent to your doctor for routine review."
    )

    # 3. Create the immutable Clinical Recommendation
    recommendation_doc = {
        "patient_id": patient_id,
        "health_record_id": record_id,
        "prediction_ids": [c["prediction_id"] for c in condition_results if "prediction_id" in c],
        "condition_results": condition_results,
        "overall_priority": overall_priority,
        "clinical_attention": clinical_attention,
        "patient_safe_summary": patient_safe_summary,
        "followup_priority": overall_priority if overall_priority != "UNAVAILABLE" else "MEDIUM",
        "status": "PENDING_REVIEW",
        "generated_at": datetime.datetime.utcnow(),
        "reviewed_at": None,
        "reviewed_by": None,
        "doctor_notes": None
    }
    
    res = db.clinical_recommendations.insert_one(recommendation_doc)
    recommendation_doc["_id"] = res.inserted_id
    
    return recommendation_doc

def submit_doctor_decision(db: Database, recommendation_id: str, doctor_id: str, decision: str, notes: str = None):
    """
    Records a Doctor's decision, creating an audit review record and updating the recommendation state.
    Does NOT modify the original ML predictions.
    """
    rec = db.clinical_recommendations.find_one({"_id": ObjectId(recommendation_id)})
    if not rec:
        raise ValueError("Clinical recommendation not found")
        
    previous_status = rec.get("status", "PENDING_REVIEW")
    new_status = decision.upper() # APPROVE, MODIFY, DISMISS
    
    now = datetime.datetime.utcnow()
    
    # 1. Update the recommendation status
    db.clinical_recommendations.update_one(
        {"_id": ObjectId(recommendation_id)},
        {"$set": {
            "status": new_status,
            "reviewed_at": now,
            "reviewed_by": doctor_id,
            "doctor_notes": notes
        }}
    )
    
    # 2. Store the Audit Review Event
    review_doc = {
        "patient_id": str(rec["patient_id"]),
        "recommendation_id": recommendation_id,
        "doctor_id": doctor_id,
        "decision": new_status,
        "doctor_notes": notes,
        "previous_status": previous_status,
        "new_status": new_status,
        "reviewed_at": now,
        "created_at": now
    }
    db.doctor_reviews.insert_one(review_doc)
    
    # 3. Mirror the status back to Health Record for backwards compatibility if needed
    db.health_records.update_one(
        {"_id": ObjectId(rec["health_record_id"])},
        {"$set": {
            "review_status": new_status,
            "reviewed_by": doctor_id,
            "reviewed_at": now,
            "doctor_notes": notes
        }}
    )
    
    return review_doc
