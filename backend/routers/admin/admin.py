from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from fastapi.security import HTTPBearer
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from config import get_db
from routers.auth.auth import get_current_user
from dependencies.rbac import (
    require_admin_agents, 
    require_admin_agents_delete,
    require_admin_read,
    require_admin_write,
    require_admin_stats,
    require_admin_child_requests,
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
    ChildIdStatusUpdate,
)
from . import schemas
from .helpers import AdminHelpers
from routers.child.helpers import ChildHelpers
from utils.model_utils import model_data_from_orm, convert_uuids_to_strings
from utils.google_sheets import google_sheets_sync
from models import UserProfile, Users
from typing import Optional
import logging
import io
import csv
import uuid

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["Admin"])
security = HTTPBearer()

admin_helpers = AdminHelpers()
child_helpers = ChildHelpers()


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
      Returns complete agent profile including all personal, professional, and document information.
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
    search: Optional[str] = Query(None, description="Search by location, email, or child ID"),
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check = Depends(require_admin_child_requests)
):
    """
    Admin: Get all child ID requests with filtering
    
    **Admin only endpoint**
    
    - **status_filter**: Filter by request status (pending, accepted, rejected, suspended)
    - **search**: Search in location, email, or child ID
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
        
        formatted_requests = []
        for req in result["requests"]:
            req_dict = convert_uuids_to_strings(model_data_from_orm(req))
            req_dict['insurer_id'] = None  # Add insurer_id to the response dictionary
            
            # Get agent information
            user_query = select(UserProfile).where(UserProfile.user_id == req.user_id)
            user_result = await db.execute(user_query)
            user_profile = user_result.scalar_one_or_none()
            
            if user_profile:
                # Create agent name from first_name and last_name
                agent_name = None
                if user_profile.first_name or user_profile.last_name:
                    agent_name = f"{user_profile.first_name or ''} {user_profile.last_name or ''}".strip()
                
                req_dict['agent_name'] = agent_name
                req_dict['agent_code'] = user_profile.agent_code
            else:
                req_dict['agent_name'] = None
                req_dict['agent_code'] = None
            
            if req.insurer:
                req_dict['insurer_id'] = req.insurer.id
                req_dict["insurer"] = {
                    "id": req.insurer.id,
                    "insurer_code": req.insurer.insurer_code,
                    "name": req.insurer.name
                }
            if req.broker:
                req_dict["broker_relation"] = {
                    "id": req.broker.id,
                    "broker_code": req.broker.broker_code,
                    "name": req.broker.name
                }
            
            formatted_requests.append(ChildIdResponse.model_validate(req_dict))
        
        return ChildIdRequestList(
            requests=formatted_requests,
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

@router.get("/child-requests/{request_id}", response_model=ChildIdResponse)
async def get_child_request_by_id(
    request_id: str,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check = Depends(require_admin_child_requests)
):
    """
    Admin: Get details of a specific child ID request
    
    **Admin only endpoint**
    
    - **request_id**: The ID of the child ID request to retrieve
    - Returns complete request details including user, insurer, and broker information
    """
    
    try:
        # Validate UUID format before proceeding
        try:
            uuid.UUID(request_id)
            logger.info(f"Successfully parsed request_id UUID: {request_id}")
        except ValueError as uuid_error:
            logger.error(f"Invalid UUID format for request_id: '{request_id}' - Error: {str(uuid_error)}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid request ID format. Expected valid UUID, got: '{request_id}'"
            )
        
        child_request = await child_helpers.get_child_request_by_id(db=db, request_id=request_id)

        if not child_request:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Child ID request not found"
            )
        
        from utils.model_utils import model_data_from_orm, convert_uuids_to_strings
        req_dict = convert_uuids_to_strings(model_data_from_orm(child_request))
        req_dict['insurer_id'] = None  # Add insurer_id to the response dictionary
        
        # Get agent information
        user_query = select(UserProfile).where(UserProfile.user_id == child_request.user_id)
        user_result = await db.execute(user_query)
        user_profile = user_result.scalar_one_or_none()
        
        if user_profile:
            # Create agent name from first_name and last_name
            agent_name = None
            if user_profile.first_name or user_profile.last_name:
                agent_name = f"{user_profile.first_name or ''} {user_profile.last_name or ''}".strip()
            
            req_dict['agent_name'] = agent_name
            req_dict['agent_code'] = user_profile.agent_code
            logger.info(f"Agent info for child request {request_id}: name='{agent_name}', code='{user_profile.agent_code}'")
        else:
            req_dict['agent_name'] = None
            req_dict['agent_code'] = None
            logger.warning(f"No user profile found for user_id: {child_request.user_id}")
        
        if child_request.insurer:
            req_dict['insurer_id'] = child_request.insurer.id
            req_dict["insurer"] = {
                "id": str(child_request.insurer.id),
                "insurer_code": child_request.insurer.insurer_code,
                "name": child_request.insurer.name
            }
        if child_request.broker:
            req_dict["broker_id"] = child_request.broker.id
            req_dict["broker_relation"] = {
                "id": str(child_request.broker.id),
                "broker_code": child_request.broker.broker_code,
                "name": child_request.broker.name
            }
        
        return ChildIdResponse.model_validate(req_dict)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching child request details: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch child ID request details"
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
    - **branch_code**: Optional branch code
    - **region**: Optional region
    - **manager_name**: Optional manager name
    - **manager_email**: Optional manager email
    - **admin_notes**: Optional admin notes
    """
    
    try:
        # Validate UUID format before proceeding
        try:
            uuid.UUID(request_id)
            logger.info(f"Successfully parsed request_id UUID: {request_id}")
        except ValueError as uuid_error:
            logger.error(f"Invalid UUID format for request_id: '{request_id}' - Error: {str(uuid_error)}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid request ID format. Expected valid UUID, got: '{request_id}'"
            )
        
        admin_user_id = current_user["user_id"]
        
        # Use model_dump() for Pydantic V2 compatibility and exclude None values
        assignment_dict = assignment_data.model_dump(exclude_none=False)
        logger.info(f"Assignment data received: {assignment_dict}")
        
        child_request = await admin_helpers.approve_child_request(
            db=db,
            request_id=request_id,
            assignment_data=assignment_dict,
            admin_user_id=admin_user_id
        )
        
        req_dict = convert_uuids_to_strings(model_data_from_orm(child_request))
        req_dict['insurer_id'] = None  # Add insurer_id to the response dictionary

        # Get agent information
        user_query = select(UserProfile).where(UserProfile.user_id == child_request.user_id)
        user_result = await db.execute(user_query)
        user_profile = user_result.scalar_one_or_none()
        
        if user_profile:
            # Create agent name from first_name and last_name
            agent_name = None
            if user_profile.first_name or user_profile.last_name:
                agent_name = f"{user_profile.first_name or ''} {user_profile.last_name or ''}".strip()
            
            req_dict['agent_name'] = agent_name
            req_dict['agent_code'] = user_profile.agent_code
        else:
            req_dict['agent_name'] = None
            req_dict['agent_code'] = None

        if child_request.insurer:
            req_dict['insurer_id'] = child_request.insurer.id
            req_dict["insurer"] = {
                "id": child_request.insurer.id,
                "insurer_code": child_request.insurer.insurer_code,
                "name": child_request.insurer.name
            }
        if child_request.broker:
            req_dict["broker_relation"] = {
                "id": child_request.broker.id,
                "broker_code": child_request.broker.broker_code,
                "name": child_request.broker.name
            }

        google_sheets_dict = {
            'id': str(child_request.id),
            'user_id': str(child_request.user_id),
            'insurance_company': child_request.insurer.name if child_request.insurer else "",
            'broker': child_request.broker.name if child_request.broker else "",
            'location': child_request.location,
            'phone_number': child_request.phone_number,
            'email': child_request.email,
            'preferred_rm_name': child_request.preferred_rm_name,
            'status': child_request.status,
            'child_id': child_request.child_id,
            'password': child_request.password,
            'branch_code': child_request.branch_code,
            'region': child_request.region,
            'manager_name': child_request.manager_name,
            'manager_email': child_request.manager_email,
            'admin_notes': child_request.admin_notes,
            'created_at': child_request.created_at,
            'updated_at': child_request.updated_at
        }
        google_sheets_sync.sync_child_id_request(google_sheets_dict, "APPROVE")
               
        return ChildIdResponse.model_validate(req_dict)
        
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
        # Validate UUID format before proceeding
        try:
            uuid.UUID(request_id)
            logger.info(f"Successfully parsed request_id UUID: {request_id}")
        except ValueError as uuid_error:
            logger.error(f"Invalid UUID format for request_id: '{request_id}' - Error: {str(uuid_error)}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid request ID format. Expected valid UUID, got: '{request_id}'"
            )
        
        admin_user_id = current_user["user_id"]
        child_request = await admin_helpers.reject_child_request(
            db=db,
            request_id=request_id,
            admin_notes=rejection_data.admin_notes,
            admin_user_id=admin_user_id
        )
        
        req_dict = convert_uuids_to_strings(model_data_from_orm(child_request))
        req_dict['insurer_id'] = None  # Add insurer_id to the response dictionary

        # Get agent information
        user_query = select(UserProfile).where(UserProfile.user_id == child_request.user_id)
        user_result = await db.execute(user_query)
        user_profile = user_result.scalar_one_or_none()
        
        if user_profile:
            # Create agent name from first_name and last_name
            agent_name = None
            if user_profile.first_name or user_profile.last_name:
                agent_name = f"{user_profile.first_name or ''} {user_profile.last_name or ''}".strip()
            
            req_dict['agent_name'] = agent_name
            req_dict['agent_code'] = user_profile.agent_code
        else:
            req_dict['agent_name'] = None
            req_dict['agent_code'] = None

        if child_request.insurer:
            req_dict['insurer_id'] = child_request.insurer.id
            req_dict["insurer"] = {
                "id": child_request.insurer.id,
                "insurer_code": child_request.insurer.insurer_code,
                "name": child_request.insurer.name
            }
        if child_request.broker:
            req_dict["broker_relation"] = {
                "id": child_request.broker.id,
                "broker_code": child_request.broker.broker_code,
                "name": child_request.broker.name
            }

        google_sheets_dict = {
            'id': str(child_request.id),
            'user_id': str(child_request.user_id),
            'insurance_company': child_request.insurer.name if child_request.insurer else "",
            'broker': child_request.broker.name if child_request.broker else "",
            'location': child_request.location,
            'phone_number': child_request.phone_number,
            'email': child_request.email,
            'preferred_rm_name': child_request.preferred_rm_name,
            'status': child_request.status,
            'child_id': child_request.child_id,
            'password': child_request.password,
            'branch_code': child_request.branch_code,
            'region': child_request.region,
            'manager_name': child_request.manager_name,
            'manager_email': child_request.manager_email,
            'admin_notes': child_request.admin_notes,
            'created_at': child_request.created_at,
            'updated_at': child_request.updated_at
        }
        google_sheets_sync.sync_child_id_request(google_sheets_dict, "REJECT")
               
        return ChildIdResponse.model_validate(req_dict)
        
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
        # Validate UUID format before proceeding
        try:
            uuid.UUID(request_id)
            logger.info(f"Successfully parsed request_id UUID: {request_id}")
        except ValueError as uuid_error:
            logger.error(f"Invalid UUID format for request_id: '{request_id}' - Error: {str(uuid_error)}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid request ID format. Expected valid UUID, got: '{request_id}'"
            )
        
        admin_user_id = current_user["user_id"]
        
        child_request = await admin_helpers.suspend_child_id(
            db=db,
            request_id=request_id,
            admin_notes=suspension_data.admin_notes,
            admin_user_id=admin_user_id
        )
        
        req_dict = convert_uuids_to_strings(model_data_from_orm(child_request))
        req_dict['insurer_id'] = None  # Add insurer_id to the response dictionary
        
        # Get agent information
        user_query = select(UserProfile).where(UserProfile.user_id == child_request.user_id)
        user_result = await db.execute(user_query)
        user_profile = user_result.scalar_one_or_none()
        
        if user_profile:
            # Create agent name from first_name and last_name
            agent_name = None
            if user_profile.first_name or user_profile.last_name:
                agent_name = f"{user_profile.first_name or ''} {user_profile.last_name or ''}".strip()
            
            req_dict['agent_name'] = agent_name
            req_dict['agent_code'] = user_profile.agent_code
        else:
            req_dict['agent_name'] = None
            req_dict['agent_code'] = None
        
        if child_request.insurer:
            req_dict['insurer_id'] = child_request.insurer.id
            req_dict["insurer"] = {
                "id": child_request.insurer.id,
                "insurer_code": child_request.insurer.insurer_code,
                "name": child_request.insurer.name
            }
        if child_request.broker:
            req_dict["broker_relation"] = {
                "id": child_request.broker.id,
                "broker_code": child_request.broker.broker_code,
                "name": child_request.broker.name
            }

        google_sheets_dict = {
            'id': str(child_request.id),
            'user_id': str(child_request.user_id),
            'insurance_company': child_request.insurer.name if child_request.insurer else "",
            'broker': child_request.broker.name if child_request.broker else "",
            'location': child_request.location,
            'phone_number': child_request.phone_number,
            'email': child_request.email,
            'preferred_rm_name': child_request.preferred_rm_name,
            'status': child_request.status,
            'child_id': child_request.child_id,
            'password': child_request.password,
            'branch_code': child_request.branch_code,
            'region': child_request.region,
            'manager_name': child_request.manager_name,
            'manager_email': child_request.manager_email,
            'admin_notes': child_request.admin_notes,
            'created_at': child_request.created_at,
            'updated_at': child_request.updated_at
        }
        google_sheets_sync.sync_child_id_request(google_sheets_dict, "SUSPEND")
               
        return ChildIdResponse.model_validate(req_dict)
        
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

@router.put("/agents/{user_id}/promote-to-admin", response_model=schemas.UserRoleUpdateResponse)
async def promote_agent_to_admin(
    user_id: str,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_admin_write)
):
    """
    Promote an agent to admin role. Only accessible by existing admins.
    Updates both database and Supabase metadata.
    """
    from config import get_supabase_admin_client
    from uuid import UUID
    
    try:
        # Validate user_id format
        try:
            user_uuid = UUID(user_id)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid user ID format. Must be a valid UUID."
            )

        result = await db.execute(
            select(UserProfile, Users)
            .join(Users, UserProfile.user_id == Users.id)
            .where(UserProfile.user_id == user_uuid)
        )
        user_data = result.first()
        
        if not user_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with ID {user_id} not found in database"
            )
        
        user_profile, user_record = user_data
        
        if user_profile.user_role != "agent":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"User is currently {user_profile.user_role}. Only agents can be promoted to admin."
            )

        # Update UserProfile role
        user_profile.user_role = "admin"
        
        # Update Users table metadata to mirror what should be in Supabase
        if user_record.raw_user_meta_data:
            user_record.raw_user_meta_data["role"] = "admin"
        else:
            user_record.raw_user_meta_data = {"role": "admin"}
        
        await db.commit()
        
        logger.info(f"Updated role in both UserProfile and Users tables for user {user_id} to admin")
        
        supabase_admin = get_supabase_admin_client()
        supabase_response = supabase_admin.auth.admin.update_user_by_id(
            uid=user_id,
            attributes={"user_metadata": {"role": "admin"}}
        )
        
        supabase_updated = bool(supabase_response.user)
        
        return schemas.UserRoleUpdateResponse(
            success=True,
            message="Successfully promoted agent to admin in both local database and Supabase auth" if supabase_updated else "Promoted to admin in local database, but failed to sync with Supabase auth. User can still access admin features.",
            user_id=user_uuid,
            new_role="admin",
            updated_in_supabase=supabase_updated,
            updated_in_database=True
        )
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while promoting the user to admin"
        )
