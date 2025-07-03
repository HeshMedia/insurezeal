"""
CutPay Router - Comprehensive API endpoints for CutPay flow
Implements all endpoints as described in CUTPAY_FLOW_DETAILED_README.md
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any
from datetime import date, datetime
from uuid import UUID
import logging
import io
import csv

from config import get_db
from ..auth.auth import get_current_user
from dependencies.rbac import require_admin_cutpay
from models import CutPay, Insurer, Broker, ChildIdRequest
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
    ExtractionRequest,
    ExtractionResponse,
    SyncRequest,
    SyncResponse,
    ExportRequest,
    DashboardStats
)
from .cutpay_helpers import (
    extract_pdf_data,
    calculate_commission_amounts,
    get_dropdown_options,
    get_filtered_dropdowns,
    auto_populate_relationship_data,
    sync_cutpay_transaction,
    validate_cutpay_data
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/cutpay", tags=["CutPay"])

# =============================================================================
# CORE CUTPAY OPERATIONS
# =============================================================================

@router.post("/", response_model=CutPayResponse)
async def create_cutpay_transaction(
    cutpay_data: CutPayCreate,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
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
        
        # Create the CutPay transaction
        cutpay = CutPay(
            **cutpay_data.dict(exclude_unset=True),
            created_by=current_user.id
        )
        
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
            
            calculations = calculate_commission_amounts(calc_request)
            
            # Update calculated fields
            cutpay.receivable_from_broker = calculations.receivable_from_broker
            cutpay.extra_amount_receivable_from_broker = calculations.extra_amount_receivable_from_broker
            cutpay.total_receivable_from_broker = calculations.total_receivable_from_broker
            cutpay.total_receivable_from_broker_with_gst = calculations.total_receivable_from_broker_with_gst
            cutpay.cut_pay_amount = calculations.cut_pay_amount
            cutpay.agent_po_amt = calculations.agent_po_amt
            cutpay.agent_extra_amount = calculations.agent_extra_amount
            cutpay.total_agent_po_amt = calculations.total_agent_po_amt
        
        db.add(cutpay)
        db.commit()
        db.refresh(cutpay)
        
        logger.info(f"Created CutPay transaction {cutpay.id} by user {current_user.id}")
        return cutpay
        
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to create CutPay transaction: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create transaction: {str(e)}"
        )

@router.get("/", response_model=List[CutPayResponse])
async def list_cutpay_transactions(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status_filter: Optional[str] = Query(None),
    insurer_id: Optional[int] = Query(None),
    broker_id: Optional[int] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    search: Optional[str] = Query(None),
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
    _rbac_check = Depends(require_admin_cutpay)
):
    """
    List CutPay transactions with comprehensive filtering
    
    Supports filtering by:
    - Status (draft, completed, cancelled)
    - Insurer and Broker
    - Date range
    - Search in policy numbers and customer names
    """
    try:
        query = db.query(CutPay)
        
        # Apply filters
        if status_filter:
            query = query.filter(CutPay.status == status_filter)
        
        if insurer_id:
            query = query.filter(CutPay.insurer_id == insurer_id)
            
        if broker_id:
            query = query.filter(CutPay.broker_id == broker_id)
            
        if date_from:
            query = query.filter(CutPay.booking_date >= date_from)
            
        if date_to:
            query = query.filter(CutPay.booking_date <= date_to)
            
        if search:
            search_filter = f"%{search}%"
            query = query.filter(
                (CutPay.policy_number.ilike(search_filter)) |
                (CutPay.customer_name.ilike(search_filter)) |
                (CutPay.agent_code.ilike(search_filter))
            )
        
        # Order by created_at desc and apply pagination
        transactions = query.order_by(CutPay.created_at.desc()).offset(skip).limit(limit).all()
        
        return transactions
        
    except Exception as e:
        logger.error(f"Failed to list CutPay transactions: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch transactions: {str(e)}"
        )

@router.get("/{cutpay_id}", response_model=CutPayResponse)
async def get_cutpay_transaction(
    cutpay_id: int,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
    _rbac_check = Depends(require_admin_cutpay)
):
    """Get specific CutPay transaction by ID"""
    
    cutpay = db.query(CutPay).filter(CutPay.id == cutpay_id).first()
    if not cutpay:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"CutPay transaction {cutpay_id} not found"
        )
    
    return cutpay

@router.put("/{cutpay_id}", response_model=CutPayResponse)
async def update_cutpay_transaction(
    cutpay_id: int,
    cutpay_data: CutPayUpdate,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
    _rbac_check = Depends(require_admin_cutpay)
):
    """
    Update CutPay transaction with recalculation
    
    Automatically recalculates amounts when relevant fields are updated
    Auto-populates relationship data when IDs are changed
    """
    try:
        cutpay = db.query(CutPay).filter(CutPay.id == cutpay_id).first()
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
        for field, value in update_data.items():
            if hasattr(cutpay, field):
                setattr(cutpay, field, value)
        
        # Auto-populate relationship data if IDs changed
        if any(field in update_data for field in ["insurer_id", "broker_id", "child_id_request_id", "code_type"]):
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
            
            calculations = calculate_commission_amounts(calc_request)
            
            # Update calculated fields
            cutpay.receivable_from_broker = calculations.receivable_from_broker
            cutpay.extra_amount_receivable_from_broker = calculations.extra_amount_receivable_from_broker
            cutpay.total_receivable_from_broker = calculations.total_receivable_from_broker
            cutpay.total_receivable_from_broker_with_gst = calculations.total_receivable_from_broker_with_gst
            cutpay.cut_pay_amount = calculations.cut_pay_amount
            cutpay.agent_po_amt = calculations.agent_po_amt
            cutpay.agent_extra_amount = calculations.agent_extra_amount
            cutpay.total_agent_po_amt = calculations.total_agent_po_amt
        
        db.commit()
        db.refresh(cutpay)
        
        logger.info(f"Updated CutPay transaction {cutpay_id} by user {current_user.id}")
        return cutpay
        
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to update CutPay transaction {cutpay_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update transaction: {str(e)}"
        )

@router.delete("/{cutpay_id}")
async def delete_cutpay_transaction(
    cutpay_id: int,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
    _rbac_check = Depends(require_admin_cutpay)
):
    """Delete CutPay transaction"""
    
    cutpay = db.query(CutPay).filter(CutPay.id == cutpay_id).first()
    if not cutpay:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"CutPay transaction {cutpay_id} not found"
        )
    
    # Check if transaction can be deleted (business rules)
    if cutpay.status == "completed" and cutpay.synced_to_master_sheet:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete completed transaction that has been synced to Master Sheet"
        )
    
    db.delete(cutpay)
    db.commit()
    
    logger.info(f"Deleted CutPay transaction {cutpay_id} by user {current_user.id}")
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
    db: Session = Depends(get_db),
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
        cutpay = db.query(CutPay).filter(CutPay.id == cutpay_id).first()
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
        
        # TODO: Implement file upload to cloud storage (S3/GCS)
        # For now, we'll simulate the upload
        document_url = f"https://storage.example.com/cutpay/{cutpay_id}/{file.filename}"
        
        # Update CutPay record with document URL
        if document_type == "policy_pdf":
            cutpay.policy_pdf_url = document_url
        else:
            if not cutpay.additional_documents:
                cutpay.additional_documents = {}
            cutpay.additional_documents[document_type] = document_url
        
        db.commit()
        
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
    extraction_request: ExtractionRequest,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
    _rbac_check = Depends(require_admin_cutpay)
):
    """
    Trigger AI/OCR extraction from uploaded policy PDF
    
    Extracts 30+ fields including:
    - Policy information
    - Premium details
    - Vehicle details (for Motor insurance)
    - Customer information
    """
    try:
        cutpay = db.query(CutPay).filter(CutPay.id == cutpay_id).first()
        if not cutpay:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"CutPay transaction {cutpay_id} not found"
            )
        
        if not cutpay.policy_pdf_url:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No policy PDF uploaded for extraction"
            )
        
        # Skip extraction if already done and not forcing re-extract
        if cutpay.policy_number and not extraction_request.force_reextract:
            logger.info(f"PDF already extracted for CutPay {cutpay_id}, skipping")
            
            extracted_data = ExtractedPolicyData(
                policy_number=cutpay.policy_number,
                customer_name=cutpay.customer_name,
                gross_premium=cutpay.gross_premium,
                net_premium=cutpay.net_premium
                # Add other extracted fields...
            )
            
            return ExtractionResponse(
                cutpay_id=cutpay_id,
                extraction_status="completed",
                extracted_data=extracted_data,
                extraction_time=cutpay.updated_at
            )
        
        # Perform PDF extraction
        extracted_data = await extract_pdf_data(cutpay_id, cutpay.policy_pdf_url, db)
        
        # Update CutPay record with extracted data
        for field, value in extracted_data.dict(exclude_unset=True).items():
            if hasattr(cutpay, field) and value is not None:
                setattr(cutpay, field, value)
        
        db.commit()
        
        logger.info(f"PDF extraction completed for CutPay {cutpay_id}")
        
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

@router.get("/{cutpay_id}/extraction-status")
async def get_extraction_status(
    cutpay_id: int,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
    _rbac_check = Depends(require_admin_cutpay)
):
    """Check PDF extraction progress and status"""
    
    cutpay = db.query(CutPay).filter(CutPay.id == cutpay_id).first()
    if not cutpay:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"CutPay transaction {cutpay_id} not found"
        )
    
    # Determine extraction status based on available data
    if cutpay.policy_number:
        status = "completed"
    elif cutpay.policy_pdf_url:
        status = "pending"
    else:
        status = "not_started"
    
    return {
        "cutpay_id": cutpay_id,
        "extraction_status": status,
        "has_pdf": bool(cutpay.policy_pdf_url),
        "extracted_fields_count": sum(1 for field in [
            cutpay.policy_number, cutpay.customer_name, cutpay.gross_premium,
            cutpay.net_premium, cutpay.registration_no, cutpay.make_model
        ] if field is not None),
        "last_updated": cutpay.updated_at
    }

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
        result = calculate_commission_amounts(calculation_request)
        return result
        
    except Exception as e:
        logger.error(f"Calculation failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Calculation failed: {str(e)}"
        )

@router.get("/dropdowns", response_model=DropdownOptions)
async def get_form_dropdown_options(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
    _rbac_check = Depends(require_admin_cutpay)
):
    """Get all dropdown options for CutPay form"""
    
    try:
        options = get_dropdown_options(db)
        return options
        
    except Exception as e:
        logger.error(f"Failed to fetch dropdown options: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch dropdown options: {str(e)}"
        )

@router.get("/dropdowns/filtered", response_model=FilteredDropdowns)
async def get_filtered_dropdown_options(
    insurer_id: Optional[int] = Query(None),
    broker_id: Optional[int] = Query(None),
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
    _rbac_check = Depends(require_admin_cutpay)
):
    """Get filtered dropdown options based on insurer/broker selection"""
    
    try:
        options = get_filtered_dropdowns(db, insurer_id, broker_id)
        return options
        
    except Exception as e:
        logger.error(f"Failed to fetch filtered dropdowns: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch filtered dropdowns: {str(e)}"
        )

@router.get("/commission-rates")
async def get_commission_rate_suggestions(
    insurer_id: Optional[int] = Query(None),
    product_type: Optional[str] = Query(None),
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
    _rbac_check = Depends(require_admin_cutpay)
):
    """Get suggested commission rates based on insurer and product type"""
    
    # TODO: Implement logic to suggest commission rates based on historical data
    # For now, return default rates
    suggestions = {
        "incoming_grid_percent": 15.0,
        "agent_commission_given_percent": 12.0,
        "extra_grid": 2.0,
        "agent_extra_percent": 1.0
    }
    
    return {
        "insurer_id": insurer_id,
        "product_type": product_type,
        "suggested_rates": suggestions,
        "confidence": 0.8
    }

# =============================================================================
# SYNC & EXPORT ENDPOINTS
# =============================================================================

@router.post("/{cutpay_id}/sync-sheets", response_model=SyncResponse)
async def manual_google_sheets_sync(
    cutpay_id: int,
    sync_request: SyncRequest,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
    _rbac_check = Depends(require_admin_cutpay)
):
    """
    Manual Google Sheets sync
    
    Syncs to:
    - CutPay Sheet: All transactions
    - Master Sheet: Only completed transactions
    """
    try:
        cutpay = db.query(CutPay).filter(CutPay.id == cutpay_id).first()
        if not cutpay:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"CutPay transaction {cutpay_id} not found"
            )
        
        sync_results = await sync_cutpay_transaction(
            cutpay_id, db, force_sync=sync_request.force_sync
        )
        
        return SyncResponse(
            cutpay_id=cutpay_id,
            cutpay_sheet_synced=sync_results["cutpay_sheet_synced"],
            master_sheet_synced=sync_results["master_sheet_synced"],
            cutpay_sheet_row_id=cutpay.cutpay_sheet_row_id,
            master_sheet_row_id=cutpay.master_sheet_row_id,
            sync_errors=sync_results.get("errors", []),
            sync_timestamp=datetime.now()
        )
        
    except Exception as e:
        logger.error(f"Manual sync failed for CutPay {cutpay_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Sync failed: {str(e)}"
        )

@router.get("/export")
async def export_cutpay_data(
    export_request: ExportRequest = Depends(),
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
    _rbac_check = Depends(require_admin_cutpay)
):
    """Export CutPay data to CSV or Excel"""
    
    try:
        query = db.query(CutPay)
        
        # Apply filters
        if export_request.date_from:
            query = query.filter(CutPay.booking_date >= export_request.date_from)
        
        if export_request.date_to:
            query = query.filter(CutPay.booking_date <= export_request.date_to)
        
        if export_request.status_filter:
            query = query.filter(CutPay.status.in_(export_request.status_filter))
        
        if export_request.insurer_ids:
            query = query.filter(CutPay.insurer_id.in_(export_request.insurer_ids))
        
        transactions = query.all()
        
        # Generate CSV content
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write headers
        headers = [
            "ID", "Policy Number", "Customer Name", "Reporting Month", "Booking Date",
            "Agent Code", "Code Type", "Insurer Name", "Broker Name", "Major Categorisation",
            "Product Type", "Gross Premium", "Net Premium", "OD Premium", "TP Premium",
            "Incoming Grid %", "Agent Commission %", "CutPay Amount", "Agent Payout", "Status"
        ]
        writer.writerow(headers)
        
        # Write data
        for txn in transactions:
            row = [
                txn.id, txn.policy_number, txn.customer_name, txn.reporting_month,
                txn.booking_date, txn.agent_code, txn.code_type, txn.insurer_name,
                txn.broker_name, txn.major_categorisation, txn.product_type,
                txn.gross_premium, txn.net_premium, txn.od_premium, txn.tp_premium,
                txn.incoming_grid_percent, txn.agent_commission_given_percent,
                txn.cut_pay_amount, txn.total_agent_po_amt, txn.status
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
    db: Session = Depends(get_db),
    _rbac_check = Depends(require_admin_cutpay)
):
    """Get dashboard statistics for CutPay overview"""
    
    try:
        # Basic counts
        total_transactions = db.query(CutPay).count()
        completed_transactions = db.query(CutPay).filter(CutPay.status == "completed").count()
        draft_transactions = db.query(CutPay).filter(CutPay.status == "draft").count()
        
        # Financial totals
        total_cut_pay = db.query(
            db.func.coalesce(db.func.sum(CutPay.cut_pay_amount), 0)
        ).scalar() or 0
        
        total_agent_payouts = db.query(
            db.func.coalesce(db.func.sum(CutPay.total_agent_po_amt), 0)
        ).scalar() or 0
        
        total_commission = db.query(
            db.func.coalesce(db.func.sum(CutPay.total_receivable_from_broker), 0)
        ).scalar() or 0
        
        # Pending sync count
        pending_sync = db.query(CutPay).filter(
            (CutPay.synced_to_cutpay_sheet == False) |
            ((CutPay.status == "completed") & (CutPay.synced_to_master_sheet == False))
        ).count()
        
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
