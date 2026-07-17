from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.license_manager import get_license_status

router = APIRouter(prefix="/licenses", tags=["licenses"])


@router.get("")
def list_licenses(db: Session = Depends(get_db)):
    return get_license_status(db)