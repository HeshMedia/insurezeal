from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
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
    CutPayStatsResponse,
    CutPayDocumentUploadResponse,
    CutPayPDFExtraction,
    CutPayCalculationRequest,
    CutPayCalculationResponse,
    CutPayDropdownsResponse
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
    Create a new cut pay transaction with new flow support
    
    **Admin only endpoint**
    
    Creates a new cut pay transaction. Can be created as draft initially and completed later.
    Supports document upload, PDF extraction, manual data entry, and dual Google Sheets sync.
    """
    
    try:
        cutpay = await cutpay_helpers.create_cutpay_transaction(
            db, cutpay_data, current_user["supabase_user"].id
        )

        if cutpay.status == "completed":
            try:
                await sync_cutpay_to_sheets(cutpay)
            except Exception as sync_error:
                logger.error(f"Failed to sync cut pay transaction {cutpay.id} to Google Sheets: {str(sync_error)}")
        
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
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search by policy number or agent code"),
    agent_code: Optional[str] = Query(None, description="Filter by agent code"),
    status_filter: Optional[str] = Query(None, description="Filter by status: draft, completed, cancelled"),
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check = Depends(require_admin_cutpay)
):    
    """
    Get all cut pay transactions with pagination and filters
    
    **Admin only endpoint**
    
    - **page**: Page number (default: 1)
    - **page_size**: Number of items per page (default: 20, max: 100)
    - **search**: Optional search term for policy number or agent code
    - **agent_code**: Filter by agent code
    - **status_filter**: Filter by transaction status (draft, completed, cancelled)
    
    Returns paginated list of cut pay transaction summaries (card view).
    Use GET /admin/cutpay/{cutpay_id} to get full details of a specific transaction.
    """
    
    try:
        transactions_data = await cutpay_helpers.get_all_cutpay_transactions(
            db, page, page_size, search, agent_code, status_filter
        )
        
        transaction_summaries = []
        for t in transactions_data["transactions"]:
            summary_data = {
                "id": t.id,
                "policy_number": t.policy_number,
                "agent_code": t.agent_code,
                "code_type": t.code_type,
                "payment_mode": t.payment_mode,
                "cut_pay_amount": t.cut_pay_amount,
                "amount_received": t.amount_received,
                "transaction_date": t.transaction_date,
                "status": t.status,
                "created_at": t.created_at,
                "insurer_name": t.insurer.name if t.insurer else None,
                "broker_name": t.broker.name if t.broker else None,
                "child_id": t.child_id_request.child_id if t.child_id_request else None
            }
            transaction_summaries.append(CutPaySummary(**summary_data))
        
        return CutPayListResponse(
            transactions=transaction_summaries,
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
            )      
        try:
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

@router.post("/{cutpay_id}/upload-document", response_model=CutPayDocumentUploadResponse)
async def upload_cutpay_document(
    cutpay_id: int,
    file: UploadFile = File(...),
    document_type: str = Query(..., description="Document type: policy_pdf or additional"),
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check = Depends(require_admin_cutpay_write)
):
    """
    Upload document to CutPay transaction
    
    **Admin only endpoint**
    
    Uploads a document to the specified CutPay transaction. For policy PDFs, automatically
    triggers AI extraction to populate policy fields.
    """
    try:
        document_url = f"https://storage.example.com/cutpay/{cutpay_id}/{file.filename}"
        
        extracted_data = None
        if document_type == "policy_pdf" and file.filename.lower().endswith('.pdf'):
            extracted_data = await cutpay_helpers.process_pdf_extraction(
                db, cutpay_id, document_url
            )
        
        return CutPayDocumentUploadResponse(
            success=True,
            message="Document uploaded successfully",
            document_url=document_url,
            extracted_data=extracted_data.model_dump() if extracted_data else None
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading document to cutpay {cutpay_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to upload document"
        )

@router.post("/{cutpay_id}/extract-pdf", response_model=CutPayPDFExtraction)
async def extract_pdf_data(
    cutpay_id: int,
    pdf_url: str = Query(..., description="URL of the PDF to extract data from"),
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check = Depends(require_admin_cutpay_write)
):
    """
    Extract data from policy PDF
    
    **Admin only endpoint**
    
    Processes the policy PDF using AI to extract policy information and updates
    the CutPay transaction with the extracted data.
    """
    try:
        extracted_data = await cutpay_helpers.process_pdf_extraction(
            db, cutpay_id, pdf_url
        )
        return extracted_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error extracting PDF data for cutpay {cutpay_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to extract PDF data"
        )

@router.post("/calculate", response_model=CutPayCalculationResponse)
async def calculate_cutpay_amounts(
    calculation_data: CutPayCalculationRequest,
    current_user = Depends(get_current_user),
    _rbac_check = Depends(require_admin_cutpay)
):
    """
    Calculate CutPay amount and payout
    
    **Admin only endpoint**
    
    Calculates the CutPay amount and payout based on the provided financial parameters.
    Used for real-time calculation in the frontend form.
    """
    try:
        calculation = await cutpay_helpers.calculate_cutpay_amounts(
            gross_amount=calculation_data.gross_amount,
            net_premium=calculation_data.net_premium,
            agent_commission_given_percent=calculation_data.agent_commission_given_percent,
            payment_mode=calculation_data.payment_mode,
            payout_percent=calculation_data.payout_percent
        )
        
        return CutPayCalculationResponse(
            cut_pay_amount=calculation["cut_pay_amount"],
            payout_amount=calculation["payout_amount"],
            calculation_details=calculation["calculation_details"]
        )
        
    except Exception as e:
        logger.error(f"Error calculating cutpay amounts: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to calculate amounts"
        )

@router.get("/dropdowns", response_model=CutPayDropdownsResponse)
async def get_cutpay_dropdowns(
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check = Depends(require_admin_cutpay)
):
    """
    Get dropdown options for CutPay form
    
    **Admin only endpoint**
    
    Returns all available options for dropdowns in the CutPay form:
    - Active insurers
    - Active brokers  
    - Approved child IDs
    """
    try:
        dropdowns = await cutpay_helpers.get_cutpay_dropdowns(db)
        return CutPayDropdownsResponse(**dropdowns)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching cutpay dropdowns: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch dropdown options"
        )

@router.post("/{cutpay_id}/sync-sheets")
async def sync_cutpay_to_google_sheets(
    cutpay_id: int,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check = Depends(require_admin_cutpay_write)
):
    """
    Manually sync CutPay transaction to Google Sheets
    
    **Admin only endpoint**
    
    Syncs the specified CutPay transaction to both CutPay sheet and Master sheet.
    """
    try:
        cutpay = await cutpay_helpers.get_cutpay_by_id(db, cutpay_id)
        if not cutpay:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cut pay transaction not found"
            )
        
        await sync_cutpay_to_sheets(cutpay)
        
        return {"message": "Cut pay transaction synced to Google Sheets successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error syncing cutpay {cutpay_id} to sheets: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to sync to Google Sheets"
        )

async def sync_cutpay_to_sheets(cutpay):
    """Sync CutPay transaction to both CutPay sheet and Master sheet"""
    try:
        cutpay_dict = {
            'id': cutpay.id,
            'policy_number': cutpay.policy_number,
            'agent_code': cutpay.agent_code,
            'code_type': cutpay.code_type,
            'insurer_name': cutpay.insurer.name if cutpay.insurer else '',
            'broker_name': cutpay.broker.name if cutpay.broker else '',
            'child_id': cutpay.child_id_request.child_id if cutpay.child_id_request else '',
            'gross_amount': cutpay.gross_amount,
            'net_premium': cutpay.net_premium,
            'commission_grid': cutpay.commission_grid,
            'agent_commission_given_percent': cutpay.agent_commission_given_percent,
            'cut_pay_amount': cutpay.cut_pay_amount,
            'payment_mode': cutpay.payment_mode,
            'payout_amount': cutpay.payout_amount,
            'payment_by': cutpay.payment_by,
            'amount_received': cutpay.amount_received,
            'payment_method': cutpay.payment_method,
            'payment_source': cutpay.payment_source,
            'transaction_date': cutpay.transaction_date,
            'payment_date': cutpay.payment_date,
            'status': cutpay.status,
            'notes': cutpay.notes,
            'created_at': cutpay.created_at,
            'updated_at': cutpay.updated_at
        }
        
        if not cutpay.synced_to_cutpay_sheet:
            google_sheets_sync.sync_cutpay_transaction(cutpay_dict)
            cutpay.synced_to_cutpay_sheet = True
            logger.info(f"Cut pay transaction {cutpay.id} synced to CutPay sheet")
        
        if cutpay.status == "completed" and not cutpay.synced_to_master_sheet:
            google_sheets_sync.sync_to_master_sheet(cutpay_dict)
            cutpay.synced_to_master_sheet = True
            logger.info(f"Cut pay transaction {cutpay.id} synced to Master sheet")
            
    except Exception as e:
        logger.error(f"Error syncing CutPay {cutpay.id} to sheets: {str(e)}")
        raise


