from fastapi import APIRouter, Depends, HTTPException, status
from pymongo.database import Database
from typing import List
from datetime import datetime
from bson import ObjectId

from ..schemas import Notification, User
from ..services.notification_service import create_notification
from .auth import get_current_user
from ..database import get_db

router = APIRouter(prefix="/notifications", tags=["Notifications"])

def serialize(doc):
    if doc and "_id" in doc:
        doc["id"] = str(doc["_id"])
    return doc

def get_notif_filter(current_user: User):
    if current_user.get("role") == "PATIENT":
        pid_str = str(current_user.get("patient_id") or "")
        uid_str = str(current_user.get("id") or current_user.get("_id") or "")
        clauses = []
        if pid_str:
            clauses.append({"patient_id": pid_str})
            clauses.append({"recipient_id": pid_str})
            if ObjectId.is_valid(pid_str):
                clauses.append({"patient_id": ObjectId(pid_str)})
        if uid_str:
            clauses.append({"recipient_id": uid_str})
            if ObjectId.is_valid(uid_str):
                clauses.append({"recipient_id": ObjectId(uid_str)})
        return {"$or": clauses} if clauses else {"patient_id": "__none__"}
    uid = str(current_user.id) if hasattr(current_user, 'id') else str(current_user.get("id") or current_user.get("_id") or "")
    clauses = [{"recipient_id": uid}]
    if ObjectId.is_valid(uid):
        clauses.append({"recipient_id": ObjectId(uid)})
    return {"$or": clauses}

@router.get("/", response_model=List[Notification])
def list_notifications(skip: int = 0, limit: int = 20,
                     db: Database = Depends(get_db),
                     current_user: User = Depends(get_current_user)):
    filter_query = get_notif_filter(current_user)
    if not filter_query.get("patient_id") and not filter_query.get("recipient_id"):
        return []
    cursor = db.notifications.find(filter_query).sort("created_at", -1).skip(skip).limit(limit)
    return [serialize(n) for n in cursor]

@router.get("/unread", response_model=List[Notification])
def list_unread(skip: int = 0, limit: int = 20,
               db: Database = Depends(get_db),
               current_user: User = Depends(get_current_user)):
    filter_query = get_notif_filter(current_user)
    filter_query["is_read"] = False
    cursor = db.notifications.find(filter_query).sort("created_at", -1).skip(skip).limit(limit)
    return [serialize(n) for n in cursor]

@router.get("/unread-count")
def unread_count(db: Database = Depends(get_db),
                current_user: User = Depends(get_current_user)):
    filter_query = get_notif_filter(current_user)
    filter_query["is_read"] = False
    count = db.notifications.count_documents(filter_query)
    return {"count": count}

@router.patch("/{notif_id}/read")
def mark_read(notif_id: str,
              db: Database = Depends(get_db),
              current_user: User = Depends(get_current_user)):
    filter_query = get_notif_filter(current_user)
    filter_query["_id"] = __import__('bson').ObjectId(notif_id)
    result = db.notifications.update_one(filter_query, {"$set": {"is_read": True}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found or not authorized")
    return {"status": "marked read"}

@router.patch("/read-all")
def mark_all_read(db: Database = Depends(get_db),
                 current_user: User = Depends(get_current_user)):
    filter_query = get_notif_filter(current_user)
    filter_query["is_read"] = False
    db.notifications.update_many(filter_query, {"$set": {"is_read": True}})
    return {"status": "all notifications marked read"}
