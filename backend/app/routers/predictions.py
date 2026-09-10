from fastapi import APIRouter, Depends, HTTPException, status
from pymongo.database import Database
from typing import List
from bson import ObjectId

from ..database import get_db
from ..schemas import Prediction as PredictionSchema, User
from .auth import get_current_user
from .patients import enforce_patient_area_access
from ..ml.predictor import predict_risk
from ..ml.model_registry import ModelNotConfiguredException, get_model_metrics
from ..services.audit import log_audit

router = APIRouter(prefix="/predictions", tags=["Predictions"])

def serialize_doc(doc):
    if doc and "_id" in doc:
        doc["id"] = str(doc["_id"])
    return doc

@router.post("/{patient_id}", response_model=PredictionSchema, status_code=status.HTTP_201_CREATED)
def trigger_prediction(
    patient_id: str, 
    model_name: str, 
    db: Database = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    patient = db.patients.find_one({"_id": ObjectId(patient_id)})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
        
    enforce_patient_area_access(current_user, patient, db)
    
    latest_record = db.health_records.find_one(
        {"patient_id": patient_id},
        sort=[("recorded_at", -1)]
    )
    
    if not latest_record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No health records found for this patient. Please enter health measurements first."
        )

    try:
        prediction = predict_risk(db, latest_record, patient, model_name)
        if "_id" not in prediction and "id" not in prediction:
            result = db.predictions.insert_one(prediction)
            prediction["_id"] = result.inserted_id
            prediction_id = str(result.inserted_id)
        else:
            prediction_id = str(prediction.get("_id", prediction.get("id")))
        
        log_audit(
            db, 
            str(current_user.id) if hasattr(current_user, 'id') else str(current_user.get("id", "sys")), 
            "TRIGGER_PREDICTION", 
            "predictions", 
            prediction_id, 
            f"Triggered {model_name} prediction. Risk={prediction.get('risk_level')} Prob={float(prediction.get('probability', 0)):.2f}"
        )
        return serialize_doc(prediction)
        
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
    patient_id: str, 
    db: Database = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    patient = db.patients.find_one({"_id": ObjectId(patient_id)})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
        
    enforce_patient_area_access(current_user, patient, db)
    predictions = list(db.predictions.find({"patient_id": patient_id}).sort("predicted_at", -1))
    return [serialize_doc(p) for p in predictions]

@router.get("/metrics", status_code=status.HTTP_200_OK)
def get_model_evaluation_metrics(
    current_user: User = Depends(get_current_user)
):
    metrics = get_model_metrics()
    if not metrics:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Evaluation metrics are not available. Ensure ML training has run successfully."
        )
    return metrics

@router.get("/{prediction_id}", response_model=PredictionSchema)
def get_prediction_detail(
    prediction_id: str, 
    db: Database = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    prediction = db.predictions.find_one({"_id": ObjectId(prediction_id)})
    if not prediction:
        raise HTTPException(status_code=404, detail="Prediction record not found")
        
    patient = db.patients.find_one({"_id": ObjectId(prediction["patient_id"])})
    if patient:
        enforce_patient_area_access(current_user, patient, db)
    return serialize_doc(prediction)
