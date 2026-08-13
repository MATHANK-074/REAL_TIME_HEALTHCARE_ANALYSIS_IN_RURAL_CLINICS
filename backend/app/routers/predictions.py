from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from ..models import Patient, Prediction, User, HealthRecord
from ..schemas import Prediction as PredictionSchema
from .auth import get_current_user
from .patients import enforce_patient_area_access
from ..ml.predictor import predict_risk
from ..ml.model_registry import ModelNotConfiguredException, get_model_metrics
from ..services.audit import log_audit

router = APIRouter(prefix="/predictions", tags=["Predictions"])

@router.post("/{patient_id}", response_model=PredictionSchema, status_code=status.HTTP_201_CREATED)
def trigger_prediction(
    patient_id: int, 
    model_name: str, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    """
    Trigger risk assessment prediction for a patient using the specified model.
    Runs predictions on the patient's latest health record.
    """
    # 1. Fetch patient and verify area-based access
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
        
    enforce_patient_area_access(current_user, patient)
    
    # 2. Retrieve latest health record logged for the patient
    latest_record = db.query(HealthRecord).filter(
        HealthRecord.patient_id == patient_id
    ).order_by(HealthRecord.recorded_at.desc()).first()
    
    if not latest_record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No health records found for this patient. Please enter health measurements first."
        )

    # 3. Trigger prediction
    try:
        prediction = predict_risk(db, latest_record, patient, model_name)
        
        log_audit(
            db, 
            current_user.id, 
            "TRIGGER_PREDICTION", 
            "predictions", 
            prediction.id, 
            f"Triggered {model_name} prediction. Risk={prediction.risk_level} Prob={float(prediction.probability):.2f}"
        )
        return prediction
        
    except ModelNotConfiguredException as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/patient/{patient_id}", response_model=List[PredictionSchema])
def get_patient_predictions(
    patient_id: int, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    """Retrieve all past risk prediction outcomes for a patient, with area checks."""
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
        
    enforce_patient_area_access(current_user, patient)
    return db.query(Prediction).filter(Prediction.patient_id == patient_id).order_by(Prediction.predicted_at.desc()).all()


@router.get("/metrics", status_code=status.HTTP_200_OK)
def get_model_evaluation_metrics(
    current_user: User = Depends(get_current_user)
):
    """Get the evaluation metrics of all trained models (accuracy, recall, precision, etc.) for admin use."""
    # Expose metrics to all registered clinicians and administrators
    metrics = get_model_metrics()
    if not metrics:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Evaluation metrics are not available. Ensure ML training has run successfully."
        )
    return metrics


@router.get("/{prediction_id}", response_model=PredictionSchema)
def get_prediction_detail(
    prediction_id: int, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    """Retrieve details of a specific prediction, including its feature importances."""
    prediction = db.query(Prediction).filter(Prediction.id == prediction_id).first()
    if not prediction:
        raise HTTPException(status_code=404, detail="Prediction record not found")
        
    # Check permissions
    patient = prediction.patient
    enforce_patient_area_access(current_user, patient)
    return prediction
