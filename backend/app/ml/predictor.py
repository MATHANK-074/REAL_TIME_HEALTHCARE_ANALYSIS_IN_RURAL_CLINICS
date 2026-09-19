import json
import os
from pymongo.database import Database
from decimal import Decimal

from ..schemas import Patient, HealthRecord, Prediction, PredictionFactor
from ..config import settings
from .preprocessing import (
    preprocess_diabetes_input, 
    preprocess_hypertension_input, 
    preprocess_maternal_input,
    preprocess_heart_disease_input,
    preprocess_stroke_input,
    preprocess_kidney_input,
    MLPreprocessingError,
    MLDataUnavailableError
)
from .model_registry import load_ml_model, ModelNotConfiguredException
from .explainability import explain_prediction
from ..services.notification import create_system_alert

def predict_risk(
    db: Database, 
    health_record: HealthRecord, 
    patient: Patient, 
    model_name: str
):
    """
    Run machine learning risk prediction for a patient's health record.
    Saves predictions, maps contributing factors, and triggers high-risk alerts.
    """
    model_name_upper = model_name.upper()
    
    # 1. Preprocess data based on selected model
    try:
        if model_name_upper == 'DIABETES':
            input_df = preprocess_diabetes_input(health_record, patient)
            disease_display = "Diabetes Risk"
        elif model_name_upper == 'HYPERTENSION':
            input_df = preprocess_hypertension_input(health_record, patient)
            disease_display = "Hypertension/Cardiovascular Risk"
        elif model_name_upper == 'MATERNAL':
            input_df = preprocess_maternal_input(health_record, patient)
            disease_display = "Maternal Health Risk"
        elif model_name_upper == 'HEART_DISEASE':
            input_df = preprocess_heart_disease_input(health_record, patient)
            disease_display = "Heart Disease Risk"
        elif model_name_upper == 'STROKE':
            input_df = preprocess_stroke_input(health_record, patient)
            disease_display = "Stroke Risk"
        elif model_name_upper == 'KIDNEY':
            input_df = preprocess_kidney_input(health_record, patient)
            disease_display = "Kidney Disease Risk"
        else:
            raise ValueError(f"Unsupported model: {model_name}")
    except MLDataUnavailableError as e:
        # Required clinical/laboratory data is missing from current schema.
        # Store an UNAVAILABLE prediction record — do NOT fabricate values.
        return _create_unavailable_prediction(
            db, health_record, patient, model_name_upper, str(e)
        )
    except MLPreprocessingError as e:
        # Re-raise as ValueError so router can respond with 400 Bad Request
        raise ValueError(str(e))

    # 2. Load model pipeline (raises ModelNotConfiguredException if file is missing)
    pipeline = load_ml_model(model_name_upper)
    
    # 3. Perform inference
    try:
        # Predict probability of the positive class (class 1)
        # pipeline is expected to have predict_proba
        probabilities = pipeline.predict_proba(input_df)
        probability = float(probabilities[0][1])
    except Exception as e:
        raise ValueError(f"Inference error during ML prediction: {str(e)}")

    # 4. Determine risk level using configurable thresholds
    low_thresh = 0.40
    high_thresh = 0.70
    
    # Load configuration if file exists
    config_path = os.path.join(os.getcwd(), settings.RISK_CONFIG_PATH)
    if os.path.exists(config_path):
        try:
            with open(config_path, 'r') as f:
                config = json.load(f)
                low_thresh = float(config.get("low_threshold", 0.40))
                high_thresh = float(config.get("high_threshold", 0.70))
        except Exception as e:
            print(f"Failed to load risk threshold config, using defaults: {str(e)}")

    if probability < low_thresh:
        risk_level = 'LOW'
    elif probability < high_thresh:
        risk_level = 'MEDIUM'
    else:
        risk_level = 'HIGH'

    # 5. Calculate contributing factors (Local Explainability)
    factors_list = explain_prediction(model_name_upper, input_df)

    # 6. Save Prediction to Database
    prediction_result = "Positive" if probability >= 0.50 else "Negative"
    
    # Fetch model version (we default to 1.0.0 or read if pipeline has version metadata)
    model_version = "1.0.0"
    if hasattr(pipeline, 'version'):
        model_version = pipeline.version
    elif isinstance(pipeline, dict) and 'version' in pipeline:
        model_version = pipeline['version']

    db_prediction_dict = {
        "patient_id": patient.id,
        "health_record_id": health_record.id,
        "model_name": model_name_upper,
        "disease": disease_display,
        "probability": str(probability),
        "risk_level": risk_level,
        "prediction_result": prediction_result,
        "model_version": model_version
    }
    
    result = db.predictions.insert_one(db_prediction_dict)
    db_prediction_id = str(result.inserted_id)

    # 7. Save prediction factors
    factors_to_insert = []
    for factor in factors_list:
        factors_to_insert.append({
            "prediction_id": db_prediction_id,
            "feature_name": factor["feature_name"],
            "feature_value": factor["feature_value"],
            "importance": str(factor["importance"]),
            "direction": factor["direction"]
        })
    if factors_to_insert:
        db.prediction_factors.insert_many(factors_to_insert)

    # 8. Trigger Alert System if risk level is HIGH
    if risk_level == 'HIGH':
        area_name = getattr(patient, 'area', {}).get('name', 'Assigned Area') if hasattr(patient, 'area') else "Assigned Area"
        # Doctor dashboard alert
        doc_msg = (
            f"High Risk Alert: Patient {patient.name} ({patient.patient_code}) in {area_name} "
            f"has an {int(probability * 100)}% predicted risk of {disease_display}."
        )
        create_system_alert(
            db=db,
            patient_id=patient.id,
            prediction_id=db_prediction_id,
            alert_type='RISK_ALERT',
            recipient_type='DOCTOR',
            message=doc_msg,
            channel='DASHBOARD'
        )
        
        # Patient SMS alert (printed to logs via mock notification)
        pat_msg = (
            "Health Alert: Your recent health assessment indicates an elevated health risk. "
            "Please contact your clinic or healthcare provider for further clinical evaluation."
        )
        create_system_alert(
            db=db,
            patient_id=patient.id,
            prediction_id=db_prediction_id,
            alert_type='SMS_ALERT',
            recipient_type='PATIENT',
            message=pat_msg,
            channel='SMS'
        )

    db_prediction_dict["_id"] = db_prediction_id
    return db_prediction_dict


def _create_unavailable_prediction(db, health_record, patient, model_name, reason):
    """
    Create and persist an UNAVAILABLE prediction when required clinical/
    laboratory data is not present in the current schema.

    No probability is fabricated, no alerts are triggered, and the record
    is stored purely for audit visibility.
    """
    _DISEASE_DISPLAY = {
        'HEART_DISEASE': 'Heart Disease Risk',
        'STROKE': 'Stroke Risk',
        'KIDNEY': 'Kidney Disease Risk',
    }
    disease_display = _DISEASE_DISPLAY.get(model_name, f"{model_name.replace('_', ' ').title()} Risk")

    # Safely extract IDs regardless of whether we received a Pydantic model or dict
    if hasattr(patient, 'id'):
        patient_id = patient.id
    else:
        patient_id = str(patient.get("_id", patient.get("id", "")))

    if hasattr(health_record, 'id'):
        hr_id = health_record.id
    else:
        hr_id = str(health_record.get("_id", health_record.get("id", "")))

    db_prediction_dict = {
        "patient_id": patient_id,
        "health_record_id": hr_id,
        "model_name": model_name,
        "disease": disease_display,
        "probability": "0.0",
        "risk_level": "UNAVAILABLE",
        "prediction_result": f"Assessment unavailable — {reason}",
        "model_version": "1.0.0",
    }

    result = db.predictions.insert_one(db_prediction_dict)
    db_prediction_dict["_id"] = str(result.inserted_id)
    return db_prediction_dict
