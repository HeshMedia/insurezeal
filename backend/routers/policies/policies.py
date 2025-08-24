from typing import Dict, Any, List, Optional
from fastapi import Depends, HTTPException, APIRouter, status, Query, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from pydantic import Field
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import logging
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import date
import io

from config import get_db
from routers.auth.auth import get_current_user
from routers.policies.helpers import PolicyHelpers
from routers.policies.schemas import (
    PolicyResponse, PolicyCreateRequest, PolicyUpdate, PolicySummary, PolicyListResponse,
    PolicyUploadResponse, AIExtractionResponse, ChildIdOption, AgentOption,
    PolicyNumberCheckResponse, PolicySummaryResponse, PolicyCreateResponse
)
from dependencies.rbac import require_permission
from utils.google_sheets import google_sheets_sync

router = APIRouter(prefix="/policies", tags=["Policies"])
security = HTTPBearer()
policy_helpers = PolicyHelpers()
logger = logging.getLogger(__name__)

require_policy_read = require_permission("policies", "read")
require_policy_write = require_permission("policies", "write")
require_policy_manage = require_permission("policies", "manage")

@router.post("/extract-pdf-data", response_model=AIExtractionResponse)
async def extract_pdf_data_endpoint(
    file: UploadFile = File(..., description="Policy PDF file for extraction"),
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check = Depends(require_policy_write)
):
    """
    Extract policy data from PDF using AI
    
    **Requires policy write permission**
    
    - **file**: Policy PDF file to extract data from
    Returns extracted policy data for review
    """
    try:
        if not file.filename or not file.filename.lower().endswith('.pdf'):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Please upload a valid PDF file"
            )
        
        pdf_bytes = await file.read()
        
        if len(pdf_bytes) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file is empty"
            )

        from utils.ai_utils import extract_policy_data_from_pdf_bytes
        extracted_data_dict = await extract_policy_data_from_pdf_bytes(pdf_bytes)
        
        if not extracted_data_dict:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to extract data from PDF. Please ensure the PDF contains readable policy information."
            )

        confidence_score = extracted_data_dict.pop("confidence_score", 0.5)
        
        return AIExtractionResponse(
            extracted_data=extracted_data_dict,
            confidence_score=confidence_score,
            success=True,
            message="Policy data extracted successfully from PDF"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error extracting PDF data: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to extract data from PDF"
        )

@router.post("/upload", response_model=PolicyUploadResponse)
async def upload_policy_pdf(
    file: UploadFile = File(..., description="Policy PDF file"),
    policy_id: str = Form(..., description="Policy ID to associate with the uploaded PDF"),
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check = Depends(require_policy_write)
):
    """
    Upload policy PDF file and associate it with a specific policy
    
    **Requires policy write permission**
    
    - **file**: Policy PDF file to upload
    - **policy_id**: Policy ID to associate the PDF with
    Returns file upload information
    """
    try:
        if not file.filename.lower().endswith('.pdf'):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only PDF files are allowed"
            )
        
        user_id = current_user["user_id"]
        user_role = current_user.get("role", "agent")
        
        # Verify the policy exists and user has access to it
        # Both admin and superadmin should see all policies
        filter_user_id = user_id if user_role not in ["admin", "superadmin"] else None
        existing_policy = await PolicyHelpers.get_policy_by_id(db, policy_id, filter_user_id)
        
        if not existing_policy:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Policy not found or you don't have access to it"
            )
        
        file_content = await file.read()

        file_path, original_filename = await PolicyHelpers.save_uploaded_file_from_bytes(
            file_content, file.filename, user_id
        )
        
        # Update the policy record with the new PDF file information
        await PolicyHelpers.update_policy(
            db, 
            policy_id, 
            {
                "pdf_file_path": file_path,
                "pdf_file_name": original_filename
            }, 
            filter_user_id
        )
        
        return PolicyUploadResponse(
            policy_id=policy_id, 
            extracted_data={},
            confidence_score=None,
            pdf_file_path=file_path,
            pdf_file_name=original_filename,
            message=f"Policy PDF uploaded successfully and associated with policy {policy_id}. Use /extract-pdf-data to extract data."
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading policy PDF: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,            
            detail="Failed to upload policy PDF"        )

@router.post("/submit", response_model=PolicyCreateResponse)
async def submit_policy(
    policy_data: PolicyCreateRequest,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check = Depends(require_policy_write)
):
    """
    Submit final policy data after user review
    
    **Requires policy write permission**
    
    - **policy_data**: Complete policy information from frontend
    
    Saves essential fields to database and full data to Google Sheets
    """
    try:
        user_id = current_user["user_id"]
        user_role = current_user.get("role", "agent")
    
        policy_dict = policy_data.model_dump()
        
        # Extract essential fields for database storage
        essential_fields = {
            "policy_number": policy_dict.get("policy_number"),
            "child_id": policy_dict.get("child_id"),
            "agent_code": policy_dict.get("agent_code"),
            "customer_documents_url": policy_dict.get("customer_documents_url"),
            "vehicle_documents_url": policy_dict.get("vehicle_documents_url"),
            "policy_documents_url": policy_dict.get("policy_documents_url"),
            "booking_date": policy_dict.get("booking_date"),
            "policy_start_date": policy_dict.get("start_date"),
            "policy_end_date": policy_dict.get("end_date")
        }
        
        # Save to database with only essential fields
        policy = await PolicyHelpers.create_simplified_policy(
            db=db,
            essential_data=essential_fields
        )
        
        # Save full data to Google Sheets
        try:
            from utils.google_sheets import sync_policy_to_master_sheet
            await sync_policy_to_master_sheet(policy_dict)
            logger.info(f"Policy {policy.policy_number} synced to Google Sheets")
        except Exception as sync_error:
            logger.error(f"Failed to sync policy {policy.policy_number} to Google Sheets: {str(sync_error)}")
        
        return PolicyCreateResponse(
            id=policy.id,
            policy_number=policy.policy_number,
            message="Policy created successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error submitting policy: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to submit policy"
        )

@router.get("/", response_model=List[PolicySummaryResponse])
async def list_policies(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of records to return"),
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check = Depends(require_policy_read)
):
    """
    Get list of policies (simplified summary from database)
    
    **Requires policy read permission**
    
    Returns simplified policy summaries stored in database
    """
    try:
        from sqlalchemy import select
        from models import Policy
        
        # Get simplified policies from database
        result = await db.execute(
            select(Policy)
            .offset(skip)
            .limit(limit)
            .order_by(Policy.created_at.desc())
        )
        policies = result.scalars().all()
        
        return [PolicySummaryResponse.model_validate(policy) for policy in policies]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing policies: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch policies"
        )

@router.get("/{policy_id}", response_model=PolicyResponse)
async def get_policy_details(
    policy_id: str,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check = Depends(require_policy_read)
):
    """
    Get detailed policy information
    
    **Requires policy read permission**
    
    Agents can only access their own policies, admins can access any
    """
    try:
        user_id = current_user["user_id"]
        user_role = current_user.get("role", "agent")
        
        # Both admin and superadmin should see all policies
        filter_user_id = user_id if user_role not in ["admin", "superadmin"] else None
        
        policy = await PolicyHelpers.get_policy_by_id(db, policy_id, filter_user_id)
        if not policy:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Policy not found"
            )
        
        return PolicyResponse.model_validate(policy)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching policy details: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch policy details"
        )

@router.put("/{policy_id}", response_model=PolicyResponse)
async def update_policy(
    policy_id: str,
    policy_data: PolicyUpdate,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check = Depends(require_policy_write)
):
    """
    Update policy information
    
    **Requires policy write permission**
    
    Agents can only update their own policies, admins can update any
    """
    try:
        user_id = current_user["user_id"]
        user_role = current_user.get("role", "agent")
        
        # Both admin and superadmin should see all policies
        filter_user_id = user_id if user_role not in ["admin", "superadmin"] else None

        update_data = policy_data.model_dump(exclude_unset=True)        
        # Note: child_id validation removed since frontend gets child_id from our own endpoint
        
        policy = await PolicyHelpers.update_policy(db, policy_id, update_data, filter_user_id)
        if not policy:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Policy not found"
            )
          # Sync to Google Sheets
        try:
            policy_dict_for_sheets = {
                'id': policy.id,
                'policy_number': policy.policy_number,
                'policy_type': policy.policy_type,
                'insurance_type': policy.insurance_type,
                'agent_id': policy.agent_id,
                'agent_code': policy.agent_code,
                'child_id': policy.child_id,
                'broker_name': policy.broker_name,
                'insurance_company': policy.insurance_company,
                'vehicle_type': policy.vehicle_type,
                'registration_number': policy.registration_number,
                'vehicle_class': policy.vehicle_class,
                'vehicle_segment': policy.vehicle_segment,
                'gross_premium': policy.gross_premium,
                'gst': policy.gst,
                'net_premium': policy.net_premium,
                'od_premium': policy.od_premium,
                'tp_premium': policy.tp_premium,
                'payment_by_office': policy.payment_by_office,
                'total_agent_payout_amount': policy.total_agent_payout_amount,
                'start_date': policy.start_date,
                'end_date': policy.end_date,
                'uploaded_by': policy.uploaded_by,
                'pdf_file_name': policy.pdf_file_name,
                'ai_confidence_score': policy.ai_confidence_score,
                'manual_override': policy.manual_override,
                'created_at': policy.created_at,
                'updated_at': policy.updated_at
            }
            google_sheets_sync.sync_policy(policy_dict_for_sheets, "UPDATE")
            logger.info(f"Updated policy {policy.id} synced to Google Sheets")
        except Exception as sync_error:
            logger.error(f"Failed to sync updated policy {policy.id} to Google Sheets: {str(sync_error)}")
            # Don't fail the main operation if Google Sheets sync fails
        
        return PolicyResponse.model_validate(policy)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating policy: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update policy"
        )

@router.delete("/{policy_id}")
async def delete_policy(
    policy_id: str,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check = Depends(require_policy_manage)
):
    """
    Delete policy
    
    **Requires policy manage permission**
    
    Agents can only delete their own policies, admins can delete any
    """
    try:
        user_id = current_user["user_id"]
        user_role = current_user.get("role", "agent")
        
        # Both admin and superadmin should see all policies
        filter_user_id = user_id if user_role not in ["admin", "superadmin"] else None
        
        success = await PolicyHelpers.delete_policy(db, policy_id, filter_user_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Policy not found"
            )
        
        return {"message": "Policy deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting policy: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete policy"
        )


@router.get("/helpers/check-policy-number", response_model=PolicyNumberCheckResponse)
async def check_policy_number_duplicate(
    policy_number: str = Query(..., description="Policy number to check for duplicates"),
    exclude_policy_id: Optional[str] = Query(None, description="Policy ID to exclude from check (for updates)"),
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check = Depends(require_policy_read)
):
    """
    Check if a policy number already exists in the database in real-time
    
    **Requires policy read permission**
    
    - **policy_number**: The policy number to check for duplicates
    - **exclude_policy_id**: Optional policy ID to exclude from the check (useful for updates)
    
    This endpoint is designed for real-time validation to prevent duplicate submissions
    before other form details are filled.
    """
    try:
        # Validate policy number format (basic validation)
        if not policy_number or not policy_number.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Policy number cannot be empty"
            )
        
        # Convert exclude_policy_id to UUID if provided
        exclude_uuid = None
        if exclude_policy_id:
            try:
                exclude_uuid = uuid.UUID(exclude_policy_id)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid exclude_policy_id format"
                )
        
        # Check for duplicate using helper method
        result = await policy_helpers.check_policy_number_duplicate(
            policy_number=policy_number,
            db=db,
            exclude_policy_id=exclude_uuid
        )
        
        return PolicyNumberCheckResponse(**result)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error checking policy number duplicate: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to check policy number"
        )

@router.get("/helpers/child-ids", response_model=List[ChildIdOption])
async def get_child_id_options(
    insurer_code: str = Query(..., description="Required insurer code to filter child IDs"),
    broker_code: Optional[str] = Query(None, description="Optional broker code to filter child IDs"),
    agent_id: Optional[str] = Query(None, description="Optional agent ID to filter child IDs (admin only)"),
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check = Depends(require_policy_read)
):
    """
    Get available child IDs for dropdown with filtering
    
    **Requires policy read permission**
    
    - **insurer_code**: Required insurer code to filter by
    - **broker_code**: Optional broker code to filter by 
    - **agent_id**: Optional agent ID to filter by (admin only)
    - Returns child IDs matching the filter criteria
    """
    try:
        user_role = current_user.get("role", "agent")
        user_id = current_user["user_id"]
        
        # Determine which agent_id to use for filtering
        if user_role not in ["admin", "superadmin"]:
            # For agents: always filter by their own user_id, ignore any provided agent_id
            agent_id = str(user_id)
        elif agent_id and user_role in ["admin", "superadmin"]:
            # For admin/superadmin: use provided agent_id if given
            agent_id = agent_id
        else:
            # For admin/superadmin without agent_id: no agent filtering
            agent_id = None
            
        # Use the new filtered method
        from routers.child.helpers import ChildHelpers
        child_helpers = ChildHelpers()
        
        filtered_requests = await child_helpers.get_filtered_child_ids(
            db=db,
            insurer_code=insurer_code,
            broker_code=broker_code,
            agent_id=agent_id
        )
        
        # Format the response to match ChildIdOption schema
        child_id_options = []
        for req in filtered_requests:
            # Extract the required fields
            child_id = req.child_id if req.child_id else ""
            broker_name = req.broker.name if req.broker else ""
            insurance_company = req.insurer.name if req.insurer else ""
            
            if child_id:  # Only include if child_id exists
                child_id_options.append(ChildIdOption(
                    child_id=child_id,
                    broker_name=broker_name,
                    insurance_company=insurance_company
                ))
        
        return child_id_options
        
    except Exception as e:
        logger.error(f"Error fetching filtered child ID options: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch child ID options"
        )

@router.get("/helpers/agents", response_model=List[AgentOption])
async def get_agent_options(
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check = Depends(require_policy_manage)
):
    """
    Get available agents for dropdown (admin only)
    
    **Requires policy manage permission**
    """
    try:
        agents = await PolicyHelpers.get_available_agents(db)
        
        return [AgentOption(**agent) for agent in agents]
        
    except Exception as e:
        logger.error(f"Error fetching agent options: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch agent options"
        )

@router.get("/export/csv")
async def export_policies_csv(
    start_date: Optional[date] = Query(None, description="Start date for filtering (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date for filtering (YYYY-MM-DD)"),
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check = Depends(require_policy_read)
):
    """
    Export policies to CSV
    
    **Requires policy read permission**
    
    - **start_date**: Optional start date for filtering (format: YYYY-MM-DD)
    - **end_date**: Optional end date for filtering (format: YYYY-MM-DD)
    
    Returns a CSV file containing all policies.
    If no date filters are provided, all policies are exported.
    Agents can only export their own policies, admins can export all policies.
    """
    
    try:
        user_id = current_user["user_id"]
        user_role = current_user.get("role", "agent")
        
        # For agents, filter by their user_id; for admins/superadmins, no filter
        filter_user_id = str(user_id) if user_role not in ["admin", "superadmin"] else None
        
        csv_content = await PolicyHelpers.export_policies_to_csv(
            db, filter_user_id, start_date, end_date
        )
        
        # Generate filename
        filename = "policies"
        if start_date and end_date:
            filename += f"_{start_date}_{end_date}"
        elif start_date:
            filename += f"_from_{start_date}"
        elif end_date:
            filename += f"_until_{end_date}"
        filename += ".csv"
        
        return StreamingResponse(
            io.BytesIO(csv_content.encode('utf-8')),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in export_policies_csv: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to export policies to CSV"
        )


@router.get("/agent/{agent_code}", response_model=PolicyListResponse)
async def get_agent_policies(
    agent_code: str,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search by policy number, customer name, or vehicle registration"),
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check = Depends(require_policy_read)
):
    """
    Get policies for a specific agent (excluding cutpay/incoming grid/calculation fields)
    
    **Requires policy read permission**
    
    - **agent_code**: Agent code to filter policies by
    - **page**: Page number (default: 1)
    - **page_size**: Number of items per page (default: 20, max: 100)
    - **search**: Optional search term for filtering policies
    
    Returns paginated list of policies for the specified agent with only relevant fields.
    """
    try:
        result = await PolicyHelpers.get_agent_policies(
            db=db,
            agent_code=agent_code,
            page=page,
            page_size=page_size,
            search=search
        )
        
        return PolicyListResponse(
            policies=result["policies"],
            total_count=result["total_count"],
            page=page,
            page_size=page_size,
            total_pages=result["total_pages"]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_agent_policies for agent {agent_code}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch agent policies"
        )

