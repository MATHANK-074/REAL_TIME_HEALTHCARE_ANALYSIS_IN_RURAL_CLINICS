import os
import json
import logging
from pywebpush import webpush, WebPushException
import datetime

logger = logging.getLogger(__name__)

def send_web_push(db, user_id: str, title: str, message: str, link: str = None):
    """
    Sends a web push notification to all active subscriptions of the given user.
    """
    vapid_private_key = os.getenv("VAPID_PRIVATE_KEY")
    vapid_claim_email = os.getenv("VAPID_CLAIM_EMAIL")
    
    if not vapid_private_key or not vapid_claim_email:
        logger.warning("VAPID keys not configured, skipping web push")
        return
        
    subscriptions = db.push_subscriptions.find({"user_id": user_id, "is_active": True})
    
    payload = json.dumps({
        "title": title,
        "body": message,
        "url": link or "/patient/notifications"
    })
    
    for sub in subscriptions:
        try:
            webpush(
                subscription_info={
                    "endpoint": sub["endpoint"],
                    "keys": sub["keys"]
                },
                data=payload,
                vapid_private_key=vapid_private_key,
                vapid_claims={"sub": vapid_claim_email}
            )
            
            # Log success
            db.push_subscriptions.update_one(
                {"_id": sub["_id"]},
                {"$set": {"last_success_at": datetime.datetime.utcnow()}}
            )
            
        except WebPushException as ex:
            logger.error(f"Web push failed: {repr(ex)}")
            
            # If subscription expired or is no longer valid, deactivate it
            if ex.response and ex.response.status_code in [404, 410]:
                db.push_subscriptions.update_one(
                    {"_id": sub["_id"]},
                    {"$set": {
                        "is_active": False, 
                        "last_failure_at": datetime.datetime.utcnow()
                    }}
                )
            else:
                db.push_subscriptions.update_one(
                    {"_id": sub["_id"]},
                    {"$set": {"last_failure_at": datetime.datetime.utcnow()}}
                )
        except Exception as e:
            logger.error(f"Error sending web push: {e}")
