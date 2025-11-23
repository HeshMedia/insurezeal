"""
CutPay Router - Comprehensive API endpoints for CutPay flow
Implements all endpoints as described in CUTPAY_FLOW_DETAILED_README.md
"""

import json
import logging
import traceback
from datetime import date, datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import attributes

from config import get_db
from dependencies.rbac import require_admin_cutpay
from models import (
    Broker,
    CutPay,
    CutPayAgentConfig,
    Insurer,
)

from ..auth.auth import get_current_user
from .cutpay_helpers import (
    auto_populate_relationship_data,
    calculate_commission_amounts,
    convert_sheets_data_to_nested_response,
    database_cutpay_response,
    get_dropdown_options,
    get_filtered_dropdowns,
    prepare_complete_sheets_data,
    prepare_complete_sheets_data_for_update,
    resolve_broker_code_to_id,
    resolve_insurer_code_to_id,
    validate_and_resolve_codes,
    validate_and_resolve_codes_with_names,
    validate_cutpay_data,
)
from .cutpay_schemas import (
    AgentPOResponse,
    BulkUpdateRequest,
    BulkUpdateResponse,
    CalculationRequest,
    CalculationResult,
    CutPayAgentConfigCreate,
    CutPayAgentConfigResponse,
    CutPayAgentConfigUpdate,
    CutPayCreate,
    CutPayResponse,
    CutPayDatabaseResponse,
    CutPayUpdate,
    DocumentUploadResponse,
    DropdownOptions,
    ExtractedPolicyData,
    ExtractionResponse,
    FilteredDropdowns,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/cutpay", tags=["CutPay"])

# =============================================================================
# CORE CUTPAY OPERATIONS
# =============================================================================


@router.post("/", response_model=CutPayDatabaseResponse)
async def create_cutpay_transaction(
    cutpay_data: CutPayCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    _rbac_check=Depends(require_admin_cutpay),
):
    """
    Create new CutPay transaction with selective DB storage and complete Google Sheets sync.
    Database stores only essential fields, Google Sheets stores all fields.
    """
    cutpay = None
    try:
        logger.info(
            "Step 1: Beginning core data transaction for new CutPay (selective fields only)."
        )
        async with db.begin():
            validation_errors = validate_cutpay_data(cutpay_data.dict())
            if validation_errors:
                raise HTTPException(
                    status_code=400, detail={"errors": validation_errors}
                )

            # Check for policy number uniqueness
            policy_number = None
            if cutpay_data.extracted_data and cutpay_data.extracted_data.policy_number:
                policy_number = cutpay_data.extracted_data.policy_number
            elif (
                cutpay_data.admin_input
                and hasattr(cutpay_data.admin_input, "policy_number")
                and cutpay_data.admin_input.policy_number
            ):
                policy_number = cutpay_data.admin_input.policy_number
            elif hasattr(cutpay_data, "policy_number") and cutpay_data.policy_number:
                policy_number = cutpay_data.policy_number

            if policy_number:
                existing_policy = await db.execute(
                    select(CutPay).where(CutPay.policy_number == policy_number)
                )
                if existing_policy.scalar_one_or_none():
                    raise HTTPException(
                        status_code=400,
                        detail=f"Policy number '{policy_number}' already exists in the database. Please use a unique policy number.",
                    )
                logger.info(
                    f"Policy number '{policy_number}' is unique - proceeding with creation"
                )

            # Prepare selective data for database storage (only essential fields)
            db_fields = {}

            # Initialize broker and insurer names for Google Sheets
            broker_name = ""
            insurer_name = ""

            # Essential document fields
            db_fields["policy_pdf_url"] = cutpay_data.policy_pdf_url
            if cutpay_data.additional_documents:
                import json

                db_fields["additional_documents"] = json.dumps(
                    cutpay_data.additional_documents
                )

            # Essential extracted data fields
            if cutpay_data.extracted_data:
                extracted = cutpay_data.extracted_data
                db_fields["policy_number"] = extracted.policy_number

                # Handle date conversion for database
                if extracted.start_date:
                    try:
                        db_fields["policy_start_date"] = datetime.strptime(
                            extracted.start_date, "%Y-%m-%d"
                        ).date()
                    except (ValueError, TypeError):
                        logger.warning(
                            f"Invalid start_date format: {extracted.start_date}"
                        )
                if extracted.end_date:
                    try:
                        db_fields["policy_end_date"] = datetime.strptime(
                            extracted.end_date, "%Y-%m-%d"
                        ).date()
                    except (ValueError, TypeError):
                        logger.warning(f"Invalid end_date format: {extracted.end_date}")

            # Essential admin input fields
            if cutpay_data.admin_input:
                admin = cutpay_data.admin_input
                db_fields["agent_code"] = admin.agent_code
                db_fields["booking_date"] = admin.booking_date
                db_fields["admin_child_id"] = admin.admin_child_id

                # Resolve broker and insurer codes to IDs and names for database relationships and sheets
                broker_name = ""
                insurer_name = ""
                if admin.broker_code or admin.insurer_code:
                    try:
                        broker_id, insurer_id, broker_name, insurer_name = (
                            await validate_and_resolve_codes_with_names(
                                db, admin.broker_code, admin.insurer_code
                            )
                        )
                        if broker_id:
                            db_fields["broker_id"] = broker_id
                        if insurer_id:
                            db_fields["insurer_id"] = insurer_id
                    except HTTPException as e:
                        logger.error(f"Code resolution failed: {e.detail}")
                        raise e

            # Remove None values
            db_fields = {k: v for k, v in db_fields.items() if v is not None}

            # Include selective financial fields if provided (from calculations or top-level)
            try:
                if hasattr(cutpay_data, "calculations") and cutpay_data.calculations:
                    calc = cutpay_data.calculations
                # cutpay_received is the authoritative source for Cut Pay Amount Received From Agent
                if getattr(cutpay_data, "cutpay_received", None) is not None:
                    db_fields["cut_pay_amount_received"] = cutpay_data.cutpay_received
            except Exception:
                # Be resilient - do not fail DB create if these fields are malformed
                logger.warning("Failed to extract financial fields for DB storage from request")

            logger.info(
                f"Storing {len(db_fields)} essential fields in database: {list(db_fields.keys())}"
            )

            cutpay = CutPay(**db_fields)
            auto_populate_relationship_data(cutpay, db)

            db.add(cutpay)

        await db.refresh(cutpay)
        logger.info(
            f"Step 1 SUCCESS: Successfully created CutPay ID {cutpay.id} with selective fields."
        )

    except Exception as e:
        logger.critical(
            f"Step 1 FAILED: Database creation failed. Traceback:\n{traceback.format_exc()}"
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create CutPay transaction in the database: {str(e)}",
        )

    sync_results = None
    try:
        logger.info(
            f"Step 2: Starting Google Sheets sync for new CutPay ID {cutpay.id} with ALL fields."
        )
        from utils.quarterly_sheets_manager import quarterly_manager

        # If no names found from codes, get names from database using stored IDs
        if not broker_name and cutpay.broker_id:
            try:
                broker_result = await db.execute(
                    select(Broker).where(Broker.id == cutpay.broker_id)
                )
                broker = broker_result.scalar_one_or_none()
                if broker:
                    broker_name = broker.name
                    logger.info(
                        f"Retrieved broker name from database: {broker_name} (ID: {cutpay.broker_id})"
                    )
            except Exception as e:
                logger.warning(f"Could not fetch broker name from database: {e}")

        if not insurer_name and cutpay.insurer_id:
            try:
                insurer_result = await db.execute(
                    select(Insurer).where(Insurer.id == cutpay.insurer_id)
                )
                insurer = insurer_result.scalar_one_or_none()
                if insurer:
                    insurer_name = insurer.name
                    logger.info(
                        f"Retrieved insurer name from database: {insurer_name} (ID: {cutpay.insurer_id})"
                    )
            except Exception as e:
                logger.warning(f"Could not fetch insurer name from database: {e}")

        logger.info(
            f"Final names for Google Sheets - Broker: '{broker_name}', Insurer: '{insurer_name}'"
        )

        # Prepare complete data for Google Sheets (all fields from request)
        complete_sheets_data = prepare_complete_sheets_data(
            cutpay_data, cutpay, broker_name, insurer_name
        )

        logger.info(
            f"Syncing {len(complete_sheets_data)} fields to Google Sheets: {list(complete_sheets_data.keys())}"
        )

        # Route to quarterly sheet with complete data
        quarterly_result = await run_in_threadpool(
            quarterly_manager.route_new_record_to_current_quarter, complete_sheets_data
        )
        sync_results = {"cutpay": quarterly_result}
        logger.info(
            f"Step 2 SUCCESS: Google Sheets sync finished for CutPay ID {cutpay.id}."
        )

    except Exception:
        logger.critical(
            f"Step 2 FAILED: Google Sheets sync failed for CutPay ID {cutpay.id}, but database changes are saved. Traceback:\n{traceback.format_exc()}"
        )
        return database_cutpay_response(cutpay)

    if not sync_results:
        logger.warning("Step 3 SKIPPED: No sync results to update flags.")
        return database_cutpay_response(cutpay)

    try:
        logger.info(
            "Step 3: Beginning transaction to update sync flags with a new session."
        )
        from config import AsyncSessionLocal

        async with AsyncSessionLocal() as final_db_session:
            async with final_db_session.begin():
                result = await final_db_session.execute(
                    select(CutPay).filter(CutPay.id == cutpay.id)
                )
                final_cutpay = result.scalar_one()

                if sync_results.get("cutpay", {}).get("success"):
                    final_cutpay.cutpay_sheet_row_id = sync_results["cutpay"].get(
                        "row_id"
                    )
                    final_cutpay.synced_to_cutpay_sheet = True

            await final_db_session.refresh(final_cutpay)
            logger.info(
                f"Step 3 SUCCESS: Successfully updated sync flags for CutPay ID {final_cutpay.id}."
            )
            logger.info(
                f"--- Create for CutPay ID: {cutpay.id} finished successfully. ---"
            )
            return database_cutpay_response(final_cutpay)

    except Exception:
        logger.critical(
            f"Step 3 FAILED: Updating sync flags failed for CutPay ID {cutpay.id}. Traceback:\n{traceback.format_exc()}"
        )
        return database_cutpay_response(cutpay)


@router.get("/", response_model=List[CutPayDatabaseResponse])
async def list_cutpay_transactions(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    insurer_code: Optional[str] = Query(None),
    broker_code: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    search: Optional[str] = Query(None),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check=Depends(require_admin_cutpay),
):
    """
    List CutPay transactions with filtering - returns only essential fields stored in database

    Uses CutPayDatabaseResponse schema which contains only the fields actually stored in the database.
    All detailed data (customer info, premiums, calculations) is stored in Google Sheets only.

    Supports filtering by:
    - Insurer and Broker (using codes)
    - Date range (booking_date)
    - Search in policy numbers and agent codes (only fields available in DB)
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
            # Only search in fields that actually exist in the database
            query = query.where(
                (CutPay.policy_number.ilike(search_filter))
                | (CutPay.agent_code.ilike(search_filter))
            )

        query = query.order_by(desc(CutPay.created_at)).offset(skip).limit(limit)
        result = await db.execute(query)
        transactions = result.scalars().all()

        return [database_cutpay_response(txn) for txn in transactions]

    except Exception as e:
        logger.error(f"Failed to list CutPay transactions: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch transactions: {str(e)}",
        )


# =============================================================================
# CALCULATIONS & DROPDOWNS ENDPOINTS
# =============================================================================


@router.post("/calculate", response_model=CalculationResult)
async def calculate_amounts(
    calculation_request: CalculationRequest,
    current_user=Depends(get_current_user),
    _rbac_check=Depends(require_admin_cutpay),
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
            detail=f"Calculation failed: {str(e)}",
        )


@router.get("/dropdowns", response_model=DropdownOptions)
async def get_form_dropdown_options(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check=Depends(require_admin_cutpay),
):
    """Get all dropdown options for CutPay form"""

    try:
        options = await get_dropdown_options(db)
        return options

    except Exception as e:
        logger.error(f"Failed to fetch dropdown options: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch dropdown options: {str(e)}",
        )


@router.get("/dropdowns/filtered", response_model=FilteredDropdowns)
async def get_filtered_dropdown_options(
    insurer_code: Optional[str] = Query(None),
    broker_code: Optional[str] = Query(None),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check=Depends(require_admin_cutpay),
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
            detail=f"Failed to fetch filtered dropdowns: {str(e)}",
        )


# =============================================================================
# BULK UPDATE ENDPOINT
# =============================================================================


@router.put("/bulk-update", response_model=BulkUpdateResponse)
async def bulk_update_cutpay_transactions(
    request: BulkUpdateRequest,
    quarter: Optional[int] = Query(
        None, ge=1, le=4, description="Quarter number (1-4) for Google Sheets update"
    ),
    year: Optional[int] = Query(
        None, ge=2020, le=2030, description="Year for Google Sheets update"
    ),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
    _rbac_check=Depends(require_admin_cutpay),
):
    """
    Perform bulk updates on multiple CutPay transactions.
    This is a generic endpoint that can update any fields on any CutPay records.
    Each update item can specify different fields to update for different records.

    Parameters:
    - quarter: Optional quarter number (1-4) to target specific Google Sheets quarter
    - year: Optional year to target specific Google Sheets quarter

    If quarter and year are provided, the update will target that specific quarter sheet.
    If not provided, it will use the current quarter or search across quarters.
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

            # Get the existing record
            result = await db.execute(select(CutPay).filter(CutPay.id == cutpay_id))
            cutpay = result.scalar_one_or_none()

            if not cutpay:
                failed_updates.append(
                    {
                        "cutpay_id": cutpay_id,
                        "error": f"CutPay transaction with ID {cutpay_id} not found",
                    }
                )
                continue

            # Get update data - handle nested structure like the existing update route
            cutpay_data = update_item.update_data
            update_data = cutpay_data.dict(
                exclude={"extracted_data", "admin_input", "calculations"},
                exclude_unset=True,
            )

            # Add extracted_data fields if present
            if hasattr(cutpay_data, "extracted_data") and cutpay_data.extracted_data:
                extracted_fields = cutpay_data.extracted_data.dict(exclude_unset=True)
                update_data.update(extracted_fields)
                logger.info(
                    f"Added {len(extracted_fields)} extracted_data fields for CutPay {cutpay_id}"
                )

            # Add admin_input fields if present
            if hasattr(cutpay_data, "admin_input") and cutpay_data.admin_input:
                admin_fields = cutpay_data.admin_input.dict(exclude_unset=True)
                # Remove broker/insurer codes from admin fields (handle separately)
                broker_code = admin_fields.pop("broker_code", None)
                insurer_code = admin_fields.pop("insurer_code", None)
                update_data.update(admin_fields)
                logger.info(
                    f"Added {len(admin_fields)} admin_input fields for CutPay {cutpay_id}"
                )
                # Add codes back for processing
                if broker_code:
                    update_data["broker_code"] = broker_code
                if insurer_code:
                    update_data["insurer_code"] = insurer_code

            # Add calculations fields if present
            if hasattr(cutpay_data, "calculations") and cutpay_data.calculations:
                calc_fields = cutpay_data.calculations.dict(exclude_unset=True)
                update_data.update(calc_fields)
                logger.info(
                    f"Added {len(calc_fields)} calculations fields for CutPay {cutpay_id}"
                )

            logger.info(
                f"Updating {len(update_data)} fields for CutPay {cutpay_id}: {list(update_data.keys())}"
            )

            # Handle broker/insurer code resolution if provided
            if "broker_code" in update_data or "insurer_code" in update_data:
                broker_code = update_data.pop("broker_code", None)
                insurer_code = update_data.pop("insurer_code", None)
                if broker_code or insurer_code:
                    broker_id, insurer_id = await validate_and_resolve_codes(
                        db, broker_code, insurer_code
                    )

            # Filter only fields that exist in the database (selective storage)
            db_fields = {
                "policy_pdf_url",
                "additional_documents",
                "policy_number",
                "agent_code",
                "booking_date",
                "admin_child_id",
                "insurer_id",
                "broker_id",
                "child_id_request_id",
                "policy_start_date",
                "policy_end_date",
                "cut_pay_amount_received",
            }

            # Convert date strings to date objects for database fields
            date_fields = ["policy_start_date", "policy_end_date"]
            for date_field in date_fields:
                if date_field in update_data and isinstance(
                    update_data[date_field], str
                ):
                    try:
                        from datetime import datetime

                        update_data[date_field] = datetime.strptime(
                            update_data[date_field], "%Y-%m-%d"
                        ).date()
                    except (ValueError, TypeError):
                        logger.warning(
                            f"Invalid date format for {date_field}: {update_data[date_field]}"
                        )
                        update_data.pop(date_field, None)

            # Handle JSON serialization for additional_documents
            if "additional_documents" in update_data and isinstance(
                update_data["additional_documents"], dict
            ):
                import json

                update_data["additional_documents"] = json.dumps(
                    update_data["additional_documents"]
                )

            # Filter to only database fields
            filtered_update_data = {
                k: v for k, v in update_data.items() if k in db_fields
            }
            logger.info(
                f"Filtered to {len(filtered_update_data)} database fields for CutPay {cutpay_id}: {list(filtered_update_data.keys())}"
            )

            # Apply updates
            for field, value in filtered_update_data.items():
                if hasattr(cutpay, field):
                    old_value = getattr(cutpay, field)
                    setattr(cutpay, field, value)
                    logger.info(
                        f"Updated {field}: {old_value} -> {value} for CutPay {cutpay_id}"
                    )
                else:
                    logger.warning(
                        f"Field '{field}' not found on CutPay model - skipping for CutPay {cutpay_id}"
                    )

            # Skip auto-populate relationship data for selective storage
            # auto_populate_relationship_data(cutpay, db)

            # Commit database changes
            await db.commit()
            await db.refresh(cutpay)
            logger.info(f"Successfully updated CutPay ID {cutpay.id} in database.")

            # Google Sheets sync with complete data (like create/update endpoints)
            sync_results = None
            try:
                logger.info(
                    f"Starting Google Sheets sync for updated CutPay ID {cutpay.id} with ALL fields."
                )
                from utils.quarterly_sheets_manager import quarterly_manager

                # Prepare complete data for Google Sheets (all fields from request)
                # Get broker and insurer names for Google Sheets
                broker_name = ""
                insurer_name = ""

                # First, try to get names from codes in update data
                if "broker_code" in update_data or "insurer_code" in update_data:
                    try:
                        broker_code = update_data.get("broker_code")
                        insurer_code = update_data.get("insurer_code")
                        if broker_code or insurer_code:
                            from .cutpay_helpers import (
                                validate_and_resolve_codes_with_names,
                            )

                            _, _, broker_name, insurer_name = (
                                await validate_and_resolve_codes_with_names(
                                    db, broker_code, insurer_code
                                )
                            )
                    except Exception as name_error:
                        logger.warning(
                            f"Could not resolve broker/insurer names from codes: {name_error}"
                        )

                # If no names found from codes, get names from database using stored IDs
                if not broker_name and cutpay.broker_id:
                    try:
                        broker_result = await db.execute(
                            select(Broker).where(Broker.id == cutpay.broker_id)
                        )
                        broker = broker_result.scalar_one_or_none()
                        if broker:
                            broker_name = broker.name
                            logger.info(
                                f"Retrieved broker name from database: {broker_name} (ID: {cutpay.broker_id})"
                            )
                    except Exception as e:
                        logger.warning(
                            f"Could not fetch broker name from database: {e}"
                        )

                if not insurer_name and cutpay.insurer_id:
                    try:
                        insurer_result = await db.execute(
                            select(Insurer).where(Insurer.id == cutpay.insurer_id)
                        )
                        insurer = insurer_result.scalar_one_or_none()
                        if insurer:
                            insurer_name = insurer.name
                            logger.info(
                                f"Retrieved insurer name from database: {insurer_name} (ID: {cutpay.insurer_id})"
                            )
                    except Exception as e:
                        logger.warning(
                            f"Could not fetch insurer name from database: {e}"
                        )

                logger.info(
                    f"Final names for Google Sheets - Broker: '{broker_name}', Insurer: '{insurer_name}'"
                )

                # Use the helper function to prepare complete sheets data
                from .cutpay_helpers import prepare_complete_sheets_data_for_update

                complete_sheets_data = prepare_complete_sheets_data_for_update(
                    cutpay_data, cutpay, broker_name, insurer_name
                )

                logger.info(
                    f"Syncing {len(complete_sheets_data)} fields to Google Sheets: {list(complete_sheets_data.keys())}"
                )

                # Use the new update method that finds existing records by policy number
                policy_number = (
                    complete_sheets_data.get("Policy number", "")
                    or complete_sheets_data.get("policy_number", "")
                    or complete_sheets_data.get("Policy Number", "")
                )
                logger.info(
                    f"🔍 DEBUG: Policy number for Google Sheets update: '{policy_number}'"
                )
                logger.info(f"🔍 DEBUG: Quarter: {quarter}, Year: {year}")
                logger.info(
                    f"🔍 DEBUG: Complete sheets data keys: {list(complete_sheets_data.keys())}"
                )
                logger.info(
                    f"🔍 DEBUG: Policy number alternatives: policy_number='{complete_sheets_data.get('policy_number')}', Policy Number='{complete_sheets_data.get('Policy Number')}', Policy number='{complete_sheets_data.get('Policy number')}'"
                )

                if policy_number:
                    if quarter and year:
                        logger.info(
                            f"✅ Using update method for policy number: '{policy_number}' in Q{quarter}-{year}"
                        )
                        quarterly_result = await run_in_threadpool(
                            quarterly_manager.update_existing_record_by_policy_number,
                            complete_sheets_data,
                            policy_number,
                            quarter,
                            year,
                        )
                    else:
                        logger.info(
                            f"✅ Using update method for policy number: '{policy_number}' in current quarter"
                        )
                        quarterly_result = await run_in_threadpool(
                            quarterly_manager.update_existing_record_by_policy_number,
                            complete_sheets_data,
                            policy_number,
                        )
                else:
                    logger.warning(
                        "❌ No policy number found, falling back to create method"
                    )
                    # Fallback to creating new record if no policy number
                    if quarter and year:
                        logger.info(f"Creating new record in Q{quarter}-{year}")
                        quarterly_result = await run_in_threadpool(
                            quarterly_manager.route_new_record_to_specific_quarter,
                            complete_sheets_data,
                            quarter,
                            year,
                            "UPDATE",
                        )
                    else:
                        quarterly_result = await run_in_threadpool(
                            quarterly_manager.route_new_record_to_current_quarter,
                            complete_sheets_data,
                            "UPDATE",
                        )

                sync_results = {"cutpay": quarterly_result}
                logger.info(
                    f"Google Sheets sync completed for CutPay ID {cutpay.id}: {quarterly_result.get('operation', 'UPDATE')}"
                )

                # Update sync flags
                if sync_results.get("cutpay", {}).get("success"):
                    cutpay.synced_to_cutpay_sheet = True
                    if sync_results["cutpay"].get("row_number"):
                        cutpay.cutpay_sheet_row_id = sync_results["cutpay"][
                            "row_number"
                        ]

                await db.commit()
                await db.refresh(cutpay)

            except Exception as sync_error:
                logger.error(
                    f"Google Sheets sync failed for CutPay {cutpay_id}: {str(sync_error)}"
                )
                logger.error(f"Sync error details: {traceback.format_exc()}")
                # Don't fail the whole operation for sync errors

            successful_ids.append(cutpay_id)
            updated_records.append(database_cutpay_response(cutpay))
            logger.info(f"Successfully processed bulk update for CutPay ID {cutpay_id}")

        except Exception as e:
            logger.error(f"Failed to update CutPay {cutpay_id}: {str(e)}")
            logger.error(f"Error details: {traceback.format_exc()}")
            failed_updates.append({"cutpay_id": cutpay_id, "error": str(e)})
            continue

    logger.info(
        f"Bulk update operation completed. Success: {len(successful_ids)}, Failed: {len(failed_updates)}"
    )

    return BulkUpdateResponse(
        success_count=len(successful_ids),
        failed_count=len(failed_updates),
        successful_ids=successful_ids,
        failed_updates=failed_updates,
        updated_records=updated_records,
    )


# =============================================================================
# MANUAL SYNC ENDPOINT FOR TROUBLESHOOTING
# =============================================================================


@router.post("/manual-sync", response_model=Dict[str, Any])
async def manual_sync_to_google_sheets(
    cutpay_ids: List[int],
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
    _rbac_check=Depends(require_admin_cutpay),
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
                sync_results.append(
                    {
                        "cutpay_id": cutpay_id,
                        "success": False,
                        "error": f"CutPay {cutpay_id} not found",
                    }
                )
                continue

            # Prepare data for sync
            cutpay_dict = {
                c.name: getattr(cutpay, c.name) for c in cutpay.__table__.columns
            }
            for key, value in cutpay_dict.items():
                if isinstance(value, (datetime, date)):
                    cutpay_dict[key] = value.isoformat()
                elif isinstance(value, UUID):
                    cutpay_dict[key] = str(value)

            logger.info(
                f"Manual sync for CutPay {cutpay_id} with data keys: {list(cutpay_dict.keys())}"
            )

            # Attempt sync
            from utils.quarterly_sheets_manager import quarterly_manager

            quarterly_result = await run_in_threadpool(
                quarterly_manager.route_new_record_to_current_quarter,
                cutpay_dict,
                "UPDATE",
            )

            # Update sync flags
            if quarterly_result and quarterly_result.get("success"):
                cutpay.synced_to_cutpay_sheet = True
                if quarterly_result.get("row_id"):
                    cutpay.cutpay_sheet_row_id = quarterly_result["row_id"]

            await db.commit()

            sync_results.append(
                {
                    "cutpay_id": cutpay_id,
                    "success": True,
                    "cutpay_sheet_sync": quarterly_result,
                }
            )

        except Exception as e:
            logger.error(f"Manual sync failed for CutPay {cutpay_id}: {str(e)}")
            logger.error(f"Error details: {traceback.format_exc()}")
            sync_results.append(
                {"cutpay_id": cutpay_id, "success": False, "error": str(e)}
            )

    return {"message": "Manual sync completed", "results": sync_results}


@router.get("/agent-config", response_model=List[CutPayAgentConfigResponse])
async def list_agent_configs(
    agent_code: Optional[str] = Query(None, description="Filter by agent code"),
    date_from: Optional[date] = Query(None, description="Filter from date"),
    date_to: Optional[date] = Query(None, description="Filter to date"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
    _rbac_check=Depends(require_admin_cutpay),
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
            detail=f"Failed to fetch agent configurations: {str(e)}",
        )


@router.get("/policy-details")
async def get_cutpay_transaction_by_policy(
    policy_number: str = Query(..., description="Policy number to search for"),
    quarter: int = Query(
        ..., ge=1, le=4, description="Quarter number (1-4) where the policy is located"
    ),
    year: int = Query(
        ..., ge=2020, le=2030, description="Year where the policy is located"
    ),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check=Depends(require_admin_cutpay),
):
    """
    Get complete CutPay transaction details by policy number from both database and specific quarterly Google Sheet

    This endpoint:
    1. Combines quarter and year into sheet name format (Q3-2025)
    2. Searches for the specific quarterly Google Sheet
    3. Fetches data from both the specific sheet AND database for the same policy number
    4. Returns combined results in nested format (extracted_data, admin_input, calculations)

    Parameters:
    - policy_number: The policy number to search for
    - quarter: Quarter number (1-4)
    - year: Year

    Returns:
    - policy_data: Nested CutPayDetailResponse structure with complete policy details
    - metadata: Search information and status flags
    """
    try:
        # Step 1: Create quarter sheet name from quarter and year
        quarter_sheet_name = f"Q{quarter}-{year}"
        logger.info(
            f"Searching for policy '{policy_number}' in quarter sheet '{quarter_sheet_name}' and database"
        )

        # Step 2: Get record from database
        database_record = None
        broker_name = ""
        insurer_name = ""

        try:
            result = await db.execute(
                select(CutPay)
                .where(CutPay.policy_number == policy_number)
                .order_by(desc(CutPay.id))  # Get the most recent one if multiple exist
            )
            cutpay = result.first()  # Use first() instead of scalar_one_or_none()

            if cutpay:
                cutpay = cutpay[0]  # Extract the CutPay object from the Row
                await db.refresh(cutpay)
                database_record = database_cutpay_response(cutpay).__dict__

                # Get broker and insurer names from database IDs
                if cutpay.broker_id:
                    try:
                        broker_result = await db.execute(
                            select(Broker).where(Broker.id == cutpay.broker_id)
                        )
                        broker = broker_result.scalar_one_or_none()
                        if broker:
                            broker_name = broker.name
                    except Exception as e:
                        logger.warning(f"Could not fetch broker name: {e}")

                if cutpay.insurer_id:
                    try:
                        insurer_result = await db.execute(
                            select(Insurer).where(Insurer.id == cutpay.insurer_id)
                        )
                        insurer = insurer_result.scalar_one_or_none()
                        if insurer:
                            insurer_name = insurer.name
                    except Exception as e:
                        logger.warning(f"Could not fetch insurer name: {e}")

                logger.info(
                    f"Found policy '{policy_number}' in database with ID: {cutpay.id}"
                )
            else:
                logger.info(f"Policy '{policy_number}' not found in database")

        except Exception as db_error:
            logger.error(f"Database search error: {str(db_error)}")
            database_record = {"error": f"Database search failed: {str(db_error)}"}

        # Step 3: Search for the specific quarterly Google Sheet and get data
        sheets_data = {}
        sheet_found = False

        try:
            from utils.quarterly_sheets_manager import quarterly_manager

            # Get the specific quarter sheet by name
            target_sheet = quarterly_manager.get_quarterly_sheet(quarter, year)

            if not target_sheet:
                logger.warning(
                    f"Quarter sheet '{quarter_sheet_name}' not found in Google Sheets"
                )
                sheets_data = {
                    "error": f"Quarter sheet '{quarter_sheet_name}' not found"
                }
            else:
                logger.info(
                    f"Found quarter sheet '{quarter_sheet_name}' in Google Sheets"
                )
                sheet_found = True

                # Get all data from the specific sheet
                all_values = target_sheet.get_all_values()
                if not all_values:
                    sheets_data = {
                        "error": f"No data found in sheet '{quarter_sheet_name}'"
                    }
                else:
                    headers = all_values[0] if all_values else []
                    logger.info(
                        f"Sheet has {len(headers)} columns and {len(all_values)-1} data rows"
                    )

                    # Find policy number column
                    policy_col_index = -1
                    for i, header in enumerate(headers):
                        if header.lower().strip() in ["policy number", "policy_number"]:
                            policy_col_index = i
                            logger.info(
                                f"Found policy number column at index {i}: '{header}'"
                            )
                            break

                    if policy_col_index == -1:
                        sheets_data = {
                            "error": f"Policy number column not found in sheet '{quarter_sheet_name}'"
                        }
                        logger.warning(
                            "Policy number column not found in sheet headers"
                        )
                    else:
                        # Search for the policy number in the sheet
                        policy_row_data = None
                        found_row_index = -1

                        # Skip header (row 1) and dummy/formula row (row 2)
                        for row_index, row_data in enumerate(all_values[2:], start=3):
                            if policy_col_index < len(row_data):
                                cell_value = row_data[policy_col_index].strip()
                                if cell_value == policy_number.strip():
                                    policy_row_data = row_data
                                    found_row_index = row_index
                                    logger.info(
                                        f"Found policy '{policy_number}' in sheet row {row_index}"
                                    )
                                    break

                        if not policy_row_data:
                            sheets_data = {
                                "error": f"Policy number '{policy_number}' not found in sheet '{quarter_sheet_name}'"
                            }
                            logger.info(
                                f"Policy '{policy_number}' not found in {len(all_values)-1} data rows"
                            )
                        else:
                            # Map headers to values for the found row
                            sheets_data = {}
                            for i, header in enumerate(headers):
                                if i < len(policy_row_data):
                                    sheets_data[header] = policy_row_data[i]
                                else:
                                    sheets_data[header] = ""

                            logger.info(
                                f"Successfully retrieved {len(sheets_data)} fields from sheet '{quarter_sheet_name}' row {found_row_index}"
                            )

        except Exception as sheets_error:
            logger.error(f"Failed to fetch from Google Sheets: {str(sheets_error)}")
            logger.error(traceback.format_exc())
            sheets_data = {
                "error": f"Failed to fetch from Google Sheets: {str(sheets_error)}"
            }

        # Step 4: Convert sheets data to nested format and combine with database
        found_in_database = database_record is not None and "error" not in str(
            database_record
        )
        found_in_sheets = sheet_found and "error" not in sheets_data

        # Convert to nested structure if we have valid sheets data
        policy_data = None
        if found_in_sheets and isinstance(sheets_data, dict) and "error" not in sheets_data:
            policy_data = convert_sheets_data_to_nested_response(
                sheets_data=sheets_data,
                database_record=database_record if found_in_database else None,
                broker_name=broker_name,
                insurer_name=insurer_name,
            )
        elif found_in_database and isinstance(database_record, dict):
            # If only database record exists, create minimal nested structure
            policy_data = {
                "id": database_record.get("id"),
                "policy_pdf_url": database_record.get("policy_pdf_url"),
                "additional_documents": database_record.get("additional_documents"),
                "extracted_data": {
                    "policy_number": database_record.get("policy_number"),
                },
                "admin_input": {
                    "agent_code": database_record.get("agent_code"),
                    "booking_date": database_record.get("booking_date"),
                    "admin_child_id": database_record.get("admin_child_id"),
                },
                "broker_name": broker_name,
                "insurer_name": insurer_name,
            }

        response_data = {
            "policy_data": policy_data,
            "metadata": {
                "policy_number": policy_number,
                "quarter": quarter,
                "year": year,
                "quarter_sheet_name": quarter_sheet_name,
                "found_in_database": found_in_database,
                "found_in_sheets": found_in_sheets,
                "quarter_sheet_exists": sheet_found,
                "fetched_at": datetime.now().isoformat(),
                "search_quarter": quarter_sheet_name,
                "database_search_completed": True,
                "sheets_search_completed": True,
            },
            # Keep error info if exists
            "database_error": database_record.get("error") if isinstance(database_record, dict) and "error" in database_record else None,
            "sheets_error": sheets_data.get("error") if isinstance(sheets_data, dict) and "error" in sheets_data else None,
        }

        # Remove None values at top level
        response_data = {k: v for k, v in response_data.items() if v is not None}

        logger.info(
            f"Search completed - DB: {found_in_database}, Sheets: {found_in_sheets}"
        )
        return response_data

    except Exception as e:
        logger.error(f"Error in policy search: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch transaction: {str(e)}",
        )


@router.put("/policy-update", response_model=CutPayDatabaseResponse)
async def update_cutpay_transaction_by_policy(
    policy_number: str = Query(..., description="Policy number to update"),
    quarter: int = Query(
        ..., ge=1, le=4, description="Quarter number (1-4) where the policy is located"
    ),
    year: int = Query(
        ..., ge=2020, le=2030, description="Year where the policy is located"
    ),
    cutpay_data: CutPayUpdate = ...,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    _rbac_check=Depends(require_admin_cutpay),
):
    """
    Update CutPay transaction by policy number with selective DB storage and complete quarterly Google Sheets sync.

    This endpoint:
    1. Combines quarter and year into sheet name format (Q3-2025)
    2. Finds the policy in database by policy number
    3. Updates selective fields in database (essential fields only)
    4. Updates all fields in the specific quarterly Google Sheet

    Parameters:
    - policy_number: The policy number to update
    - quarter: Quarter number (1-4) where the policy is located
    - year: Year where the policy is located
    - cutpay_data: Update data for the policy

    Database updates only essential fields, Google Sheets updates all fields.
    """
    cutpay = None
    quarter_sheet_name = f"Q{quarter}-{year}"

    try:
        logger.info(
            f"Step 1: Beginning database update for policy '{policy_number}' in quarter '{quarter_sheet_name}' (selective fields only)."
        )
        async with db.begin():
            # Get the existing record by policy number
            result = await db.execute(
                select(CutPay)
                .where(CutPay.policy_number == policy_number)
                .order_by(desc(CutPay.id))  # Get the most recent one if multiple exist
            )
            cutpay = result.first()

            if cutpay:
                cutpay = cutpay[0]  # Extract the CutPay object from the Row
            else:
                raise HTTPException(
                    status_code=404,
                    detail=f"CutPay transaction with policy number '{policy_number}' not found in database",
                )

            # Prepare selective data for database update (only essential fields)
            db_update_fields = {}

            # Initialize broker and insurer names for Google Sheets
            broker_name = ""
            insurer_name = ""

            # Essential document fields
            if cutpay_data.policy_pdf_url is not None:
                db_update_fields["policy_pdf_url"] = cutpay_data.policy_pdf_url
            if cutpay_data.additional_documents is not None:
                db_update_fields["additional_documents"] = json.dumps(
                    cutpay_data.additional_documents
                )

            # Essential extracted data fields (check both nested and direct)
            updated_policy_number = None
            if hasattr(cutpay_data, "extracted_data") and cutpay_data.extracted_data:
                extracted = cutpay_data.extracted_data
                if extracted.policy_number is not None:
                    db_update_fields["policy_number"] = extracted.policy_number
                    updated_policy_number = extracted.policy_number
                if extracted.start_date:
                    try:
                        db_update_fields["policy_start_date"] = datetime.strptime(
                            extracted.start_date, "%Y-%m-%d"
                        ).date()
                    except (ValueError, TypeError):
                        logger.warning(
                            f"Invalid start_date format: {extracted.start_date}"
                        )
                if extracted.end_date:
                    try:
                        db_update_fields["policy_end_date"] = datetime.strptime(
                            extracted.end_date, "%Y-%m-%d"
                        ).date()
                    except (ValueError, TypeError):
                        logger.warning(f"Invalid end_date format: {extracted.end_date}")

            # Check direct fields for policy number too
            if (
                hasattr(cutpay_data, "policy_number")
                and cutpay_data.policy_number is not None
            ):
                db_update_fields["policy_number"] = cutpay_data.policy_number
                updated_policy_number = cutpay_data.policy_number

            # Essential admin input fields (check both nested and direct)
            if hasattr(cutpay_data, "admin_input") and cutpay_data.admin_input:
                admin = cutpay_data.admin_input
                if admin.agent_code is not None:
                    db_update_fields["agent_code"] = admin.agent_code
                if admin.booking_date is not None:
                    db_update_fields["booking_date"] = admin.booking_date
                if admin.admin_child_id is not None:
                    db_update_fields["admin_child_id"] = admin.admin_child_id

                # Resolve broker and insurer codes to IDs and names for database relationships and sheets
                if admin.broker_code or admin.insurer_code:
                    try:
                        broker_id, insurer_id, broker_name, insurer_name = (
                            await validate_and_resolve_codes_with_names(
                                db, admin.broker_code, admin.insurer_code
                            )
                        )
                        if broker_id:
                            db_update_fields["broker_id"] = broker_id
                        if insurer_id:
                            db_update_fields["insurer_id"] = insurer_id
                    except HTTPException as e:
                        logger.error(f"Code resolution failed: {e.detail}")
                        raise e

            # Check direct fields for admin input too
            direct_admin_fields = ["agent_code", "booking_date", "admin_child_id"]
            for field in direct_admin_fields:
                if (
                    hasattr(cutpay_data, field)
                    and getattr(cutpay_data, field) is not None
                ):
                    db_update_fields[field] = getattr(cutpay_data, field)

            # Handle broker/insurer codes from direct fields (if not already resolved from admin_input)
            if hasattr(cutpay_data, "insurer_code") or hasattr(
                cutpay_data, "broker_code"
            ):
                broker_code = getattr(cutpay_data, "broker_code", None)
                insurer_code = getattr(cutpay_data, "insurer_code", None)
                if (
                    (broker_code or insurer_code)
                    and not broker_name
                    and not insurer_name
                ):
                    try:
                        broker_id, insurer_id, broker_name, insurer_name = (
                            await validate_and_resolve_codes_with_names(
                                db, broker_code, insurer_code
                            )
                        )
                        if broker_id:
                            db_update_fields["broker_id"] = broker_id
                        if insurer_id:
                            db_update_fields["insurer_id"] = insurer_id
                    except HTTPException as e:
                        logger.error(f"Code resolution failed: {e.detail}")
                        raise e

            logger.info(
                f"Updating {len(db_update_fields)} essential fields in database: {list(db_update_fields.keys())}"
            )

            # Include calculation-derived DB fields if present
            try:
                if hasattr(cutpay_data, "calculations") and cutpay_data.calculations:
                    calc = cutpay_data.calculations
                    
                    # Extract agent_total_po_amount from calculations
                    if getattr(calc, "total_agent_po_amt", None) is not None:
                        db_update_fields["agent_total_po_amount"] = calc.total_agent_po_amt

                # cutpay_received is the authoritative source for Cut Pay Amount Received From Agent
                if getattr(cutpay_data, "cutpay_received", None) is not None:
                    db_update_fields["cut_pay_amount_received"] = cutpay_data.cutpay_received
            except Exception:
                logger.warning("Failed to extract financial fields for DB update from request")

            # Check for policy number uniqueness if policy number is being updated
            if updated_policy_number and updated_policy_number != cutpay.policy_number:
                existing_policy = await db.execute(
                    select(CutPay).where(
                        (CutPay.policy_number == updated_policy_number)
                        & (CutPay.id != cutpay.id)  # Exclude current record
                    )
                )
                if existing_policy.scalar_one_or_none():
                    raise HTTPException(
                        status_code=400,
                        detail=f"Policy number '{updated_policy_number}' already exists in the database. Please use a unique policy number.",
                    )
                logger.info(
                    f"Policy number change to '{updated_policy_number}' is valid - proceeding with update"
                )

            # Apply updates to database
            for field, value in db_update_fields.items():
                if hasattr(cutpay, field):
                    old_value = getattr(cutpay, field)
                    setattr(cutpay, field, value)
                    logger.info(f"DB Update {field}: {old_value} -> {value}")
                else:
                    logger.warning(
                        f"Field '{field}' not found on CutPay model - skipping"
                    )

            # Auto-populate relationship data
            auto_populate_relationship_data(cutpay, db)

        # Refresh to get committed data
        await db.refresh(cutpay)
        logger.info(
            f"Step 1 SUCCESS: Successfully updated policy '{policy_number}' (CutPay ID {cutpay.id}) with selective fields."
        )

    except Exception as e:
        logger.critical(
            f"Step 1 FAILED: Database update failed for policy '{policy_number}'. Traceback:\n{traceback.format_exc()}"
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update CutPay transaction in the database: {str(e)}",
        )

    # Google Sheets sync with complete data to specific quarterly sheet
    sync_results = None
    try:
        logger.info(
            f"Step 2: Starting quarterly Google Sheets sync for policy '{policy_number}' in '{quarter_sheet_name}' with ALL fields."
        )
        from utils.quarterly_sheets_manager import quarterly_manager

        # If no names found from codes, get names from database using stored IDs
        if not broker_name and cutpay.broker_id:
            try:
                broker_result = await db.execute(
                    select(Broker).where(Broker.id == cutpay.broker_id)
                )
                broker = broker_result.scalar_one_or_none()
                if broker:
                    broker_name = broker.name
                    logger.info(
                        f"Retrieved broker name from database: {broker_name} (ID: {cutpay.broker_id})"
                    )
            except Exception as e:
                logger.warning(f"Could not fetch broker name from database: {e}")

        if not insurer_name and cutpay.insurer_id:
            try:
                insurer_result = await db.execute(
                    select(Insurer).where(Insurer.id == cutpay.insurer_id)
                )
                insurer = insurer_result.scalar_one_or_none()
                if insurer:
                    insurer_name = insurer.name
                    logger.info(
                        f"Retrieved insurer name from database: {insurer_name} (ID: {cutpay.insurer_id})"
                    )
            except Exception as e:
                logger.warning(f"Could not fetch insurer name from database: {e}")

        logger.info(
            f"Final names for quarterly Google Sheets - Broker: '{broker_name}', Insurer: '{insurer_name}'"
        )

        # Prepare complete data for Google Sheets (all fields from request)
        complete_sheets_data = prepare_complete_sheets_data_for_update(
            cutpay_data, cutpay, broker_name, insurer_name
        )

        logger.info(
            f"Syncing {len(complete_sheets_data)} fields to quarterly sheet '{quarter_sheet_name}': {list(complete_sheets_data.keys())}"
        )

        # Use the update method that targets specific quarterly sheet by policy number
        target_policy_number = (
            updated_policy_number if updated_policy_number else policy_number
        )
        logger.info(
            f"🔍 QUARTERLY SHEETS UPDATE DEBUG for policy '{target_policy_number}' in '{quarter_sheet_name}':"
        )
        logger.info(f"   - Original policy number: '{policy_number}'")
        logger.info(f"   - Updated policy number: '{updated_policy_number}'")
        logger.info(f"   - Target policy number: '{target_policy_number}'")
        logger.info(f"   - Quarter: {quarter}, Year: {year}")

        # Update the specific quarterly sheet with quarter and year parameters
        quarterly_result = await run_in_threadpool(
            quarterly_manager.update_existing_record_by_policy_number,
            complete_sheets_data,
            target_policy_number,
            quarter,  # Specify quarter
            year,  # Specify year
        )

        sync_results = {"cutpay": quarterly_result}
        logger.info(
            f"Step 2 SUCCESS: Quarterly Google Sheets sync finished for policy '{target_policy_number}' in '{quarter_sheet_name}': {quarterly_result.get('operation', 'UPDATE')}"
        )

    except Exception:
        logger.critical(
            f"Step 2 FAILED: Quarterly Google Sheets sync failed for policy '{policy_number}', but database changes are saved. Traceback:\n{traceback.format_exc()}"
        )
        return database_cutpay_response(cutpay)

    if not sync_results:
        logger.warning("Step 3 SKIPPED: No sync results to update flags.")
        return database_cutpay_response(cutpay)

    # Update sync flags
    try:
        logger.info(
            "Step 3: Beginning transaction to update sync flags with a new session."
        )
        from config import AsyncSessionLocal

        async with AsyncSessionLocal() as final_db_session:
            async with final_db_session.begin():
                result = await final_db_session.execute(
                    select(CutPay).filter(CutPay.id == cutpay.id)
                )
                final_cutpay = result.scalar_one_or_none()

                if final_cutpay and sync_results.get("cutpay", {}).get("success"):
                    final_cutpay.synced_to_cutpay_sheet = True
                    if sync_results["cutpay"].get("row_number"):
                        final_cutpay.cutpay_sheet_row_id = sync_results["cutpay"][
                            "row_number"
                        ]

            await final_db_session.refresh(final_cutpay)
            logger.info(
                f"Step 3 SUCCESS: Successfully updated sync flags for policy '{policy_number}' (CutPay ID {final_cutpay.id})."
            )
            logger.info(
                f"--- Update for policy '{policy_number}' in '{quarter_sheet_name}' finished successfully. ---"
            )
            return database_cutpay_response(final_cutpay)

    except Exception:
        logger.critical(
            f"Step 3 FAILED: Updating sync flags failed for policy '{policy_number}' (CutPay ID {cutpay.id}). Traceback:\n{traceback.format_exc()}"
        )
        return database_cutpay_response(cutpay)


# New delete route - delete by policy number and quarter (same concept as get/update routes)
@router.delete("/policy-delete")
async def delete_cutpay_transaction_by_policy(
    policy_number: str = Query(..., description="Policy number to delete"),
    quarter: int = Query(
        ..., ge=1, le=4, description="Quarter number (1-4) where the policy is located"
    ),
    year: int = Query(
        ..., ge=2020, le=2030, description="Year where the policy is located"
    ),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check=Depends(require_admin_cutpay),
):
    """
    Delete CutPay transaction by policy number from both database and specific quarterly Google Sheet

    This endpoint:
    1. Combines quarter and year into sheet name format (Q3-2025)
    2. Finds the policy in database by policy number
    3. Deletes the record from database
    4. Deletes the record from the specific quarterly Google Sheet

    Parameters:
    - policy_number: The policy number to delete
    - quarter: Quarter number (1-4) where the policy is located
    - year: Year where the policy is located

    Returns deletion status for both database and Google Sheets
    """
    quarter_sheet_name = f"Q{quarter}-{year}"
    cutpay = None

    try:
        logger.info(
            f"Step 1: Finding and deleting policy '{policy_number}' from database"
        )

        # Get the existing record by policy number
        result = await db.execute(
            select(CutPay)
            .where(CutPay.policy_number == policy_number)
            .order_by(desc(CutPay.id))  # Get the most recent one if multiple exist
        )
        cutpay = result.first()

        if cutpay:
            cutpay = cutpay[0]  # Extract the CutPay object from the Row
        else:
            raise HTTPException(
                status_code=404,
                detail=f"CutPay transaction with policy number '{policy_number}' not found in database",
            )

        # Store cutpay_id for logging before deletion
        cutpay_id = cutpay.id
        logger.info(f"Found policy '{policy_number}' in database with ID: {cutpay_id}")

        # Delete from database
        await db.delete(cutpay)
        await db.commit()

        logger.info(
            f"Step 1 SUCCESS: Deleted policy '{policy_number}' (CutPay ID {cutpay_id}) from database"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Step 1 FAILED: Database deletion failed for policy '{policy_number}': {str(e)}"
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete CutPay transaction from database: {str(e)}",
        )

    # Delete from specific quarterly Google Sheet
    sheets_deletion_success = False
    sheets_deletion_message = ""

    try:
        logger.info(
            f"Step 2: Deleting policy '{policy_number}' from quarterly sheet '{quarter_sheet_name}'"
        )
        from utils.quarterly_sheets_manager import quarterly_manager

        # Get the specific quarter sheet
        target_sheet = quarterly_manager.get_quarterly_sheet(quarter, year)

        if not target_sheet:
            logger.warning(
                f"Quarter sheet '{quarter_sheet_name}' not found in Google Sheets"
            )
            sheets_deletion_message = f"Quarter sheet '{quarter_sheet_name}' not found - no Google Sheets deletion performed"
        else:
            logger.info(
                f"Found quarter sheet '{quarter_sheet_name}', searching for policy to delete..."
            )

            # Get all data from the sheet to find the policy row
            all_values = target_sheet.get_all_values()
            if not all_values:
                sheets_deletion_message = (
                    f"No data found in quarter sheet '{quarter_sheet_name}'"
                )
            else:
                headers = all_values[0] if all_values else []

                # Find policy number column
                policy_col_index = -1
                for i, header in enumerate(headers):
                    if header.lower().strip() in ["policy number", "policy_number"]:
                        policy_col_index = i
                        logger.info(
                            f"Found policy number column at index {i}: '{header}'"
                        )
                        break

                if policy_col_index == -1:
                    sheets_deletion_message = f"Policy number column not found in quarter sheet '{quarter_sheet_name}'"
                    logger.warning("Policy number column not found in sheet headers")
                else:
                    # Find the row with matching policy number
                    found_row_index = -1

                    # Skip header (row 1) and dummy/formula row (row 2)
                    for row_index, row_data in enumerate(all_values[2:], start=3):
                        if policy_col_index < len(row_data):
                            cell_value = row_data[policy_col_index].strip()
                            if cell_value == policy_number.strip():
                                found_row_index = row_index
                                logger.info(
                                    f"Found policy '{policy_number}' in quarter sheet at row {row_index}"
                                )
                                break

                    if found_row_index == -1:
                        sheets_deletion_message = f"Policy '{policy_number}' not found in quarter sheet '{quarter_sheet_name}'"
                        logger.info(
                            f"Policy '{policy_number}' not found in {len(all_values)-1} data rows"
                        )
                    else:
                        # Delete the row from Google Sheets
                        target_sheet.delete_rows(found_row_index)
                        sheets_deletion_success = True
                        sheets_deletion_message = f"Successfully deleted policy '{policy_number}' from quarter sheet '{quarter_sheet_name}' at row {found_row_index}"
                        logger.info(
                            f"Step 2 SUCCESS: Deleted policy '{policy_number}' from quarter sheet row {found_row_index}"
                        )

    except Exception as sheets_error:
        logger.error(
            f"Step 2 FAILED: Quarterly Google Sheets deletion failed for policy '{policy_number}': {str(sheets_error)}"
        )
        logger.error(f"Sheets deletion error details: {traceback.format_exc()}")
        sheets_deletion_message = (
            f"Failed to delete from quarterly sheets: {str(sheets_error)}"
        )

    # Return deletion status
    response_data = {
        "message": f"Policy '{policy_number}' deletion completed",
        "policy_number": policy_number,
        "quarter": quarter,
        "year": year,
        "quarter_sheet_name": quarter_sheet_name,
        "database_deletion": {
            "success": True,
            "cutpay_id": cutpay_id if cutpay else None,
            "message": "Successfully deleted from database",
        },
        "sheets_deletion": {
            "success": sheets_deletion_success,
            "message": sheets_deletion_message,
        },
        "overall_success": sheets_deletion_success,  # Both database and sheets must succeed
        "metadata": {
            "deleted_at": datetime.now().isoformat(),
            "deleted_by": current_user.get("user_id", "unknown"),
            "target_quarter": quarter_sheet_name,
        },
    }

    if sheets_deletion_success:
        logger.info(
            f"--- Deletion for policy '{policy_number}' in '{quarter_sheet_name}' completed successfully ---"
        )
    else:
        logger.warning(
            f"--- Deletion for policy '{policy_number}' completed with sheets deletion issues ---"
        )

    return response_data


# =============================================================================
# DOCUMENT PROCESSING ENDPOINTS
# =============================================================================


@router.post("/upload-document", response_model=DocumentUploadResponse)
async def upload_policy_document(
    cutpay_id: int = Query(..., description="CutPay record ID to upload document for"),
    filename: str = Form(..., description="Document filename for upload"),
    document_type: str = Form("policy_pdf"),
    type: str = Form(
        ..., description="Document type - any string provided by frontend (required)"
    ),
    content_type: str | None = Form(None),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check=Depends(require_admin_cutpay),
):
    """
    Upload policy PDF or additional documents using presigned URL

    Parameters:
    - cutpay_id: The CutPay record ID to upload document for
    - filename: Document filename for upload
    - document_type: Type of document being uploaded
    - type: Document type - accepts any string from frontend (required)

    For additional documents (non-policy_pdf), the 'type' parameter will be used as the key
    in the additional_documents JSON field. If the same type is uploaded again, it will
    update the existing entry.

    Returns a presigned URL for direct upload to S3
    """
    try:
        # Find CutPay record by ID
        result = await db.execute(
            select(CutPay)
            .where(CutPay.id == cutpay_id)
            .order_by(desc(CutPay.id))  # Get the most recent one if multiple exist
        )
        cutpay = result.first()

        if cutpay:
            cutpay = cutpay[0]  # Extract the CutPay object from the Row
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"CutPay transaction with ID '{cutpay_id}' not found",
            )

        from utils.s3_utils import (
            build_cloudfront_url,
            build_key,
            generate_presigned_put_url,
        )

        # Validate PDF filename
        if not filename or not filename.lower().endswith(".pdf"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Valid PDF filename is required",
            )

        key = build_key(prefix=f"cutpay/{cutpay_id}", filename=filename)
        upload_url = generate_presigned_put_url(
            key=key, content_type=content_type or "application/pdf"
        )
        document_url = build_cloudfront_url(key)

        # Comprehensive debugging for presigned uploads
        logger.info(
            f"🔵 PRESIGNED: Processing document_type='{document_type}' with type='{type}' for CutPay ID '{cutpay_id}'"
        )
        logger.info(f"🔵 PRESIGNED: Document URL generated: {document_url}")
        logger.info(
            f"🔵 PRESIGNED: Before update - policy_pdf_url: '{cutpay.policy_pdf_url}'"
        )
        logger.info(
            f"🔵 PRESIGNED: Before update - additional_documents: {cutpay.additional_documents}"
        )

        # Normalize document_type to handle any whitespace/case issues
        document_type_clean = document_type.strip() if document_type else ""
        type_clean = type.strip() if type else ""
        logger.info(f"🔵 PRESIGNED: Cleaned document_type: '{document_type_clean}'")
        logger.info(f"🔵 PRESIGNED: Cleaned type: '{type_clean}'")
        logger.info(
            f"🔵 PRESIGNED: document_type_clean == 'policy_pdf': {document_type_clean == 'policy_pdf'}"
        )

        if document_type_clean == "policy_pdf":
            logger.info(
                "✅ PRESIGNED: ENTERING policy_pdf branch - UPDATING policy_pdf_url"
            )
            old_url = cutpay.policy_pdf_url
            cutpay.policy_pdf_url = document_url
            logger.info(
                f"✅ PRESIGNED: policy_pdf_url updated from '{old_url}' to '{cutpay.policy_pdf_url}'"
            )
        else:
            logger.info(
                f"❌ PRESIGNED: ENTERING additional_documents branch using frontend-provided type: '{type_clean}'"
            )

            # Parse existing additional documents (handle both JSON string and dict formats)
            current_additional_docs = cutpay.additional_documents or {}
            existing_docs = {}

            if current_additional_docs:
                if isinstance(current_additional_docs, str):
                    # Parse JSON string from database
                    try:
                        import json

                        existing_docs = json.loads(current_additional_docs)
                    except (json.JSONDecodeError, TypeError):
                        logger.warning(
                            f"Failed to parse additional_documents as JSON: {current_additional_docs}"
                        )
                        existing_docs = {}
                elif isinstance(current_additional_docs, dict):
                    existing_docs = current_additional_docs.copy()
                else:
                    # Handle other legacy formats if needed
                    logger.info(
                        f"Converting legacy additional_documents format: {type(current_additional_docs)}"
                    )
                    existing_docs = {}

            # Add/update document with the provided type as key
            if not type_clean:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="'type' parameter is required for additional documents",
                )

            # Create new document info
            new_doc_info = {
                "filename": filename,
                "url": document_url,
                "uploaded_at": datetime.now().isoformat(),
                "uploaded_by": str(current_user["user_id"]),
                "document_type": type_clean,
            }

            old_value = existing_docs.get(type_clean, "None")

            # Update or add the document for this type (overwrites if type exists)
            existing_docs[type_clean] = new_doc_info

            # Convert to JSON string for database storage
            import json

            cutpay.additional_documents = json.dumps(existing_docs)

            logger.info(
                f"❌ PRESIGNED: additional_documents['{type_clean}'] updated from '{old_value}' to new document info"
            )
            logger.info(
                f"❌ PRESIGNED: New additional_documents JSON: {json.dumps(existing_docs)}"
            )

        # Mark the field as modified to ensure SQLAlchemy detects the change
        attributes.flag_modified(cutpay, "additional_documents")

        # Force database commit and refresh
        await db.commit()
        await db.refresh(cutpay)

        logger.info(
            f"🔵 PRESIGNED: After commit/refresh - policy_pdf_url: '{cutpay.policy_pdf_url}'"
        )
        logger.info(
            f"🔵 PRESIGNED: After commit/refresh - additional_documents: {cutpay.additional_documents}"
        )
        logger.info(f"Generated presigned URL for CutPay ID '{cutpay_id}', key: {key}")

        return DocumentUploadResponse(
            document_url=document_url,
            document_type=(
                type_clean
                if document_type_clean != "policy_pdf"
                else document_type_clean
            ),  # Use type for additional docs
            upload_status="presigned",
            message="Presigned URL generated; upload directly to S3",
            upload_url=upload_url,
        )

    except Exception as e:
        logger.error(f"Failed to upload document for CutPay ID '{cutpay_id}': {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Document upload failed: {str(e)}",
        )


@router.post("/extract-pdf", response_model=ExtractionResponse)
async def extract_pdf_data_endpoint(
    file: UploadFile = File(..., description="Policy PDF file for extraction"),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check=Depends(require_admin_cutpay),
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
        if not file.filename or not file.filename.lower().endswith(".pdf"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Please upload a valid PDF file",
            )

        pdf_bytes = await file.read()

        if len(pdf_bytes) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty"
            )

        from utils.ai_utils import extract_policy_data_from_pdf_bytes

        extracted_data_dict = await extract_policy_data_from_pdf_bytes(pdf_bytes)

        if not extracted_data_dict:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to extract data from PDF. Please ensure the PDF contains readable policy information.",
            )

        extracted_data = ExtractedPolicyData(**extracted_data_dict)

        return ExtractionResponse(
            extraction_status="completed",
            extracted_data=extracted_data,
            extraction_time=datetime.now(),
        )

    except Exception as e:
        logger.error(f"PDF extraction failed for CutPay {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"PDF extraction failed: {str(e)}",
        )


# =============================================================================
# AGENT FINANCIAL TRACKING ENDPOINTS
# =============================================================================


@router.get("/agent/{agent_code}/financial-summary", response_model=Dict[str, Any])
async def get_agent_financial_summary_endpoint(
    agent_code: str,
    current_user=Depends(get_current_user),
    _rbac_check=Depends(require_admin_cutpay),
):
    """
    Get agent financial summary from Google Sheets Summary tab

    Returns financial data for the specified agent including:
    - Running Balance (True and True&False)
    - Net Premium (True and True&False)
    - Commissionable Premium (True and True&False)
    - Policy Count (True)

    Parameters:
    - agent_code: The agent code to fetch summary for (e.g., IZ0001)

    Returns data from the Summary sheet for both "True" and "True&False" categories
    """
    try:
        logger.info(f"Fetching financial summary for agent: {agent_code}")

        from utils.quarterly_sheets_manager import quarterly_manager

        # Get the summary sheet from Google Sheets
        try:
            # Access the summary sheet (assuming it's named "Summary" in the quarterly workbook)
            summary_sheet = quarterly_manager.get_summary_sheet()

            if not summary_sheet:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Summary sheet not found in Google Sheets",
                )

            logger.info("Successfully accessed Summary sheet")

        except Exception as sheet_error:
            logger.error(f"Failed to access Summary sheet: {str(sheet_error)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to access Summary sheet: {str(sheet_error)}",
            )

        # Get all data from the summary sheet
        try:
            all_values = summary_sheet.get_all_values()

            if not all_values or len(all_values) < 2:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="No data found in Summary sheet",
                )

            headers = all_values[0]
            data_rows = all_values[1:]

            logger.info(
                f"Summary sheet has {len(headers)} columns and {len(data_rows)} data rows"
            )
            logger.info(f"Headers: {headers}")

        except Exception as data_error:
            logger.error(f"Failed to read Summary sheet data: {str(data_error)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to read Summary sheet data: {str(data_error)}",
            )

        # Find the agent code column and the agent's row
        agent_code_col_index = -1
        for i, header in enumerate(headers):
            if header.lower().strip() in ["agent code", "agent_code"]:
                agent_code_col_index = i
                logger.info(f"Found agent code column at index {i}: '{header}'")
                break

        if agent_code_col_index == -1:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Agent Code column not found in Summary sheet",
            )

        # Find the agent's data row
        agent_row = None
        agent_row_index = -1

        for row_index, row_data in enumerate(data_rows):
            if agent_code_col_index < len(row_data):
                cell_value = row_data[agent_code_col_index].strip()
                if cell_value.upper() == agent_code.upper():
                    agent_row = row_data
                    agent_row_index = (
                        row_index + 2
                    )  # +2 because we start from data_rows (skipped header) and sheets are 1-indexed
                    logger.info(f"Found agent '{agent_code}' at row {agent_row_index}")
                    break

        if not agent_row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Agent code '{agent_code}' not found in Summary sheet",
            )

        # Extract financial data based on expected column structure
        # Expected columns: Agent Code, Running Balance (True), Net Premium (True), Commissionable Premium (True),
        # Policy Count (True), Running Balance (True&False), Net Premium (True&False), Commissionable Premium (True&False)

        financial_data = {
            "agent_code": agent_code,
            "true_category": {},
            "true_and_false_category": {},
            "metadata": {
                "sheet_row": agent_row_index,
                "fetched_at": datetime.now().isoformat(),
                "total_columns": len(headers),
                "available_columns": headers,
            },
        }

        # Create a mapping of header names to values for easier access
        header_value_map = {}
        for i, header in enumerate(headers):
            if i < len(agent_row):
                value = agent_row[i].strip()
                header_value_map[header.strip()] = value
                logger.info(f"Column '{header}': '{value}'")

        # Extract "True" category data
        true_data = {}
        if "Running Balance (True)" in header_value_map:
            try:
                true_data["running_balance"] = (
                    float(header_value_map["Running Balance (True)"])
                    if header_value_map["Running Balance (True)"]
                    else 0.0
                )
            except (ValueError, TypeError):
                true_data["running_balance"] = 0.0

        if "Net Premium (True)" in header_value_map:
            try:
                true_data["net_premium"] = (
                    float(header_value_map["Net Premium (True)"])
                    if header_value_map["Net Premium (True)"]
                    else 0.0
                )
            except (ValueError, TypeError):
                true_data["net_premium"] = 0.0

        if "Commissionable Premium (True)" in header_value_map:
            try:
                true_data["commissionable_premium"] = (
                    float(header_value_map["Commissionable Premium (True)"])
                    if header_value_map["Commissionable Premium (True)"]
                    else 0.0
                )
            except (ValueError, TypeError):
                true_data["commissionable_premium"] = 0.0

        if "Policy Count (True)" in header_value_map:
            try:
                true_data["policy_count"] = (
                    int(header_value_map["Policy Count (True)"])
                    if header_value_map["Policy Count (True)"]
                    else 0
                )
            except (ValueError, TypeError):
                true_data["policy_count"] = 0

        financial_data["true_category"] = true_data

        # Extract "True&False" category data
        true_false_data = {}
        if "Running Balance (True&False)" in header_value_map:
            try:
                true_false_data["running_balance"] = (
                    float(header_value_map["Running Balance (True&False)"])
                    if header_value_map["Running Balance (True&False)"]
                    else 0.0
                )
            except (ValueError, TypeError):
                true_false_data["running_balance"] = 0.0

        if "Net Premium (True&False)" in header_value_map:
            try:
                true_false_data["net_premium"] = (
                    float(header_value_map["Net Premium (True&False)"])
                    if header_value_map["Net Premium (True&False)"]
                    else 0.0
                )
            except (ValueError, TypeError):
                true_false_data["net_premium"] = 0.0

        if "Commissionable Premium (True&False)" in header_value_map:
            try:
                true_false_data["commissionable_premium"] = (
                    float(header_value_map["Commissionable Premium (True&False)"])
                    if header_value_map["Commissionable Premium (True&False)"]
                    else 0.0
                )
            except (ValueError, TypeError):
                true_false_data["commissionable_premium"] = 0.0

        financial_data["true_and_false_category"] = true_false_data

        # Add summary calculations
        financial_data["summary"] = {
            "difference_running_balance": true_false_data.get("running_balance", 0.0)
            - true_data.get("running_balance", 0.0),
            "difference_net_premium": true_false_data.get("net_premium", 0.0)
            - true_data.get("net_premium", 0.0),
            "difference_commissionable_premium": true_false_data.get(
                "commissionable_premium", 0.0
            )
            - true_data.get("commissionable_premium", 0.0),
            "total_policy_count": true_data.get("policy_count", 0),
        }

        logger.info(f"Successfully fetched financial summary for agent '{agent_code}':")
        logger.info(f"True category: {true_data}")
        logger.info(f"True&False category: {true_false_data}")

        return financial_data

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Failed to fetch financial summary for agent '{agent_code}': {str(e)}"
        )
        logger.error(f"Error details: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch agent financial summary: {str(e)}",
        )


# =============================================================================
# CUTPAY AGENT CONFIG ENDPOINTS
# =============================================================================


@router.post("/agent-config", response_model=CutPayAgentConfigResponse)
async def create_agent_config(
    config_data: CutPayAgentConfigCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    _rbac_check=Depends(require_admin_cutpay),
):
    """Create new CutPay agent configuration"""
    try:
        # Check if config already exists for this agent and date
        existing_config = await db.execute(
            select(CutPayAgentConfig).where(
                CutPayAgentConfig.agent_code == config_data.agent_code,
                CutPayAgentConfig.date == config_data.config_date,
            )
        )
        if existing_config.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Configuration already exists for agent {config_data.agent_code} on date {config_data.config_date}",
            )

        config_dict = config_data.dict()
        config_dict["date"] = config_dict.pop("config_date")  # Map config_date to date
        config_dict["created_by"] = current_user["user_id"]

        agent_config = CutPayAgentConfig(**config_dict)
        db.add(agent_config)
        await db.commit()
        await db.refresh(agent_config)

        logger.info(
            f"Created agent config {agent_config.id} for agent {config_data.agent_code}"
        )
        return CutPayAgentConfigResponse.model_validate(agent_config)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create agent config: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create agent configuration: {str(e)}",
        )


@router.get("/agent-config/agent/{agent_code}/po-paid", response_model=AgentPOResponse)
async def get_agent_po_paid(
    agent_code: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
    _rbac_check=Depends(require_admin_cutpay),
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
                configurations_count=0,
            )

        total_po_paid = sum(float(config.po_paid_to_agent) for config in configs)
        latest_config_date = max(config.date for config in configs)

        return AgentPOResponse(
            agent_code=agent_code,
            total_po_paid=total_po_paid,
            latest_config_date=latest_config_date,
            configurations_count=len(configs),
        )

    except Exception as e:
        logger.error(f"Failed to get PO paid for agent {agent_code}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch agent PO data: {str(e)}",
        )


@router.get("/agent-config/{config_id}", response_model=CutPayAgentConfigResponse)
async def get_agent_config(
    config_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
    _rbac_check=Depends(require_admin_cutpay),
):
    """Get specific agent configuration by ID"""
    result = await db.execute(
        select(CutPayAgentConfig).where(CutPayAgentConfig.id == config_id)
    )
    config = result.scalar_one_or_none()

    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Agent configuration {config_id} not found",
        )

    return CutPayAgentConfigResponse.model_validate(config)


@router.put("/agent-config/{config_id}", response_model=CutPayAgentConfigResponse)
async def update_agent_config(
    config_id: int,
    config_data: CutPayAgentConfigUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
    _rbac_check=Depends(require_admin_cutpay),
):
    """Update agent configuration"""
    try:
        result = await db.execute(
            select(CutPayAgentConfig).where(CutPayAgentConfig.id == config_id)
        )
        config = result.scalar_one_or_none()

        if not config:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Agent configuration {config_id} not found",
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
            detail=f"Failed to update agent configuration: {str(e)}",
        )


@router.delete("/agent-config/{config_id}")
async def delete_agent_config(
    config_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
    _rbac_check=Depends(require_admin_cutpay),
):
    """Delete agent configuration"""
    result = await db.execute(
        select(CutPayAgentConfig).where(CutPayAgentConfig.id == config_id)
    )
    config = result.scalar_one_or_none()

    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Agent configuration {config_id} not found",
        )

    await db.delete(config)
    await db.commit()

    logger.info(f"Deleted agent config {config_id}")
    return {"message": f"Agent configuration {config_id} deleted successfully"}
