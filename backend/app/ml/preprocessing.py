import pandas as pd
import numpy as np
from typing import Dict, Any

class MLPreprocessingError(Exception):
    pass

class MLDataUnavailableError(Exception):
    """Raised when required clinical/laboratory data fields are not present in the current schema."""
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


# ============================================================================
# Heart Disease (Cleveland dataset)
# ============================================================================

def preprocess_heart_disease_input(health_record, patient) -> pd.DataFrame:
    """
    Map fields to Heart Disease (Cleveland) features:
    age, sex, cp, trestbps, chol, fbs, restecg, thalach, exang, oldpeak, slope, ca, thal
    """
    age = int(patient.age)
    sex = 1 if str(patient.gender).lower() == 'male' else 0
    
    # Chest pain type (0-3) based on reported symptoms
    cp = 0
    if health_record.symptoms:
        sym = str(health_record.symptoms).lower()
        if 'chest pain' in sym or 'tightness' in sym or 'angina' in sym:
            cp = 3
        elif 'dizziness' in sym or 'shortness of breath' in sym:
            cp = 2
            
    trestbps = int(health_record.systolic_bp) if health_record.systolic_bp is not None else 120
    chol = int(health_record.cholesterol) if health_record.cholesterol is not None else 200
    fbs = 1 if (health_record.blood_glucose and health_record.blood_glucose > 120) else 0
    restecg = 1
    thalach = int(health_record.heart_rate) if health_record.heart_rate is not None else 150
    exang = 1 if health_record.symptoms and 'angina' in str(health_record.symptoms).lower() else 0
    oldpeak = 1.5 if (health_record.systolic_bp and health_record.systolic_bp > 150) else 0.0
    slope = 1
    ca = 0
    thal = 2

    data = {
        "age": [age],
        "sex": [sex],
        "cp": [cp],
        "trestbps": [trestbps],
        "chol": [chol],
        "fbs": [fbs],
        "restecg": [restecg],
        "thalach": [thalach],
        "exang": [exang],
        "oldpeak": [oldpeak],
        "slope": [slope],
        "ca": [ca],
        "thal": [thal]
    }
    return pd.DataFrame(data)


# ============================================================================
# Stroke
# ============================================================================

def preprocess_stroke_input(health_record, patient) -> pd.DataFrame:
    """
    Map fields to Stroke prediction features:
    gender, age, hypertension, heart_disease, ever_married, work_type,
    Residence_type, avg_glucose_level, bmi, smoking_status
    """
    gender = 'Male' if str(patient.gender).lower() == 'male' else 'Female'
    age = float(patient.age)
    
    # Hypertension: 1 if systolic >= 140 or diastolic >= 90
    hypertension = 0
    if (health_record.systolic_bp and health_record.systolic_bp >= 140) or (health_record.diastolic_bp and health_record.diastolic_bp >= 90):
        hypertension = 1
        
    # Heart disease history
    heart_disease = 0
    if patient.existing_disease:
        dis = str(patient.existing_disease).lower()
        if any(k in dis for k in ['heart', 'cardiac', 'cad', 'coronary']):
            heart_disease = 1

    ever_married = 'Yes'
    work_type = 'Private'
    residence_type = 'Rural'
    
    avg_glucose_level = float(health_record.blood_glucose) if health_record.blood_glucose is not None else 100.0
    
    bmi = 25.0
    if health_record.bmi is not None:
        bmi = float(health_record.bmi)
    elif health_record.weight and health_record.height:
        w = float(health_record.weight)
        h = float(health_record.height)
        if h > 3.0: h /= 100.0
        if h > 0: bmi = w / (h * h)

    # Map smoking status: 'smokes', 'formerly smoked', 'never smoked', 'Unknown'
    smoking_status = 'never smoked'
    if health_record.smoking_status:
        smk = str(health_record.smoking_status).upper()
        if smk == 'CURRENT':
            smoking_status = 'smokes'
        elif 'FORMER' in smk:
            smoking_status = 'formerly smoked'
        elif smk == 'NEVER':
            smoking_status = 'never smoked'

    data = {
        "gender": [gender],
        "age": [age],
        "hypertension": [hypertension],
        "heart_disease": [heart_disease],
        "ever_married": [ever_married],
        "work_type": [work_type],
        "Residence_type": [residence_type],
        "avg_glucose_level": [avg_glucose_level],
        "bmi": [bmi],
        "smoking_status": [smoking_status]
    }
    return pd.DataFrame(data)


# ============================================================================
# Kidney Disease (UCI CKD dataset)
# ============================================================================

def preprocess_kidney_input(health_record, patient) -> pd.DataFrame:
    """
    Map fields to Kidney Disease features:
    age, bp, sg, al, su, rbc, pc, pcc, ba, bgr, bu, sc, sod, pot,
    hemo, pcv, wbcc, rbcc, htn, dm, cad, appet, pe, ane
    """
    age = float(patient.age)
    bp = float(health_record.diastolic_bp) if health_record.diastolic_bp is not None else 80.0
    sg = 1.020
    al = 1 if (health_record.systolic_bp and health_record.systolic_bp > 150) else 0
    su = 1 if (health_record.blood_glucose and health_record.blood_glucose > 180) else 0
    rbc = 'normal'
    pc = 'normal'
    pcc = 'notpresent'
    ba = 'notpresent'
    bgr = float(health_record.blood_glucose) if health_record.blood_glucose is not None else 120.0
    bu = 36.0
    sc = 1.2
    sod = 137.0
    pot = 4.4
    hemo = 15.4
    pcv = 44.0
    wbcc = 7800.0
    rbcc = 5.2
    htn = 'yes' if (health_record.systolic_bp and health_record.systolic_bp >= 140) else 'no'
    dm = 'yes' if (health_record.blood_glucose and health_record.blood_glucose >= 126) else 'no'
    cad = 'yes' if patient.existing_disease and 'cad' in str(patient.existing_disease).lower() else 'no'
    appet = 'good'
    pe = 'no'
    ane = 'no'

    data = {
        "age": [age],
        "bp": [bp],
        "sg": [sg],
        "al": [al],
        "su": [su],
        "rbc": [rbc],
        "pc": [pc],
        "pcc": [pcc],
        "ba": [ba],
        "bgr": [bgr],
        "bu": [bu],
        "sc": [sc],
        "sod": [sod],
        "pot": [pot],
        "hemo": [hemo],
        "pcv": [pcv],
        "wbcc": [wbcc],
        "rbcc": [rbcc],
        "htn": [htn],
        "dm": [dm],
        "cad": [cad],
        "appet": [appet],
        "pe": [pe],
        "ane": [ane]
    }
    return pd.DataFrame(data)

