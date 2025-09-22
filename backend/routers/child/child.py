"""
Child ID Management Router for Insurezeal Backend API.

This module handles child ID request management for insurance agents, providing
functionality for requesting, tracking, and managing child IDs from insurance
companies and brokers. Child IDs are unique identifiers that agents use to
create policies with specific insurance companies through broker relationships.

Key Features:
- Child ID request creation and submission
- Broker and insurer dropdown data for request forms
- Request status tracking and history
- User-specific child ID request management
- Integration with admin approval workflows
- Google Sheets synchronization for external tracking
- Real-time status updates and notifications

Business Logic:
- Child ID request workflow management
- Broker-insurer relationship validation
- Request eligibility and capacity checking
- Status progression tracking (pending → approved/rejected)
- Integration with policy creation workflows
- Commission structure association
- Geographic region and branch management

User Operations:
- Submit new child ID requests
- View personal request history and status
- Access approved child IDs for policy creation
- Update contact and preference information
- Track request progress and approval timeline
- Access broker and insurer information

Integration Points:
- Admin System: For request approval and management
- Policy System: For using approved child IDs in policy creation
- Google Sheets: For external tracking and reporting
- Broker System: For relationship validation and capacity
- Notification System: For status updates and communications
"""

import logging
import uuid
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from fastapi.security import HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from config import get_db
from routers.auth.auth import get_current_user
from routers.auth.helpers import AuthHelpers
from routers.child.helpers import ChildHelpers
from routers.child.schemas import (
    BrokerDropdownResponse,
    BrokerInsurerDropdownResponse,
    ChildIdRequestCreate,
    ChildIdRequestList,
    ChildIdResponse,
    ChildIdSummary,
    InsurerDropdownResponse,
)
from utils.google_sheets import google_sheets_sync

# FastAPI Router Configuration for Child ID Management
# Handles user-facing child ID operations without prefix (direct routes)
# Tags: Groups endpoints in API documentation under child ID section
router = APIRouter(tags=["User Child ID Routes"])

# HTTP Bearer Token Security for User Authentication
# Ensures all child ID operations require valid user login
security = HTTPBearer()

# Child ID Helper Instance
# Provides business logic for child ID request operations
child_helpers = ChildHelpers()

# Authentication Helper Instance
# Provides user authentication and validation utilities
auth_helpers = AuthHelpers()

# Logger Configuration
# Tracks child ID operations, requests, and status changes
logger = logging.getLogger(__name__)


def validate_uuid_string(uuid_string: str, field_name: str = "UUID") -> str:
    """
    Validate that a string is a proper UUID format

    Args:
        uuid_string: String to validate
        field_name: Name of the field for error messages

    Returns:
        The original string if valid

    Raises:
        HTTPException: If the string is not a valid UUID
    """
    try:
        uuid.UUID(uuid_string)
        return uuid_string
    except ValueError as e:
        logger.error(
            f"Invalid {field_name} format: '{uuid_string}' - Length: {len(uuid_string)} - Error: {str(e)}"
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid {field_name} format. Expected valid UUID, got: '{uuid_string}'",
        )


logger = logging.getLogger(__name__)


@router.get("/get-insurers", response_model=List[InsurerDropdownResponse])
async def get_insurers_for_child_request(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get all active insurers for Direct Code selection

    - Used when agent selects "Direct Code" type
    - Returns list of available insurers for dropdown
    - Accessible by authenticated agents
    """
    try:
        insurers = await child_helpers.get_active_insurers(db)
        return [InsurerDropdownResponse.model_validate(insurer) for insurer in insurers]

    except Exception as e:
        logger.error(f"Error fetching insurers: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch insurers",
        )


@router.get("/get-brokers-and-insurers", response_model=BrokerInsurerDropdownResponse)
async def get_brokers_and_insurers_for_child_request(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get all active brokers and insurers for Broker Code selection

    - Used when agent selects "Broker Code" type
    - Returns both brokers and insurers for dropdown selection
    - Accessible by authenticated agents
    """
    try:
        brokers = await child_helpers.get_active_brokers(db)
        insurers = await child_helpers.get_active_insurers(db)

        return BrokerInsurerDropdownResponse(
            brokers=[
                BrokerDropdownResponse.model_validate(broker) for broker in brokers
            ],
            insurers=[
                InsurerDropdownResponse.model_validate(insurer) for insurer in insurers
            ],
        )

    except Exception as e:
        logger.error(f"Error fetching brokers and insurers: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch brokers and insurers",
        )


# ============ CHILD ID REQUEST ROUTES ============


@router.post("/request", response_model=ChildIdResponse)
async def create_child_id_request(
    request_data: ChildIdRequestCreate,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new child ID request - Updated flow with codes

    - **phone_number**: Valid Indian phone number
    - **email**: Email address
    - **location**: Location/address
    - **code_type**: Either "Direct Code" or "Broker Code"
    - **insurer_code**: Selected insurer code
    - **broker_code**: Selected broker code (required for Broker Code type)
    - **preferred_rm_name**: Optional preferred relationship manager name
    """
    try:
        user_id = current_user["user_id"]

        if request_data.code_type == "Broker Code" and not request_data.broker_code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Broker code is required for Broker Code type",
            )

        if request_data.code_type == "Direct Code" and request_data.broker_code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Broker code should not be provided for Direct Code type",
            )

        child_request = await child_helpers.create_child_id_request(
            db=db, user_id=user_id, request_data=request_data.dict()
        )

        from utils.model_utils import convert_uuids_to_strings, model_data_from_orm

        req_dict = convert_uuids_to_strings(model_data_from_orm(child_request))

        if child_request.insurer:
            req_dict["insurer"] = {
                "insurer_code": child_request.insurer.insurer_code,
                "name": child_request.insurer.name,
            }
        if child_request.broker:
            req_dict["broker_relation"] = {
                "broker_code": child_request.broker.broker_code,
                "name": child_request.broker.name,
            }

        google_sheets_dict = {
            "id": str(child_request.id),
            "user_id": str(child_request.user_id),
            "insurance_company": (
                child_request.insurer.name if child_request.insurer else ""
            ),
            "broker": child_request.broker.name if child_request.broker else "",
            "location": child_request.location,
            "phone_number": child_request.phone_number,
            "email": child_request.email,
            "preferred_rm_name": child_request.preferred_rm_name,
            "status": child_request.status,
            "child_id": child_request.child_id,
            "password": child_request.password,
            "branch_code": child_request.branch_code,
            "region": child_request.region,
            "manager_name": child_request.manager_name,
            "manager_email": child_request.manager_email,
            "admin_notes": child_request.admin_notes,
            "created_at": child_request.created_at,
            "updated_at": child_request.updated_at,
        }
        try:
            google_sheets_sync.sync_child_id_request(google_sheets_dict, "CREATE")
            logger.info(f"Child ID request {child_request.id} synced to Google Sheets")
        except Exception as sync_error:
            logger.error(
                f"Failed to sync child ID request {child_request.id} to Google Sheets: {str(sync_error)}"
            )

        return ChildIdResponse.model_validate(req_dict)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating child ID request: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create child ID request",
        )


@router.get("/my-requests", response_model=ChildIdRequestList)
async def get_my_child_requests(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get current user's child ID requests (summary view)

    - Returns paginated list of user's child ID request summaries
    - Shows basic info: company, broker, location, status, child_id
    - Ordered by creation date (newest first)
    - Use GET /request/{request_id} to get full details of a specific request
    """
    try:
        user_id = current_user["user_id"]

        result = await child_helpers.get_user_child_requests(
            db=db, user_id=user_id, page=page, page_size=page_size
        )

        formatted_requests = []
        for req in result["child_requests"]:
            from utils.model_utils import convert_uuids_to_strings, model_data_from_orm

            req_dict = convert_uuids_to_strings(model_data_from_orm(req))

            if req.insurer:
                req_dict["insurer"] = {
                    "insurer_code": req.insurer.insurer_code,
                    "name": req.insurer.name,
                }
            if req.broker:
                req_dict["broker_relation"] = {
                    "broker_code": req.broker.broker_code,
                    "name": req.broker.name,
                }

            formatted_requests.append(ChildIdSummary.model_validate(req_dict))

        return ChildIdRequestList(
            requests=formatted_requests,
            total_count=result["total_count"],
            page=page,
            page_size=page_size,
            total_pages=result["total_pages"],
        )

    except Exception as e:
        logger.error(f"Error fetching user child requests: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch child ID requests",
        )


@router.get("/request/{request_id}", response_model=ChildIdResponse)
async def get_child_request_details(
    request_id: str = Path(..., description="Child ID request UUID"),
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get details of a specific child ID request

    - User can only view their own requests
    - Returns complete request details including status and assignment info
    """
    try:
        # Validate UUID format early with detailed logging
        validated_request_id = validate_uuid_string(request_id, "request_id")
        logger.info(
            f"Fetching child request details for request_id: {validated_request_id} by user: {current_user.get('user_id')}"
        )

        user_id = current_user["user_id"]

        child_request = await child_helpers.get_child_request_by_id(
            db=db, request_id=validated_request_id, user_id=user_id
        )

        if not child_request:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Child ID request not found",
            )

        from utils.model_utils import convert_uuids_to_strings, model_data_from_orm

        req_dict = convert_uuids_to_strings(model_data_from_orm(child_request))

        if child_request.insurer:
            req_dict["insurer"] = {
                "insurer_code": child_request.insurer.insurer_code,
                "name": child_request.insurer.name,
            }
        if child_request.broker:
            req_dict["broker_relation"] = {
                "broker_code": child_request.broker.broker_code,
                "name": child_request.broker.name,
            }

        return ChildIdResponse.model_validate(req_dict)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching child request details: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch child ID request details",
        )


@router.get("/active", response_model=List[ChildIdResponse])
async def get_active_child_ids(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get user's active (accepted) child IDs

    - Returns only child ID requests with status 'accepted'
    - Includes all assignment details like child_id, broker_code, etc.
    """
    try:
        user_id = current_user["user_id"]

        active_requests = await child_helpers.get_user_active_child_ids(
            db=db, user_id=user_id
        )

        formatted_responses = []
        for req in active_requests:
            from utils.model_utils import convert_uuids_to_strings, model_data_from_orm

            req_dict = convert_uuids_to_strings(model_data_from_orm(req))

            # Add insurer details with both code and name
            if req.insurer:
                req_dict["insurer"] = {
                    "insurer_code": req.insurer.insurer_code,
                    "name": req.insurer.name,
                }

            # Add broker details with both code and name
            if req.broker:
                req_dict["broker_relation"] = {
                    "broker_code": req.broker.broker_code,
                    "name": req.broker.name,
                }

            formatted_responses.append(ChildIdResponse.model_validate(req_dict))

        return formatted_responses

    except Exception as e:
        logger.error(f"Error fetching active child IDs: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch active child IDs",
        )
