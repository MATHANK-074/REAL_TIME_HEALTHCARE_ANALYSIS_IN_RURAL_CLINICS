from typing import Optional
import datetime
from bson import ObjectId
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
    db,
    patient_id: str,
    prediction_id: Optional[str],
    alert_type: str,
    recipient_type: str,
    message: str,
    channel: str = 'DASHBOARD'
):
    """
    Create a notification alert in the database for tracking on dashboards.
    """
    alert = {
        "patient_id": patient_id,
        "prediction_id": prediction_id,
        "alert_type": alert_type,
        "recipient_type": recipient_type,
        "message": message,
        "channel": channel,
        "status": 'UNREAD',
        "created_at": datetime.datetime.utcnow()
    }
    
    if channel == 'SMS':
        # Simulate immediate dispatch
        alert["sent_at"] = datetime.datetime.utcnow()
        # Trigger the mock SMS sending
        try:
            patient = db.patients.find_one({"_id": ObjectId(patient_id)})
            if patient and patient.get("phone"):
                send_patient_sms(patient["phone"], message)
        except Exception as e:
            print(f"Failed to dispatch SMS: {str(e)}")

    result = db.alerts.insert_one(alert)
    alert["_id"] = str(result.inserted_id)
    return alert
