![alt text](image.png)# RuralCare AI – Complete Functional Test Plan

## 1. Project Overview & Architecture
**Project Name**: RuralCare AI – AI-Powered Rural Healthcare Analytics System  
**Backend Framework**: FastAPI (Python 3.10+)  
**Frontend Framework**: React 19, React Router v7, Recharts, Leaflet  
**Database**: MongoDB Atlas (`rural_healthcare` database) with collections:
`users`, `patients`, `health_records`, `predictions`, `prediction_factors`, `clinical_recommendations`, `doctor_reviews`, `followups`, `notifications`, `push_subscriptions`, `alerts`, `audit_logs`, `districts`, `subdistricts`, `villages`, `healthcare_areas`, `clinics`, `revenue_divisions`, `revenue_taluks`, `revenue_firkas`, `revenue_villages`.

**ML Models Directory**: `models/`
1. `diabetes_model.pkl` (Pima Indians Pipeline)
2. `heart_disease_risk_model.pkl` (Cleveland Heart Disease Pipeline)
3. `hypertension_model.pkl` (Cardiovascular Disease Pipeline)
4. `kidney_model.pkl` (UCI Chronic Kidney Disease Pipeline)
5. `stroke_model.pkl` (Stroke Risk Prediction Pipeline)
*(Additional: `maternal_model.pkl`, `metrics.json`)*

---

## 2. Discovered Modules & Real Endpoints

### A. Health & System Configuration
- `GET /api/health`: Health status, environment, and system timestamp.
- Database ping via PyMongo `admin.command('ping')`.
- ML Model Registry loading checks for all 5 core disease models + maternal model.

### B. Authentication (`/api/auth`)
- `POST /api/auth/register`: User registration with role (`ADMIN`, `DOCTOR`, `NURSE`, `PATIENT`) and geographic hierarchy validation.
- `POST /api/auth/login`: Credential verification, returns JWT access token (`HS256`).
- `GET /api/auth/me`: Retrieves current authenticated user profile.
- Token validation & expiration checks.

### C. Role-Based Access Control (RBAC) & Jurisdiction
- Admin: District-wide unrestricted management.
- Doctor: Limited to assigned `clinic_id` or `subdistrict_id`.
- Nurse: Limited to assigned `area_id` or `village_id`.
- Patient: Limited strictly to their linked `patient_id`.
- Enforcement of `enforce_patient_area_access` across patients, health records, predictions, reviews, and follow-ups.

### D. Patient Management (`/api/patients`)
- `POST /api/patients`: Register patient, auto-generate `RH-XXXX` code, auto-create linked user account.
- `GET /api/patients`: Search/filter accessible patients based on user role and jurisdiction.
- `GET /api/patients/{id}`: Detailed patient profile with cascading village, subdistrict, district enrichment.
- `PUT /api/patients/{id}`: Update demographics with location validation.

### E. Health Records (`/api/health-records`)
- `POST /api/health-records`: Nurse logs vitals, auto-calculates BMI, splits BP, sets status `PENDING_REVIEW`, automatically triggers ML risk assessment, clinical recommendations, and notifications.
- `GET /api/health-records/patient/{patient_id}`: Retrieves chronological health records.
- `GET /api/health-records/pending-review`: Retrieves doctor's pending reviews filtered by jurisdiction.

### F. AI Prediction Models & Explainability (`/api/predictions`)
- Models: Diabetes, Hypertension, Heart Disease, Stroke, Kidney Disease (plus Maternal).
- `POST /api/predictions/{patient_id}?model_name=...`: Trigger model inference.
- Outputs: Finite probability in [0, 1], risk category (`LOW`, `MEDIUM`, `HIGH`, `UNAVAILABLE`), local feature importance factors.
- Controlled validation: Missing required features return documented `UNAVAILABLE` or raise controlled validation errors.
- `GET /api/predictions/patient/{patient_id}`: Patient prediction history.
- `GET /api/predictions/metrics`: Returns real evaluation metrics from `models/metrics.json`.

### G. Clinical Support & Doctor Review (`/api/reviews`)
- `GET /api/reviews/queue`: Prioritized clinical review queue for doctors.
- `GET /api/reviews/{patient_id}`: Review summary with patient vitals, predictions, and recommendations.
- `POST /api/reviews/{recommendation_id}/decision`: Doctor submits `APPROVE`, `MODIFY`, or `DISMISS` with mandatory notes.

### H. Follow-up Scheduling (`/api/followups`)
- `POST /api/followups`: Doctor/Admin schedules follow-up with date and priority.
- `GET /api/followups`: Filtered list by user role and jurisdiction.
- `PUT /api/followups/{id}`: Status update (`PENDING`, `COMPLETED`, `MISSED`) with notifications.

### I. In-App & Web Push Notifications (`/api/notifications`, `/api/push`)
- `GET /api/notifications`: Recipient-isolated notifications.
- `GET /api/notifications/unread-count`: Unread counter.
- `PATCH /api/notifications/{id}/read`: Mark notification as read.
- `PATCH /api/notifications/read-all`: Mark all as read.
- `GET /api/push/public-key`: VAPID public key retrieval.
- `POST /api/push/subscribe`: Web push subscription registration.
- `DELETE /api/push/unsubscribe`: Web push unsubscription.

### J. Patient Portal (`/api/patient`)
- `GET /api/patient/dashboard`: Summary overview for patient.
- `GET /api/patient/health`: Patient-safe health status.
- `GET /api/patient/history`: Historical records and safe AI assessments.
- `GET /api/patient/profile`: Demographics, assigned nurse, assigned doctor.

### K. Admin Dashboard & Geography (`/api/dashboard/admin`, `/api/locations`)
- `GET /api/dashboard/admin`: Real KPI counts (patients, doctors, nurses, high-risk breakdown).
- `GET /api/locations/districts`, `taluks`, `firkas`, `villages`, `areas`, `facilities`.

---

## 3. Test Suites Implementation Plan
1. `test_health.py`: FastAPI startup, health endpoint, DB connection, config loading.
2. `test_auth.py`: Registration, login, invalid password, bad token, password security.
3. `test_authorization.py`: RBAC, cross-clinic isolation, patient isolation, unauthenticated access.
4. `test_patients.py`: Patient CRUD, validation, duplicate prevention, ID consistency.
5. `test_health_records.py`: Vitals logging, BP/BMI parsing, persistence, pending status.
6. `test_predictions.py`: 5 core ML models + maternal, feature preprocessing, schema, probabilities, metrics.
7. `test_clinical_support.py`: Clinical recommendation engine, priority aggregation, local explainability.
8. `test_clinical_reviews.py`: Review queue, decision submission (APPROVE/MODIFY/DISMISS), doctor notes.
9. `test_followups.py`: Follow-up creation, retrieval, status update, patient isolation.
10. `test_notifications.py`: Recipient isolation, unread count, mark read, mark all read, push API.
11. `test_dashboard.py`: Doctor & Admin dashboards, real counts.
12. `test_geo_hierarchy.py`: Erode district cascade, taluks, firkas, villages, areas, facilities.
13. `test_full_workflow.py`: End-to-end nurse-to-doctor-to-patient full workflow with isolated cleanup.
