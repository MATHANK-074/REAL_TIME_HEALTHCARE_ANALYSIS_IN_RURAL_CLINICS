from fastapi import APIRouter, Depends, HTTPException, status, Request
from pymongo.database import Database
import datetime
from bson import ObjectId
import os

from ..database import get_db
from ..routers.auth import get_current_user
from ..schemas import PushSubscriptionCreate, VapidPublicKeyResponse

router = APIRouter()

@router.get("/public-key", response_model=VapidPublicKeyResponse)
def get_public_key():
    public_key = os.getenv("VAPID_PUBLIC_KEY")
    if not public_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="VAPID public key not configured on server"
        )
    return {"public_key": public_key}

@router.post("/subscribe", status_code=status.HTTP_201_CREATED)
def subscribe(
    sub_data: PushSubscriptionCreate,
    request: Request,
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    user_id = str(current_user.get("id", current_user.get("_id")))
    if not user_id or user_id == "None":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )
        
    user_agent = sub_data.user_agent or request.headers.get("user-agent", "")
    
    # Check if this endpoint is already registered
    existing = db.push_subscriptions.find_one({"endpoint": sub_data.endpoint})
    
    now = datetime.datetime.utcnow()
    
    if existing:
        db.push_subscriptions.update_one(
            {"_id": existing["_id"]},
            {
                "$set": {
                    "user_id": user_id,
                    "keys": sub_data.keys.dict(),
                    "user_agent": user_agent,
                    "is_active": True,
                    "updated_at": now
                }
            }
        )
    else:
        new_sub = {
            "user_id": user_id,
            "endpoint": sub_data.endpoint,
            "keys": sub_data.keys.dict(),
            "user_agent": user_agent,
            "is_active": True,
            "created_at": now,
            "updated_at": now,
            "last_success_at": None,
            "last_failure_at": None
        }
        db.push_subscriptions.insert_one(new_sub)
        
    return {"status": "subscribed"}

@router.delete("/unsubscribe", status_code=status.HTTP_200_OK)
def unsubscribe(
    sub_data: PushSubscriptionCreate,  # We just need the endpoint
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    user_id = str(current_user.get("id", current_user.get("_id")))
    
    db.push_subscriptions.update_many(
        {"endpoint": sub_data.endpoint, "user_id": user_id},
        {"$set": {"is_active": False, "updated_at": datetime.datetime.utcnow()}}
    )
    return {"status": "unsubscribed"}
