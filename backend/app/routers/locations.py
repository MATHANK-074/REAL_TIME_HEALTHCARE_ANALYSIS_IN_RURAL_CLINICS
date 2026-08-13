from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from ..models import District, SubDistrict, Village
from ..schemas import (
    District as DistrictSchema, DistrictCreate,
    SubDistrict as SubDistrictSchema, SubDistrictCreate,
    Village as VillageSchema, VillageCreate
)
from .auth import require_role

router = APIRouter(prefix="/locations", tags=["Locations"])

@router.get("/districts", response_model=List[DistrictSchema])
def get_districts(db: Session = Depends(get_db)):
    """Retrieve all districts."""
    return db.query(District).all()

@router.post("/districts", response_model=DistrictSchema, status_code=status.HTTP_201_CREATED)
def create_district(district: DistrictCreate, db: Session = Depends(get_db), current_user = Depends(require_role(["ADMIN"]))):
    """Create a new district (Admin only)."""
    db_district = District(**district.dict())
    db.add(db_district)
    db.commit()
    db.refresh(db_district)
    return db_district

@router.get("/subdistricts", response_model=List[SubDistrictSchema])
def get_subdistricts(district_id: int = None, db: Session = Depends(get_db)):
    """Retrieve all subdistricts, optionally filtered by district."""
    query = db.query(SubDistrict)
    if district_id:
        query = query.filter(SubDistrict.district_id == district_id)
    return query.all()

@router.post("/subdistricts", response_model=SubDistrictSchema, status_code=status.HTTP_201_CREATED)
def create_subdistrict(subdistrict: SubDistrictCreate, db: Session = Depends(get_db), current_user = Depends(require_role(["ADMIN"]))):
    """Create a new subdistrict (Admin only)."""
    db_subdistrict = SubDistrict(**subdistrict.dict())
    db.add(db_subdistrict)
    db.commit()
    db.refresh(db_subdistrict)
    return db_subdistrict

@router.get("/villages", response_model=List[VillageSchema])
def get_villages(subdistrict_id: int = None, db: Session = Depends(get_db)):
    """Retrieve all villages, optionally filtered by subdistrict."""
    query = db.query(Village)
    if subdistrict_id:
        query = query.filter(Village.subdistrict_id == subdistrict_id)
    return query.all()

@router.post("/villages", response_model=VillageSchema, status_code=status.HTTP_201_CREATED)
def create_village(village: VillageCreate, db: Session = Depends(get_db), current_user = Depends(require_role(["ADMIN"]))):
    """Create a new village (Admin only)."""
    db_village = Village(**village.dict())
    db.add(db_village)
    db.commit()
    db.refresh(db_village)
    return db_village
