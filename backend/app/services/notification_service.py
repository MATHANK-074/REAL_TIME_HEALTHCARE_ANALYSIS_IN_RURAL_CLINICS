import datetime
from typing import Optional

# Service functions for notifications

def create_notification(db, recipient_id: str, notif_type: str, title: str, message: str,
                        priority: str = "MEDIUM", patient_id: Optional[str] = None,
                        health_record_id: Optional[str] = None, followup_id: Optional[str] = None,
                        link: Optional[str] = None):
    """Insert a notification document into the `notifications` collection.
    Returns the inserted document (including generated _id)."""
    doc = {
        "recipient_id": recipient_id,
        "type": notif_type,
        "title": title,
        "message": message,
        "priority": priority,
        "is_read": False,
        "created_at": datetime.datetime.utcnow(),
        "patient_id": patient_id,
        "health_record_id": health_record_id,
        "followup_id": followup_id,
        "link": link,
    }
    result = db.notifications.insert_one(doc)
    doc["_id"] = result.inserted_id
    return doc


def get_doctor_for_patient(db, patient):
    """Return the user id of the doctor assigned to the patient's clinic.
    Assumes patient document has a `clinic_id` field and that a doctor is linked via `clinic.doctor_id` or similar.
    Adjust according to actual schema – fallback to first doctor in the clinic if not explicit.
    """
    clinic_id = patient.get("clinic_id")
    if not clinic_id:
        return None
    clinic = db.clinics.find_one({"_id": clinic_id})
    if clinic and clinic.get("doctor_id"):
        return str(clinic["doctor_id"])
    doctor = db.users.find_one({"role": "DOCTOR", "clinic_id": str(clinic_id)})
    return str(doctor["_id"]) if doctor else None


def get_nurse_for_patient(db, patient):
    """Return the user id of the nurse responsible for the patient.
    Uses area_id or village_id hierarchy.
    """
    area_id = patient.get("area_id")
    if area_id:
        nurse = db.users.find_one({"role": "NURSE", "area_id": str(area_id)})
        if nurse:
            return str(nurse["_id"])
    village_id = patient.get("village_id")
    if village_id:
        nurse = db.users.find_one({"role": "NURSE", "village_id": str(village_id)})
        if nurse:
            return str(nurse["_id"])
    return None

# Trigger functions for each workflow (A‑F)

def notify_health_review_required(db, record, patient):
    doctor_id = get_doctor_for_patient(db, patient)
    if not doctor_id:
        return None
    title = "Health record requires review"
    message = f"New health record for patient {patient.get('name')} needs your review."
    link = f"/patients/{patient.get('_id')}/health-records/{record.get('_id')}"
    return create_notification(db, doctor_id, "HEALTH_REVIEW_REQUIRED", title, message,
                                priority="MEDIUM", patient_id=str(patient.get('_id')),
                                health_record_id=str(record.get('_id')), link=link)

def notify_followup_created(db, followup, patient):
    nurse_id = get_nurse_for_patient(db, patient)
    if not nurse_id:
        return None
    title = "New follow‑up scheduled"
    message = f"Follow‑up on {followup.get('followup_date')} for patient {patient.get('name')} has been created."
    link = f"/patients/{patient.get('_id')}/followups/{followup.get('_id')}"
    return create_notification(db, nurse_id, "FOLLOWUP_CREATED", title, message,
                                priority=followup.get('priority', 'MEDIUM'),
                                patient_id=str(patient.get('_id')),
                                followup_id=str(followup.get('_id')), link=link)

def notify_followup_completed(db, followup, patient):
    doctor_id = get_doctor_for_patient(db, patient)
    if not doctor_id:
        return None
    title = "Follow‑up completed"
    message = f"Follow‑up scheduled for {followup.get('followup_date')} has been marked completed."
    link = f"/patients/{patient.get('_id')}/followups/{followup.get('_id')}"
    return create_notification(db, doctor_id, "FOLLOWUP_COMPLETED", title, message,
                                priority=followup.get('priority', 'MEDIUM'),
                                patient_id=str(patient.get('_id')),
                                followup_id=str(followup.get('_id')), link=link)

def notify_followup_missed(db, followup, patient):
    doctor_id = get_doctor_for_patient(db, patient)
    if not doctor_id:
        return None
    title = "Follow‑up missed"
    message = f"Follow‑up scheduled for {followup.get('followup_date')} was missed."
    link = f"/patients/{patient.get('_id')}/followups/{followup.get('_id')}"
    return create_notification(db, doctor_id, "FOLLOWUP_MISSED", title, message,
                                priority="HIGH", patient_id=str(patient.get('_id')),
                                followup_id=str(followup.get('_id')), link=link)

def notify_needs_followup(db, record, patient):
    nurse_id = get_nurse_for_patient(db, patient)
    if not nurse_id:
        return None
    title = "Patient needs follow‑up"
    message = f"Health record for patient {patient.get('name')} marked as Needs Follow‑up."
    link = f"/patients/{patient.get('_id')}/followups"
    return create_notification(db, nurse_id, "FOLLOWUP_CREATED", title, message,
                                priority="HIGH", patient_id=str(patient.get('_id')),
                                health_record_id=str(record.get('_id')), link=link)

def notify_escalated(db, record, patient, admin_user_id: str):
    doctor_id = get_doctor_for_patient(db, patient)
    notifications = []
    title = "Health record escalated"
    message = f"Health record for patient {patient.get('name')} has been escalated."
    link = f"/patients/{patient.get('_id')}/health-records/{record.get('_id')}"
    if doctor_id:
        notifications.append(create_notification(db, doctor_id, "HEALTH_ESCALATED", title, message,
                                                priority="URGENT", patient_id=str(patient.get('_id')),
                                                health_record_id=str(record.get('_id')), link=link))
    if admin_user_id:
        notifications.append(create_notification(db, admin_user_id, "HEALTH_ESCALATED", title, message,
                                                priority="URGENT", patient_id=str(patient.get('_id')),
                                                health_record_id=str(record.get('_id')), link=link))
    return notifications
