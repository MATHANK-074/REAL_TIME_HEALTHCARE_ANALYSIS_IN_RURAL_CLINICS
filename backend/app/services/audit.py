from sqlalchemy.orm import Session
from typing import Optional
from ..models import AuditLog

def log_audit(
    db: Session, 
    user_id: int, 
    action: str, 
    entity_type: str, 
    entity_id: Optional[int] = None, 
    details: Optional[str] = None
):
    """Log an action to the audit logs table."""
    try:
        audit_log = AuditLog(
            user_id=user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            details=details
        )
        db.add(audit_log)
        db.commit()
    except Exception as e:
        db.rollback()
        # Non-blocking log failure
        print(f"Failed to write audit log: {str(e)}")
