from typing import Dict, Any, List, Optional
from fastapi import Depends, HTTPException, APIRouter, status, Query, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from pydantic import Field
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import date
import io

from config import get_db
from routers.auth.auth import get_current_user
from routers.policies.helpers import PolicyHelpers
from routers.policies.schemas import (
    PolicyResponse, PolicyCreate, PolicyUpdate, PolicySummary, PolicyListResponse,
    PolicyUploadResponse, AIExtractionResponse, ChildIdOption, AgentOption
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
        filter_user_id = user_id if user_role != "admin" else None
        existing_policy = await policy_helpers.get_policy_by_id(db, policy_id, filter_user_id)
        
        if not existing_policy:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Policy not found or you don't have access to it"
            )
        
        file_content = await file.read()

        file_path, original_filename = await policy_helpers.save_uploaded_file_from_bytes(
            file_content, file.filename, user_id
        )
        
        # Update the policy record with the new PDF file information
        await policy_helpers.update_policy(
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

@router.post("/submit", response_model=PolicyResponse)
async def submit_policy(
    policy_data: PolicyCreate,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check = Depends(require_policy_write)
):
    """
    Submit final policy data after user review
    
    **Requires policy write permission**
    
    - **policy_data**: Complete policy information including:
        - PDF-extracted data (policy_number, premiums, dates, etc.) - can be edited by user
        - User-provided data (agent_id, child_id, broker_name, etc.)
        - File information (pdf_file_path, pdf_file_name)
        - AI metadata (ai_confidence_score, manual_override)
    
    Creates the policy record in the database
    """
    try:
        user_id = current_user["user_id"]
        user_role = current_user.get("role", "agent")
    
        policy_dict = policy_data.model_dump()
        pdf_file_path = policy_dict.pop("pdf_file_path")
        pdf_file_name = policy_dict.pop("pdf_file_name")
        
        submitted_agent_id = policy_dict.get("agent_id")
        if submitted_agent_id:
            try:

                agent_id_str = str(submitted_agent_id)
                agent_profile = await policy_helpers.get_agent_by_user_id(db, agent_id_str)
                if not agent_profile:
                    logger.warning(f"Invalid agent_id submitted: {submitted_agent_id}")
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Agent with ID {submitted_agent_id} not found"
                    )
                policy_dict["agent_code"] = agent_profile.agent_code
            except HTTPException:
                raise
            except Exception as e:
                logger.error(f"Error validating agent_id {submitted_agent_id}: {str(e)}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid agent_id provided"
                )
        else:
            if user_role == "agent":
                agent_profile = await policy_helpers.get_agent_by_user_id(db, user_id)
                if agent_profile:
                    policy_dict["agent_id"] = str(agent_profile.user_id)
                    policy_dict["agent_code"] = agent_profile.agent_code
                    logger.info(f"Auto-assigned agent_id {user_id} for agent user")
                else:
                    logger.warning(f"Agent profile not found for user {user_id}")
                    policy_dict["agent_id"] = str(user_id)
                    policy_dict["agent_code"] = None
        
        submitted_child_id = policy_dict.get("child_id")
        if submitted_child_id:
            try:
                child_details = await policy_helpers.get_child_id_details(db, submitted_child_id)
                if not child_details:
                    logger.warning(f"Invalid child_id submitted: {submitted_child_id}")
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Child ID {submitted_child_id} not found"
                    )
                policy_dict["broker_name"] = child_details.broker
                policy_dict["insurance_company"] = child_details.insurance_company
            except HTTPException:
                raise
            except Exception as e:
                logger.error(f"Error validating child_id {submitted_child_id}: {str(e)}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid child_id provided"                )
        
        policy = await policy_helpers.create_policy(
            db=db,
            policy_data=policy_dict,
            file_path=pdf_file_path,
            file_name=pdf_file_name,
            uploaded_by=user_id
        )

        if policy.agent_code:
            await policy_helpers.update_agent_financials(
                db, 
                policy.agent_code, 
                policy.payment_by_office or 0.0, 
                policy.total_agent_payout_amount or 0.0
            )
            await db.commit()
        
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
            'updated_at': policy.updated_at        }
        try:
            google_sheets_sync.sync_policy(policy_dict_for_sheets, "CREATE")
            logger.info(f"Policy {policy.id} synced to Google Sheets")
        except Exception as sync_error:
            logger.error(f"Failed to sync policy {policy.id} to Google Sheets: {str(sync_error)}")
        
        return PolicyResponse.model_validate(policy)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error submitting policy: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to submit policy"
        )

@router.get("/", response_model=PolicyListResponse)
async def list_policies(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    policy_type: str = Query(None, description="Filter by policy type"),
    agent_id: str = Query(None, description="Filter by agent ID (admin only)"),
    search: str = Query(None, description="Search by policy number, registration, or agent code"),
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check = Depends(require_policy_read)
):
    """
    Get paginated list of policies
    
    **Requires policy read permission**
    
    - **page**: Page number
    - **page_size**: Items per page
    - **policy_type**: Filter by policy type
    - **agent_id**: Filter by agent (admin only)
    - **search**: Search term
    
    Agents can only see their own policies, admins can see all
    """
    try:
        user_id = current_user["user_id"]
        user_role = current_user.get("role", "agent")

        filter_user_id = user_id if user_role != "admin" else None
        filter_agent_id = agent_id if user_role == "admin" else None
        
        result = await policy_helpers.get_policies(
            db=db,
            page=page,
            page_size=page_size,
            user_id=filter_user_id,
            agent_id=filter_agent_id,
            policy_type=policy_type,
            search=search
        )
        
        return PolicyListResponse(
            policies=[PolicySummary.model_validate(policy) for policy in result["policies"]],
            total_count=result["total_count"],
            page=result["page"],
            page_size=result["page_size"],
            total_pages=result["total_pages"]
        )
        
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
        
        filter_user_id = user_id if user_role != "admin" else None
        
        policy = await policy_helpers.get_policy_by_id(db, policy_id, filter_user_id)
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
        
        filter_user_id = user_id if user_role != "admin" else None

        update_data = policy_data.model_dump(exclude_unset=True)        
        if "child_id" in update_data and update_data["child_id"]:
            child_details = await policy_helpers.get_child_id_details(db, update_data["child_id"])
            if child_details:
                update_data["broker_name"] = child_details.broker
                update_data["insurance_company"] = child_details.insurance_company
        
        policy = await policy_helpers.update_policy(db, policy_id, update_data, filter_user_id)
        if not policy:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Policy not found"
            )
          # Sync to Google Sheets
        try:
            policy_dict_for_sheets = await policy_helpers.convert_policy_to_dict(policy)
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
        
        filter_user_id = user_id if user_role != "admin" else None
        
        success = await policy_helpers.delete_policy(db, policy_id, filter_user_id)
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


@router.get("/helpers/child-ids", response_model=List[ChildIdOption])
async def get_child_id_options(
    agent_id: str = Query(None, description="Agent ID to filter child IDs (admin only)"),
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check = Depends(require_policy_read)
):
    """
    Get available child IDs for dropdown
    
    **Requires policy read permission**
    
    - **agent_id**: Optional agent ID to filter child IDs (for admins)
    - If agent_id is provided and user is admin: returns child IDs for that agent
    - If agent_id is not provided or user is agent: returns child IDs for current user
    """
    try:
        user_id = current_user["user_id"]
        user_role = current_user.get("role", "agent")
        
        if agent_id and user_role == "admin":
            target_agent_id = agent_id
        else:
            target_agent_id = str(user_id)
        
        child_ids = await policy_helpers.get_available_child_ids(db, target_agent_id)
        
        return [ChildIdOption(**child_id) for child_id in child_ids]
        
    except Exception as e:
        logger.error(f"Error fetching child ID options: {str(e)}")
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
        agents = await policy_helpers.get_available_agents(db)
        
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
        
        # For agents, filter by their user_id; for admins, no filter
        filter_user_id = str(user_id) if user_role != "admin" else None
        
        csv_content = await policy_helpers.export_policies_to_csv(
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

