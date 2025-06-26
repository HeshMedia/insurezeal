from typing import Dict, Any, List
from fastapi import Depends, HTTPException, APIRouter, status, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import logging
from sqlalchemy.ext.asyncio import AsyncSession

from config import get_db
from routers.auth.auth import get_current_user
from routers.child.helpers import ChildHelpers
from routers.auth.helpers import AuthHelpers
from routers.child.schemas import (
    ChildIdResponse, ChildIdRequestCreate, ChildIdRequestList, ChildIdSummary,
    InsurerDropdownResponse, BrokerDropdownResponse, BrokerInsurerDropdownResponse
)
from utils.google_sheets import google_sheets_sync

router = APIRouter(tags=["User Child ID Routes"])
security = HTTPBearer()
child_helpers = ChildHelpers()
auth_helpers = AuthHelpers()
logger = logging.getLogger(__name__)

# ============ DROPDOWN ROUTES FOR CHILD ID REQUESTS ============

@router.get("/get-insurers", response_model=List[InsurerDropdownResponse])
async def get_insurers_for_child_request(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
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
            detail="Failed to fetch insurers"
        )

@router.get("/get-brokers-and-insurers", response_model=BrokerInsurerDropdownResponse)
async def get_brokers_and_insurers_for_child_request(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
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
            brokers=[BrokerDropdownResponse.model_validate(broker) for broker in brokers],
            insurers=[InsurerDropdownResponse.model_validate(insurer) for insurer in insurers]
        )
        
    except Exception as e:
        logger.error(f"Error fetching brokers and insurers: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch brokers and insurers"
        )

# ============ CHILD ID REQUEST ROUTES ============

@router.post("/request", response_model=ChildIdResponse)
async def create_child_id_request(
    request_data: ChildIdRequestCreate,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new child ID request - Updated flow
    
    - **phone_number**: Valid Indian phone number
    - **email**: Email address
    - **location**: Location/address
    - **code_type**: Either "Direct Code" or "Broker Code"
    - **insurer_id**: Selected insurer ID
    - **broker_id**: Selected broker ID (required for Broker Code type)
    - **preferred_rm_name**: Optional preferred relationship manager name
    """
    try:
        user_id = current_user["supabase_user"].id
        
        if request_data.code_type == "Broker Code" and not request_data.broker_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Broker ID is required for Broker Code type"
            )

        if request_data.code_type == "Direct Code" and request_data.broker_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Broker ID should not be provided for Direct Code type"
            )
        
        child_request = await child_helpers.create_child_id_request(
            db=db,
            user_id=user_id,            
            request_data=request_data.dict()
        )
        
        child_request_dict = {
            'id': child_request.id,
            'user_id': child_request.user_id,
            'insurance_company': child_request.insurance_company,
            'broker': child_request.broker,
            'location': child_request.location,
            'phone_number': child_request.phone_number,
            'email': child_request.email,
            'preferred_rm_name': child_request.preferred_rm_name,
            'status': child_request.status,
            'child_id': child_request.child_id,
            'broker_code': child_request.broker_code,
            'branch_code': child_request.branch_code,
            'region': child_request.region,
            'created_at': child_request.created_at,
            'updated_at': child_request.updated_at        }
        try:
            google_sheets_sync.sync_child_id_request(child_request_dict, "CREATE")
            logger.info(f"Child ID request {child_request.id} synced to Google Sheets")
        except Exception as sync_error:
            logger.error(f"Failed to sync child ID request {child_request.id} to Google Sheets: {str(sync_error)}")
        
        return ChildIdResponse.model_validate(child_request)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating child ID request: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create child ID request"
        )

@router.get("/my-requests", response_model=ChildIdRequestList)
async def get_my_child_requests(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):    
    """
    Get current user's child ID requests (summary view)
    
    - Returns paginated list of user's child ID request summaries
    - Shows basic info: company, broker, location, status, child_id
    - Ordered by creation date (newest first)
    - Use GET /request/{request_id} to get full details of a specific request
    """
    try:
        user_id = current_user["supabase_user"].id
        
        result = await child_helpers.get_user_child_requests(
            db=db,
            user_id=user_id,
            page=page,
            page_size=page_size
        )
        
        return ChildIdRequestList(
            requests=[ChildIdSummary.model_validate(req) for req in result["child_requests"]],
            total_count=result["total_count"],
            page=page,
            page_size=page_size,
            total_pages=result["total_pages"]
        )
        
    except Exception as e:
        logger.error(f"Error fetching user child requests: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch child ID requests"
        )

@router.get("/request/{request_id}", response_model=ChildIdResponse)
async def get_child_request_details(
    request_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get details of a specific child ID request
    
    - User can only view their own requests
    - Returns complete request details including status and assignment info
    """
    try:
        user_id = current_user["supabase_user"].id
        
        child_request = await child_helpers.get_child_request_by_id(
            db=db,
            request_id=request_id,
            user_id=user_id
        )
        
        if not child_request:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Child ID request not found"            )
        
        return ChildIdResponse.model_validate(child_request)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching child request details: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch child ID request details"
        )

@router.get("/active", response_model=List[ChildIdResponse])
async def get_active_child_ids(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get user's active (accepted) child IDs
    
    - Returns only child ID requests with status 'accepted'
    - Includes all assignment details like child_id, broker_code, etc.
    """
    try:
        user_id = current_user["supabase_user"].id
        
        active_requests = await child_helpers.get_user_active_child_ids(
            db=db,
            user_id=user_id
        )
        
        return [ChildIdResponse.model_validate(req) for req in active_requests]
        
    except Exception as e:
        logger.error(f"Error fetching active child IDs: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch active child IDs"        )
