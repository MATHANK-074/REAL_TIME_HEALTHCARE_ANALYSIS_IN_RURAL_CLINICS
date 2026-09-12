from fastapi import APIRouter, Depends, status
from typing import List
import datetime

from ..database import get_db
from ..schemas import (
    District as DistrictSchema,
    DistrictCreate,
    RevenueDivision as DivisionSchema,
    RevenueDivisionCreate,
)
from .auth import require_role

router = APIRouter(prefix="/geography", tags=["Geography Master Data"])

def serialize_doc(doc: dict) -> dict:
    if doc and "_id" in doc:
        doc["id"] = str(doc.pop("_id"))
    return doc

# District endpoints
@router.get("/districts", response_model=List[DistrictSchema])
def get_districts(db=Depends(get_db)):
    docs = list(db.districts.find({}))
    return [serialize_doc(d) for d in docs]

@router.post("/districts", response_model=DistrictSchema, status_code=status.HTTP_201_CREATED)
def create_district(district: DistrictCreate, db=Depends(get_db), current_user=Depends(require_role(["ADMIN"]))):
    db_item = district.dict()
    db_item["created_at"] = datetime.datetime.utcnow()
    result = db.districts.insert_one(db_item)
    db_item["_id"] = result.inserted_id
    return serialize_doc(db_item)

# Revenue Division endpoints
@router.get("/divisions", response_model=List[DivisionSchema])
def get_divisions(db=Depends(get_db)):
    docs = list(db.revenue_divisions.find({}))
    return [serialize_doc(d) for d in docs]

@router.post("/divisions", response_model=DivisionSchema, status_code=status.HTTP_201_CREATED)
def create_division(division: RevenueDivisionCreate, db=Depends(get_db), current_user=Depends(require_role(["ADMIN"]))):
    db_item = division.dict()
    db_item["created_at"] = datetime.datetime.utcnow()
    result = db.revenue_divisions.insert_one(db_item)
    db_item["_id"] = result.inserted_id
    return serialize_doc(db_item)
