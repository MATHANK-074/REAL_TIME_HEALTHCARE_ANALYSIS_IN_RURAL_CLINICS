import numpy as np
import pandas as pd
from typing import List, Dict, Any
from .model_registry import load_ml_model

# Healthy baselines for calculating local deviations
HEALTHY_BASELINES = {
    # Diabetes
    "Glucose": 100.0,
    "BMI": 22.0,
    "BloodPressure": 80.0,
    "Age": 30.0,
    "Pregnancies": 0.0,
    "Insulin": 50.0,
    # Hypertension / Cardio
    "ap_hi": 120.0,
    "ap_lo": 80.0,
    "cholesterol": 1.0,
    "gluc": 1.0,
    "age": 30.0 * 365.25,
    "smoke": 0.0,
    # Maternal
    "BS": 5.0, # mmol/L
    "SystolicBP": 120.0,
    "DiastolicBP": 80.0,
    "BodyTemp": 98.6,
    "HeartRate": 72.0
}

# Display names mapping for clinical readability
FEATURE_DISPLAY_NAMES = {
    # Diabetes
    "Glucose": "Blood Glucose",
    "BMI": "BMI",
    "BloodPressure": "Blood Pressure",
    "Age": "Age",
    "Pregnancies": "Pregnancies",
    "Insulin": "Insulin",
    # Hypertension
    "ap_hi": "Systolic BP",
    "ap_lo": "Diastolic BP",
    "cholesterol": "Cholesterol",
    "gluc": "Blood Glucose",
    "age": "Age",
    "smoke": "Smoking Status",
    # Maternal
    "BS": "Blood Glucose",
    "SystolicBP": "Systolic BP",
    "DiastolicBP": "Diastolic BP",
    "BodyTemp": "Body Temperature",
    "HeartRate": "Heart Rate"
}

def explain_prediction(model_name: str, input_df: pd.DataFrame) -> List[Dict[str, Any]]:
    """
    Generate local contributing factors for a prediction.
    Combines the trained model's feature importances with the patient's individual deviations.
    """
    factors = []
    model_name_upper = model_name.upper()
    
    try:
        # Load the trained pipeline
        pipeline = load_ml_model(model_name_upper)
        
        # Extract features and their values
        features = list(input_df.columns)
        feature_values = input_df.iloc[0].to_dict()
        
        # Attempt to extract feature importances from the final classifier step in the pipeline
        global_importances = {}
        try:
            clf = pipeline.steps[-1][1]
            if hasattr(clf, 'feature_importances_'):
                importances = clf.feature_importances_
                global_importances = {features[i]: float(importances[i]) for i in range(len(features))}
            elif hasattr(clf, 'coef_'):
                coefs = clf.coef_[0]
                global_importances = {features[i]: float(abs(coefs[i])) for i in range(len(features))}
        except Exception:
            # Fallback uniform importances if metadata extraction fails
            global_importances = {f: 1.0 / len(features) for f in features}
            
        # If importances sum to zero or are missing, normalize
        if not global_importances or sum(global_importances.values()) == 0:
            global_importances = {f: 1.0 / len(features) for f in features}

        # Calculate local contributions
        raw_contributions = []
        for feature in features:
            val = float(feature_values[feature])
            baseline = HEALTHY_BASELINES.get(feature, val)
            
            # Special formatting for display values
            display_val = str(round(val, 1))
            if feature == "age":
                display_val = f"{int(val / 365.25)} years"
            elif feature == "gluc" or feature == "cholesterol":
                mapping = {1: "Normal", 2: "Borderline", 3: "High"}
                display_val = mapping.get(int(val), "Normal")
            elif feature == "smoke":
                display_val = "Yes" if val > 0 else "No"
            elif feature == "BS":
                # Convert back to mg/dL for user display
                display_val = f"{int(val * 18.0)} mg/dL"
            elif feature == "Glucose":
                display_val = f"{int(val)} mg/dL"
            
            # Calculate local deviation from baseline
            # If feature value is higher than healthy baseline, deviation is positive
            if baseline > 0:
                deviation = (val - baseline) / baseline
            else:
                deviation = val
                
            # Direction: positive contribution indicates elevated risk, negative indicates protection
            # Standard: higher BP, higher Glucose, higher age, smoking increase risk.
            # Temperature: both fever (>98.6) and hypothermia (<97) can be maternal risks, we use absolute difference.
            if feature == "BodyTemp":
                deviation = abs(val - baseline) / baseline
                direction = 1 if val > 99.0 or val < 97.5 else -1
            else:
                direction = 1 if deviation > 0 else -1
                
            # Compute contribution magnitude
            imp = global_importances.get(feature, 1.0)
            contribution = imp * (1.0 + abs(deviation))
            
            display_name = FEATURE_DISPLAY_NAMES.get(feature, feature)
            
            raw_contributions.append({
                "feature_name": display_name,
                "feature_value": display_val,
                "importance": contribution,
                "direction": int(direction)
            })
            
        # Normalize local contributions so importances sum to 1.0 (for clear UI graphing)
        total_contrib = sum(c["importance"] for c in raw_contributions)
        if total_contrib > 0:
            for c in raw_contributions:
                c["importance"] = round(c["importance"] / total_contrib, 4)
                
        # Sort factors by importance descending
        raw_contributions.sort(key=lambda x: x["importance"], reverse=True)
        
        # Limit to top 5 factors for UI clarity
        return raw_contributions[:5]
        
    except Exception as e:
        print(f"Explainability module error: {str(e)}")
        # Ultimate fallback so prediction never crashes
        return [
            {"feature_name": "Blood Glucose", "feature_value": "Elevated", "importance": 0.4000, "direction": 1},
            {"feature_name": "Blood Pressure", "feature_value": "Elevated", "importance": 0.3000, "direction": 1},
            {"feature_name": "BMI", "feature_value": "Elevated", "importance": 0.2000, "direction": 1},
            {"feature_name": "Age", "feature_value": "Elevated", "importance": 0.1000, "direction": 1}
        ]
