from typing import List, Dict, Any
from bson import ObjectId
import datetime
from pymongo.database import Database

from ..ml.predictor import predict_risk
from ..schemas import ClinicalRecommendation, DoctorReview

# The exact 5 model names supported by the existing ML registry
SUPPORTED_MODELS = [
    "diabetes_rf",
    "cardiovascular_rf",
    "stroke_rf",
    "kidney_rf",
    "hypertension_rf"
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
    
    for model_name in SUPPORTED_MODELS:
        try:
            # Reuses the exact existing predict_risk from ML pipeline
            prediction = predict_risk(db, health_record, patient, model_name)
            
            # Store original immutable prediction
            if "_id" not in prediction and "id" not in prediction:
                result = db.predictions.insert_one(prediction)
                prediction["_id"] = result.inserted_id
            
            predictions.append(prediction)
            
            condition_results.append({
                "model_name": prediction.get("model_name"),
                "disease": prediction.get("disease"),
                "risk_level": prediction.get("risk_level"),
                "probability": float(prediction.get("probability", 0)),
                "prediction_id": str(prediction.get("_id", prediction.get("id"))),
                "factors": prediction.get("factors", [])
            })
            
        except Exception as e:
            # Model failed (e.g., missing data, unconfigured) -> Log unavailability, don't fake risk.
            condition_results.append({
                "model_name": model_name,
                "disease": model_name.split("_")[0].capitalize(),
                "risk_level": "UNAVAILABLE",
                "probability": None,
                "error": str(e)
            })

    # 2. Rule-Based Risk Aggregation (DO NOT MODIFY AI OUTPUT)
    overall_priority = "LOW"
    clinical_attention = []
    
    # Priorities mapping
    priority_scores = {"URGENT": 4, "HIGH": 3, "MODERATE": 2, "LOW": 1, "UNAVAILABLE": 0}
    highest_score = 1
    
    for cond in condition_results:
        risk = str(cond.get("risk_level")).upper()
        if risk in ["HIGH", "URGENT"]:
            clinical_attention.append(f"Elevated {cond.get('disease')} risk detected. Clinical review recommended.")
        elif risk == "UNAVAILABLE":
            clinical_attention.append(f"{cond.get('disease')} assessment was unavailable due to missing clinical data.")
            
        score = priority_scores.get(risk, 0)
        if score > highest_score:
            highest_score = score
            overall_priority = risk

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
