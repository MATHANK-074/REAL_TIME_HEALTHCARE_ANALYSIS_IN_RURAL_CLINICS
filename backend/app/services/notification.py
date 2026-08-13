from sqlalchemy.orm import Session
from typing import Optional
import datetime
from ..models import Alert
from ..config import settings

def send_patient_sms(phone: str, message: str) -> bool:
    """
    Mock SMS sender for development. Prints SMS to the console/logs.
    Can be configured to use a production gateway like Twilio or Vonage.
    """
    print(f"\n--- [SMS LOGS] Send SMS to {phone} ---")
    print(f"From: {settings.SMS_SENDER_NAME}")
    print(f"Message: {message}")
    print(f"--------------------------------------\n")
    return True

def create_system_alert(
    db: Session,
    patient_id: int,
    prediction_id: Optional[int],
    alert_type: str,
    recipient_type: str,
    message: str,
    channel: str = 'DASHBOARD'
) -> Alert:
    """
    Create a notification alert in the database for tracking on dashboards.
    """
    alert = Alert(
        patient_id=patient_id,
        prediction_id=prediction_id,
        alert_type=alert_type,
        recipient_type=recipient_type,
        message=message,
        channel=channel,
        status='UNREAD',
        created_at=datetime.datetime.utcnow()
    )
    
    if channel == 'SMS':
        # Simulate immediate dispatch
        alert.sent_at = datetime.datetime.utcnow()
        # Trigger the mock SMS sending
        try:
            from ..models import Patient
            patient = db.query(Patient).filter(Patient.id == patient_id).first()
            if patient and patient.phone:
                send_patient_sms(patient.phone, message)
        except Exception as e:
            print(f"Failed to dispatch SMS: {str(e)}")

    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert
