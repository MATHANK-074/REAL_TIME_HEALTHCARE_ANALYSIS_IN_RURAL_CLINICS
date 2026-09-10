from typing import Optional
import datetime

def log_audit(
    db, 
    user_id: str, 
    action: str, 
    entity_type: str, 
    entity_id: Optional[str] = None, 
    details: Optional[str] = None
):
    """Log an action to the audit logs collection."""
    try:
        audit_log = {
            "user_id": user_id,
            "action": action,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "details": details,
            "timestamp": datetime.datetime.utcnow()
        }
        db.audit_logs.insert_one(audit_log)
    except Exception as e:
        # Non-blocking log failure
        print(f"Failed to write audit log: {str(e)}")
