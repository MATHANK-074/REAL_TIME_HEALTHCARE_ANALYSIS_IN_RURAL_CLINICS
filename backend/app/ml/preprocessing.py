import pandas as pd
import numpy as np
from typing import Dict, Any

class MLPreprocessingError(Exception):
    pass

def preprocess_diabetes_input(health_record, patient) -> pd.DataFrame:
    """
    Map general HealthRecord/Patient model fields to Pima Indians Diabetes features:
    Pregnancies, Glucose, BloodPressure, SkinThickness, Insulin, BMI, DiabetesPedigreeFunction, Age
    """
    if health_record.blood_glucose is None:
        raise MLPreprocessingError("Blood glucose is required for diabetes risk prediction.")
    if health_record.bmi is None:
        # Re-verify if we can calculate it
        if health_record.weight and health_record.height:
            w = float(health_record.weight)
            h = float(health_record.height)
            if h > 3.0: h /= 100.0 # cm to m
            bmi = w / (h * h)
        else:
            raise MLPreprocessingError("BMI (or weight & height) is required for diabetes risk prediction.")
    else:
        bmi = float(health_record.bmi)

    # Standard Pima dataset uses diastolic blood pressure for "BloodPressure".
    # If we have diastolic, use it, else default to 80.
    bp = int(health_record.diastolic_bp) if health_record.diastolic_bp is not None else 80

    # Impute skin thickness and pedigree function if not available
    skin_thickness = 20.0
    pedigree = 0.47  # Typical average pedigree function

    # Insulin defaults to 0 if not provided (many zeros in Pima are treated as missing, but standard is 0)
    insulin = int(health_record.insulin) if health_record.insulin is not None else 0

    pregnancies = int(health_record.pregnancies) if health_record.pregnancies is not None else 0
    if patient.gender == 'Male':
        pregnancies = 0

    data = {
        "Pregnancies": [pregnancies],
        "Glucose": [int(health_record.blood_glucose)],
        "BloodPressure": [bp],
        "SkinThickness": [skin_thickness],
        "Insulin": [insulin],
        "BMI": [bmi],
        "DiabetesPedigreeFunction": [pedigree],
        "Age": [int(patient.age)]
    }

    return pd.DataFrame(data)


def preprocess_hypertension_input(health_record, patient) -> pd.DataFrame:
    """
    Map fields to Cardiovascular Disease features (cardio_train.csv):
    age (days), gender (1: women, 2: men), height (cm), weight (kg), ap_hi (systolic), ap_lo (diastolic),
    cholesterol (1, 2, 3), gluc (1, 2, 3), smoke (0, 1), alco (0, 1), active (0, 1)
    """
    if health_record.systolic_bp is None or health_record.diastolic_bp is None:
        raise MLPreprocessingError("Systolic and diastolic blood pressure are required for hypertension risk prediction.")
    if health_record.weight is None or health_record.height is None:
        raise MLPreprocessingError("Height and weight are required for hypertension risk prediction.")

    # Age in days
    age_days = int(patient.age * 365.25)
    
    # Gender (1 = Female, 2 = Male)
    gender_code = 2 if patient.gender == 'Male' else 1
    
    # Height in cm
    height_cm = float(health_record.height)
    if height_cm < 3.0:
        height_cm *= 100.0 # m to cm
        
    weight_kg = float(health_record.weight)
    
    # Cholesterol mapping (1: normal < 200, 2: border 200-239, 3: high >= 240)
    chol_val = 1
    if health_record.cholesterol is not None:
        c = int(health_record.cholesterol)
        if c >= 240: chol_val = 3
        elif c >= 200: chol_val = 2

    # Glucose mapping (1: normal < 100, 2: prediabetes 100-125, 3: diabetes >= 126)
    gluc_val = 1
    if health_record.blood_glucose is not None:
        g = int(health_record.blood_glucose)
        if g >= 126: gluc_val = 3
        elif g >= 100: gluc_val = 2
        
    smoke_val = 1 if health_record.smoking_status == 'CURRENT' else 0
    alco_val = 0
    active_val = 1 # assume active

    data = {
        "age": [age_days],
        "gender": [gender_code],
        "height": [height_cm],
        "weight": [weight_kg],
        "ap_hi": [int(health_record.systolic_bp)],
        "ap_lo": [int(health_record.diastolic_bp)],
        "cholesterol": [chol_val],
        "gluc": [gluc_val],
        "smoke": [smoke_val],
        "alco": [alco_val],
        "active": [active_val]
    }

    return pd.DataFrame(data)


def preprocess_maternal_input(health_record, patient) -> pd.DataFrame:
    """
    Map fields to Maternal Health Risk features (Maternal Health Risk Data Set.csv):
    Age, SystolicBP, DiastolicBP, BS (mmol/L), BodyTemp (F), HeartRate
    """
    if patient.gender != 'Female':
        raise MLPreprocessingError("Maternal health predictions are only applicable for female patients.")
    
    if health_record.systolic_bp is None or health_record.diastolic_bp is None:
        raise MLPreprocessingError("Systolic and diastolic blood pressure are required for maternal risk prediction.")
    if health_record.blood_glucose is None:
        raise MLPreprocessingError("Blood glucose is required for maternal risk prediction.")
        
    # Convert blood glucose from mg/dL to mmol/L (UCI dataset expectation)
    bs_mmol = float(health_record.blood_glucose) / 18.0
    
    # Body temperature in Fahrenheit. If logged in Celsius (e.g. 35-41), convert.
    temp_f = 98.6
    if health_record.temperature is not None:
        t = float(health_record.temperature)
        if t < 45.0:  # Celsius range
            temp_f = (t * 9.0 / 5.0) + 32.0
        else:
            temp_f = t
            
    heart_rate = int(health_record.heart_rate) if health_record.heart_rate is not None else 80

    data = {
        "Age": [int(patient.age)],
        "SystolicBP": [int(health_record.systolic_bp)],
        "DiastolicBP": [int(health_record.diastolic_bp)],
        "BS": [bs_mmol],
        "BodyTemp": [temp_f],
        "HeartRate": [heart_rate]
    }

    return pd.DataFrame(data)
