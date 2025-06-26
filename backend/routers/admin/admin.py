from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from fastapi.security import HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession
from config import get_db
from routers.auth.auth import get_current_user
from dependencies.rbac import (
    require_admin_agents, 
    require_admin_agents_write, 
    require_admin_agents_delete,
    require_admin_read,
    require_admin_write,
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
    ChildIdStatusUpdate,
    UniversalRecordUploadResponse
)
from .helpers import AdminHelpers
from .cutpay import router as cutpay_router
from utils.model_utils import model_data_from_orm, convert_uuids_to_strings
from utils.google_sheets import google_sheets_sync
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
            
            if req.insurer:
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
        admin_user_id = current_user["supabase_user"].id
        child_request = await admin_helpers.approve_child_request(
            db=db,
            request_id=request_id,
            assignment_data=assignment_data.dict(),
            admin_user_id=admin_user_id
        )
        
        req_dict = convert_uuids_to_strings(model_data_from_orm(child_request))

        if child_request.insurer:
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
        admin_user_id = current_user["supabase_user"].id
        child_request = await admin_helpers.reject_child_request(
            db=db,
            request_id=request_id,
            admin_notes=rejection_data.admin_notes,
            admin_user_id=admin_user_id
        )
        
        req_dict = convert_uuids_to_strings(model_data_from_orm(child_request))

        if child_request.insurer:
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
        admin_user_id = current_user["supabase_user"].id
        
        child_request = await admin_helpers.suspend_child_id(
            db=db,
            request_id=request_id,
            admin_notes=suspension_data.admin_notes,
            admin_user_id=admin_user_id
        )
        
        req_dict = convert_uuids_to_strings(model_data_from_orm(child_request))
        
        if child_request.insurer:
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


#<------------------Universal Record Management------------------>

@router.post("/universal-records/upload", response_model=UniversalRecordUploadResponse)
async def upload_universal_record(
    file: UploadFile = File(..., description="Universal record CSV file"),
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check = Depends(require_admin_write)
):
    """
    Upload and process universal record CSV for data reconciliation
    
    **Admin only endpoint**
    
    This endpoint processes a universal record CSV file from external companies
    that contains both policy and cut pay transaction data. The universal record
    is considered the source of truth and will be used to:
    
    1. **Update existing records** where data mismatches are found
    2. **Add missing records** that exist in universal record but not in our system
    3. **Generate detailed report** of all changes made
    
    **CSV Requirements:**
    - Must contain 'policy_number' column as unique identifier
    - Can contain any combination of policy and cut pay fields
    - Date fields should be in YYYY-MM-DD format
    - Numeric fields should be valid numbers
    
    **Process Flow:**
    1. Parse and validate CSV content
    2. For each record, find matching policy/cut pay by policy number
    3. Compare universal record data with existing data
    4. Update fields where universal record differs from our data
    5. Create new records if they don't exist in our system
    6. Generate comprehensive reconciliation report
    
    **Returns:**
    - Detailed report showing what was updated/added
    - Processing statistics and timing
    - List of any errors encountered
    """
    
    try:
        if not file.filename.lower().endswith('.csv'):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only CSV files are allowed"
            )

        file_content = await file.read()
        csv_content = file_content.decode('utf-8')
        
        if not csv_content.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="CSV file is empty"
            )
        
        admin_user_id = current_user["supabase_user"].id

        result = await admin_helpers.process_universal_record_csv(
            db=db,
            csv_content=csv_content,
            admin_user_id=admin_user_id
        )
        
        logger.info(f"Universal record processed by admin {admin_user_id}")
        logger.info(f"File: {file.filename}, Size: {len(file_content)} bytes")
        
        return UniversalRecordUploadResponse(
            message=f"Universal record processed successfully. "
                   f"Processed {result['total_records_processed']} records in "
                   f"{result['processing_time_seconds']:.2f} seconds.",
            report=result,
            processing_time_seconds=result['processing_time_seconds']
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing universal record: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process universal record: {str(e)}"
        )

@router.get("/universal-records/template")
async def download_universal_record_template(
    current_user = Depends(get_current_user),
    _rbac_check = Depends(require_admin_read)
):
    """
    Download CSV template for universal record upload
    
    **Admin only endpoint**
    
    Returns a CSV template file showing the expected format and all possible
    fields that can be included in a universal record upload.
    """
    
    try:
        from fastapi.responses import StreamingResponse
        import io
        import csv

        headers = [
            'policy_number',
            'policy_type',
            'insurance_type', 
            'agent_code',
            'broker_name',
            'insurance_company',
            'vehicle_type',
            'registration_number',
            'vehicle_class',
            'vehicle_segment',
            'gross_premium',
            'gst',
            'net_premium',
            'od_premium',
            'tp_premium',
            'start_date',
            'end_date',
            
            # Cut pay fields
            'cut_pay_amount',
            'commission_grid',
            'agent_commission_given_percent',
            'payment_by',
            'amount_received',
            'payment_method',
            'payment_source',
            'transaction_date',
            'payment_date',
            'notes'
        ]
        
        # Create sample data
        sample_data = [
            'POL-2024-001',  # policy_number
            'Motor Insurance',  # policy_type
            'Comprehensive',  # insurance_type
            'AGT001',  # agent_code
            'ABC Insurance Brokers',  # broker_name
            'ICICI Lombard',  # insurance_company
            'Car',  # vehicle_type
            'MH12AB1234',  # registration_number
            'Private Car',  # vehicle_class
            'Sedan',  # vehicle_segment
            25000.00,  # gross_premium
            4500.00,  # gst
            20500.00,  # net_premium
            15000.00,  # od_premium
            5500.00,  # tp_premium
            '2024-01-01',  # start_date
            '2024-12-31',  # end_date
            2500.00,  # cut_pay_amount
            '10%',  # commission_grid
            12.5,  # agent_commission_given_percent
            'John Smith',  # payment_by
            2500.00,  # amount_received
            'Bank Transfer',  # payment_method
            'Company Account',  # payment_source
            '2024-01-15',  # transaction_date
            '2024-01-20',  # payment_date
            'Sample transaction'  # notes
        ]
        
        # Create CSV content
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(headers)
        writer.writerow(sample_data)
        
        csv_content = output.getvalue()
        output.close()
        
        # Return as downloadable file
        return StreamingResponse(
            io.BytesIO(csv_content.encode('utf-8')),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=universal_record_template.csv"}
        )
        
    except Exception as e:
        logger.error(f"Error generating template: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate template"
        )
