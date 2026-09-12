from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from bson import ObjectId
import datetime

from ..database import get_db
from ..schemas import (
    District as DistrictSchema, DistrictCreate,
    SubDistrict as SubDistrictSchema, SubDistrictCreate,
    Village as VillageSchema, VillageCreate,
    RevenueDivision as DivisionSchema, RevenueDivisionCreate
)
from .auth import require_role

router = APIRouter(prefix="/locations", tags=["Locations"])

def serialize_doc(doc: dict) -> dict:
    if doc and "_id" in doc:
        doc["id"] = str(doc.pop("_id"))
    return doc

@router.get("/districts", response_model=List[DistrictSchema])
def get_districts(db = Depends(get_db)):
    """Retrieve all districts."""
    docs = list(db.districts.find({}))
    return [serialize_doc(d) for d in docs]

@router.post("/districts", response_model=DistrictSchema, status_code=status.HTTP_201_CREATED)
def create_district(district: DistrictCreate, db = Depends(get_db), current_user = Depends(require_role(["ADMIN"]))):
    """Create a new district (Admin only)."""
    db_district = district.dict()
    db_district["created_at"] = datetime.datetime.utcnow()
    result = db.districts.insert_one(db_district)
    db_district["_id"] = result.inserted_id
    return serialize_doc(db_district)

@router.get("/subdistricts", response_model=List[SubDistrictSchema])
def get_subdistricts(district_id: str = None, db = Depends(get_db)):
    """Retrieve all subdistricts, optionally filtered by district."""
    query = {}
    if district_id:
        query["district_id"] = district_id
    docs = list(db.subdistricts.find(query))
    return [serialize_doc(d) for d in docs]

@router.post("/subdistricts", response_model=SubDistrictSchema, status_code=status.HTTP_201_CREATED)
def create_subdistrict(subdistrict: SubDistrictCreate, db = Depends(get_db), current_user = Depends(require_role(["ADMIN"]))):
    """Create a new subdistrict (Admin only)."""
    db_subdistrict = subdistrict.dict()
    db_subdistrict["created_at"] = datetime.datetime.utcnow()
    result = db.subdistricts.insert_one(db_subdistrict)
    db_subdistrict["_id"] = result.inserted_id
    return serialize_doc(db_subdistrict)

@router.get("/villages", response_model=List[VillageSchema])
def get_villages(subdistrict_id: str = None, db = Depends(get_db)):
    """Retrieve all villages, optionally filtered by subdistrict."""
    query = {}
    if subdistrict_id:
        query["subdistrict_id"] = subdistrict_id
    docs = list(db.villages.find(query))
    return [serialize_doc(d) for d in docs]

@router.post("/villages", response_model=VillageSchema, status_code=status.HTTP_201_CREATED)
def create_village(village: VillageCreate, db = Depends(get_db), current_user = Depends(require_role(["ADMIN"]))):
    """Create a new village (Admin only)."""
    db_village = village.dict()
    db_village["created_at"] = datetime.datetime.utcnow()
    result = db.villages.insert_one(db_village)
    db_village["_id"] = result.inserted_id
    return serialize_doc(db_village)

# Areas
from ..schemas import Area as AreaSchema, AreaCreate

@router.get("/areas", response_model=List[AreaSchema])
def get_areas(village_id: str = None, db = Depends(get_db)):
    """Retrieve all areas, optionally filtered by village."""
    query = {}
    if village_id:
        query["village_id"] = village_id
    docs = list(db.areas.find(query))
    return [serialize_doc(d) for d in docs]

@router.post("/areas", response_model=AreaSchema, status_code=status.HTTP_201_CREATED)
def create_area(area: AreaCreate, db = Depends(get_db), current_user = Depends(require_role(["ADMIN"]))):
    """Create a new area (Admin only)."""
    db_area = area.dict()
    db_area["created_at"] = datetime.datetime.utcnow()
    result = db.areas.insert_one(db_area)
    db_area["_id"] = result.inserted_id
    return serialize_doc(db_area)

# Clinics
from ..schemas import Clinic as ClinicSchema, ClinicCreate

@router.get("/clinics", response_model=List[ClinicSchema])
def get_clinics(village_id: str = None, area_id: str = None, db = Depends(get_db)):
    """Retrieve all clinics, optionally filtered by village or area."""
    query = {}
    if village_id:
        query["village_id"] = village_id
    if area_id:
        query["area_id"] = area_id
    docs = list(db.clinics.find(query))
    return [serialize_doc(d) for d in docs]

@router.post("/clinics", response_model=ClinicSchema, status_code=status.HTTP_201_CREATED)
def create_clinic(clinic: ClinicCreate, db = Depends(get_db), current_user = Depends(require_role(["ADMIN"]))):
    """Create a new clinic (Admin only)."""
    db_clinic = clinic.dict()
    db_clinic["created_at"] = datetime.datetime.utcnow()
    result = db.clinics.insert_one(db_clinic)
    db_clinic["_id"] = result.inserted_id
    return serialize_doc(db_clinic)
