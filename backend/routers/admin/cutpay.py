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
from models import CutPay, Insurer, Broker, ChildIdRequest, AdminChildID
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
    DashboardStats
)
from .cutpay_helpers import (
    calculate_commission_amounts,
    get_dropdown_options,
    get_filtered_dropdowns,
    auto_populate_relationship_data,
    sync_cutpay_transaction,
    validate_cutpay_data,
    validate_and_resolve_codes,
    resolve_broker_code_to_id,
    resolve_insurer_code_to_id
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/cutpay", tags=["CutPay"])

# Helper function to safely convert SQLAlchemy object to Pydantic
def safe_cutpay_response(cutpay_obj) -> CutPayResponse:
    """Safely convert SQLAlchemy CutPay object to Pydantic CutPayResponse"""
    try:
        return CutPayResponse.model_validate(cutpay_obj)
    except Exception as e:
        logger.warning(f"model_validate failed, using manual conversion: {str(e)}")
        # Fallback to manual field extraction
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
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check = Depends(require_admin_cutpay)
):
    """
    Create new CutPay transaction
    
    Supports the comprehensive flow with:
    - Document upload fields
    - Extracted data from PDF
    - Admin manual input
    - Auto-calculated fields
    - Relationship auto-population
    """
    try:
        # Validate the data
        validation_errors = validate_cutpay_data(cutpay_data.dict())
        if validation_errors:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"errors": validation_errors}
            )
        
        # Create the CutPay transaction with flattened data
        cutpay_dict = {
            "created_by": current_user["user_id"],
            "status": "completed",  # CutPay transactions are always completed by default
            "policy_pdf_url": cutpay_data.policy_pdf_url,
            "additional_documents": cutpay_data.additional_documents,
            "notes": cutpay_data.notes,
            "claimed_by": cutpay_data.claimed_by,
            "already_given_to_agent": cutpay_data.already_given_to_agent,
            "po_paid_to_agent": cutpay_data.po_paid_to_agent,
            "running_bal": cutpay_data.running_bal,
            "match_status": cutpay_data.match_status,
            "invoice_number": cutpay_data.invoice_number
        }
        
        # Extract and flatten extracted_data fields
        if cutpay_data.extracted_data:
            extracted_fields = cutpay_data.extracted_data.dict(exclude_unset=True)
            cutpay_dict.update(extracted_fields)
        
        # Extract and flatten admin_input fields  
        if cutpay_data.admin_input:
            admin_fields = cutpay_data.admin_input.dict(exclude_unset=True)
            
            # Resolve broker and insurer codes to IDs before storing
            broker_code = admin_fields.pop('broker_code', None)
            insurer_code = admin_fields.pop('insurer_code', None)
            
            if broker_code or insurer_code:
                try:
                    broker_id, insurer_id = await validate_and_resolve_codes(
                        db, broker_code, insurer_code
                    )
                    if broker_id:
                        admin_fields['broker_id'] = broker_id
                    if insurer_id:
                        admin_fields['insurer_id'] = insurer_id
                except HTTPException as e:
                    logger.error(f"Code resolution failed: {e.detail}")
                    raise e

            cutpay_dict.update(admin_fields)
        
        # Extract and flatten calculations fields
        if cutpay_data.calculations:
            calc_fields = cutpay_data.calculations.dict(exclude_unset=True)
            cutpay_dict.update(calc_fields)
        
        # Remove None values to avoid overriding defaults
        cutpay_dict = {k: v for k, v in cutpay_dict.items() if v is not None}
        
        # Check if admin_child_id exists in the database, remove if not
        if cutpay_dict.get('admin_child_id'):
            admin_child_exists_result = await db.execute(
                select(AdminChildID.id).where(AdminChildID.id == cutpay_dict['admin_child_id'])
            )
            if not admin_child_exists_result.scalar_one_or_none():
                logger.warning(f"Admin child ID {cutpay_dict['admin_child_id']} not found, removing from CutPay creation")
                cutpay_dict.pop('admin_child_id', None)
        
        cutpay = CutPay(**cutpay_dict)
        
        # Auto-populate relationship data
        auto_populate_relationship_data(cutpay, db)
        
        # Calculate amounts if sufficient data is provided
        if (cutpay_data.admin_input and cutpay_data.extracted_data and 
            cutpay_data.extracted_data.gross_premium):
            
            calc_request = CalculationRequest(
                gross_premium=cutpay_data.extracted_data.gross_premium,
                net_premium=cutpay_data.extracted_data.net_premium,
                od_premium=cutpay_data.extracted_data.od_premium,
                tp_premium=cutpay_data.extracted_data.tp_premium,
                incoming_grid_percent=cutpay_data.admin_input.incoming_grid_percent,
                extra_grid=cutpay_data.admin_input.extra_grid,
                commissionable_premium=cutpay_data.admin_input.commissionable_premium,
                agent_commission_given_percent=cutpay_data.admin_input.agent_commission_given_percent,
                agent_extra_percent=cutpay_data.admin_input.agent_extra_percent,
                payment_by=cutpay_data.admin_input.payment_by,
                payout_on=cutpay_data.admin_input.payout_on
            )
            
            calculations = await calculate_commission_amounts(calc_request.dict())
            
            # Update calculated fields
            cutpay.receivable_from_broker = calculations['receivable_from_broker']
            cutpay.extra_amount_receivable_from_broker = calculations['extra_amount_receivable_from_broker']
            cutpay.total_receivable_from_broker = calculations['total_receivable_from_broker']
            cutpay.total_receivable_from_broker_with_gst = calculations['total_receivable_from_broker_with_gst']
            cutpay.cut_pay_amount = calculations['cut_pay_amount']
            cutpay.agent_po_amt = calculations['agent_po_amt']
            cutpay.agent_extra_amount = calculations.get('agent_extra_amount', 0)
            cutpay.total_agent_po_amt = calculations['total_agent_po_amt']
        
        db.add(cutpay)
        await db.commit()
        await db.refresh(cutpay)

        # Convert to Pydantic model safely
        cutpay_response = safe_cutpay_response(cutpay)

        # Auto-sync to Google Sheets after successful creation
        try:
            from utils.google_sheets import google_sheets_sync
            
            # Always sync to both CutPay and Master sheets since CutPay transactions are always completed
            await google_sheets_sync.sync_cutpay_to_sheets(cutpay)
            cutpay.synced_to_cutpay_sheet = True
            
            await google_sheets_sync.sync_to_master_sheet(cutpay)
            cutpay.synced_to_master_sheet = True
            
            # Update sync status in database
            await db.commit()
            logger.info(f"Auto-synced CutPay {cutpay.id} to both CutPay and Master Google Sheets")
            
        except Exception as sync_error:
            # Log sync error but don't fail the entire creation
            logger.error(f"Auto-sync failed for CutPay {cutpay.id}: {str(sync_error)}")
            # Don't raise exception here as the transaction was created successfully

        logger.info(f"Created CutPay transaction {cutpay.id} by user {current_user['user_id']}")
        return cutpay_response
        
    except HTTPException:
        # Let FastAPI handle HTTPExceptions (like your 400 validation error)
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Failed to create CutPay transaction: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create transaction: {str(e)}"
        )

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
        
        # Apply filters (removed status filter since all CutPay are completed)
        if insurer_code:
            # Resolve insurer code to ID for filtering
            insurer_id = await resolve_insurer_code_to_id(db, insurer_code)
            query = query.where(CutPay.insurer_id == insurer_id)
            
        if broker_code:
            # Resolve broker code to ID for filtering
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
        
        # Order by created_at desc and apply pagination
        query = query.order_by(desc(CutPay.created_at)).offset(skip).limit(limit)
        result = await db.execute(query)
        transactions = result.scalars().all()
        
        # Convert each transaction to Pydantic model to avoid lazy loading issues
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
        # Resolve codes to IDs for internal filtering
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
        
        # Apply filters
        if export_request.date_from:
            query = query.where(CutPay.booking_date >= export_request.date_from)
        
        if export_request.date_to:
            query = query.where(CutPay.booking_date <= export_request.date_to)
        
        # Remove status filter since all CutPay are completed
        
        if hasattr(export_request, 'insurer_codes') and export_request.insurer_codes:
            # Resolve insurer codes to IDs for filtering
            insurer_ids = []
            for code in export_request.insurer_codes:
                try:
                    insurer_id = await resolve_insurer_code_to_id(db, code)
                    insurer_ids.append(insurer_id)
                except HTTPException:
                    # Skip invalid codes
                    continue
            if insurer_ids:
                query = query.where(CutPay.insurer_id.in_(insurer_ids))
        
        result = await db.execute(query)
        transactions = result.scalars().all()
        
        # Generate CSV content
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write headers
        headers = [
            "ID", "Policy Number", "Customer Name", "Reporting Month", "Booking Date",
            "Agent Code", "Code Type", "Insurer Name", "Broker Name", "Major Categorisation",
            "Product Type", "Gross Premium", "Net Premium", "OD Premium", "TP Premium",
            "Incoming Grid %", "Agent Commission %", "CutPay Amount", "Agent Payout"
        ]
        writer.writerow(headers)
        
        # Write data
        for txn in transactions:
            row = [
                txn.id, txn.policy_number or '', txn.customer_name or '', txn.reporting_month or '',
                txn.booking_date or '', txn.agent_code or '', txn.code_type or '', 
                txn.insurer_name or '', txn.broker_name or '', txn.major_categorisation or '', 
                txn.product_type or '', txn.gross_premium or 0, txn.net_premium or 0, 
                txn.od_premium or 0, txn.tp_premium or 0, txn.incoming_grid_percent or 0,
                txn.agent_commission_given_percent or 0, txn.cut_pay_amount or 0, 
                txn.total_agent_po_amt or 0
            ]
            writer.writerow(row)
        
        output.seek(0)
        
        # Return as streaming response
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode()),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=cutpay_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"}
        )
        
    except Exception as e:
        logger.error(f"Export failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Export failed: {str(e)}"
        )

@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_statistics(
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check = Depends(require_admin_cutpay)
):
    """Get dashboard statistics for CutPay overview"""
    
    try:
        # Basic counts (all CutPay transactions are completed)
        total_result = await db.execute(select(func.count(CutPay.id)))
        total_transactions = total_result.scalar()
        
        # All transactions are completed, so completed = total
        completed_transactions = total_transactions
        draft_transactions = 0  # No drafts in CutPay
        
        # Financial totals
        cutpay_sum_result = await db.execute(select(func.coalesce(func.sum(CutPay.cut_pay_amount), 0)))
        total_cut_pay = cutpay_sum_result.scalar() or 0
        
        agent_sum_result = await db.execute(select(func.coalesce(func.sum(CutPay.total_agent_po_amt), 0)))
        total_agent_payouts = agent_sum_result.scalar() or 0
        
        commission_sum_result = await db.execute(select(func.coalesce(func.sum(CutPay.total_receivable_from_broker), 0)))
        total_commission = commission_sum_result.scalar() or 0
        
        # Pending sync count (simplified since all are completed)
        pending_sync_result = await db.execute(
            select(func.count(CutPay.id)).where(
                (CutPay.synced_to_cutpay_sheet == False) |
                (CutPay.synced_to_master_sheet == False)
            )
        )
        pending_sync = pending_sync_result.scalar()
        
        # TODO: Implement monthly stats, top agents, top insurers
        monthly_stats = {}
        top_agents = []
        top_insurers = []
        
        return DashboardStats(
            total_transactions=total_transactions,
            completed_transactions=completed_transactions,
            draft_transactions=draft_transactions,
            total_cut_pay_amount=float(total_cut_pay),
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
# SPECIFIC CUTPAY TRANSACTION ENDPOINTS (parameterized routes)
# =============================================================================

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
    
    # Refresh the object to ensure all attributes are loaded
    await db.refresh(cutpay)
    return safe_cutpay_response(cutpay)

@router.put("/{cutpay_id}", response_model=CutPayResponse)
async def update_cutpay_transaction(
    cutpay_id: int,
    cutpay_data: CutPayUpdate,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check = Depends(require_admin_cutpay)
):
    """
    Update CutPay transaction with recalculation
    
    Automatically recalculates amounts when relevant fields are updated
    Auto-populates relationship data when IDs are changed
    """
    try:
        result = await db.execute(select(CutPay).where(CutPay.id == cutpay_id))
        cutpay = result.scalar_one_or_none()
        if not cutpay:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"CutPay transaction {cutpay_id} not found"
            )
        
        # Validate update data
        validation_errors = validate_cutpay_data(cutpay_data.dict(exclude_unset=True))
        if validation_errors:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"errors": validation_errors}
            )
        
        # Update fields
        update_data = cutpay_data.dict(exclude_unset=True)
        
        # Remove status from update data since CutPay transactions are always completed
        update_data.pop('status', None)
        
        # Handle broker and insurer code resolution
        broker_code = update_data.pop('broker_code', None)
        insurer_code = update_data.pop('insurer_code', None)
        
        if broker_code or insurer_code:
            try:
                broker_id, insurer_id = await validate_and_resolve_codes(
                    db, broker_code, insurer_code
                )
                if broker_id:
                    update_data['broker_id'] = broker_id
                if insurer_id:
                    update_data['insurer_id'] = insurer_id
            except HTTPException as e:
                logger.error(f"Code resolution failed during update: {e.detail}")
                raise e
        
        # Remove child_id_request_id if it doesn't exist in the database
        if update_data.get('child_id_request_id'):
            child_id_exists_result = await db.execute(
                select(ChildIdRequest.id).where(ChildIdRequest.id == update_data['child_id_request_id'])
            )
            if not child_id_exists_result.scalar_one_or_none():
                logger.warning(f"Child ID request {update_data['child_id_request_id']} not found, removing from update")
                update_data.pop('child_id_request_id', None)
        
        # Remove admin_child_id if it doesn't exist in the database
        if update_data.get('admin_child_id'):
            admin_child_exists_result = await db.execute(
                select(AdminChildID.id).where(AdminChildID.id == update_data['admin_child_id'])
            )
            if not admin_child_exists_result.scalar_one_or_none():
                logger.warning(f"Admin child ID {update_data['admin_child_id']} not found, removing from update")
                update_data.pop('admin_child_id', None)
        
        for field, value in update_data.items():
            if hasattr(cutpay, field):
                setattr(cutpay, field, value)
        
        # Auto-populate relationship data if IDs changed
        if any(field in update_data for field in ["insurer_id", "broker_id", "code_type"]):
            auto_populate_relationship_data(cutpay, db)
        
        # Recalculate amounts if relevant fields changed
        calculation_fields = [
            "gross_premium", "net_premium", "od_premium", "tp_premium",
            "incoming_grid_percent", "agent_commission_given_percent", "extra_grid",
            "commissionable_premium", "agent_extra_percent", "payment_by", "payout_on"
        ]
        
        if any(field in update_data for field in calculation_fields):
            calc_request = CalculationRequest(
                gross_premium=cutpay.gross_premium,
                net_premium=cutpay.net_premium,
                od_premium=cutpay.od_premium,
                tp_premium=cutpay.tp_premium,
                incoming_grid_percent=cutpay.incoming_grid_percent,
                extra_grid=cutpay.extra_grid,
                commissionable_premium=cutpay.commissionable_premium,
                agent_commission_given_percent=cutpay.agent_commission_given_percent,
                agent_extra_percent=cutpay.agent_extra_percent,
                payment_by=cutpay.payment_by,
                payout_on=cutpay.payout_on
            )
            
            calculations = await calculate_commission_amounts(calc_request.dict())
            
            # Update calculated fields
            cutpay.receivable_from_broker = calculations['receivable_from_broker']
            cutpay.extra_amount_receivable_from_broker = calculations['extra_amount_receivable_from_broker']
            cutpay.total_receivable_from_broker = calculations['total_receivable_from_broker']
            cutpay.total_receivable_from_broker_with_gst = calculations['total_receivable_from_broker_with_gst']
            cutpay.cut_pay_amount = calculations['cut_pay_amount']
            cutpay.agent_po_amt = calculations['agent_po_amt']
            cutpay.agent_extra_amount = calculations.get('agent_extra_amount', 0)
            cutpay.total_agent_po_amt = calculations['total_agent_po_amt']
        
        await db.commit()
        await db.refresh(cutpay)
        
        # Convert to Pydantic model immediately after refresh to avoid lazy loading issues
        cutpay_response = safe_cutpay_response(cutpay)
        
        # Auto-sync to Google Sheets if significant changes occurred
        try:
            from utils.google_sheets import google_sheets_sync
            
            # Re-sync to both CutPay and Master sheets if any data changed (since all CutPay are completed)
            if update_data:
                await google_sheets_sync.sync_cutpay_to_sheets(cutpay)
                cutpay.synced_to_cutpay_sheet = True
                
                await google_sheets_sync.sync_to_master_sheet(cutpay)
                cutpay.synced_to_master_sheet = True
                
                # Update sync status
                await db.commit()
                logger.info(f"Auto-synced updated CutPay {cutpay_id} to both CutPay and Master Google Sheets")
                
        except Exception as sync_error:
            # Log sync error but don't fail the entire update
            logger.error(f"Auto-sync failed for updated CutPay {cutpay_id}: {str(sync_error)}")
        
        logger.info(f"Updated CutPay transaction {cutpay_id} by user {current_user['user_id']}")
        return cutpay_response
        
    except Exception as e:
        await db.rollback()
        logger.error(f"Failed to update CutPay transaction {cutpay_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update transaction: {str(e)}"
        )

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
    
    # Check if transaction can be deleted (business rules)
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
        
        # Validate file type
        if not file.filename.lower().endswith('.pdf'):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only PDF files are supported"
            )
        
        # Validate file size (max 10MB for PDFs)
        file_content = await file.read()
        if len(file_content) > 10 * 1024 * 1024:  # 10MB
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File size must be less than 10MB"
            )
        
        # Upload to Supabase Storage
        try:
            supabase_client = get_supabase_admin_client()
            bucket_name = os.getenv("SUPABASE_STORAGE_BUCKET", "insurezeal")
            
            # Generate unique filename
            file_extension = os.path.splitext(file.filename)[1] if file.filename else '.pdf'
            unique_filename = f"cutpay/{cutpay_id}/{uuid.uuid4()}{file_extension}"
            
            # Upload to Supabase
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
            
            # Get public URL
            document_url = supabase_client.storage.from_(bucket_name).get_public_url(unique_filename)
            
        except HTTPException:
            raise
        except Exception as upload_error:
            logger.error(f"Upload error: {str(upload_error)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to upload PDF: {str(upload_error)}"
            )
        
        # Update CutPay record with document URL
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

@router.post("/{cutpay_id}/extract-pdf", response_model=ExtractionResponse)
async def extract_pdf_data_endpoint(
    cutpay_id: int,
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
        # Verify CutPay record exists
        result = await db.execute(select(CutPay).where(CutPay.id == cutpay_id))
        cutpay = result.scalar_one_or_none()
        if not cutpay:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"CutPay transaction {cutpay_id} not found"
            )
        
        # Validate uploaded file
        if not file.filename or not file.filename.lower().endswith('.pdf'):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Please upload a valid PDF file"
            )
        
        # Read PDF bytes directly (stateless approach)
        logger.info(f"Starting stateless PDF extraction for CutPay {cutpay_id}")
        pdf_bytes = await file.read()
        
        if len(pdf_bytes) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file is empty"
            )
        
        # Extract data using the new stateless utility
        from utils.ai_utils import extract_policy_data_from_pdf_bytes
        extracted_data_dict = await extract_policy_data_from_pdf_bytes(pdf_bytes)
        
        if not extracted_data_dict:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to extract data from PDF. Please ensure the PDF contains readable policy information."
            )
        
        # Convert to Pydantic model for validation
        extracted_data = ExtractedPolicyData(**extracted_data_dict)
        
        # Update CutPay record with extracted data
        for field, value in extracted_data.dict(exclude_unset=True).items():
            if hasattr(cutpay, field) and value is not None:
                setattr(cutpay, field, value)
        
        await db.commit()
        
        # Auto-sync updated extracted data to both CutPay and Master sheets
        try:
            from utils.google_sheets import google_sheets_sync
            await google_sheets_sync.sync_cutpay_to_sheets(cutpay)
            cutpay.synced_to_cutpay_sheet = True
            
            await google_sheets_sync.sync_to_master_sheet(cutpay)
            cutpay.synced_to_master_sheet = True
            
            await db.commit()
            logger.info(f"Auto-synced extracted data for CutPay {cutpay_id} to both CutPay and Master Google Sheets")
        except Exception as sync_error:
            logger.error(f"Auto-sync failed after extraction for CutPay {cutpay_id}: {str(sync_error)}")
        
        logger.info(f"Stateless PDF extraction completed for CutPay {cutpay_id}")
        
        return ExtractionResponse(
            cutpay_id=cutpay_id,
            extraction_status="completed", 
            extracted_data=extracted_data,
            extraction_time=datetime.now()
        )
        
    except Exception as e:
        logger.error(f"PDF extraction failed for CutPay {cutpay_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"PDF extraction failed: {str(e)}"
        )

# =============================================================================
# NOTE: Auto-sync is enabled for all create/update operations
# CutPay transactions are always completed by default (created by admins)
# Both CutPay Sheet and Master Sheet are auto-synced for all transactions
# Manual sync endpoints removed - sync happens automatically
# =============================================================================
