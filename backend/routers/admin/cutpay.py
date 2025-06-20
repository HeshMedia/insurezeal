from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from config import get_db
from routers.auth.auth import get_current_user
from dependencies.rbac import (
    require_admin_cutpay, 
    require_admin_cutpay_write,
    require_admin_cutpay_update,
    require_admin_cutpay_delete
)
from .cutpay_schemas import (
    CutPayCreate, 
    CutPayResponse, 
    CutPayUpdate,
    CutPayListResponse,
    CutPaySummary,
    CutPayStatsResponse
)
from .cutpay_helpers import CutPayHelpers
from .helpers import AdminHelpers
from utils.google_sheets import google_sheets_sync
from typing import Optional
from datetime import date
import logging
import io
import csv

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/cutpay")

cutpay_helpers = CutPayHelpers()
admin_helpers = AdminHelpers()

@router.post("/", response_model=CutPayResponse)
async def create_cutpay_transaction(
    cutpay_data: CutPayCreate,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check = Depends(require_admin_cutpay_write)
):
    """
    Create a new cut pay transaction
    
    **Admin only endpoint**
    
    Creates a new cut pay transaction with all the required financial and payment details.
    """
    
    try:
        cutpay = await cutpay_helpers.create_cutpay_transaction(
            db, cutpay_data, current_user["supabase_user"].id
        )
          # Sync to Google Sheets
        try:
            # Convert SQLAlchemy model to dict for Google Sheets sync
            cutpay_dict = {
                'id': cutpay.id,
                'policy_number': cutpay.policy_number,
                'agent_code': cutpay.agent_code,
                'insurance_company': cutpay.insurance_company,
                'broker': cutpay.broker,
                'gross_amount': cutpay.gross_amount,
                'net_premium': cutpay.net_premium,
                'commission_grid': cutpay.commission_grid,
                'agent_commission_given_percent': cutpay.agent_commission_given_percent,
                'cut_pay_amount': cutpay.cut_pay_amount,
                'payment_by': cutpay.payment_by,
                'amount_received': cutpay.amount_received,
                'payment_method': cutpay.payment_method,
                'payment_source': cutpay.payment_source,
                'transaction_date': cutpay.transaction_date,
                'payment_date': cutpay.payment_date,
                'notes': cutpay.notes,
                'created_at': cutpay.created_at,
                'updated_at': cutpay.updated_at
            }
            google_sheets_sync.sync_cutpay_transaction(cutpay_dict)
            logger.info(f"Cut pay transaction {cutpay.id} synced to Google Sheets")
        except Exception as sync_error:
            logger.error(f"Failed to sync cut pay transaction {cutpay.id} to Google Sheets: {str(sync_error)}")
            # Don't fail the main operation if Google Sheets sync fails
        
        return CutPayResponse.model_validate(cutpay)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in create_cutpay_transaction: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create cut pay transaction"
        )

@router.get("/", response_model=CutPayListResponse)
async def list_cutpay_transactions(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),    search: Optional[str] = Query(None, description="Search by policy number"),
    agent_code: Optional[str] = Query(None, description="Filter by agent code"),
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check = Depends(require_admin_cutpay)
):    
    """
    Get all cut pay transactions with pagination and filters
    
    **Admin only endpoint**
    
    - **page**: Page number (default: 1)
    - **page_size**: Number of items per page (default: 20, max: 100)    - **search**: Optional search term for policy number
    - **agent_code**: Filter by agent code
    
    Returns paginated list of cut pay transaction summaries (card view).
    Use GET /admin/cutpay/{cutpay_id} to get full details of a specific transaction.
    """
    
    try:
        transactions_data = await cutpay_helpers.get_all_cutpay_transactions(
            db, page, page_size, search, agent_code
        )
        
        return CutPayListResponse(
            transactions=[CutPaySummary.model_validate(t) for t in transactions_data["transactions"]],
            total_count=transactions_data["total_count"],
            page=transactions_data["page"],
            page_size=transactions_data["page_size"]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in list_cutpay_transactions: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch cut pay transactions"
        )

@router.get("/stats", response_model=CutPayStatsResponse)
async def get_cutpay_statistics(
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check = Depends(require_admin_cutpay)
):
    """
    Get comprehensive cut pay statistics
    
    **Admin only endpoint**
    
    Returns detailed statistics including:
    - Total transactions and amounts
    - Monthly breakdown
    - Top agents by cut pay amount    - Payment status breakdown
    """
    
    try:
        stats_data = await cutpay_helpers.get_cutpay_statistics(db)
        return CutPayStatsResponse.model_validate(stats_data)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_cutpay_statistics: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch cut pay statistics"
        )

@router.get("/export/csv")
async def export_cutpay_transactions_csv(
    start_date: Optional[date] = Query(None, description="Start date for filtering (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date for filtering (YYYY-MM-DD)"),
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check = Depends(require_admin_cutpay)
):
    """    Export cut pay transactions to CSV
    
    **Admin only endpoint**
    
    - **start_date**: Optional start date for filtering (format: YYYY-MM-DD)
    - **end_date**: Optional end date for filtering (format: YYYY-MM-DD)
    
    Returns a CSV file containing all cut pay transactions.    If no date filters are provided, all transactions are exported.
    """
    
    try:
        csv_content = await cutpay_helpers.export_cutpay_to_csv(
            db, start_date, end_date
        )
        
        filename = "cutpay_transactions"
        if start_date and end_date:
            filename += f"_{start_date}_{end_date}"
        elif start_date:
            filename += f"_from_{start_date}"
        elif end_date:
            filename += f"_until_{end_date}"
        filename += ".csv"
        
        csv_buffer = io.StringIO(csv_content)
        
        return StreamingResponse(
            io.BytesIO(csv_content.encode('utf-8')),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in export_cutpay_transactions_csv: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to export cut pay transactions to CSV"
        )

@router.get("/{cutpay_id}", response_model=CutPayResponse)
async def get_cutpay_transaction(
    cutpay_id: int,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check = Depends(require_admin_cutpay)
):
    """
    Get a specific cut pay transaction by ID
    
    **Admin only endpoint**
    
    - **cutpay_id**: The ID of the cut pay transaction to retrieve
      Returns detailed information about the cut pay transaction.
    """
    
    try:
        cutpay = await cutpay_helpers.get_cutpay_by_id(db, cutpay_id)
        if not cutpay:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cut pay transaction not found"
            )
        
        return CutPayResponse.model_validate(cutpay)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_cutpay_transaction: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch cut pay transaction"
        )

@router.put("/{cutpay_id}", response_model=CutPayResponse)
async def update_cutpay_transaction(
    cutpay_id: int,
    update_data: CutPayUpdate,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check = Depends(require_admin_cutpay_update)
):
    """
    Update a cut pay transaction
    
    **Admin only endpoint**
    
    - **cutpay_id**: The ID of the cut pay transaction to update
    
    Updates the specified cut pay transaction with the provided data.
    """
    try:
        cutpay = await cutpay_helpers.update_cutpay_transaction(db, cutpay_id, update_data)
        if not cutpay:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cut pay transaction not found"
            )        # Sync to Google Sheets
        try:
            # Convert SQLAlchemy model to dict for Google Sheets sync
            cutpay_dict = {
                'id': cutpay.id,
                'policy_number': cutpay.policy_number,
                'agent_code': cutpay.agent_code,
                'insurance_company': cutpay.insurance_company,
                'broker': cutpay.broker,
                'gross_amount': cutpay.gross_amount,
                'net_premium': cutpay.net_premium,
                'commission_grid': cutpay.commission_grid,
                'agent_commission_given_percent': cutpay.agent_commission_given_percent,
                'cut_pay_amount': cutpay.cut_pay_amount,
                'payment_by': cutpay.payment_by,
                'amount_received': cutpay.amount_received,
                'payment_method': cutpay.payment_method,
                'payment_source': cutpay.payment_source,
                'transaction_date': cutpay.transaction_date,
                'payment_date': cutpay.payment_date,
                'notes': cutpay.notes,
                'created_at': cutpay.created_at,
                'updated_at': cutpay.updated_at
            }
            google_sheets_sync.sync_cutpay_transaction(cutpay_dict, action="UPDATE")
            logger.info(f"Updated cut pay transaction {cutpay.id} synced to Google Sheets")
        except Exception as sync_error:
            logger.error(f"Failed to sync updated cut pay transaction {cutpay.id} to Google Sheets: {str(sync_error)}")
            # Don't fail the main operation if Google Sheets sync fails
        
        return CutPayResponse.model_validate(cutpay)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in update_cutpay_transaction: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update cut pay transaction"
        )

@router.delete("/{cutpay_id}")
async def delete_cutpay_transaction(
    cutpay_id: int,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check = Depends(require_admin_cutpay_delete)
):
    """
    Delete a cut pay transaction
    
    **Admin only endpoint**
    
    - **cutpay_id**: The ID of the cut pay transaction to delete
      Permanently deletes the specified cut pay transaction.
    """
    
    try:
        success = await cutpay_helpers.delete_cutpay_transaction(db, cutpay_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cut pay transaction not found"
            )
        
        return {"message": "Cut pay transaction deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in delete_cutpay_transaction: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete cut pay transaction"
        )


