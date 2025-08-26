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
from utils.s3_utils import build_key, build_cloudfront_url, generate_presigned_put_url
from utils.quarterly_sheets_manager import quarterly_manager


router = APIRouter(prefix="/policies", tags=["Policies"])
security = HTTPBearer()
policy_helpers = PolicyHelpers()
logger = logging.getLogger(__name__)

require_policy_read = require_permission("policies", "read")
require_policy_write = require_permission("policies", "write")
require_policy_manage = require_permission("policies", "manage")


#TODO: give the AI the list of all insurers and brokers full name and ofc unko khudke db me b dalo, ask AI to extract if they are avail so to cross check agent gaalt to nhi dal rha, agar null aye by any chance agent ki manlo nhi to forntend pe hoga ki agent ko allow nhi krnege jane ko age agar same na hua to
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
    file: UploadFile | None = File(None, description="Policy PDF file (if presign=false)"),
    policy_id: str = Form(..., description="Policy ID to associate with the uploaded PDF"),
    presign: bool = Form(False),
    filename: str | None = Form(None),
    content_type: str | None = Form(None),
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
        if presign or not file:
            user_id = current_user["user_id"]
            user_role = current_user.get("role", "agent")
            filter_user_id = user_id if user_role not in ["admin", "superadmin"] else None
            existing_policy = await PolicyHelpers.get_policy_by_id(db, policy_id, filter_user_id)
            if not existing_policy:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Policy not found or you don't have access to it")

            if not filename:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="filename is required for presign")
            if not filename.lower().endswith('.pdf'):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only PDF files are allowed")

            key = build_key(prefix=f"policies/{user_id}", filename=filename)
            upload_url = generate_presigned_put_url(key=key, content_type=content_type or "application/pdf")
            file_path = build_cloudfront_url(key)

            await PolicyHelpers.update_policy(
                db,
                policy_id,
                {"pdf_file_path": file_path, "pdf_file_name": filename},
                filter_user_id,
            )

            return PolicyUploadResponse(
                policy_id=policy_id,
                extracted_data={},
                confidence_score=None,
                pdf_file_path=file_path,
                pdf_file_name=filename,
                message="Presigned URL generated; upload directly to S3",
                upload_url=upload_url,
            )

        if not file.filename.lower().endswith('.pdf'):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only PDF files are allowed")
        
        user_id = current_user["user_id"]
        user_role = current_user.get("role", "agent")
        
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

#TODO: line number 245 onwards kuch to dikkat hai yahan aise manusally sab kyu pass kre and mujhe lgra hai ye sahi b pass nhi kr rhe hai ham yaan pta nhi pr ye cutpay nhi tha atleast to dkehna hai yahan aisa kyu hai
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
            # Route to quarterly sheet instead of master sheet
            from utils.quarterly_sheets_manager import quarterly_manager
            
            # Prepare data for quarterly sheet with the new headers structure
            policy_dict_for_quarterly = {
                'Reporting Month (mmm\'yy)': policy_dict_for_sheets.get('reporting_month', ''),
                'Child ID/ User ID [Provided by Insure Zeal]': policy_dict_for_sheets.get('child_id', ''),
                'Insurer /broker code': policy_dict_for_sheets.get('agent_code', ''),
                'Policy Start Date': policy_dict_for_sheets.get('start_date', ''),
                'Policy End Date': policy_dict_for_sheets.get('end_date', ''),
                'Booking Date(Click to select Date)': '',
                'Broker Name': policy_dict_for_sheets.get('broker_name', ''),
                'Insurer name': policy_dict_for_sheets.get('insurance_company', ''),
                'Major Categorisation( Motor/Life/ Health)': policy_dict_for_sheets.get('major_categorisation', ''),
                'Product (Insurer Report)': policy_dict_for_sheets.get('product_insurer_report', ''),
                'Product Type': policy_dict_for_sheets.get('product_type', ''),
                'Plan type (Comp/STP/SAOD)': policy_dict_for_sheets.get('plan_type', ''),
                'Gross premium': policy_dict_for_sheets.get('gross_premium', ''),
                'GST Amount': policy_dict_for_sheets.get('gst_amount', ''),
                'Net premium': policy_dict_for_sheets.get('net_premium', ''),
                'OD Preimium': policy_dict_for_sheets.get('od_premium', ''),
                'TP Premium': policy_dict_for_sheets.get('tp_premium', ''),
                'Policy number': policy_dict_for_sheets.get('policy_number', ''),
                'Formatted Policy number': policy_dict_for_sheets.get('formatted_policy_number', ''),
                'Registration.no': policy_dict_for_sheets.get('registration_number', ''),
                'Make_Model': policy_dict_for_sheets.get('make_model', ''),
                'Model': policy_dict_for_sheets.get('model', ''),
                'Vehicle_Variant': policy_dict_for_sheets.get('vehicle_variant', ''),
                'GVW': policy_dict_for_sheets.get('gvw', ''),
                'RTO': policy_dict_for_sheets.get('rto', ''),
                'State': policy_dict_for_sheets.get('state', ''),
                'Cluster': policy_dict_for_sheets.get('cluster', ''),
                'Fuel Type': policy_dict_for_sheets.get('fuel_type', ''),
                'CC': policy_dict_for_sheets.get('cc', ''),
                'Age(Year)': policy_dict_for_sheets.get('age_year', ''),
                'NCB (YES/NO)': policy_dict_for_sheets.get('ncb', ''),
                'Discount %': policy_dict_for_sheets.get('discount_percent', ''),
                'Business Type': policy_dict_for_sheets.get('business_type', ''),
                'Seating Capacity': policy_dict_for_sheets.get('seating_capacity', ''),
                'Veh_Wheels': policy_dict_for_sheets.get('veh_wheels', ''),
                'Customer Name': policy_dict_for_sheets.get('customer_name', ''),
                'Customer Number': policy_dict_for_sheets.get('customer_phone_number', ''),
                'Payment By Office': policy_dict_for_sheets.get('payment_by_office', ''),
                'PO Paid To Agent': policy_dict_for_sheets.get('total_agent_payout_amount', ''),
                'Running Bal': policy_dict_for_sheets.get('running_bal', ''),
                '  Invoice Number  ': policy_dict_for_sheets.get('invoice_number', ''),
                'Match': 'False'
            }
            
            # Route to current quarterly sheet
            quarterly_result = quarterly_manager.route_new_record_to_current_quarter(policy_dict_for_quarterly)
            
            if quarterly_result.get('success'):
                logger.info(f"Policy {policy.id} routed to quarterly sheet: {quarterly_result.get('sheet_name')}")
            else:
                logger.error(f"Failed to route policy {policy.id} to quarterly sheet: {quarterly_result.get('error')}")
                
        except Exception as sync_error:
            logger.error(f"Failed to route policy {policy.id} to quarterly sheet: {str(sync_error)}")
        
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

#TODO: same jaisa cutpay me tha ki yahan wo limited fields return krdo sari
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


#TODO: same jaisa cutoay me tha ki policy number pass kro and quarter(s) and uske hisab se return kro
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

#TODO: same shit as above pr yahan pe wapis se koi jhol hai wo quartely sheet wale part me line 431 and ye to sahi me kuch aur hi lg rha and haan db me b update kro wo limited fields ko
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
        
        filter_user_id = user_id if user_role not in ["admin", "superadmin"] else None

        update_data = policy_data.model_dump(exclude_unset=True)        
        # Note: child_id validation removed since frontend gets child_id from our own endpoint
        
        policy = await PolicyHelpers.update_policy(db, policy_id, update_data, filter_user_id)
        if not policy:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Policy not found"
            )
        # Sync to quarterly Google Sheets
        try:
            # Map policy data to quarterly sheet format
            quarterly_data = {
                'date': policy.created_at.strftime('%d-%m-%Y') if policy.created_at else "",
                'insurer_name': policy.insurance_company or "",
                'product': "Motor",
                'client_name': policy.client_name or "",
                'policy_holder_mobile': "",
                'vehicle_make': "",
                'vehicle_model': "",
                'variant': "",
                'fuel_type': "",
                'vehicle_reg_no': policy.registration_number or "",
                'manufacturing_year': "",
                'vehicle_age': "",
                'rto': "",
                'policy_no': policy.policy_number or "",
                'invoice_no': policy.invoice_number or "",
                'policy_start_date': policy.start_date.strftime('%d-%m-%Y') if policy.start_date else "",
                'policy_end_date': policy.end_date.strftime('%d-%m-%Y') if policy.end_date else "",
                'policy_tenure': "",
                'idv': "",
                'net_premium': policy.net_premium or 0,
                'od_premium': policy.od_premium or 0,
                'tp_premium': policy.tp_premium or 0,
                'commission_percentage': "",
                'commission_amount': "",
                'discount_amount': "",
                'final_premium': policy.net_premium or 0,
                'payment_mode': "",
                'payment_type': "",
                'payment_reference': "",
                'bank_name': "",
                'branch_name': "",
                'cheque_number': "",
                'cheque_date': "",
                'transaction_date': "",
                'transaction_status': "",
                'payment_status': "",
                'receipt_no': "",
                'receipt_date': "",
                'gstin': "",
                'pan_number': "",
                'adhaar_number': "",
                'email_id': "",
                'agent_code': policy.agent_code or "",
                'agent_name': "",
                'agent_mobile': "",
                'agent_email': "",
                'team_leader': "",
                'regional_manager': "",
                'zonal_head': "",
                'branch_office': "",
                'state': "",
                'region': "",
                'zone': "",
                'business_source': "",
                'lead_source': "",
                'campaign_name': "",
                'utm_source': "",
                'utm_medium': "",
                'utm_campaign': "",
                'referral_code': "",
                'promo_code': "",
                'discount_code': "",
                'coupon_code': "",
                'loyalty_points_used': "",
                'loyalty_points_earned': "",
                'customer_segment': "",
                'policy_type': "",
                'cover_type': "",
                'previous_policy_number': "",
                'previous_insurer': "",
                'claim_history': "",
                'no_claim_bonus': "",
                'remarks': "",
                'special_instructions': "",
                'uploaded_by': policy.uploaded_by or "",
                'uploaded_date': policy.created_at.strftime('%d-%m-%Y') if policy.created_at else "",
                'last_updated_by': "",
                'last_updated_date': policy.updated_at.strftime('%d-%m-%Y') if policy.updated_at else ""
            }
            
            quarterly_manager.route_new_record_to_current_quarter(quarterly_data, "UPDATE")
            logger.info(f"Updated policy {policy.id} synced to quarterly Google Sheets")
        except Exception as sync_error:
            logger.error(f"Failed to sync updated policy {policy.id} to quarterly Google Sheets: {str(sync_error)}")
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

#TODO: same shit pr isko lodh pdegi nhi shyad anyways db se b udha do
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

#TODO: hata do bc wo mis wala export route hi chlga AAAAAAAA
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

#TODO: koi lodh nhi iski b wo agent MIS kaam krega iska hata do
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

