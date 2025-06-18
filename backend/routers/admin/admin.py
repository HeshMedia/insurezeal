from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.security import HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession
from config import get_db
from routers.auth.auth import get_current_user
from dependencies.rbac import (
    require_admin_agents, 
    require_admin_agents_write, 
    require_admin_agents_delete,
    require_admin_read,
    require_admin_stats,
    require_admin_child_requests,
    require_admin_child_requests_write,
    require_admin_child_requests_update
)
from .schemas import (
    AgentListResponse, 
    AgentDetailResponse, 
    DeleteAgentResponse, 
    AgentSummary,
    AdminStatsResponse,
    ChildIdRequestList,
    ChildIdResponse,
    ChildIdAssignment,
    ChildIdStatusUpdate
)
from .helpers import AdminHelpers
from .cutpay import router as cutpay_router
from utils.model_utils import model_data_from_orm, convert_uuids_to_strings
from typing import Optional
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["Admin"])
security = HTTPBearer()

admin_helpers = AdminHelpers()

router.include_router(cutpay_router)

@router.get("/agents", response_model=AgentListResponse)
async def list_all_agents(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search by name, email, or agent code"),
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check = Depends(require_admin_agents)
):
    """
    Get all agents with pagination and search
    
    **Admin only endpoint**
    
    - **page**: Page number (default: 1)
    - **page_size**: Number of items per page (default: 20, max: 100)
    - **search**: Optional search term for filtering agents
      Returns paginated list of all agents with basic information.
    """   
    
    try:
        agents_data = await admin_helpers.get_all_agents(db, page, page_size, search)
        agent_summaries = []
        for agent in agents_data["agents"]:
            email = await admin_helpers.get_user_email_from_supabase(str(agent.user_id))
            agent_data = model_data_from_orm(agent, {"email": email})
            
            agent_summary = AgentSummary.model_validate(agent_data)
            agent_summaries.append(agent_summary)
        
        return AgentListResponse(
            agents=agent_summaries,
            total_count=agents_data["total_count"],
            page=agents_data["page"],
            page_size=agents_data["page_size"]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in list_all_agents: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch agents list"
        )

@router.get("/agents/{agent_id}", response_model=AgentDetailResponse)
async def get_agent_details(
    agent_id: str,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check = Depends(require_admin_agents)
):
    """
    Get detailed information about a specific agent
    
    **Admin only endpoint**
    
    - **agent_id**: The ID of the agent to retrieve
      Returns complete agent profile including all personal, professional,    and document information.
    """    
    
    try:
        agent_data = await admin_helpers.get_agent_with_documents(db, agent_id)
        converted_data = convert_uuids_to_strings(agent_data)
        
        agent_detail = AgentDetailResponse.model_validate(converted_data)
        
        return agent_detail
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_agent_details for agent {agent_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch agent details"
        )

@router.delete("/agents/{agent_id}", response_model=DeleteAgentResponse)
async def delete_agent_by_id(
    agent_id: str,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check = Depends(require_admin_agents_delete)
):
    """
    Delete an agent and all related data
    
    **Admin only endpoint**
    
    - **agent_id**: The ID of the agent to delete
    
    **⚠️ Warning: This action is irreversible!**
    
    This will permanently delete:
    - Agent's profile information
    - All uploaded documents
    - All related data
    
    Returns confirmation of deletion.
    """   
    
    try:
        deletion_result = await admin_helpers.delete_agent(db, agent_id)
        
        return DeleteAgentResponse(
            message=deletion_result["message"],
            deleted_agent_id=deletion_result["deleted_agent_id"],
            deleted_user_id=deletion_result["deleted_user_id"]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in delete_agent_by_id for agent {agent_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete agent"
        )

@router.get("/agent-stats", response_model=AdminStatsResponse)
async def get_admin_stats(
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check = Depends(require_admin_stats)
):
    """
    Get admin dashboard statistics
    
    **Admin only endpoint**
    
    Returns overview statistics for the admin dashboard.
    """   
    
    try:
        stats = await admin_helpers.get_admin_statistics(db)
        return AdminStatsResponse(**stats)
        
    except Exception as e:
        logger.error(f"Error in get_admin_stats: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch admin statistics"
        )


#<------------------child id management endpoints------------------>

@router.get("/child-requests", response_model=ChildIdRequestList)
async def get_all_child_requests(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    status_filter: Optional[str] = Query(None, description="Filter by status"),
    search: Optional[str] = Query(None, description="Search by company, broker, or email"),
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check = Depends(require_admin_child_requests)
):
    """
    Admin: Get all child ID requests with filtering
    
    **Admin only endpoint**
    
    - **status_filter**: Filter by request status (pending, accepted, rejected, suspended)
    - **search**: Search in company name, broker, or email
    - Returns paginated list with user details
    """
    
    try:
        result = await admin_helpers.get_all_child_requests(
            db=db,
            page=page,
            page_size=page_size,
            status_filter=status_filter,
            search=search
        )
        
        return ChildIdRequestList(
            requests=[ChildIdResponse.model_validate(req) for req in result["requests"]],
            total_count=result["total_count"],
            page=page,
            page_size=page_size,
            total_pages=result["total_pages"]
        )
        
    except Exception as e:
        logger.error(f"Error fetching all child requests: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch child ID requests"
        )

@router.put("/child-requests/{request_id}/assign", response_model=ChildIdResponse)
async def assign_child_id(
    request_id: str,
    assignment_data: ChildIdAssignment,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check = Depends(require_admin_child_requests_update)
):
    """
    Admin: Assign child ID details and approve request
    
    **Admin only endpoint**
    
    - **child_id**: Unique child ID to assign
    - **broker_code**: Broker code
    - **branch_code**: Optional branch code
    - **region**: Optional region
    - **manager_name**: Optional manager name
    - **manager_email**: Optional manager email
    - **commission_percentage**: Optional commission percentage
    - **policy_limit**: Optional policy limit
    - **admin_notes**: Optional admin notes
    """
    
    try:
        admin_user_id = current_user["supabase_user"].id
        
        child_request = await admin_helpers.approve_child_request(
            db=db,
            request_id=request_id,
            assignment_data=assignment_data.dict(),
            admin_user_id=admin_user_id
        )        
        return ChildIdResponse.model_validate(child_request)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error assigning child ID: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to assign child ID"
        )

@router.put("/child-requests/{request_id}/reject", response_model=ChildIdResponse)
async def reject_child_request(
    request_id: str,
    rejection_data: ChildIdStatusUpdate,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check = Depends(require_admin_child_requests_update)
):
    """
    Admin: Reject a child ID request
    
    **Admin only endpoint**
    
    - **admin_notes**: Required reason for rejection
    """
    
    try:
        admin_user_id = current_user["supabase_user"].id
        
        child_request = await admin_helpers.reject_child_request(
            db=db,
            request_id=request_id,
            admin_notes=rejection_data.admin_notes,
            admin_user_id=admin_user_id
        )        
        return ChildIdResponse.model_validate(child_request)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error rejecting child request: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reject child ID request"
        )

@router.put("/child-requests/{request_id}/suspend", response_model=ChildIdResponse)
async def suspend_child_id(
    request_id: str,
    suspension_data: ChildIdStatusUpdate,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check = Depends(require_admin_child_requests_update)
):
    """
    Admin: Suspend an active child ID
    
    **Admin only endpoint**
    
    - **admin_notes**: Required reason for suspension
    - Can only suspend accepted child IDs
    """
    
    try:
        admin_user_id = current_user["supabase_user"].id
        
        child_request = await admin_helpers.suspend_child_id(
            db=db,
            request_id=request_id,
            admin_notes=suspension_data.admin_notes,
            admin_user_id=admin_user_id
        )        
        return ChildIdResponse.model_validate(child_request)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error suspending child ID: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to suspend child ID"
        )

@router.get("/child-statistics")
async def get_child_id_statistics(
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check = Depends(require_admin_child_requests)
):
    """
    Admin: Get child ID management statistics
    
    **Admin only endpoint**
    
    Returns counts by status, recent requests, etc.
    """
    
    try:
        stats = await admin_helpers.get_child_id_statistics(db=db)
        return stats
        
    except Exception as e:
        logger.error(f"Error fetching child ID statistics: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch child ID statistics"
        )
