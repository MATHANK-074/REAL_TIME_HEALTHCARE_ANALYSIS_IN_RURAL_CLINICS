USE rural_healthcare;

-- Clear existing data (in order of dependencies)
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE audit_logs;
TRUNCATE TABLE followups;
TRUNCATE TABLE alerts;
TRUNCATE TABLE prediction_factors;
TRUNCATE TABLE predictions;
TRUNCATE TABLE health_records;
TRUNCATE TABLE patients;
TRUNCATE TABLE users;
TRUNCATE TABLE villages;
TRUNCATE TABLE subdistricts;
TRUNCATE TABLE districts;
SET FOREIGN_KEY_CHECKS = 1;

-- 1. Seed districts
INSERT INTO districts (id, name) VALUES
(1, 'Erode');

-- 2. Seed subdistricts
INSERT INTO subdistricts (id, name, district_id) VALUES
(1, 'Perundurai', 1),
(2, 'Bhavani', 1);

-- 3. Seed villages
INSERT INTO villages (id, name, subdistrict_id) VALUES
(1, 'Perundurai East', 1),
(2, 'Perundurai West', 1),
(3, 'Pallipalayam', 2),
(4, 'Bhavani Center', 2);

-- 4. Seed users
-- Password is 'password123' hashed using bcrypt ($2b$12$Z3LVDCXo/ICeKxPwbWysROoZDSFHIUbNxgidZTComlsBi3rkC38Sy)
INSERT INTO users (id, name, email, password_hash, role, phone, district_id, subdistrict_id, village_id, is_active) VALUES
(1, 'District Admin', 'admin@ruralcare.com', '$2b$12$Z3LVDCXo/ICeKxPwbWysROoZDSFHIUbNxgidZTComlsBi3rkC38Sy', 'ADMIN', '+91 90000 11111', 1, NULL, NULL, TRUE),
(2, 'Dr. Arun', 'doctor@ruralcare.com', '$2b$12$Z3LVDCXo/ICeKxPwbWysROoZDSFHIUbNxgidZTComlsBi3rkC38Sy', 'DOCTOR', '+91 90000 33333', NULL, 1, NULL, TRUE),
(3, 'Nurse 01', 'nurse@ruralcare.com', '$2b$12$Z3LVDCXo/ICeKxPwbWysROoZDSFHIUbNxgidZTComlsBi3rkC38Sy', 'NURSE', '+91 90000 22222', NULL, NULL, 1, TRUE);

-- 5. Seed patients
INSERT INTO patients (id, patient_code, name, age, gender, phone, village_id, address, blood_group, emergency_contact, existing_disease, allergies) VALUES
(1, 'RH-0001', 'Kumar', 45, 'Male', '9876543210', 1, '12 Ward 3, Perundurai East', 'O+', '9876543290', 'None', 'None'),
(2, 'RH-0002', 'Ravi', 52, 'Male', '9876543211', 1, '34 East Cross, Perundurai East', 'A+', '9876543291', 'Hypertension', 'Penicillin'),
(3, 'RH-0003', 'Priya', 28, 'Female', '9876543212', 3, '7 South St, Pallipalayam', 'B+', '9876543292', 'None', 'Dust'),
(4, 'RH-0004', 'Meena', 32, 'Female', '9876543213', 3, '18 North St, Pallipalayam', 'O-', '9876543293', 'None', 'None'),
(5, 'RH-0005', 'Balan', 60, 'Male', '9876543214', 4, '88 Main Bazaar, Bhavani Center', 'AB+', '9876543294', 'Diabetes', 'None');

-- 6. Seed health_records (showing history for trends)
INSERT INTO health_records (id, patient_id, recorded_by, weight, height, bmi, blood_pressure, systolic_bp, diastolic_bp, heart_rate, temperature, blood_glucose, cholesterol, insulin, pregnancies, smoking_status, recorded_at) VALUES
-- Kumar's trend (Low -> Med -> High)
(1, 1, 3, 78.00, 1.70, 27.0, '130/85', 130, 85, 76, 98.4, 130, 180, 0, 0, 'NEVER', '2026-06-05 10:00:00'),
(2, 1, 3, 78.20, 1.70, 27.1, '140/90', 140, 90, 80, 98.6, 160, 195, 0, 0, 'NEVER', '2026-07-20 10:30:00'),
(3, 1, 3, 78.50, 1.70, 27.2, '150/95', 150, 95, 84, 99.0, 180, 210, 0, 0, 'NEVER', '2026-08-07 09:00:00'),

-- Ravi's cardiovascular record
(4, 2, 3, 85.00, 1.75, 27.8, '160/100', 160, 100, 88, 98.6, 110, 240, 0, 0, 'CURRENT', '2026-08-07 09:15:00'),

-- Priya's high-risk maternal record
(5, 3, 3, 68.00, 1.62, 25.9, '135/90', 135, 90, 90, 98.8, 170, 190, 0, 2, 'NEVER', '2026-08-07 09:30:00'),

-- Meena's low-risk maternal record
(6, 4, 3, 60.00, 1.58, 24.0, '110/70', 110, 70, 72, 98.2, 90, 160, 0, 1, 'NEVER', '2026-08-07 09:45:00'),

-- Balan's medium-risk diabetes record
(7, 5, 3, 70.00, 1.68, 24.8, '130/80', 130, 80, 74, 98.4, 145, 205, 0, 0, 'NEVER', '2026-08-07 10:00:00');

-- 7. Seed predictions
INSERT INTO predictions (id, patient_id, health_record_id, model_name, disease, probability, risk_level, prediction_result, model_version, predicted_at) VALUES
-- Kumar's history
(1, 1, 1, 'DIABETES', 'Diabetes Risk', 0.150, 'LOW', 'Negative', '1.0.0', '2026-06-05 10:05:00'),
(2, 1, 2, 'DIABETES', 'Diabetes Risk', 0.550, 'MEDIUM', 'Positive', '1.0.0', '2026-07-20 10:35:00'),
(3, 1, 3, 'DIABETES', 'Diabetes Risk', 0.870, 'HIGH', 'Positive', '1.0.0', '2026-08-07 09:05:00'),

-- Ravi
(4, 2, 4, 'HYPERTENSION', 'Hypertension/Cardiovascular Risk', 0.810, 'HIGH', 'Positive', '1.0.0', '2026-08-07 09:20:00'),

-- Priya
(5, 3, 5, 'MATERNAL', 'Maternal Health Risk', 0.920, 'HIGH', 'Positive', '1.0.0', '2026-08-07 09:35:00'),

-- Meena
(6, 4, 6, 'MATERNAL', 'Maternal Health Risk', 0.100, 'LOW', 'Negative', '1.0.0', '2026-08-07 09:50:00'),

-- Balan
(7, 5, 7, 'DIABETES', 'Diabetes Risk', 0.450, 'MEDIUM', 'Positive', '1.0.0', '2026-08-07 10:05:00');

-- 8. Seed prediction_factors
INSERT INTO prediction_factors (prediction_id, feature_name, feature_value, importance, direction) VALUES
(3, 'Blood Glucose', '180 mg/dL', 0.4500, 1),
(3, 'BMI', '27.2', 0.2500, 1),
(3, 'Age', '45', 0.1500, 1),
(3, 'Blood Pressure', '150/95 mmHg', 0.1000, 1),
(4, 'Systolic BP', '160 mmHg', 0.3800, 1),
(4, 'Diastolic BP', '100 mmHg', 0.2200, 1),
(4, 'Cholesterol', '240 mg/dL', 0.1800, 1),
(4, 'Smoking Status', 'CURRENT', 0.1200, 1),
(5, 'Blood Glucose', '170 mg/dL', 0.4200, 1),
(5, 'Systolic BP', '135 mmHg', 0.2000, 1),
(5, 'Heart Rate', '90 bpm', 0.1500, 1),
(5, 'Age', '28', 0.1000, 1);

-- 9. Seed alerts (High risk alerts)
INSERT INTO alerts (id, patient_id, prediction_id, alert_type, recipient_type, message, channel, status, created_at, sent_at) VALUES
(1, 1, 3, 'RISK_ALERT', 'DOCTOR', 'High Risk Alert: Patient Kumar (RH-0001) in Perundurai East has an 87% predicted risk of Diabetes.', 'DASHBOARD', 'UNREAD', '2026-08-07 09:06:00', NULL),
(2, 1, 3, 'SMS_ALERT', 'PATIENT', 'Health Alert: Your recent health assessment indicates elevated health risk. Please contact a healthcare professional for further evaluation.', 'SMS', 'UNREAD', '2026-08-07 09:06:00', '2026-08-07 09:06:30'),
(3, 2, 4, 'RISK_ALERT', 'DOCTOR', 'High Risk Alert: Patient Ravi (RH-0002) in Perundurai East has an 81% predicted risk of Hypertension/Cardiovascular.', 'DASHBOARD', 'UNREAD', '2026-08-07 09:21:00', NULL),
(4, 3, 5, 'RISK_ALERT', 'DOCTOR', 'High Risk Alert: Patient Priya (RH-0003) in Pallipalayam has a 92% predicted risk of Maternal Health Risk.', 'DASHBOARD', 'UNREAD', '2026-08-07 09:36:00', NULL);

-- 10. Seed followups
INSERT INTO followups (id, patient_id, doctor_id, followup_date, status, notes) VALUES
(1, 1, 2, '2026-08-10', 'PENDING', 'Schedule clinical fasting glucose test and review diet logs.'),
(2, 2, 2, '2026-08-12', 'PENDING', 'Check blood pressure at rest. Advise smoking cessation program.'),
(3, 3, 2, '2026-08-09', 'PENDING', 'Urgent gestational diabetes follow-up. Check fetal movement.');
