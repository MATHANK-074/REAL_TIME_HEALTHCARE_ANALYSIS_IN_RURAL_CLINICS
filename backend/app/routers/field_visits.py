from fastapi import APIRouter, Depends, HTTPException, status
from pymongo.database import Database
from typing import List, Optional
from bson import ObjectId
import datetime

from ..database import get_db
from ..schemas import FieldVisit as FieldVisitSchema, FieldVisitCreate, User
from .auth import get_current_user
from ..services.audit import log_audit

router = APIRouter(prefix="/field-visits", tags=["Field Visits"])

def serialize_doc(doc):
    if doc and "_id" in doc:
        doc["id"] = str(doc["_id"])
    return doc

@router.post("", response_model=FieldVisitSchema, status_code=status.HTTP_201_CREATED)
def start_field_visit(
    visit_data: FieldVisitCreate, 
    db: Database = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    """Start a new field visit. Validates assigned area/clinic against patient."""
    
    if current_user.get("role") not in ['NURSE', 'ADMIN']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Nurses and Admins can start field visits"
        )
        
    # Check if patient exists
    try:
        patient_obj_id = ObjectId(visit_data.patient_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid patient ID")
        
    patient = db.patients.find_one({"_id": patient_obj_id})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    # Authorize location
    if current_user.get("role") == 'NURSE':
        if str(patient.get("village_id")) != str(current_user.get("village_id")):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. Patient belongs to another village."
            )

    # Set properties
    db_visit = visit_data.dict(exclude_unset=True)
    db_visit["nurse_id"] = str(current_user.get("_id") or current_user.get("id"))
    db_visit["status"] = db_visit.get("status") or 'STARTED'
    db_visit["created_at"] = datetime.datetime.utcnow()
    if not db_visit.get("started_at"):
        db_visit["started_at"] = db_visit["created_at"]
    
    # If nurse has assigned village/clinic/area, copy them if not provided
    if not db_visit.get("village_id"):
        db_visit["village_id"] = str(current_user.get("village_id"))
    
    result = db.field_visits.insert_one(db_visit)
    db_visit["_id"] = result.inserted_id
    
    log_audit(db, db_visit["nurse_id"], "START_FIELD_VISIT", "field_visits", str(db_visit["_id"]), f"Started field visit for patient {visit_data.patient_id}")
    
    return serialize_doc(db_visit)


@router.get("", response_model=List[FieldVisitSchema])
def get_field_visits(
    status_filter: Optional[str] = None,
    patient_id: Optional[str] = None,
    db: Database = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get field visits for the logged-in user or a specific patient."""
    query = {}
    
    if current_user.get("role") == 'NURSE':
        nurse_id = str(current_user.get("_id") or current_user.get("id"))
        query["nurse_id"] = nurse_id
    
    if status_filter:
        query["status"] = status_filter
        
    if patient_id:
        query["patient_id"] = patient_id
        
    visits = list(db.field_visits.find(query).sort("created_at", -1))
    return [serialize_doc(v) for v in visits]


@router.get("/{visit_id}", response_model=FieldVisitSchema)
def get_field_visit(
    visit_id: str,
    db: Database = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific field visit by ID."""
    try:
        visit_obj_id = ObjectId(visit_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid visit ID")
        
    visit = db.field_visits.find_one({"_id": visit_obj_id})
    if not visit:
        raise HTTPException(status_code=404, detail="Field visit not found")
        
    if current_user.get("role") == 'NURSE':
        if visit.get("nurse_id") != str(current_user.get("_id") or current_user.get("id")):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied."
            )
            
    return serialize_doc(visit)


@router.put("/{visit_id}", response_model=FieldVisitSchema)
def update_field_visit(
    visit_id: str,
    visit_data: FieldVisitCreate,
    db: Database = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a field visit (e.g. mark as COMPLETED, add notes)."""
    try:
        visit_obj_id = ObjectId(visit_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid visit ID")
        
    visit = db.field_visits.find_one({"_id": visit_obj_id})
    if not visit:
        raise HTTPException(status_code=404, detail="Field visit not found")
        
    if current_user.get("role") == 'NURSE':
        if visit.get("nurse_id") != str(current_user.get("_id") or current_user.get("id")):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied."
            )
            
    update_data = visit_data.dict(exclude_unset=True)
    
    if update_data.get("status") == "COMPLETED" and visit.get("status") != "COMPLETED":
        update_data["completed_at"] = datetime.datetime.utcnow()
        
    db.field_visits.update_one({"_id": visit_obj_id}, {"$set": update_data})
    visit.update(update_data)
    
    log_audit(db, str(current_user.get("_id") or current_user.get("id")), "UPDATE_FIELD_VISIT", "field_visits", visit_id, f"Updated field visit to status {visit.get('status')}")
    
    return serialize_doc(visit)


@router.get("/patient/{patient_id}", response_model=List[FieldVisitSchema])
def get_patient_field_visits(
    patient_id: str,
    db: Database = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get field visit history for a specific patient."""
    try:
        patient_obj_id = ObjectId(patient_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid patient ID")
        
    patient = db.patients.find_one({"_id": patient_obj_id})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
        
    if current_user.get("role") == 'NURSE':
        if str(patient.get("village_id")) != str(current_user.get("village_id")):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. Patient belongs to another village."
            )
            
    visits = list(db.field_visits.find({"patient_id": patient_id}).sort("created_at", -1))
    return [serialize_doc(v) for v in visits]
