"""
CutPay Router - Comprehensive API endpoints for CutPay flow
Implements all endpoints as described in CUTPAY_FLOW_DETAILED_README.md
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
from sqlalchemy.orm import selectinload
from typing import Optional, List, Dict, Any
from datetime import date, datetime
from uuid import UUID
import logging
import io
import csv
import traceback
import uuid
import os

from config import get_db, get_supabase_admin_client
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
    PostCutPayDetails,
    BulkPostCutPayRequest,
    BulkPostCutPayResponse,
    CutPayAgentConfigCreate,
    CutPayAgentConfigUpdate,
    CutPayAgentConfigResponse,
    AgentPOResponse
)
from .cutpay_helpers import (
    calculate_commission_amounts,
    get_dropdown_options,
    get_filtered_dropdowns,
    auto_populate_relationship_data,

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
                # Check if policy number already exists
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
                cutpay_dict.update(cutpay_data.extracted_data.dict(exclude_unset=True))
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

            calc_request = CalculationRequest.model_validate(cutpay, from_attributes=True)
            calculations = await calculate_commission_amounts(calc_request.dict())
            for field, value in calculations.items():
                if hasattr(cutpay, field):
                    setattr(cutpay, field, value)
            
            db.add(cutpay)

        await db.refresh(cutpay)
        logger.info(f"Step 1 SUCCESS: Successfully created CutPay ID {cutpay.id}.")

    except Exception as e:
        logger.critical(f"Step 1 FAILED: Database creation failed. Traceback:\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Failed to create CutPay transaction in the database: {str(e)}")

    sync_results = None
    try:
        logger.info(f"Step 2: Starting Google Sheets sync for new CutPay ID {cutpay.id}.")
        from utils.google_sheets import google_sheets_sync
        
        cutpay_dict = {c.name: getattr(cutpay, c.name) for c in cutpay.__table__.columns}
        for key, value in cutpay_dict.items():
            if isinstance(value, (datetime, date)): cutpay_dict[key] = value.isoformat()
            elif isinstance(value, UUID): cutpay_dict[key] = str(value)

        cutpay_sync_result = await run_in_threadpool(google_sheets_sync.sync_cutpay_to_sheets, cutpay_dict)
        master_sync_result = await run_in_threadpool(google_sheets_sync.sync_to_master_sheet, cutpay_dict)
        sync_results = {"cutpay": cutpay_sync_result, "master": master_sync_result}
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
                
                if sync_results.get("master", {}).get("success"):
                    final_cutpay.master_sheet_row_id = sync_results["master"].get("row_id")
                    final_cutpay.synced_to_master_sheet = True

            await final_db_session.refresh(final_cutpay)
            logger.info(f"Step 3 SUCCESS: Successfully updated sync flags for CutPay ID {final_cutpay.id}.")
            logger.info(f"--- Create for CutPay ID: {cutpay.id} finished successfully. ---")
            return safe_cutpay_response(final_cutpay)
            
    except Exception as e:
        logger.critical(f"Step 3 FAILED: Updating sync flags failed for CutPay ID {cutpay.id}. Traceback:\n{traceback.format_exc()}")
        return safe_cutpay_response(cutpay)

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

@router.get("/export")
async def export_cutpay_data(
    export_request: ExportRequest = Depends(),
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check = Depends(require_admin_cutpay)
):
    """Export CutPay data to CSV or Excel"""
    
    try:
        query = select(CutPay)
        
        if export_request.date_from:
            query = query.where(CutPay.booking_date >= export_request.date_from)
        
        if export_request.date_to:
            query = query.where(CutPay.booking_date <= export_request.date_to)
        
        
        if hasattr(export_request, 'insurer_codes') and export_request.insurer_codes:
            insurer_ids = []
            for code in export_request.insurer_codes:
                try:
                    insurer_id = await resolve_insurer_code_to_id(db, code)
                    insurer_ids.append(insurer_id)
                except HTTPException:
                    continue
            if insurer_ids:
                query = query.where(CutPay.insurer_id.in_(insurer_ids))
        
        if hasattr(export_request, 'broker_codes') and export_request.broker_codes:
            broker_ids = []
            for code in export_request.broker_codes:
                try:
                    broker_id = await resolve_broker_code_to_id(db, code)
                    broker_ids.append(broker_id)
                except HTTPException:
                    continue
            if broker_ids:
                query = query.where(CutPay.broker_id.in_(broker_ids))
        
        result = await db.execute(query)
        transactions = result.scalars().all()
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        writer.writerow(CutPayResponse.model_fields.keys())
        
        for txn in transactions:
            writer.writerow([getattr(txn, field) for field in CutPayResponse.model_fields.keys()])
        
        output.seek(0)
        
        return StreamingResponse(
            output,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=cutpay_export_{date.today()}.csv"}
        )
        
    except Exception as e:
        logger.error(f"Failed to export CutPay data: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to export data: {str(e)}"
        )

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
            select(func.count(CutPay.id)).where(CutPay.synced_to_master_sheet == True)
        ) or 0
        draft_transactions = await db.scalar(
            select(func.count(CutPay.id)).where(CutPay.synced_to_master_sheet == False)
        ) or 0
        
        pending_sync_result = await db.execute(
            select(func.count(CutPay.id)).where(
                (CutPay.synced_to_cutpay_sheet == False) |
                (CutPay.synced_to_master_sheet == False)
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
# POST-CUTPAY DETAILS ENDPOINTS
# =============================================================================

@router.post("/post-details", response_model=BulkPostCutPayResponse)
async def add_bulk_post_cutpay_details(
    request: BulkPostCutPayRequest,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
    _rbac_check = Depends(require_admin_cutpay)
):
    """
    Add post-CutPay details to multiple CutPay transactions in bulk.
    These fields are filled after the initial CutPay creation for tracking
    additional payment information, broker details, and invoice status.
    """
    successful_ids = []
    failed_updates = []
    updated_records = []
    
    logger.info(f"Processing bulk post-CutPay details for {len(request.cutpay_ids)} records")
    
    for cutpay_id in request.cutpay_ids:
        try:
            logger.info(f"Adding post-CutPay details for CutPay ID {cutpay_id}")
            
            # Get the existing CutPay record
            result = await db.execute(select(CutPay).where(CutPay.id == cutpay_id))
            cutpay = result.scalar_one_or_none()
            if not cutpay:
                failed_updates.append({
                    "cutpay_id": cutpay_id,
                    "error": f"CutPay transaction {cutpay_id} not found"
                })
                continue

            # Update the fields with provided values
            update_data = request.details.dict(exclude_unset=True)
            for field, value in update_data.items():
                if hasattr(cutpay, field):
                    setattr(cutpay, field, value)
                    logger.info(f"Set {field} = {value} for CutPay {cutpay_id}")

            # Auto-calculate IZ Total PO% if incoming_grid_percent and extra_grid are available
            if cutpay.incoming_grid_percent is not None and cutpay.extra_grid is not None:
                cutpay.iz_total_po_percent = cutpay.incoming_grid_percent + cutpay.extra_grid
                logger.info(f"Auto-calculated iz_total_po_percent = {cutpay.iz_total_po_percent} for CutPay {cutpay_id}")

            await db.commit()
            await db.refresh(cutpay)

            # Sync to Google Sheets with detailed error handling
            sync_success = False
            try:
                logger.info(f"Syncing post-CutPay details to Google Sheets for CutPay ID {cutpay_id}")
                from utils.google_sheets import google_sheets_sync
                
                cutpay_dict = {c.name: getattr(cutpay, c.name) for c in cutpay.__table__.columns}
                for key, value in cutpay_dict.items():
                    if isinstance(value, (datetime, date)): 
                        cutpay_dict[key] = value.isoformat()
                    elif isinstance(value, UUID): 
                        cutpay_dict[key] = str(value)
                
                # Sync to CutPay sheet
                cutpay_sync_result = await run_in_threadpool(google_sheets_sync.sync_cutpay_to_sheets, cutpay_dict)
                logger.info(f"CutPay sheet sync result for {cutpay_id}: {cutpay_sync_result}")
                
                # Sync to Master sheet
                master_sync_result = await run_in_threadpool(google_sheets_sync.sync_to_master_sheet, cutpay_dict)
                logger.info(f"Master sheet sync result for {cutpay_id}: {master_sync_result}")
                
                # Update sync flags if successful
                if cutpay_sync_result and cutpay_sync_result.get("success"):
                    cutpay.synced_to_cutpay_sheet = True
                    if cutpay_sync_result.get("row_id"):
                        cutpay.cutpay_sheet_row_id = cutpay_sync_result["row_id"]
                
                if master_sync_result and master_sync_result.get("success"):
                    cutpay.synced_to_master_sheet = True
                    if master_sync_result.get("row_id"):
                        cutpay.master_sheet_row_id = master_sync_result["row_id"]
                
                # Commit sync flag updates
                await db.commit()
                await db.refresh(cutpay)
                
                sync_success = True
                logger.info(f"Successfully synced post-CutPay details to Google Sheets for CutPay {cutpay_id}")
                
            except Exception as sync_error:
                logger.error(f"Google Sheets sync failed for post-CutPay details CutPay {cutpay_id}: {str(sync_error)}")
                logger.error(f"Sync error details: {traceback.format_exc()}")
                # Don't fail the whole operation for sync errors, but log detailed info

            successful_ids.append(cutpay_id)
            updated_records.append(safe_cutpay_response(cutpay))
            logger.info(f"Successfully added post-CutPay details for CutPay ID {cutpay_id}")
            
        except Exception as e:
            logger.error(f"Failed to add post-CutPay details for CutPay {cutpay_id}: {str(e)}")
            failed_updates.append({
                "cutpay_id": cutpay_id,
                "error": str(e)
            })
            continue
    
    logger.info(f"Bulk post-CutPay details operation completed. Success: {len(successful_ids)}, Failed: {len(failed_updates)}")
    
    return BulkPostCutPayResponse(
        success_count=len(successful_ids),
        failed_count=len(failed_updates),
        successful_ids=successful_ids,
        failed_updates=failed_updates,
        updated_records=updated_records
    )

@router.put("/post-details", response_model=BulkPostCutPayResponse)
async def update_bulk_post_cutpay_details(
    request: BulkPostCutPayRequest,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
    _rbac_check = Depends(require_admin_cutpay)
):
    """
    Update post-CutPay details for multiple CutPay transactions in bulk.
    Allows modification of payment tracking fields, broker information, and invoice status.
    """
    successful_ids = []
    failed_updates = []
    updated_records = []
    
    logger.info(f"Processing bulk post-CutPay details update for {len(request.cutpay_ids)} records")
    
    for cutpay_id in request.cutpay_ids:
        try:
            logger.info(f"Updating post-CutPay details for CutPay ID {cutpay_id}")
            
            # Get the existing CutPay record
            result = await db.execute(select(CutPay).where(CutPay.id == cutpay_id))
            cutpay = result.scalar_one_or_none()
            if not cutpay:
                failed_updates.append({
                    "cutpay_id": cutpay_id,
                    "error": f"CutPay transaction {cutpay_id} not found"
                })
                continue

            # Update the fields with provided values
            update_data = request.details.dict(exclude_unset=True)
            for field, value in update_data.items():
                if hasattr(cutpay, field):
                    old_value = getattr(cutpay, field)
                    setattr(cutpay, field, value)
                    logger.info(f"Updated {field}: {old_value} -> {value} for CutPay {cutpay_id}")

            # Auto-calculate IZ Total PO% if incoming_grid_percent and extra_grid are available
            if cutpay.incoming_grid_percent is not None and cutpay.extra_grid is not None:
                cutpay.iz_total_po_percent = cutpay.incoming_grid_percent + cutpay.extra_grid
                logger.info(f"Auto-calculated iz_total_po_percent = {cutpay.iz_total_po_percent} for CutPay {cutpay_id}")

            await db.commit()
            await db.refresh(cutpay)

            # Sync to Google Sheets with detailed error handling
            sync_success = False
            try:
                logger.info(f"Syncing updated post-CutPay details to Google Sheets for CutPay ID {cutpay_id}")
                from utils.google_sheets import google_sheets_sync
                
                cutpay_dict = {c.name: getattr(cutpay, c.name) for c in cutpay.__table__.columns}
                for key, value in cutpay_dict.items():
                    if isinstance(value, (datetime, date)): 
                        cutpay_dict[key] = value.isoformat()
                    elif isinstance(value, UUID): 
                        cutpay_dict[key] = str(value)
                
                # Sync to CutPay sheet
                cutpay_sync_result = await run_in_threadpool(google_sheets_sync.sync_cutpay_to_sheets, cutpay_dict)
                logger.info(f"CutPay sheet sync result for {cutpay_id}: {cutpay_sync_result}")
                
                # Sync to Master sheet
                master_sync_result = await run_in_threadpool(google_sheets_sync.sync_to_master_sheet, cutpay_dict)
                logger.info(f"Master sheet sync result for {cutpay_id}: {master_sync_result}")
                
                # Update sync flags if successful
                if cutpay_sync_result and cutpay_sync_result.get("success"):
                    cutpay.synced_to_cutpay_sheet = True
                    if cutpay_sync_result.get("row_id"):
                        cutpay.cutpay_sheet_row_id = cutpay_sync_result["row_id"]
                
                if master_sync_result and master_sync_result.get("success"):
                    cutpay.synced_to_master_sheet = True
                    if master_sync_result.get("row_id"):
                        cutpay.master_sheet_row_id = master_sync_result["row_id"]
                
                # Commit sync flag updates
                await db.commit()
                await db.refresh(cutpay)
                
                sync_success = True
                logger.info(f"Successfully synced updated post-CutPay details to Google Sheets for CutPay {cutpay_id}")
                
            except Exception as sync_error:
                logger.error(f"Google Sheets sync failed for updated post-CutPay details CutPay {cutpay_id}: {str(sync_error)}")
                logger.error(f"Sync error details: {traceback.format_exc()}")
                # Don't fail the whole operation for sync errors, but log detailed info

            successful_ids.append(cutpay_id)
            updated_records.append(safe_cutpay_response(cutpay))
            logger.info(f"Successfully updated post-CutPay details for CutPay ID {cutpay_id}")
            
        except Exception as e:
            logger.error(f"Failed to update post-CutPay details for CutPay {cutpay_id}: {str(e)}")
            failed_updates.append({
                "cutpay_id": cutpay_id,
                "error": str(e)
            })
            continue
    
    logger.info(f"Bulk post-CutPay details update completed. Success: {len(successful_ids)}, Failed: {len(failed_updates)}")
    
    return BulkPostCutPayResponse(
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
            from utils.google_sheets import google_sheets_sync
            
            cutpay_sync_result = await run_in_threadpool(google_sheets_sync.sync_cutpay_to_sheets, cutpay_dict)
            master_sync_result = await run_in_threadpool(google_sheets_sync.sync_to_master_sheet, cutpay_dict)
            
            # Update sync flags
            if cutpay_sync_result and cutpay_sync_result.get("success"):
                cutpay.synced_to_cutpay_sheet = True
                if cutpay_sync_result.get("row_id"):
                    cutpay.cutpay_sheet_row_id = cutpay_sync_result["row_id"]
            
            if master_sync_result and master_sync_result.get("success"):
                cutpay.synced_to_master_sheet = True
                if master_sync_result.get("row_id"):
                    cutpay.master_sheet_row_id = master_sync_result["row_id"]
            
            await db.commit()
            
            sync_results.append({
                "cutpay_id": cutpay_id,
                "success": True,
                "cutpay_sheet_sync": cutpay_sync_result,
                "master_sheet_sync": master_sync_result
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

            # Recalculate if needed
            recalculation_fields = [
                "gross_premium", "net_premium", "od_premium", "tp_premium", "commissionable_premium",
                "incoming_grid_perc", "agent_commission_perc", "extra_grid_perc", "agent_extra_perc"
            ]
            if any(field in update_data for field in recalculation_fields):
                calc_request = CalculationRequest.model_validate(cutpay, from_attributes=True)
                calculations = await calculate_commission_amounts(calc_request.dict())
                for field, value in calculations.items():
                    if hasattr(cutpay, field):
                        setattr(cutpay, field, value)
                        
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
        from utils.google_sheets import google_sheets_sync
        
        cutpay_dict = {c.name: getattr(cutpay, c.name) for c in cutpay.__table__.columns}
        for key, value in cutpay_dict.items():
            if isinstance(value, (datetime, date)): cutpay_dict[key] = value.isoformat()
            elif isinstance(value, UUID): cutpay_dict[key] = str(value)

        cutpay_sync_result = await run_in_threadpool(google_sheets_sync.sync_cutpay_to_sheets, cutpay_dict)
        master_sync_result = await run_in_threadpool(google_sheets_sync.sync_to_master_sheet, cutpay_dict)
        sync_results = {"cutpay": cutpay_sync_result, "master": master_sync_result}
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
                
                if sync_results.get("master", {}).get("success"):
                    final_cutpay.master_sheet_row_id = sync_results["master"].get("row_id")
                    final_cutpay.synced_to_master_sheet = True

            await final_db_session.refresh(final_cutpay)
            logger.info(f"Step 3 SUCCESS: Successfully updated sync flags for CutPay ID {final_cutpay.id}.")
            logger.info(f"--- Update for CutPay ID: {cutpay.id} finished successfully. ---")
            return safe_cutpay_response(final_cutpay)
            
    except Exception as e:
        logger.critical(f"Step 3 FAILED: Updating sync flags failed for CutPay ID {cutpay.id}. Traceback:\n{traceback.format_exc()}")
        return safe_cutpay_response(cutpay)

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

    if cutpay.synced_to_master_sheet:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete CutPay transaction that has been synced to Master Sheet"
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
    file: UploadFile = File(...),
    document_type: str = Form("policy_pdf"),
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
        
        if not file.filename.lower().endswith('.pdf'):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only PDF files are supported"
            )

        file_content = await file.read()
        if len(file_content) > 10 * 1024 * 1024: 
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File size must be less than 10MB"
            )

        try:
            supabase_client = get_supabase_admin_client()
            bucket_name = os.getenv("SUPABASE_STORAGE_BUCKET", "insurezeal")

            file_extension = os.path.splitext(file.filename)[1] if file.filename else '.pdf'
            unique_filename = f"cutpay/{cutpay_id}/{uuid.uuid4()}{file_extension}"

            response = supabase_client.storage.from_(bucket_name).upload(
                path=unique_filename,
                file=file_content,
                file_options={"content-type": "application/pdf"}
            )
            
            if hasattr(response, 'error') and response.error:
                logger.error(f"Supabase upload error: {response.error}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to upload PDF to storage"
                )
            document_url = supabase_client.storage.from_(bucket_name).get_public_url(unique_filename)
            
        except HTTPException:
            raise
        except Exception as upload_error:
            logger.error(f"Upload error: {str(upload_error)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to upload PDF: {str(upload_error)}"
            )

        if document_type == "policy_pdf":
            cutpay.policy_pdf_url = document_url
        else:
            if not cutpay.additional_documents:
                cutpay.additional_documents = {}
            cutpay.additional_documents[document_type] = document_url
        
        await db.commit()
        
        logger.info(f"Uploaded {document_type} for CutPay {cutpay_id}")
        
        return DocumentUploadResponse(
            document_url=document_url,
            document_type=document_type,
            upload_status="success",
            message=f"Document uploaded successfully"
        )
        
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
