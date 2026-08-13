import json
import os
from sqlalchemy.orm import Session
from decimal import Decimal

from ..models import Patient, HealthRecord, Prediction, PredictionFactor
from ..config import settings
from .preprocessing import (
    preprocess_diabetes_input, 
    preprocess_hypertension_input, 
    preprocess_maternal_input, 
    MLPreprocessingError
)
from .model_registry import load_ml_model, ModelNotConfiguredException
from .explainability import explain_prediction
from ..services.notification import create_system_alert

def predict_risk(
    db: Session, 
    health_record: HealthRecord, 
    patient: Patient, 
    model_name: str
) -> Prediction:
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
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported model: {model_name}")
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

    db_prediction = Prediction(
        patient_id=patient.id,
        health_record_id=health_record.id,
        model_name=model_name_upper,
        disease=disease_display,
        probability=Decimal(probability),
        risk_level=risk_level,
        prediction_result=prediction_result,
        model_version=model_version
    )
    
    db.add(db_prediction)
    db.commit()
    db.refresh(db_prediction)

    # 7. Save prediction factors
    for factor in factors_list:
        db_factor = PredictionFactor(
            prediction_id=db_prediction.id,
            feature_name=factor["feature_name"],
            feature_value=factor["feature_value"],
            importance=Decimal(factor["importance"]),
            direction=factor["direction"]
        )
        db.add(db_factor)
    db.commit()
    db.refresh(db_prediction)

    # 8. Trigger Alert System if risk level is HIGH
    if risk_level == 'HIGH':
        area_name = patient.area.name if patient.area else "Assigned Area"
        # Doctor dashboard alert
        doc_msg = (
            f"High Risk Alert: Patient {patient.name} ({patient.patient_code}) in {area_name} "
            f"has an {int(probability * 100)}% predicted risk of {disease_display}."
        )
        create_system_alert(
            db=db,
            patient_id=patient.id,
            prediction_id=db_prediction.id,
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
            prediction_id=db_prediction.id,
            alert_type='SMS_ALERT',
            recipient_type='PATIENT',
            message=pat_msg,
            channel='SMS'
        )

    return db_prediction
