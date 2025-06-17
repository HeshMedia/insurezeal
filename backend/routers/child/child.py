from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, Any, List, Optional
import logging
from datetime import datetime

from config import get_db
from routers.auth.helpers import AuthHelpers
from .helpers import ChildHelpers
from .schemas import (
    ChildIdRequestCreate,
    ChildIdResponse,
    ChildIdRequestList
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/child", tags=["child"])
security = HTTPBearer()
child_helpers = ChildHelpers()
auth_helpers = AuthHelpers()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Get current user from token"""
    return await auth_helpers.verify_token(credentials.credentials, db)

@router.post("/request", response_model=ChildIdResponse)
async def create_child_id_request(
    request_data: ChildIdRequestCreate,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new child ID request
    
    - **insurance_company**: Name of the insurance company
    - **broker**: Broker name
    - **location**: Location/address
    - **phone_number**: Valid Indian phone number
    - **email**: Email address
    - **preferred_rm_name**: Optional preferred relationship manager name
    """
    try:
        user_id = current_user["supabase_user"].id
        
        child_request = await child_helpers.create_child_id_request(
            db=db,
            user_id=user_id,
            request_data=request_data.dict()
        )
        
        return ChildIdResponse.from_orm(child_request)
        
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
    Get current user's child ID requests
    
    - Returns paginated list of user's child ID requests
    - Ordered by creation date (newest first)
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
            requests=[ChildIdResponse.from_orm(req) for req in result["requests"]],
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
            user_id=user_id  # Ensures user can only see their own requests
        )
        
        if not child_request:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Child ID request not found"
            )
        
        return ChildIdResponse.from_orm(child_request)
        
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
        
        return [ChildIdResponse.from_orm(req) for req in active_requests]
        
    except Exception as e:
        logger.error(f"Error fetching active child IDs: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch active child IDs"        )
