"""
SuperAdmin router for managing brokers, insurers, and admin child IDs
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from config import get_db
from models import Broker, Insurer, AdminChildID, UserProfile
from routers.auth.auth import get_current_user
from dependencies.rbac import (
    require_superadmin_brokers_write, require_superadmin_brokers,
    require_superadmin_insurers_write, require_superadmin_insurers,
    require_superadmin_admin_child_ids_write, require_superadmin_admin_child_ids,
    require_superadmin_admin_child_ids_update, require_superadmin_admin_child_ids_delete,
    require_superadmin_brokers_insurers_list, require_superadmin_brokers_update,
    require_superadmin_insurers_update
)
from .schemas import (
    BrokerCreate, BrokerResponse, BrokerUpdate,
    InsurerCreate, InsurerResponse, InsurerUpdate,
    AdminChildIDCreate, AdminChildIDResponse, AdminChildIDUpdate,
    BrokerInsurerListResponse
)
from .helpers import SuperAdminHelpers

router = APIRouter(prefix="/superadmin", tags=["SuperAdmin"])

superadmin_helpers = SuperAdminHelpers()


# ============ BROKER ROUTES ============

@router.post("/brokers", response_model=dict)
def create_broker(
    broker_data: BrokerCreate,
    db: Session = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user),
    _rbac_check = Depends(require_superadmin_brokers_write)
):
    """Create a new broker (SuperAdmin only)"""
    broker_code = superadmin_helpers.generate_broker_code(db)
    
    db_broker = Broker(
        broker_code=broker_code,
        name=broker_data.name,
        address=broker_data.address,
        rm=broker_data.rm,
        gst=broker_data.gst
    )
    
    db.add(db_broker)
    db.commit()
    db.refresh(db_broker)
    
    return {
        "message": "Broker created successfully",
        "broker_code": broker_code,
        "broker_id": db_broker.id
    }


@router.get("/brokers", response_model=List[BrokerResponse])
def get_brokers(
    db: Session = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user),
    _rbac_check = Depends(require_superadmin_brokers)
):
    """Get all active brokers (Admin/SuperAdmin only)"""
    return superadmin_helpers.get_active_brokers(db)


@router.get("/brokers/{broker_id}", response_model=BrokerResponse)
def get_broker(
    broker_id: int,
    db: Session = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user),
    _rbac_check = Depends(require_superadmin_brokers)
):
    """Get specific broker by ID (Admin/SuperAdmin only)"""
    broker = superadmin_helpers.get_broker_by_id(db, broker_id)
    if not broker:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Broker not found"
        )
    
    return broker


@router.put("/brokers/{broker_id}", response_model=dict)
def update_broker(
    broker_id: int,
    broker_update: BrokerUpdate,
    db: Session = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user),
    _rbac_check = Depends(require_superadmin_brokers_update)
):
    """Update broker (SuperAdmin only)"""
    broker = superadmin_helpers.get_broker_by_id(db, broker_id)
    if not broker:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Broker not found"
        )
    
    update_data = broker_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(broker, field, value)
    
    db.commit()
    
    return {"message": "Broker updated successfully"}


# ============ INSURER ROUTES ============

@router.post("/insurers", response_model=dict)
def create_insurer(
    insurer_data: InsurerCreate,
    db: Session = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user),
    _rbac_check = Depends(require_superadmin_insurers_write)
):
    """Create a new insurer (SuperAdmin only)"""
    insurer_code = superadmin_helpers.generate_insurer_code(db)
    
    db_insurer = Insurer(
        insurer_code=insurer_code,
        name=insurer_data.name
    )
    
    db.add(db_insurer)
    db.commit()
    db.refresh(db_insurer)
    
    return {
        "message": "Insurer created successfully",
        "insurer_code": insurer_code,
        "insurer_id": db_insurer.id
    }


@router.get("/insurers", response_model=List[InsurerResponse])
def get_insurers(
    db: Session = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user),
    _rbac_check = Depends(require_superadmin_insurers)
):
    """Get all active insurers (Admin/SuperAdmin only)"""
    return superadmin_helpers.get_active_insurers(db)


@router.get("/insurers/{insurer_id}", response_model=InsurerResponse)
def get_insurer(
    insurer_id: int,
    db: Session = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user),
    _rbac_check = Depends(require_superadmin_insurers)
):
    """Get specific insurer by ID (Admin/SuperAdmin only)"""
    insurer = superadmin_helpers.get_insurer_by_id(db, insurer_id)
    if not insurer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Insurer not found"
        )
    
    return insurer


@router.put("/insurers/{insurer_id}", response_model=dict)
def update_insurer(
    insurer_id: int,
    insurer_update: InsurerUpdate,
    db: Session = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user),
    _rbac_check = Depends(require_superadmin_insurers_update)
):
    """Update insurer (SuperAdmin only)"""
    insurer = superadmin_helpers.get_insurer_by_id(db, insurer_id)
    if not insurer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Insurer not found"
        )
    update_data = insurer_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(insurer, field, value)
    
    db.commit()
    
    return {"message": "Insurer updated successfully"}


# ============ DROPDOWN/LIST ROUTES ============

@router.get("/brokers-insurers-list", response_model=BrokerInsurerListResponse)
def get_brokers_insurers_list(
    db: Session = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user),
    _rbac_check = Depends(require_superadmin_brokers_insurers_list)
):
    """Get combined list of brokers and insurers for dropdowns (Admin/SuperAdmin only)"""
    brokers = superadmin_helpers.get_active_brokers(db)
    insurers = superadmin_helpers.get_active_insurers(db)
    
    return {
        "brokers": brokers,
        "insurers": insurers
    }


# ============ ADMIN CHILD ID ROUTES ============

@router.post("/admin-child-ids", response_model=dict)
def create_admin_child_id(
    child_id_data: AdminChildIDCreate,
    db: Session = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user),
    _rbac_check = Depends(require_superadmin_admin_child_ids_write)
):
    """Create a new admin child ID (SuperAdmin only)"""
    existing_child_id = superadmin_helpers.get_admin_child_id_by_child_id(db, child_id_data.child_id)
    if existing_child_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Child ID already exists"
        )
    
    insurer = superadmin_helpers.get_insurer_by_id(db, child_id_data.insurer_id)
    if not insurer:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid insurer ID"
        )
    
    if child_id_data.broker_id:
        broker = superadmin_helpers.get_broker_by_id(db, child_id_data.broker_id)
        if not broker:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid broker ID"
            )
        
    db_child_id = AdminChildID(
        **child_id_data.dict(),
        created_by=current_user.user_id
    )
    
    db.add(db_child_id)
    db.commit()
    db.refresh(db_child_id)
    
    return {
        "message": "Admin child ID created successfully",
        "child_id": db_child_id.child_id,
        "id": db_child_id.id
    }


@router.get("/admin-child-ids", response_model=List[AdminChildIDResponse])
def get_admin_child_ids(
    db: Session = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user),
    _rbac_check = Depends(require_superadmin_admin_child_ids)
):
    """Get all admin child IDs (Admin/SuperAdmin only)"""
    return superadmin_helpers.get_active_admin_child_ids(db)


@router.get("/admin-child-ids/{child_id_id}", response_model=AdminChildIDResponse)
def get_admin_child_id(
    child_id_id: int,
    db: Session = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user),
    _rbac_check = Depends(require_superadmin_admin_child_ids)
):
    """Get specific admin child ID by ID (Admin/SuperAdmin only)"""
    child_id = superadmin_helpers.get_admin_child_id_by_id(db, child_id_id)
    if not child_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Admin child ID not found"
        )
    
    return child_id


@router.put("/admin-child-ids/{child_id_id}", response_model=dict)
def update_admin_child_id(
    child_id_id: int,
    child_id_update: AdminChildIDUpdate,
    db: Session = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user),
    _rbac_check = Depends(require_superadmin_admin_child_ids_update)
):
    """Update admin child ID (SuperAdmin only)"""
    child_id = superadmin_helpers.get_admin_child_id_by_id(db, child_id_id)
    if not child_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Admin child ID not found"
        )
    
    update_data = child_id_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(child_id, field, value)
    
    db.commit()
    
    return {"message": "Admin child ID updated successfully"}


@router.delete("/admin-child-ids/{child_id_id}", response_model=dict)
def delete_admin_child_id(
    child_id_id: int,
    db: Session = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user),
    _rbac_check = Depends(require_superadmin_admin_child_ids_delete)
):
    """Delete admin child ID (SuperAdmin only)"""
    child_id = superadmin_helpers.get_admin_child_id_by_id(db, child_id_id)
    if not child_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Admin child ID not found"
        )
    
    child_id.is_active = False
    db.commit()
    
    return {"message": "Admin child ID deleted successfully"}


@router.patch("/admin-child-ids/{child_id_id}/suspend", response_model=dict)
def toggle_admin_child_id_suspension(
    child_id_id: int,
    db: Session = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user),
    _rbac_check = Depends(require_superadmin_admin_child_ids_update)
):
    """Suspend/unsuspend admin child ID (SuperAdmin only)"""
    child_id = superadmin_helpers.get_admin_child_id_by_id(db, child_id_id)
    if not child_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Admin child ID not found"
        )
    
    child_id.is_suspended = not child_id.is_suspended
    db.commit()
    
    action = "suspended" if child_id.is_suspended else "unsuspended"
    return {"message": f"Admin child ID {action} successfully"}


@router.get("/admin-child-ids/available", response_model=List[AdminChildIDResponse])
def get_available_admin_child_ids(
    insurer_id: int,
    broker_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user),
    _rbac_check = Depends(require_superadmin_admin_child_ids)
):
    """Get available admin child IDs filtered by insurer and optionally broker (Admin/SuperAdmin only)"""
    return superadmin_helpers.get_available_admin_child_ids_by_broker_insurer(db, insurer_id, broker_id)
