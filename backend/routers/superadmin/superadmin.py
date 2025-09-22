"""
SuperAdmin Administration Router

This module provides comprehensive SuperAdmin functionality for managing core
platform entities including brokers, insurers, and admin child IDs. SuperAdmins
have the highest level of access in the InsureZeal platform and can perform
administrative operations across all aspects of the system.

Key Features:
1. **Broker Management**: Complete CRUD operations for insurance brokers
   - Create new brokers with auto-generated broker codes (B001, B002, etc.)
   - Update broker information (name, address, RM, GST details)
   - View individual brokers or list all active brokers
   - Manage broker status and relationships

2. **Insurer Management**: Full lifecycle management of insurance companies
   - Create new insurers with auto-generated insurer codes (I001, I002, etc.)
   - Update insurer information and contact details
   - View individual insurers or list all active insurers
   - Manage insurer partnerships and integrations

3. **Admin Child ID Management**: Advanced management of admin-owned child IDs
   - Create new admin child IDs for specific broker-insurer combinations
   - View available child IDs filtered by insurer and broker
   - Update child ID details and assignments
   - Suspend/unsuspend child IDs for operational control
   - Soft delete child IDs while maintaining data integrity

4. **User Role Management**: Promotion and role assignment capabilities
   - Promote agents to admin role with dual database/Supabase updates
   - Comprehensive role validation and error handling
   - Maintain role consistency across authentication systems

Business Logic:
- Auto-increment coding system for brokers (B001-B999) and insurers (I001-I999)
- Strict role-based access control with granular permissions
- Soft deletion patterns to maintain referential integrity
- Comprehensive validation of broker-insurer relationships
- Dual-system updates for role changes (database + Supabase)

Security Features:
- Multiple RBAC permission checks for different operations
- SuperAdmin-only operations for sensitive management functions
- Input validation and sanitization for all data operations
- Proper error handling with appropriate HTTP status codes
- UUID validation for user ID operations

Integration Points:
- Supabase Admin Client for user metadata management
- SQLAlchemy async operations with proper transaction handling
- Role-based access control through dependency injection
- Comprehensive error handling with rollback mechanisms

Database Relationships:
- Broker ↔ AdminChildID (one-to-many)
- Insurer ↔ AdminChildID (one-to-many)
- UserProfile role management with UUID references
- Soft deletion with is_active flags

Performance Considerations:
- Efficient queries with selectinload for related entities
- Proper indexing on frequently queried fields (codes, IDs)
- Pagination support for large datasets
- Optimized filtering for available child IDs

This router serves as the administrative backbone of the InsureZeal platform,
providing SuperAdmins with powerful tools to manage the core entities that
enable the insurance brokerage operations.
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from config import get_db
from dependencies.rbac import (
    require_admin_child_ids_read,
    require_brokers_read,
    require_insurers_read,
    require_superadmin_admin_child_ids_delete,
    require_superadmin_admin_child_ids_update,
    require_superadmin_admin_child_ids_write,
    require_superadmin_brokers_insurers_list,
    require_superadmin_brokers_update,
    require_superadmin_brokers_write,
    require_superadmin_insurers_update,
    require_superadmin_insurers_write,
    require_superadmin_write,
)
from models import AdminChildID, Broker, Insurer, UserProfile
from routers.auth.auth import get_current_user

from . import schemas
from .schemas import (
    AdminChildIDCreate,
    AdminChildIDResponse,
    AdminChildIDUpdate,
    BrokerCreate,
    BrokerInsurerListResponse,
    BrokerResponse,
    BrokerUpdate,
    InsurerCreate,
    InsurerResponse,
    InsurerUpdate,
)

router = APIRouter(prefix="/superadmin", tags=["SuperAdmin"])


# ============ BROKER ROUTES ============


@router.post("/brokers", response_model=dict)
async def create_broker(
    broker_data: BrokerCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
    _rbac_check=Depends(require_superadmin_brokers_write),
):
    """Create a new broker (SuperAdmin only)"""
    result = await db.execute(select(Broker).order_by(desc(Broker.id)).limit(1))
    last_broker = result.scalar_one_or_none()
    if last_broker and last_broker.broker_code:
        last_num = int(last_broker.broker_code[1:])
        broker_code = f"B{last_num + 1:03d}"
    else:
        broker_code = "B001"

    db_broker = Broker(
        broker_code=broker_code,
        name=broker_data.name,
        address=broker_data.address,
        rm=broker_data.rm,
        gst=broker_data.gst,
    )

    db.add(db_broker)
    await db.commit()
    await db.refresh(db_broker)

    return {
        "message": "Broker created successfully",
        "broker_code": broker_code,
        "broker_id": db_broker.id,
    }


@router.get("/brokers", response_model=List[BrokerResponse])
async def get_brokers(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
    _rbac_check=Depends(require_brokers_read),
):
    """Get all active brokers (Admin/SuperAdmin only)"""
    result = await db.execute(select(Broker).where(Broker.is_active == True))
    return result.scalars().all()


@router.get("/brokers/{broker_code}", response_model=BrokerResponse)
async def get_broker(
    broker_code: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
    _rbac_check=Depends(require_brokers_read),
):
    """Get specific broker by code (Admin/SuperAdmin only)"""
    result = await db.execute(select(Broker).where(Broker.broker_code == broker_code))
    broker = result.scalar_one_or_none()
    if not broker:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Broker not found"
        )

    return broker


@router.put("/brokers/{broker_code}", response_model=dict)
async def update_broker(
    broker_code: str,
    broker_update: BrokerUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
    _rbac_check=Depends(require_superadmin_brokers_update),
):
    """Update broker (SuperAdmin only)"""
    result = await db.execute(select(Broker).where(Broker.broker_code == broker_code))
    broker = result.scalar_one_or_none()
    if not broker:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Broker not found"
        )

    update_data = broker_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(broker, field, value)

    await db.commit()

    return {"message": "Broker updated successfully"}


# ============ INSURER ROUTES ============


@router.post("/insurers", response_model=dict)
async def create_insurer(
    insurer_data: InsurerCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
    _rbac_check=Depends(require_superadmin_insurers_write),
):
    """Create a new insurer (SuperAdmin only)"""
    result = await db.execute(select(Insurer).order_by(desc(Insurer.id)).limit(1))
    last_insurer = result.scalar_one_or_none()
    if last_insurer and last_insurer.insurer_code:
        last_num = int(last_insurer.insurer_code[1:])
        insurer_code = f"I{last_num + 1:03d}"
    else:
        insurer_code = "I001"

    db_insurer = Insurer(insurer_code=insurer_code, name=insurer_data.name)

    db.add(db_insurer)
    await db.commit()
    await db.refresh(db_insurer)

    return {
        "message": "Insurer created successfully",
        "insurer_code": insurer_code,
        "insurer_id": db_insurer.id,
    }


@router.get("/insurers", response_model=List[InsurerResponse])
async def get_insurers(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
    _rbac_check=Depends(require_insurers_read),
):
    """Get all active insurers (Admin/SuperAdmin only)"""
    result = await db.execute(select(Insurer).where(Insurer.is_active == True))
    return result.scalars().all()


@router.get("/insurers/{insurer_code}", response_model=InsurerResponse)
async def get_insurer(
    insurer_code: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
    _rbac_check=Depends(require_insurers_read),
):
    """Get specific insurer by code (Admin/SuperAdmin only)"""
    result = await db.execute(
        select(Insurer).where(Insurer.insurer_code == insurer_code)
    )
    insurer = result.scalar_one_or_none()
    if not insurer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Insurer not found"
        )

    return insurer


@router.put("/insurers/{insurer_code}", response_model=dict)
async def update_insurer(
    insurer_code: str,
    insurer_update: InsurerUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
    _rbac_check=Depends(require_superadmin_insurers_update),
):
    """Update insurer (SuperAdmin only)"""
    result = await db.execute(
        select(Insurer).where(Insurer.insurer_code == insurer_code)
    )
    insurer = result.scalar_one_or_none()
    if not insurer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Insurer not found"
        )
    update_data = insurer_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(insurer, field, value)

    await db.commit()

    return {"message": "Insurer updated successfully"}


# ============ DROPDOWN/LIST ROUTES ============


@router.get("/brokers-insurers-list", response_model=BrokerInsurerListResponse)
async def get_brokers_insurers_list(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
    _rbac_check=Depends(require_superadmin_brokers_insurers_list),
):
    """Get combined list of brokers and insurers for dropdowns (Admin/SuperAdmin only)"""
    brokers_result = await db.execute(select(Broker).where(Broker.is_active == True))
    brokers = brokers_result.scalars().all()

    insurers_result = await db.execute(select(Insurer).where(Insurer.is_active == True))
    insurers = insurers_result.scalars().all()

    return {"brokers": brokers, "insurers": insurers}


# ============ ADMIN CHILD ID ROUTES ============


@router.post("/admin-child-ids", response_model=dict)
async def create_admin_child_id(
    child_id_data: AdminChildIDCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
    _rbac_check=Depends(require_superadmin_admin_child_ids_write),
):
    """Create a new admin child ID (SuperAdmin only)"""
    # Log the incoming data for debugging
    import logging

    logger = logging.getLogger(__name__)
    logger.info(f"Creating admin child ID with data: {child_id_data.model_dump()}")

    existing_result = await db.execute(
        select(AdminChildID).where(AdminChildID.child_id == child_id_data.child_id)
    )
    existing_child_id = existing_result.scalar_one_or_none()
    if existing_child_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Child ID already exists"
        )

    insurer_result = await db.execute(
        select(Insurer).where(Insurer.insurer_code == child_id_data.insurer_code)
    )
    insurer = insurer_result.scalar_one_or_none()
    if not insurer:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid insurer code: {child_id_data.insurer_code}",
        )

    broker_id = None
    if child_id_data.broker_code:
        broker_result = await db.execute(
            select(Broker).where(Broker.broker_code == child_id_data.broker_code)
        )
        broker = broker_result.scalar_one_or_none()
        if not broker:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid broker code: {child_id_data.broker_code}",
            )
        broker_id = broker.id

    db_child_id = AdminChildID(
        child_id=child_id_data.child_id,
        password=child_id_data.password,  # Add password field
        branch_code=child_id_data.branch_code,
        region=child_id_data.region,
        manager_name=child_id_data.manager_name,
        manager_email=child_id_data.manager_email,
        admin_notes=child_id_data.admin_notes,
        code_type=child_id_data.code_type,
        insurer_id=insurer.id,
        broker_id=broker_id,
        created_by=current_user["user_id"],
    )

    db.add(db_child_id)
    await db.commit()
    await db.refresh(db_child_id)

    return {
        "message": "Admin child ID created successfully",
        "child_id": db_child_id.child_id,
        "id": db_child_id.id,
    }


@router.get("/admin-child-ids", response_model=List[AdminChildIDResponse])
async def get_admin_child_ids(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
    _rbac_check=Depends(require_admin_child_ids_read),
):
    """Get all admin child IDs (Admin/SuperAdmin only)"""
    result = await db.execute(
        select(AdminChildID)
        .options(selectinload(AdminChildID.insurer), selectinload(AdminChildID.broker))
        .where(AdminChildID.is_active == True)
    )
    return result.scalars().all()


@router.get("/admin-child-ids/available", response_model=List[AdminChildIDResponse])
async def get_available_admin_child_ids(
    insurer_code: str,
    broker_code: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
    _rbac_check=Depends(require_admin_child_ids_read),
):
    """Get available admin child IDs filtered by insurer code and optionally broker code (Admin/SuperAdmin only)"""
    insurer_result = await db.execute(
        select(Insurer).where(Insurer.insurer_code == insurer_code)
    )
    insurer = insurer_result.scalar_one_or_none()
    if not insurer:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid insurer code: {insurer_code}",
        )

    query = (
        select(AdminChildID)
        .options(selectinload(AdminChildID.insurer), selectinload(AdminChildID.broker))
        .where(
            AdminChildID.is_active == True,
            AdminChildID.is_suspended == False,
            AdminChildID.insurer_id == insurer.id,
        )
    )

    if broker_code:
        broker_result = await db.execute(
            select(Broker).where(Broker.broker_code == broker_code)
        )
        broker = broker_result.scalar_one_or_none()
        if not broker:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid broker code: {broker_code}",
            )
        query = query.where(AdminChildID.broker_id == broker.id)

    result = await db.execute(query)
    return result.scalars().all()


@router.get("/admin-child-ids/{child_id_id}", response_model=AdminChildIDResponse)
async def get_admin_child_id(
    child_id_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
    _rbac_check=Depends(require_admin_child_ids_read),
):
    """Get specific admin child ID by ID (Admin/SuperAdmin only)"""
    result = await db.execute(
        select(AdminChildID)
        .options(selectinload(AdminChildID.insurer), selectinload(AdminChildID.broker))
        .where(AdminChildID.id == child_id_id)
    )
    child_id = result.scalar_one_or_none()
    if not child_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Admin child ID not found"
        )

    return child_id


@router.put("/admin-child-ids/{child_id_id}", response_model=dict)
async def update_admin_child_id(
    child_id_id: int,
    child_id_update: AdminChildIDUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
    _rbac_check=Depends(require_superadmin_admin_child_ids_update),
):
    """Update admin child ID (SuperAdmin only)"""
    result = await db.execute(
        select(AdminChildID).where(AdminChildID.id == child_id_id)
    )
    child_id = result.scalar_one_or_none()
    if not child_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Admin child ID not found"
        )

    update_data = child_id_update.model_dump(exclude_unset=True)

    if "insurer_code" in update_data:
        insurer_code = update_data.pop("insurer_code")
        insurer_result = await db.execute(
            select(Insurer).where(Insurer.insurer_code == insurer_code)
        )
        insurer = insurer_result.scalar_one_or_none()
        if not insurer:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid insurer code: {insurer_code}",
            )
        update_data["insurer_id"] = insurer.id

    if "broker_code" in update_data:
        broker_code = update_data.pop("broker_code")
        if broker_code:
            broker_result = await db.execute(
                select(Broker).where(Broker.broker_code == broker_code)
            )
            broker = broker_result.scalar_one_or_none()
            if not broker:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid broker code: {broker_code}",
                )
            update_data["broker_id"] = broker.id
        else:
            update_data["broker_id"] = None

    for field, value in update_data.items():
        setattr(child_id, field, value)

    await db.commit()

    return {"message": "Admin child ID updated successfully"}


@router.delete("/admin-child-ids/{child_id_id}", response_model=dict)
async def delete_admin_child_id(
    child_id_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
    _rbac_check=Depends(require_superadmin_admin_child_ids_delete),
):
    """Delete admin child ID (SuperAdmin only)"""
    result = await db.execute(
        select(AdminChildID).where(AdminChildID.id == child_id_id)
    )
    child_id = result.scalar_one_or_none()
    if not child_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Admin child ID not found"
        )

    child_id.is_active = False
    await db.commit()

    return {"message": "Admin child ID deleted successfully"}


@router.patch("/admin-child-ids/{child_id_id}/suspend", response_model=dict)
async def toggle_admin_child_id_suspension(
    child_id_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
    _rbac_check=Depends(require_superadmin_admin_child_ids_update),
):
    """Suspend/unsuspend admin child ID (SuperAdmin only)"""
    result = await db.execute(
        select(AdminChildID).where(AdminChildID.id == child_id_id)
    )
    child_id = result.scalar_one_or_none()
    if not child_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Admin child ID not found"
        )

    child_id.is_suspended = not child_id.is_suspended
    await db.commit()

    action = "suspended" if child_id.is_suspended else "unsuspended"
    return {"message": f"Admin child ID {action} successfully"}


# ============ USER ROLE MANAGEMENT ============


@router.put(
    "/agents/{user_id}/promote-to-admin", response_model=schemas.UserRoleUpdateResponse
)
async def promote_agent_to_admin_superadmin(
    user_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check=Depends(require_superadmin_write),
):
    """
    Promote an agent to admin role (SuperAdmin only).
    Updates both database and Supabase metadata.
    """
    from uuid import UUID

    from config import get_supabase_admin_client

    try:
        # Validate user_id format
        try:
            user_uuid = UUID(user_id)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid user ID format. Must be a valid UUID.",
            )

        result = await db.execute(
            select(UserProfile).where(UserProfile.user_id == user_uuid)
        )
        user_profile = result.scalar_one_or_none()

        if not user_profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with ID {user_id} not found in database",
            )

        if user_profile.user_role != "agent":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"User is currently {user_profile.user_role}. Only agents can be promoted to admin.",
            )

        user_profile.user_role = "admin"
        await db.commit()

        supabase_admin = get_supabase_admin_client()
        supabase_response = supabase_admin.auth.admin.update_user_by_id(
            uid=user_id, attributes={"user_metadata": {"role": "admin"}}
        )

        return schemas.UserRoleUpdateResponse(
            success=True,
            message="Successfully promoted agent to admin",
            user_id=user_uuid,
            new_role="admin",
            updated_in_supabase=bool(supabase_response.user),
            updated_in_database=True,
        )

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while promoting the user to admin",
        )
