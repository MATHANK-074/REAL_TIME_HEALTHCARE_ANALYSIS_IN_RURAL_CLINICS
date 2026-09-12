from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
import datetime

from ..database import get_db
from ..schemas import (
    District as DistrictSchema,
    RevenueDivision as DivisionSchema,
    RevenueDivisionCreate,
    RevenueTaluk as TalukSchema,
    RevenueTalukCreate,
    RevenueFirka as FirkaSchema,
    RevenueFirkaCreate,
    RevenueVillage as VillageSchema,
    RevenueVillageCreate,
    HealthcareArea as AreaSchema,
    HealthcareAreaCreate,
    HealthcareFacility as FacilitySchema,
    HealthcareFacilityCreate,
)
from .auth import require_role

router = APIRouter(prefix="/locations", tags=["Geography Cascading"])

def serialize_doc(doc: dict) -> dict:
    if doc and "_id" in doc:
        doc["id"] = str(doc.pop("_id"))
    return doc

# Districts (read‑only for all users)
@router.get("/districts", response_model=List[DistrictSchema])
def get_districts(db=Depends(get_db)):
    docs = list(db.districts.find({}))
    return [serialize_doc(d) for d in docs]

# Revenue Divisions (admin only to create, read for all)
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

# Taluks
@router.get("/taluks", response_model=List[TalukSchema])
def get_taluks(district_id: str = None, db=Depends(get_db)):
    query = {}
    if district_id:
        query["district_id"] = district_id
    docs = list(db.revenue_taluks.find(query))
    return [serialize_doc(d) for d in docs]

@router.post("/taluks", response_model=TalukSchema, status_code=status.HTTP_201_CREATED)
def create_taluk(taluk: RevenueTalukCreate, db=Depends(get_db), current_user=Depends(require_role(["ADMIN"]))):
    db_item = taluk.dict()
    db_item["created_at"] = datetime.datetime.utcnow()
    result = db.revenue_taluks.insert_one(db_item)
    db_item["_id"] = result.inserted_id
    return serialize_doc(db_item)

# Firkas
@router.get("/firkas", response_model=List[FirkaSchema])
def get_firkas(taluk_id: str = None, db=Depends(get_db)):
    query = {}
    if taluk_id:
        query["taluk_id"] = taluk_id
    docs = list(db.revenue_firkas.find(query))
    return [serialize_doc(d) for d in docs]

@router.post("/firkas", response_model=FirkaSchema, status_code=status.HTTP_201_CREATED)
def create_firka(firka: RevenueFirkaCreate, db=Depends(get_db), current_user=Depends(require_role(["ADMIN"]))):
    db_item = firka.dict()
    db_item["created_at"] = datetime.datetime.utcnow()
    result = db.revenue_firkas.insert_one(db_item)
    db_item["_id"] = result.inserted_id
    return serialize_doc(db_item)

# Villages
@router.get("/villages", response_model=List[VillageSchema])
def get_villages(firka_id: str = None, db=Depends(get_db)):
    query = {}
    if firka_id:
        query["firka_id"] = firka_id
    docs = list(db.revenue_villages.find(query))
    return [serialize_doc(d) for d in docs]

@router.post("/villages", response_model=VillageSchema, status_code=status.HTTP_201_CREATED)
def create_village(village: RevenueVillageCreate, db=Depends(get_db), current_user=Depends(require_role(["ADMIN"]))):
    db_item = village.dict()
    db_item["created_at"] = datetime.datetime.utcnow()
    result = db.revenue_villages.insert_one(db_item)
    db_item["_id"] = result.inserted_id
    return serialize_doc(db_item)

# Healthcare Areas
@router.get("/areas", response_model=List[AreaSchema])
def get_areas(village_id: str = None, db=Depends(get_db)):
    query = {}
    if village_id:
        query["village_id"] = village_id
    docs = list(db.healthcare_areas.find(query))
    return [serialize_doc(d) for d in docs]

@router.post("/areas", response_model=AreaSchema, status_code=status.HTTP_201_CREATED)
def create_area(area: HealthcareAreaCreate, db=Depends(get_db), current_user=Depends(require_role(["ADMIN"]))):
    db_item = area.dict()
    db_item["created_at"] = datetime.datetime.utcnow()
    result = db.healthcare_areas.insert_one(db_item)
    db_item["_id"] = result.inserted_id
    return serialize_doc(db_item)

# Facilities
@router.get("/facilities", response_model=List[FacilitySchema])
def get_facilities(area_id: str = None, db=Depends(get_db)):
    query = {}
    if area_id:
        query["area_id"] = area_id
    docs = list(db.healthcare_facilities.find(query))
    return [serialize_doc(d) for d in docs]

@router.post("/facilities", response_model=FacilitySchema, status_code=status.HTTP_201_CREATED)
def create_facility(facility: HealthcareFacilityCreate, db=Depends(get_db), current_user=Depends(require_role(["ADMIN"]))):
    db_item = facility.dict()
    db_item["created_at"] = datetime.datetime.utcnow()
    result = db.healthcare_facilities.insert_one(db_item)
    db_item["_id"] = result.inserted_id
    return serialize_doc(db_item)
