"""
CutPay Router - Comprehensive API endpoints for CutPay flow
Implements all endpoints as described in CUTPAY_FLOW_DETAILED_README.md
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
from sqlalchemy.orm import selectinload, attributes
from typing import Optional, List, Dict, Any
from datetime import date, datetime
from uuid import UUID
import logging
import io
import csv
import traceback
import uuid
import os

from config import get_db, AWS_S3_BUCKET
from ..auth.auth import get_current_user
from dependencies.rbac import require_admin_cutpay
from models import CutPay, Insurer, Broker, ChildIdRequest, AdminChildID, CutPayAgentConfig
from fastapi.concurrency import run_in_threadpool
from .cutpay_schemas import (
    CutPayCreate,
    CutPayUpdate,
    CutPayResponse,
    ExtractedPolicyData,
    CalculationRequest,
    CalculationResult,
    DropdownOptions,
    FilteredDropdowns,
    DocumentUploadResponse,
    ExtractionResponse,
    ExportRequest,
    DashboardStats,
    BulkUpdateRequest,
    BulkUpdateResponse,
    CutPayAgentConfigCreate,
    CutPayAgentConfigUpdate,
    CutPayAgentConfigResponse,
    AgentPOResponse,
    AgentFinancialSummary
)
from .cutpay_helpers import (
    calculate_commission_amounts,
    get_dropdown_options,
    get_filtered_dropdowns,
    auto_populate_relationship_data,
    update_agent_financials,
    get_agent_financial_summary,
    validate_cutpay_data,
    validate_and_resolve_codes,
    resolve_broker_code_to_id,
    resolve_insurer_code_to_id
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/cutpay", tags=["CutPay"])

def safe_cutpay_response(cutpay_obj) -> CutPayResponse:
    """Safely convert SQLAlchemy CutPay object to Pydantic CutPayResponse"""
    try:
        return CutPayResponse.model_validate(cutpay_obj)
    except Exception as e:
        logger.warning(f"model_validate failed, using manual conversion: {str(e)}")
        cutpay_dict = {}
        for field_name in CutPayResponse.model_fields.keys():
            try:
                cutpay_dict[field_name] = getattr(cutpay_obj, field_name)
            except Exception:
                cutpay_dict[field_name] = None
        return CutPayResponse(**cutpay_dict)

# =============================================================================
# CORE CUTPAY OPERATIONS
# =============================================================================

#TODO: only saving the few selected fields in DB, need to sync all fields to Google Sheets though (check)
@router.post("/", response_model=CutPayResponse)
async def create_cutpay_transaction(
    cutpay_data: CutPayCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    _rbac_check = Depends(require_admin_cutpay)
):
    """
    Create new CutPay transaction with a robust, two-phase commit process.
    """
    cutpay = None
    try:
        logger.info("Step 1: Beginning core data transaction for new CutPay.")
        async with db.begin():
            validation_errors = validate_cutpay_data(cutpay_data.dict())
            if validation_errors:
                raise HTTPException(status_code=400, detail={"errors": validation_errors})

            # Check for policy number uniqueness
            policy_number = None
            if cutpay_data.extracted_data and cutpay_data.extracted_data.policy_number:
                policy_number = cutpay_data.extracted_data.policy_number
            elif cutpay_data.admin_input and hasattr(cutpay_data.admin_input, 'policy_number') and cutpay_data.admin_input.policy_number:
                policy_number = cutpay_data.admin_input.policy_number
            elif hasattr(cutpay_data, 'policy_number') and cutpay_data.policy_number:
                policy_number = cutpay_data.policy_number

            if policy_number:
                existing_policy = await db.execute(
                    select(CutPay).where(CutPay.policy_number == policy_number)
                )
                if existing_policy.scalar_one_or_none():
                    raise HTTPException(
                        status_code=400, 
                        detail=f"Policy number '{policy_number}' already exists in the database. Please use a unique policy number."
                    )
                logger.info(f"Policy number '{policy_number}' is unique - proceeding with creation")

            cutpay_dict = cutpay_data.dict(exclude={"extracted_data", "admin_input", "calculations"}, exclude_unset=True)
            if cutpay_data.extracted_data:
                extracted_dict = cutpay_data.extracted_data.dict(exclude_unset=True)
                # Fix field mapping: schema uses start_date/end_date but model uses policy_start_date/policy_end_date
                if 'start_date' in extracted_dict:
                    start_date_str = extracted_dict.pop('start_date')
                    if start_date_str:
                        try:
                            from datetime import datetime
                            extracted_dict['policy_start_date'] = datetime.strptime(start_date_str, '%Y-%m-%d').date()
                        except (ValueError, TypeError):
                            logger.warning(f"Invalid start_date format: {start_date_str}")
                if 'end_date' in extracted_dict:
                    end_date_str = extracted_dict.pop('end_date')
                    if end_date_str:
                        try:
                            from datetime import datetime
                            extracted_dict['policy_end_date'] = datetime.strptime(end_date_str, '%Y-%m-%d').date()
                        except (ValueError, TypeError):
                            logger.warning(f"Invalid end_date format: {end_date_str}")
                cutpay_dict.update(extracted_dict)
            if cutpay_data.admin_input:
                admin_fields = cutpay_data.admin_input.dict(exclude_unset=True)
                broker_code = admin_fields.pop('broker_code', None)
                insurer_code = admin_fields.pop('insurer_code', None)
                if broker_code or insurer_code:
                    try:
                        broker_id, insurer_id = await validate_and_resolve_codes(db, broker_code, insurer_code)
                        if broker_id: admin_fields['broker_id'] = broker_id
                        if insurer_id: admin_fields['insurer_id'] = insurer_id
                    except HTTPException as e:
                        logger.error(f"Code resolution failed for broker '{broker_code}' or insurer '{insurer_code}': {e.detail}")
                        raise e
                cutpay_dict.update(admin_fields)
            if cutpay_data.calculations:
                cutpay_dict.update(cutpay_data.calculations.dict(exclude_unset=True))
            
            cutpay_dict["created_by"] = current_user["user_id"]
            
            cutpay_dict = {k: v for k, v in cutpay_dict.items() if v is not None}

            cutpay = CutPay(**cutpay_dict)
            auto_populate_relationship_data(cutpay, db)
            
            # Update agent financials if agent_code is present
            if cutpay.agent_code:
                await update_agent_financials(
                    db=db,
                    agent_code=cutpay.agent_code,
                    net_premium=cutpay.net_premium or 0.0,
                    running_balance=cutpay.running_bal or 0.0
                )
            db.add(cutpay)

        await db.refresh(cutpay)
        logger.info(f"Step 1 SUCCESS: Successfully created CutPay ID {cutpay.id}.")

    except Exception as e:
        logger.critical(f"Step 1 FAILED: Database creation failed. Traceback:\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Failed to create CutPay transaction in the database: {str(e)}")

    sync_results = None
    try:
        logger.info(f"Step 2: Starting Google Sheets sync for new CutPay ID {cutpay.id}.")
        from utils.quarterly_sheets_manager import quarterly_manager
        
        cutpay_dict = {c.name: getattr(cutpay, c.name) for c in cutpay.__table__.columns}
        for key, value in cutpay_dict.items():
            if isinstance(value, (datetime, date)): cutpay_dict[key] = value.isoformat()
            elif isinstance(value, UUID): cutpay_dict[key] = str(value)

        # Route to quarterly sheet instead of dedicated cutpay sheet
        quarterly_result = await run_in_threadpool(quarterly_manager.route_new_record_to_current_quarter, cutpay_dict)
        sync_results = {"cutpay": quarterly_result}
        logger.info(f"Step 2 SUCCESS: Google Sheets sync finished for CutPay ID {cutpay.id}.")
        
    except Exception as e:
        logger.critical(f"Step 2 FAILED: Google Sheets sync failed for CutPay ID {cutpay.id}, but database changes are saved. Traceback:\n{traceback.format_exc()}")
        return safe_cutpay_response(cutpay)

    if not sync_results:
        logger.warning("Step 3 SKIPPED: No sync results to update flags.")
        return safe_cutpay_response(cutpay)

    try:
        logger.info("Step 3: Beginning transaction to update sync flags with a new session.")
        from config import AsyncSessionLocal
        async with AsyncSessionLocal() as final_db_session:
            async with final_db_session.begin():
                result = await final_db_session.execute(select(CutPay).filter(CutPay.id == cutpay.id))
                final_cutpay = result.scalar_one()

                if sync_results.get("cutpay", {}).get("success"):
                    final_cutpay.cutpay_sheet_row_id = sync_results["cutpay"].get("row_id")
                    final_cutpay.synced_to_cutpay_sheet = True

            await final_db_session.refresh(final_cutpay)
            logger.info(f"Step 3 SUCCESS: Successfully updated sync flags for CutPay ID {final_cutpay.id}.")
            logger.info(f"--- Create for CutPay ID: {cutpay.id} finished successfully. ---")
            return safe_cutpay_response(final_cutpay)
            
    except Exception as e:
        logger.critical(f"Step 3 FAILED: Updating sync flags failed for CutPay ID {cutpay.id}. Traceback:\n{traceback.format_exc()}")
        return safe_cutpay_response(cutpay)

#TODO: should return the list of all cutpays from db, the limited number of columns that we are now storing
@router.get("/", response_model=List[CutPayResponse])
async def list_cutpay_transactions(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    insurer_code: Optional[str] = Query(None),
    broker_code: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    search: Optional[str] = Query(None),
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check = Depends(require_admin_cutpay)
):
    """
    List CutPay transactions with comprehensive filtering
    
    Supports filtering by:
    - Insurer and Broker (using codes)
    - Date range
    - Search in policy numbers and customer names
    """
    try:
        query = select(CutPay)
        
        if insurer_code:
            insurer_id = await resolve_insurer_code_to_id(db, insurer_code)
            query = query.where(CutPay.insurer_id == insurer_id)
            
        if broker_code:
            broker_id = await resolve_broker_code_to_id(db, broker_code)
            query = query.where(CutPay.broker_id == broker_id)
            
        if date_from:
            query = query.where(CutPay.booking_date >= date_from)
            
        if date_to:
            query = query.where(CutPay.booking_date <= date_to)
            
        if search:
            search_filter = f"%{search}%"
            query = query.where(
                (CutPay.policy_number.ilike(search_filter)) |
                (CutPay.customer_name.ilike(search_filter)) |
                (CutPay.agent_code.ilike(search_filter))
            )
        
        query = query.order_by(desc(CutPay.created_at)).offset(skip).limit(limit)
        result = await db.execute(query)
        transactions = result.scalars().all()
        
        return [safe_cutpay_response(txn) for txn in transactions]
        
    except Exception as e:
        logger.error(f"Failed to list CutPay transactions: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch transactions: {str(e)}"
        )

# =============================================================================
# CALCULATIONS & DROPDOWNS ENDPOINTS  
# =============================================================================

@router.post("/calculate", response_model=CalculationResult)
async def calculate_amounts(
    calculation_request: CalculationRequest,
    current_user = Depends(get_current_user),
    _rbac_check = Depends(require_admin_cutpay)
):
    """
    Real-time calculation API for frontend
    
    Calculates:
    - Commission amounts (receivable from broker)
    - CutPay amount (based on payment mode)
    - Agent payout amounts
    - GST calculations
    """
    try:
        result = await calculate_commission_amounts(calculation_request.dict())
        return CalculationResult(**result)
        
    except Exception as e:
        logger.error(f"Calculation failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Calculation failed: {str(e)}"
        )

@router.get("/dropdowns", response_model=DropdownOptions)
async def get_form_dropdown_options(
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check = Depends(require_admin_cutpay)
):
    """Get all dropdown options for CutPay form"""
    
    try:
        options = await get_dropdown_options(db)
        return options
        
    except Exception as e:
        logger.error(f"Failed to fetch dropdown options: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch dropdown options: {str(e)}"
        )

@router.get("/dropdowns/filtered", response_model=FilteredDropdowns)
async def get_filtered_dropdown_options(
    insurer_code: Optional[str] = Query(None),
    broker_code: Optional[str] = Query(None),
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check = Depends(require_admin_cutpay)
):
    """Get filtered dropdown options based on insurer/broker codes"""
    
    try:
        insurer_id = None
        broker_id = None
        
        if insurer_code:
            insurer_id = await resolve_insurer_code_to_id(db, insurer_code)
        if broker_code:
            broker_id = await resolve_broker_code_to_id(db, broker_code)
            
        options = await get_filtered_dropdowns(db, insurer_id, broker_id)
        return options
        
    except Exception as e:
        logger.error(f"Failed to fetch filtered dropdowns: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch filtered dropdowns: {str(e)}"
        )

# =============================================================================
# EXPORT AND STATISTICS ENDPOINTS (must be before parameterized routes)
# =============================================================================


#TODO: ye hata do bc sab ye MIS me ayega bs ab as ham ye sab db me store thodi kr rhe udr hi ajaye seedha
@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check = Depends(require_admin_cutpay)
):
    """Get dashboard statistics for CutPay"""
    try:
        total_transactions = await db.scalar(select(func.count(CutPay.id)))
        total_gross_premium = await db.scalar(select(func.sum(CutPay.gross_premium))) or 0
        total_cutpay_amount = await db.scalar(select(func.sum(CutPay.cut_pay_amount))) or 0
        commission_sum_result = await db.execute(select(func.coalesce(func.sum(CutPay.total_receivable_from_broker), 0)))
        total_commission = commission_sum_result.scalar() or 0
        
        # Calculate agent payouts
        agent_payout_result = await db.execute(select(func.coalesce(func.sum(CutPay.total_agent_payout), 0)))
        total_agent_payouts = agent_payout_result.scalar() or 0
        
        # Get completed and draft transactions counts
        completed_transactions = await db.scalar(
            select(func.count(CutPay.id)).where(CutPay.synced_to_cutpay_sheet == True)
        ) or 0
        draft_transactions = await db.scalar(
            select(func.count(CutPay.id)).where(CutPay.synced_to_cutpay_sheet == False)
        ) or 0
        
        pending_sync_result = await db.execute(
            select(func.count(CutPay.id)).where(
                (CutPay.synced_to_cutpay_sheet == False)
            )
        )
        pending_sync = pending_sync_result.scalar()

        monthly_stats = {}
        top_agents = []
        top_insurers = []
        
        return DashboardStats(
            total_transactions=total_transactions,
            completed_transactions=completed_transactions,
            draft_transactions=draft_transactions,
            total_cut_pay_amount=float(total_cutpay_amount),
            total_agent_payouts=float(total_agent_payouts),
            total_commission_receivable=float(total_commission),
            pending_sync_count=pending_sync,
            monthly_stats=monthly_stats,
            top_agents=top_agents,
            top_insurers=top_insurers
        )
        
    except Exception as e:
        logger.error(f"Failed to fetch dashboard stats: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch statistics: {str(e)}"
        )

# =============================================================================
# BULK UPDATE ENDPOINT
# =============================================================================

#TODO: quartely sheet ka mention hai waise idr to ki hana krta hai update usme pr have to check and normally db me kya update krta hai wo b dkehna
@router.put("/bulk-update", response_model=BulkUpdateResponse)
async def bulk_update_cutpay_transactions(
    request: BulkUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
    _rbac_check = Depends(require_admin_cutpay)
):
    """
    Perform bulk updates on multiple CutPay transactions.
    This is a generic endpoint that can update any fields on any CutPay records.
    Each update item can specify different fields to update for different records.
    """
    successful_ids = []
    failed_updates = []
    updated_records = []
    
    logger.info(f"Processing bulk update for {len(request.updates)} records")
    
    for update_item in request.updates:
        cutpay_id = update_item.cutpay_id
        cutpay = None
        
        try:
            logger.info(f"Processing bulk update for CutPay ID {cutpay_id}")
            
            async with db.begin():
                # Get the existing record
                result = await db.execute(select(CutPay).filter(CutPay.id == cutpay_id))
                cutpay = result.scalar_one_or_none()
                
                if not cutpay:
                    failed_updates.append({
                        "cutpay_id": cutpay_id,
                        "error": f"CutPay transaction with ID {cutpay_id} not found"
                    })
                    continue

                # Get update data - handle nested structure like the existing update route
                cutpay_data = update_item.update_data
                update_data = cutpay_data.dict(exclude={"extracted_data", "admin_input", "calculations"}, exclude_unset=True)
                
                # Add extracted_data fields if present
                if hasattr(cutpay_data, 'extracted_data') and cutpay_data.extracted_data:
                    extracted_fields = cutpay_data.extracted_data.dict(exclude_unset=True)
                    update_data.update(extracted_fields)
                    logger.info(f"Added {len(extracted_fields)} extracted_data fields for CutPay {cutpay_id}")
                
                # Add admin_input fields if present
                if hasattr(cutpay_data, 'admin_input') and cutpay_data.admin_input:
                    admin_fields = cutpay_data.admin_input.dict(exclude_unset=True)
                    # Remove broker/insurer codes from admin fields (handle separately)
                    broker_code = admin_fields.pop('broker_code', None)
                    insurer_code = admin_fields.pop('insurer_code', None)
                    update_data.update(admin_fields)
                    logger.info(f"Added {len(admin_fields)} admin_input fields for CutPay {cutpay_id}")
                    # Add codes back for processing
                    if broker_code: update_data['broker_code'] = broker_code
                    if insurer_code: update_data['insurer_code'] = insurer_code
                    
                # Add calculations fields if present
                if hasattr(cutpay_data, 'calculations') and cutpay_data.calculations:
                    calc_fields = cutpay_data.calculations.dict(exclude_unset=True)
                    update_data.update(calc_fields)
                    logger.info(f"Added {len(calc_fields)} calculations fields for CutPay {cutpay_id}")
                
                logger.info(f"Updating {len(update_data)} fields for CutPay {cutpay_id}: {list(update_data.keys())}")
                
                # Check for policy number uniqueness if policy number is being updated
                if 'policy_number' in update_data and update_data['policy_number']:
                    new_policy_number = update_data['policy_number']
                    current_policy_number = cutpay.policy_number
                    
                    # Only check uniqueness if policy number is actually changing
                    if new_policy_number != current_policy_number:
                        existing_policy = await db.execute(
                            select(CutPay).where(
                                (CutPay.policy_number == new_policy_number) &
                                (CutPay.id != cutpay_id)  # Exclude current record
                            )
                        )
                        if existing_policy.scalar_one_or_none():
                            failed_updates.append({
                                "cutpay_id": cutpay_id,
                                "error": f"Policy number '{new_policy_number}' already exists in the database. Please use a unique policy number."
                            })
                            continue
                        logger.info(f"Policy number change from '{current_policy_number}' to '{new_policy_number}' is valid for CutPay {cutpay_id}")
                
                # Handle broker/insurer code resolution if provided
                if 'broker_code' in update_data or 'insurer_code' in update_data:
                    broker_code = update_data.pop('broker_code', None)
                    insurer_code = update_data.pop('insurer_code', None)
                    if broker_code or insurer_code:
                        broker_id, insurer_id = await validate_and_resolve_codes(db, broker_code, insurer_code)
                        if broker_id: update_data['broker_id'] = broker_id
                        if insurer_id: update_data['insurer_id'] = insurer_id
                
                # Apply updates
                for field, value in update_data.items():
                    if hasattr(cutpay, field):
                        old_value = getattr(cutpay, field)
                        setattr(cutpay, field, value)
                        logger.info(f"Updated {field}: {old_value} -> {value} for CutPay {cutpay_id}")
                    else:
                        logger.warning(f"Field '{field}' not found on CutPay model - skipping for CutPay {cutpay_id}")
                
                # Auto-populate relationship data
                auto_populate_relationship_data(cutpay, db)
                
                # Update agent financials if agent_code is present and relevant fields changed
                if cutpay.agent_code and ('net_premium' in update_data or 'running_bal' in update_data):
                    await update_agent_financials(
                        db=db,
                        agent_code=cutpay.agent_code,
                        net_premium=update_data.get('net_premium', 0.0) if 'net_premium' in update_data else 0.0,
                        running_balance=update_data.get('running_bal', 0.0) if 'running_bal' in update_data else 0.0
                    )
                            
            # Refresh to get committed data
            await db.refresh(cutpay)
            logger.info(f"Successfully updated CutPay ID {cutpay.id} in database.")

            # Google Sheets sync
            sync_results = None
            try:
                logger.info(f"Starting Google Sheets sync for updated CutPay ID {cutpay.id}.")
                from utils.quarterly_sheets_manager import quarterly_manager
                
                cutpay_dict = {c.name: getattr(cutpay, c.name) for c in cutpay.__table__.columns}
                for key, value in cutpay_dict.items():
                    if isinstance(value, (datetime, date)): cutpay_dict[key] = value.isoformat()
                    elif isinstance(value, UUID): cutpay_dict[key] = str(value)

                # Route to quarterly sheet instead of dedicated cutpay sheet
                quarterly_result = await run_in_threadpool(quarterly_manager.route_new_record_to_current_quarter, cutpay_dict, "UPDATE")
                sync_results = {"cutpay": quarterly_result}
                logger.info(f"Google Sheets sync completed for CutPay ID {cutpay.id}.")
                
                # Update sync flags
                if sync_results.get("cutpay", {}).get("success"):
                    cutpay.synced_to_cutpay_sheet = True
                    if sync_results["cutpay"].get("row_id"):
                        cutpay.cutpay_sheet_row_id = sync_results["cutpay"]["row_id"]
                
                await db.commit()
                await db.refresh(cutpay)
                
            except Exception as sync_error:
                logger.error(f"Google Sheets sync failed for CutPay {cutpay_id}: {str(sync_error)}")
                logger.error(f"Sync error details: {traceback.format_exc()}")
                # Don't fail the whole operation for sync errors

            successful_ids.append(cutpay_id)
            updated_records.append(safe_cutpay_response(cutpay))
            logger.info(f"Successfully processed bulk update for CutPay ID {cutpay_id}")
            
        except Exception as e:
            logger.error(f"Failed to update CutPay {cutpay_id}: {str(e)}")
            logger.error(f"Error details: {traceback.format_exc()}")
            failed_updates.append({
                "cutpay_id": cutpay_id,
                "error": str(e)
            })
            continue
    
    logger.info(f"Bulk update operation completed. Success: {len(successful_ids)}, Failed: {len(failed_updates)}")
    
    return BulkUpdateResponse(
        success_count=len(successful_ids),
        failed_count=len(failed_updates),
        successful_ids=successful_ids,
        failed_updates=failed_updates,
        updated_records=updated_records
    )

# =============================================================================
# MANUAL SYNC ENDPOINT FOR TROUBLESHOOTING
# =============================================================================

@router.post("/manual-sync", response_model=Dict[str, Any])
async def manual_sync_to_google_sheets(
    cutpay_ids: List[int],
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
    _rbac_check = Depends(require_admin_cutpay)
):
    """
    Manually trigger Google Sheets sync for specific CutPay records.
    Useful for troubleshooting sync issues.
    """
    sync_results = []
    
    for cutpay_id in cutpay_ids:
        try:
            # Get the CutPay record
            result = await db.execute(select(CutPay).where(CutPay.id == cutpay_id))
            cutpay = result.scalar_one_or_none()
            if not cutpay:
                sync_results.append({
                    "cutpay_id": cutpay_id,
                    "success": False,
                    "error": f"CutPay {cutpay_id} not found"
                })
                continue
            
            # Prepare data for sync
            cutpay_dict = {c.name: getattr(cutpay, c.name) for c in cutpay.__table__.columns}
            for key, value in cutpay_dict.items():
                if isinstance(value, (datetime, date)): 
                    cutpay_dict[key] = value.isoformat()
                elif isinstance(value, UUID): 
                    cutpay_dict[key] = str(value)
            
            logger.info(f"Manual sync for CutPay {cutpay_id} with data keys: {list(cutpay_dict.keys())}")
            
            # Attempt sync
            from utils.quarterly_sheets_manager import quarterly_manager
            
            quarterly_result = await run_in_threadpool(quarterly_manager.route_new_record_to_current_quarter, cutpay_dict, "UPDATE")
            
            # Update sync flags
            if quarterly_result and quarterly_result.get("success"):
                cutpay.synced_to_cutpay_sheet = True
                if quarterly_result.get("row_id"):
                    cutpay.cutpay_sheet_row_id = quarterly_result["row_id"]
            
            await db.commit()
            
            sync_results.append({
                "cutpay_id": cutpay_id,
                "success": True,
                "cutpay_sheet_sync": quarterly_result
            })
            
        except Exception as e:
            logger.error(f"Manual sync failed for CutPay {cutpay_id}: {str(e)}")
            logger.error(f"Error details: {traceback.format_exc()}")
            sync_results.append({
                "cutpay_id": cutpay_id,
                "success": False,
                "error": str(e)
            })
    
    return {
        "message": "Manual sync completed",
        "results": sync_results
    }

@router.get("/agent-config", response_model=List[CutPayAgentConfigResponse])
async def list_agent_configs(
    agent_code: Optional[str] = Query(None, description="Filter by agent code"),
    date_from: Optional[date] = Query(None, description="Filter from date"),
    date_to: Optional[date] = Query(None, description="Filter to date"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
    _rbac_check = Depends(require_admin_cutpay)
):
    """List CutPay agent configurations with filtering"""
    try:
        query = select(CutPayAgentConfig)
        
        if agent_code:
            query = query.where(CutPayAgentConfig.agent_code == agent_code)
        if date_from:
            query = query.where(CutPayAgentConfig.date >= date_from)
        if date_to:
            query = query.where(CutPayAgentConfig.date <= date_to)
            
        query = query.order_by(desc(CutPayAgentConfig.date)).offset(skip).limit(limit)
        result = await db.execute(query)
        configs = result.scalars().all()
        
        return [CutPayAgentConfigResponse.model_validate(config) for config in configs]
        
    except Exception as e:
        logger.error(f"Failed to list agent configs: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch agent configurations: {str(e)}"
        )

#TODO: cutpay id ka to nhi pta ab wo db me alag hoyegi master sheet me hoyegi hi nhi to idr jo b better ho url param yaan normally policy number hi pass krwao wo return kro fir
#also ye policy number milega hame get all cutpay wale routes se right so wahan se frontend bhejga hame quarter b date se nikal ke fir ham usi quarter me check krnege time bachane ko
# tho ho skta hai ki quarter alag b ho rtaher than whatver date there to frontend ko wahan dikhana b pdega phele to autofecth krke kya quarter hai
# if user want he can change that but haan hame backend pe both policy number and quarter chaiye rhega PAR AB qo quarter jab pass krnege jo jo b tera quarter sheets ka logic hai ye manager
# wo use handle kr rha hai ache se ke nhi wo dkehna ppdega aisa to nhi wo sare quarter check krega

@router.get("/{cutpay_id}", response_model=CutPayResponse)
async def get_cutpay_transaction(
    cutpay_id: int,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check = Depends(require_admin_cutpay)
):
    """Get specific CutPay transaction by ID"""
    
    result = await db.execute(select(CutPay).where(CutPay.id == cutpay_id))
    cutpay = result.scalar_one_or_none()
    if not cutpay:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"CutPay transaction {cutpay_id} not found"
        )

    await db.refresh(cutpay)
    return safe_cutpay_response(cutpay)

#TODO: test hi krna basically to in a way limited fields hi nayi wali db me update hori na and ki quartely me b aram se chal rha
#idr b get cutpay route jaise pass hoga hampe policy number and quarter so its easier for us and ham us quarter sheet ko hi dekhnge pr wo upar wali problem abhi b hai
@router.put("/{cutpay_id}", response_model=CutPayResponse)
async def update_cutpay_transaction(
    cutpay_id: int,
    cutpay_data: CutPayUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    _rbac_check = Depends(require_admin_cutpay)
):
    """
    Update CutPay transaction - simplified to mirror the working create route
    """
    cutpay = None
    try:
        logger.info(f"Step 1: Beginning database update for CutPay ID {cutpay_id}.")
        async with db.begin():
            # Get the existing record
            result = await db.execute(select(CutPay).filter(CutPay.id == cutpay_id))
            cutpay = result.scalar_one_or_none()
            
            if not cutpay:
                raise HTTPException(status_code=404, detail=f"CutPay transaction with ID {cutpay_id} not found")

            # Get update data - handle nested structure like create route
            update_data = cutpay_data.dict(exclude={"extracted_data", "admin_input", "calculations"}, exclude_unset=True)
            
            # Add extracted_data fields if present
            if hasattr(cutpay_data, 'extracted_data') and cutpay_data.extracted_data:
                extracted_fields = cutpay_data.extracted_data.dict(exclude_unset=True)
                update_data.update(extracted_fields)
                logger.info(f"Added {len(extracted_fields)} extracted_data fields: {list(extracted_fields.keys())}")
            
            # Add admin_input fields if present
            if hasattr(cutpay_data, 'admin_input') and cutpay_data.admin_input:
                admin_fields = cutpay_data.admin_input.dict(exclude_unset=True)
                # Remove broker/insurer codes from admin fields (handle separately)
                broker_code = admin_fields.pop('broker_code', None)
                insurer_code = admin_fields.pop('insurer_code', None)
                update_data.update(admin_fields)
                logger.info(f"Added {len(admin_fields)} admin_input fields: {list(admin_fields.keys())}")
                # Add codes back for processing
                if broker_code: update_data['broker_code'] = broker_code
                if insurer_code: update_data['insurer_code'] = insurer_code
                
            # Add calculations fields if present
            if hasattr(cutpay_data, 'calculations') and cutpay_data.calculations:
                calc_fields = cutpay_data.calculations.dict(exclude_unset=True)
                update_data.update(calc_fields)
                logger.info(f"Added {len(calc_fields)} calculations fields: {list(calc_fields.keys())}")
            
            logger.info(f"Raw cutpay_data.dict(): {cutpay_data.dict()}")
            logger.info(f"Final update_data after processing nested fields: {update_data}")
            logger.info(f"Updating {len(update_data)} fields: {list(update_data.keys())}")
            
            # Check for policy number uniqueness if policy number is being updated
            if 'policy_number' in update_data and update_data['policy_number']:
                new_policy_number = update_data['policy_number']
                current_policy_number = cutpay.policy_number
                
                # Only check uniqueness if policy number is actually changing
                if new_policy_number != current_policy_number:
                    existing_policy = await db.execute(
                        select(CutPay).where(
                            (CutPay.policy_number == new_policy_number) &
                            (CutPay.id != cutpay_id)  # Exclude current record
                        )
                    )
                    if existing_policy.scalar_one_or_none():
                        raise HTTPException(
                            status_code=400, 
                            detail=f"Policy number '{new_policy_number}' already exists in the database. Please use a unique policy number."
                        )
                    logger.info(f"Policy number change from '{current_policy_number}' to '{new_policy_number}' is valid - proceeding with update")
            
            # Handle broker/insurer code resolution if provided
            if 'broker_code' in update_data or 'insurer_code' in update_data:
                broker_code = update_data.pop('broker_code', None)
                insurer_code = update_data.pop('insurer_code', None)
                if broker_code or insurer_code:
                    broker_id, insurer_id = await validate_and_resolve_codes(db, broker_code, insurer_code)
                    if broker_id: update_data['broker_id'] = broker_id
                    if insurer_id: update_data['insurer_id'] = insurer_id
            
            # Apply updates
            for field, value in update_data.items():
                if hasattr(cutpay, field):
                    old_value = getattr(cutpay, field)
                    setattr(cutpay, field, value)
                    logger.info(f"Updated {field}: {old_value} -> {value}")
                else:
                    logger.warning(f"Field '{field}' not found on CutPay model - skipping")
            
            # Check if customer_name was in the original request
            if 'customer_name' not in update_data:
                logger.warning("customer_name was NOT in the update_data - check frontend request")
            else:
                logger.info("customer_name WAS included in update_data")
            
            # Auto-populate relationship data
            auto_populate_relationship_data(cutpay, db)
            
            # Update agent financials if agent_code is present and relevant fields changed
            if cutpay.agent_code and ('net_premium' in update_data or 'running_bal' in update_data):
                await update_agent_financials(
                    db=db,
                    agent_code=cutpay.agent_code,
                    net_premium=update_data.get('net_premium', 0.0) if 'net_premium' in update_data else 0.0,
                    running_balance=update_data.get('running_bal', 0.0) if 'running_bal' in update_data else 0.0
                )
                        
        # Refresh to get committed data
        await db.refresh(cutpay)
        logger.info(f"Step 1 SUCCESS: Successfully updated CutPay ID {cutpay.id}.")

    except Exception as e:
        logger.critical(f"Step 1 FAILED: Database update failed. Traceback:\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Failed to update CutPay transaction in the database: {str(e)}")

    # Google Sheets sync - exactly like create route
    sync_results = None
    try:
        logger.info(f"Step 2: Starting Google Sheets sync for updated CutPay ID {cutpay.id}.")
        from utils.quarterly_sheets_manager import quarterly_manager
        
        cutpay_dict = {c.name: getattr(cutpay, c.name) for c in cutpay.__table__.columns}
        for key, value in cutpay_dict.items():
            if isinstance(value, (datetime, date)): cutpay_dict[key] = value.isoformat()
            elif isinstance(value, UUID): cutpay_dict[key] = str(value)

        # Route to quarterly sheet instead of dedicated cutpay sheet
        quarterly_result = await run_in_threadpool(quarterly_manager.route_new_record_to_current_quarter, cutpay_dict, "UPDATE")
        sync_results = {"cutpay": quarterly_result}
        logger.info(f"Step 2 SUCCESS: Google Sheets sync finished for CutPay ID {cutpay.id}.")
        
    except Exception as e:
        logger.critical(f"Step 2 FAILED: Google Sheets sync failed for CutPay ID {cutpay.id}, but database changes are saved. Traceback:\n{traceback.format_exc()}")
        return safe_cutpay_response(cutpay)

    if not sync_results:
        logger.warning("Step 3 SKIPPED: No sync results to update flags.")
        return safe_cutpay_response(cutpay)

    # Update sync flags - exactly like create route
    try:
        logger.info("Step 3: Beginning transaction to update sync flags with a new session.")
        from config import AsyncSessionLocal
        async with AsyncSessionLocal() as final_db_session:
            async with final_db_session.begin():
                result = await final_db_session.execute(select(CutPay).filter(CutPay.id == cutpay.id))
                final_cutpay = result.scalar_one()

                if sync_results.get("cutpay", {}).get("success"):
                    final_cutpay.cutpay_sheet_row_id = sync_results["cutpay"].get("row_id")
                    final_cutpay.synced_to_cutpay_sheet = True

            await final_db_session.refresh(final_cutpay)
            logger.info(f"Step 3 SUCCESS: Successfully updated sync flags for CutPay ID {final_cutpay.id}.")
            logger.info(f"--- Update for CutPay ID: {cutpay.id} finished successfully. ---")
            return safe_cutpay_response(final_cutpay)
            
    except Exception as e:
        logger.critical(f"Step 3 FAILED: Updating sync flags failed for CutPay ID {cutpay.id}. Traceback:\n{traceback.format_exc()}")
        return safe_cutpay_response(cutpay)

#TODO: same shit as above 2 routes
@router.delete("/{cutpay_id}")
async def delete_cutpay_transaction(
    cutpay_id: int,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check = Depends(require_admin_cutpay)
):
    """Delete CutPay transaction"""
    
    result = await db.execute(select(CutPay).where(CutPay.id == cutpay_id)); cutpay = result.scalar_one_or_none()
    if not cutpay:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"CutPay transaction {cutpay_id} not found"
        )
    
    await db.delete(cutpay)
    await db.commit()
    
    logger.info(f"Deleted CutPay transaction {cutpay_id} by user {current_user['user_id']}")
    return {"message": f"CutPay transaction {cutpay_id} deleted successfully"}

# =============================================================================
# DOCUMENT PROCESSING ENDPOINTS
# =============================================================================

@router.post("/{cutpay_id}/upload-document", response_model=DocumentUploadResponse)
async def upload_policy_document(
    cutpay_id: int,
    file: UploadFile = File(None),
    document_type: str = Form("policy_pdf"),
    presign: bool = Form(False),
    filename: str | None = Form(None),
    content_type: str | None = Form(None),
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check = Depends(require_admin_cutpay)
):
    """
    Upload policy PDF or additional documents
    
    Supported document types:
    - policy_pdf: Main policy document
    - kyc_documents: KYC documents
    - rc_document: Registration Certificate
    - previous_policy: Previous policy PDF
    """
    try:
        result = await db.execute(select(CutPay).where(CutPay.id == cutpay_id)); cutpay = result.scalar_one_or_none()
        if not cutpay:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"CutPay transaction {cutpay_id} not found"
            )
        
        from utils.s3_utils import build_key, build_cloudfront_url, generate_presigned_put_url

        if presign or not file:
            if not filename or not filename.lower().endswith('.pdf'):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Valid PDF filename is required")
            key = build_key(prefix=f"cutpay/{cutpay_id}", filename=filename)
            upload_url = generate_presigned_put_url(key=key, content_type=content_type or "application/pdf")
            document_url = build_cloudfront_url(key)

            # ✅ COMPREHENSIVE DEBUGGING FOR PRESIGNED UPLOADS
            logger.info(f"🔵 PRESIGNED: Processing document_type='{document_type}' for CutPay {cutpay_id}")
            logger.info(f"🔵 PRESIGNED: Document URL generated: {document_url}")
            logger.info(f"🔵 PRESIGNED: Before update - policy_pdf_url: '{cutpay.policy_pdf_url}'")
            logger.info(f"🔵 PRESIGNED: Before update - additional_documents: {cutpay.additional_documents}")
            
            # Normalize document_type to handle any whitespace/case issues
            document_type_clean = document_type.strip() if document_type else ""
            logger.info(f"🔵 PRESIGNED: Cleaned document_type: '{document_type_clean}'")
            logger.info(f"🔵 PRESIGNED: document_type_clean == 'policy_pdf': {document_type_clean == 'policy_pdf'}")

            if document_type_clean == "policy_pdf":
                logger.info(f"✅ PRESIGNED: ENTERING policy_pdf branch - UPDATING policy_pdf_url")
                old_url = cutpay.policy_pdf_url
                cutpay.policy_pdf_url = document_url
                logger.info(f"✅ PRESIGNED: policy_pdf_url updated from '{old_url}' to '{cutpay.policy_pdf_url}'")
            else:
                logger.info(f"❌ PRESIGNED: ENTERING additional_documents branch for type: '{document_type_clean}'")
                if not cutpay.additional_documents:
                    cutpay.additional_documents = {}
                    logger.info(f"❌ PRESIGNED: Initialized empty additional_documents dict")
                
                old_value = cutpay.additional_documents.get(document_type_clean, "None")
                
                # ✅ PROPER JSON FIELD UPDATE - Create new dict to trigger SQLAlchemy change detection
                updated_additional_docs = dict(cutpay.additional_documents) if cutpay.additional_documents else {}
                updated_additional_docs[document_type_clean] = document_url
                cutpay.additional_documents = updated_additional_docs
                
                logger.info(f"❌ PRESIGNED: additional_documents['{document_type_clean}'] updated from '{old_value}' to '{document_url}'")
                logger.info(f"❌ PRESIGNED: New additional_documents dict: {cutpay.additional_documents}")
            
            # Mark the field as modified to ensure SQLAlchemy detects the change
            attributes.flag_modified(cutpay, 'additional_documents')
            
            # Force database commit and refresh
            await db.commit()
            await db.refresh(cutpay)
            
            logger.info(f"🔵 PRESIGNED: After commit/refresh - policy_pdf_url: '{cutpay.policy_pdf_url}'")
            logger.info(f"🔵 PRESIGNED: After commit/refresh - additional_documents: {cutpay.additional_documents}")
            logger.info(f"Generated presigned URL for CutPay {cutpay_id}, key: {key}")

            return DocumentUploadResponse(
                document_url=document_url, 
                document_type=document_type, 
                upload_status="presigned", 
                message="Presigned URL generated; upload directly to S3", 
                upload_url=upload_url
            )

        if not file.filename.lower().endswith('.pdf'):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only PDF files are supported")

        file_content = await file.read()
        if len(file_content) > 10 * 1024 * 1024: 
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File size must be less than 10MB"
            )

        try:
            from utils.s3_utils import build_key, build_cloudfront_url, put_object
            file_extension = os.path.splitext(file.filename)[1] if file.filename else '.pdf'
            unique_key = build_key(prefix=f"cutpay/{cutpay_id}", filename=f"x{file_extension}")
            put_object(key=unique_key, body=file_content, content_type="application/pdf")
            document_url = build_cloudfront_url(unique_key)
        except Exception as upload_error:
            logger.error(f"Upload error: {str(upload_error)}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to upload PDF: {str(upload_error)}")

        # ✅ COMPREHENSIVE DEBUGGING FOR DIRECT UPLOADS
        logger.info(f"🟢 DIRECT: Processing document_type='{document_type}' for CutPay {cutpay_id}")
        logger.info(f"🟢 DIRECT: Document URL generated: {document_url}")
        logger.info(f"🟢 DIRECT: Before update - policy_pdf_url: '{cutpay.policy_pdf_url}'")
        logger.info(f"🟢 DIRECT: Before update - additional_documents: {cutpay.additional_documents}")
        
        # Normalize document_type to handle any whitespace/case issues
        document_type_clean = document_type.strip() if document_type else ""
        logger.info(f"🟢 DIRECT: Cleaned document_type: '{document_type_clean}'")
        logger.info(f"🟢 DIRECT: document_type_clean == 'policy_pdf': {document_type_clean == 'policy_pdf'}")

        if document_type_clean == "policy_pdf":
            logger.info(f"✅ DIRECT: ENTERING policy_pdf branch - UPDATING policy_pdf_url")
            old_url = cutpay.policy_pdf_url
            cutpay.policy_pdf_url = document_url
            logger.info(f"✅ DIRECT: policy_pdf_url updated from '{old_url}' to '{cutpay.policy_pdf_url}'")
        else:
            logger.info(f"❌ DIRECT: ENTERING additional_documents branch for type: '{document_type_clean}'")
            if not cutpay.additional_documents:
                cutpay.additional_documents = {}
                logger.info(f"❌ DIRECT: Initialized empty additional_documents dict")
            
            old_value = cutpay.additional_documents.get(document_type_clean, "None")
            
            # ✅ PROPER JSON FIELD UPDATE - Create new dict to trigger SQLAlchemy change detection
            updated_additional_docs = dict(cutpay.additional_documents) if cutpay.additional_documents else {}
            updated_additional_docs[document_type_clean] = document_url
            cutpay.additional_documents = updated_additional_docs
            
            logger.info(f"❌ DIRECT: additional_documents['{document_type_clean}'] updated from '{old_value}' to '{document_url}'")
            logger.info(f"❌ DIRECT: New additional_documents dict: {cutpay.additional_documents}")
        
        # Mark the field as modified to ensure SQLAlchemy detects the change
        attributes.flag_modified(cutpay, 'additional_documents')
        
        await db.commit()
        await db.refresh(cutpay)
        
        logger.info(f"🟢 DIRECT: After commit/refresh - policy_pdf_url: '{cutpay.policy_pdf_url}'")
        logger.info(f"🟢 DIRECT: After commit/refresh - additional_documents: {cutpay.additional_documents}")
        logger.info(f"Uploaded {document_type} for CutPay {cutpay_id}")
        
        return DocumentUploadResponse(document_url=document_url, document_type=document_type, upload_status="success", message=f"Document uploaded successfully")
        
    except Exception as e:
        logger.error(f"Failed to upload document for CutPay {cutpay_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Document upload failed: {str(e)}"
        )

@router.post("/extract-pdf", response_model=ExtractionResponse)
async def extract_pdf_data_endpoint(
    file: UploadFile = File(..., description="Policy PDF file for extraction"),
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check = Depends(require_admin_cutpay)
):
    """
    Trigger AI/OCR extraction from uploaded policy PDF (stateless approach)
    
    Extracts 30+ fields including:
    - Policy information
    - Premium details  
    - Vehicle details (for Motor insurance)
    - Customer information
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

        extracted_data = ExtractedPolicyData(**extracted_data_dict)
             
        return ExtractionResponse(
            extraction_status="completed", 
            extracted_data=extracted_data,
            extraction_time=datetime.now()
        )
        
    except Exception as e:
        logger.error(f"PDF extraction failed for CutPay {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"PDF extraction failed: {str(e)}"
        )

# =============================================================================
# AGENT FINANCIAL TRACKING ENDPOINTS
# =============================================================================

#TODO: throughout all cutpay routes ye finance details upgrade krna agent ki isko hatana hai as wo db me sotre hongi hi nhi ab, infact agent ke model se b hata do and ab ye details ham wo summary sheet se lenge to route ko refactor krdo uske hisaab se
@router.get("/agent/{agent_code}/financial-summary", response_model=AgentFinancialSummary)
async def get_agent_financial_summary_endpoint(
    agent_code: str,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
    _rbac_check = Depends(require_admin_cutpay)
):
    """Get financial summary for a specific agent"""
    try:
        summary = await get_agent_financial_summary(db, agent_code)
        return AgentFinancialSummary(**summary)
        
    except Exception as e:
        logger.error(f"Failed to get financial summary for agent {agent_code}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch agent financial summary: {str(e)}"
        )

# =============================================================================
# CUTPAY AGENT CONFIG ENDPOINTS
# =============================================================================

@router.post("/agent-config", response_model=CutPayAgentConfigResponse)
async def create_agent_config(
    config_data: CutPayAgentConfigCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    _rbac_check = Depends(require_admin_cutpay)
):
    """Create new CutPay agent configuration"""
    try:
        # Check if config already exists for this agent and date
        existing_config = await db.execute(
            select(CutPayAgentConfig).where(
                CutPayAgentConfig.agent_code == config_data.agent_code,
                CutPayAgentConfig.date == config_data.config_date
            )
        )
        if existing_config.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Configuration already exists for agent {config_data.agent_code} on date {config_data.config_date}"
            )
        
        config_dict = config_data.dict()
        config_dict["date"] = config_dict.pop("config_date")  # Map config_date to date
        config_dict["created_by"] = current_user["user_id"]
        
        agent_config = CutPayAgentConfig(**config_dict)
        db.add(agent_config)
        await db.commit()
        await db.refresh(agent_config)
        
        logger.info(f"Created agent config {agent_config.id} for agent {config_data.agent_code}")
        return CutPayAgentConfigResponse.model_validate(agent_config)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create agent config: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create agent configuration: {str(e)}"
        )

@router.get("/agent-config/agent/{agent_code}/po-paid", response_model=AgentPOResponse)
async def get_agent_po_paid(
    agent_code: str,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
    _rbac_check = Depends(require_admin_cutpay)
):
    """Get total PO paid amount for a specific agent"""
    try:
        # Get all configurations for the agent
        result = await db.execute(
            select(CutPayAgentConfig).where(CutPayAgentConfig.agent_code == agent_code)
        )
        configs = result.scalars().all()
        
        if not configs:
            return AgentPOResponse(
                agent_code=agent_code,
                total_po_paid=0.0,
                latest_config_date=None,
                configurations_count=0
            )
        
        total_po_paid = sum(float(config.po_paid_to_agent) for config in configs)
        latest_config_date = max(config.date for config in configs)
        
        return AgentPOResponse(
            agent_code=agent_code,
            total_po_paid=total_po_paid,
            latest_config_date=latest_config_date,
            configurations_count=len(configs)
        )
        
    except Exception as e:
        logger.error(f"Failed to get PO paid for agent {agent_code}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch agent PO data: {str(e)}"
        )

@router.get("/agent-config/{config_id}", response_model=CutPayAgentConfigResponse)
async def get_agent_config(
    config_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
    _rbac_check = Depends(require_admin_cutpay)
):
    """Get specific agent configuration by ID"""
    result = await db.execute(select(CutPayAgentConfig).where(CutPayAgentConfig.id == config_id))
    config = result.scalar_one_or_none()
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Agent configuration {config_id} not found"
        )
    
    return CutPayAgentConfigResponse.model_validate(config)

@router.put("/agent-config/{config_id}", response_model=CutPayAgentConfigResponse)
async def update_agent_config(
    config_id: int,
    config_data: CutPayAgentConfigUpdate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
    _rbac_check = Depends(require_admin_cutpay)
):
    """Update agent configuration"""
    try:
        result = await db.execute(select(CutPayAgentConfig).where(CutPayAgentConfig.id == config_id))
        config = result.scalar_one_or_none()
        
        if not config:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Agent configuration {config_id} not found"
            )
        
        update_data = config_data.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(config, field, value)
        
        await db.commit()
        await db.refresh(config)
        
        logger.info(f"Updated agent config {config_id}")
        return CutPayAgentConfigResponse.model_validate(config)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update agent config {config_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update agent configuration: {str(e)}"
        )

@router.delete("/agent-config/{config_id}")
async def delete_agent_config(
    config_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
    _rbac_check = Depends(require_admin_cutpay)
):
    """Delete agent configuration"""
    result = await db.execute(select(CutPayAgentConfig).where(CutPayAgentConfig.id == config_id))
    config = result.scalar_one_or_none()
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Agent configuration {config_id} not found"
        )
    
    await db.delete(config)
    await db.commit()
    
    logger.info(f"Deleted agent config {config_id}")
    return {"message": f"Agent configuration {config_id} deleted successfully"}
