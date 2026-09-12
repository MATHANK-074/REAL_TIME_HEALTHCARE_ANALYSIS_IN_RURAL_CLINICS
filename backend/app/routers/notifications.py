from fastapi import APIRouter, Depends, HTTPException, status
from pymongo.database import Database
from typing import List
from datetime import datetime

from ..schemas import Notification, User
from ..services.notification_service import create_notification
from .auth import get_current_user

router = APIRouter(prefix="/notifications", tags=["Notifications"])

def serialize(doc):
    if doc and "_id" in doc:
        doc["id"] = str(doc["_id"])
    return doc

def get_notif_filter(current_user: User):
    if current_user.get("role") == "PATIENT":
        return {"patient_id": str(current_user.get("patient_id"))}
    return {"recipient_id": str(current_user.id) if hasattr(current_user, 'id') else str(current_user.get("id"))}

@router.get("/", response_model=List[Notification])
def list_notifications(skip: int = 0, limit: int = 20,
                     db: Database = Depends(lambda: __import__('..database', fromlist=['get_db']).get_db()),
                     current_user: User = Depends(get_current_user)):
    filter_query = get_notif_filter(current_user)
    if not filter_query.get("patient_id") and not filter_query.get("recipient_id"):
        return []
    cursor = db.notifications.find(filter_query).sort("created_at", -1).skip(skip).limit(limit)
    return [serialize(n) for n in cursor]

@router.get("/unread", response_model=List[Notification])
def list_unread(skip: int = 0, limit: int = 20,
               db: Database = Depends(lambda: __import__('..database', fromlist=['get_db']).get_db()),
               current_user: User = Depends(get_current_user)):
    filter_query = get_notif_filter(current_user)
    filter_query["is_read"] = False
    cursor = db.notifications.find(filter_query).sort("created_at", -1).skip(skip).limit(limit)
    return [serialize(n) for n in cursor]

@router.get("/unread-count")
def unread_count(db: Database = Depends(lambda: __import__('..database', fromlist=['get_db']).get_db()),
                current_user: User = Depends(get_current_user)):
    filter_query = get_notif_filter(current_user)
    filter_query["is_read"] = False
    count = db.notifications.count_documents(filter_query)
    return {"count": count}

@router.patch("/{notif_id}/read")
def mark_read(notif_id: str,
              db: Database = Depends(lambda: __import__('..database', fromlist=['get_db']).get_db()),
              current_user: User = Depends(get_current_user)):
    filter_query = get_notif_filter(current_user)
    filter_query["_id"] = __import__('bson').ObjectId(notif_id)
    result = db.notifications.update_one(filter_query, {"$set": {"is_read": True}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found or not authorized")
    return {"status": "marked read"}

@router.patch("/read-all")
def mark_all_read(db: Database = Depends(lambda: __import__('..database', fromlist=['get_db']).get_db()),
                 current_user: User = Depends(get_current_user)):
    filter_query = get_notif_filter(current_user)
    filter_query["is_read"] = False
    db.notifications.update_many(filter_query, {"$set": {"is_read": True}})
    return {"status": "all notifications marked read"}
