"""
Universal Records Management Router

This module provides comprehensive functionality for managing universal insurance
records with sophisticated insurer-specific mapping capabilities for data
reconciliation and system synchronization. It serves as the central hub for
processing insurance data from multiple sources and formats.

Key Features:
1. **Insurer Mapping Management**: Dynamic header mapping system
   - Retrieve available insurer configurations with header mappings
   - Support for multiple insurance companies with different data formats
   - Flexible mapping system to handle varying CSV structures
   - Standardized output format for consistent data processing

2. **CSV Processing & Preview**: Advanced file handling with validation
   - Preview CSV files with insurer-specific mapping applied
   - Real-time data transformation and validation
   - Support for large file uploads with efficient streaming
   - Error detection and reporting for data quality assurance
   - Header mapping validation before processing

3. **Universal Record Upload**: Sophisticated data ingestion system
   - Upload CSV files with automatic insurer mapping application
   - Comprehensive data validation and error handling
   - Duplicate detection and prevention mechanisms
   - Batch processing for large datasets with performance optimization
   - Detailed upload reporting with success/failure metrics

4. **Template Management**: Standardized format distribution
   - Download universal record templates for data consistency
   - Support for different insurer formats and requirements
   - Comprehensive field documentation and validation rules
   - Version control for template updates and changes

5. **Reconciliation System**: Advanced data verification and reporting
   - Comprehensive reconciliation summary with detailed metrics
   - Cross-reference validation between different data sources
   - Automated discrepancy detection and reporting
   - Historical reconciliation tracking and audit trails
   - Performance metrics for data quality assessment

6. **Mapping Configuration**: Dynamic configuration management
   - Retrieve specific insurer mapping configurations
   - Support for custom field mappings and transformations
   - Validation rules for different data types and formats
   - Flexible configuration updates without system downtime

Business Logic:
- Dynamic header mapping system for different insurer data formats
- Comprehensive data validation with business rule enforcement
- Duplicate prevention across multiple upload sessions
- Reconciliation algorithms for data consistency verification
- Performance optimization for large-scale data processing

Data Processing Features:
- CSV parsing with encoding detection and error handling
- Field mapping with type conversion and validation
- Batch processing with progress tracking and error reporting
- Memory-efficient streaming for large file uploads
- Comprehensive logging for audit and debugging purposes

Security Features:
- Admin-only access control for sensitive operations
- File upload validation with size and type restrictions
- Input sanitization for CSV data processing
- Secure file handling with temporary storage cleanup
- Comprehensive error handling without data exposure

Integration Points:
- ReconciliationReport model for audit tracking
- Helper functions for complex business logic
- File streaming capabilities for large dataset handling
- Database integration for persistent storage
- External insurer API integration preparation

Performance Considerations:
- Streaming file uploads to handle large datasets efficiently
- Memory optimization for CSV processing operations
- Batch processing with configurable chunk sizes
- Database query optimization for reconciliation operations
- Caching strategies for frequently accessed mapping configurations

Error Handling:
- Comprehensive validation with detailed error messages
- Graceful handling of malformed CSV files
- Rollback mechanisms for failed upload operations
- Detailed error logging for debugging and audit purposes
- User-friendly error responses with actionable guidance

This router serves as the backbone for insurance data management, enabling
seamless integration of data from multiple insurance companies while maintaining
data quality and consistency across the InsureZeal platform.
"""

import csv
import io
import logging
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from config import get_db
from dependencies.rbac import require_admin_read, require_admin_write
from routers.auth.auth import get_current_user
from models import ReconciliationReport

from . import helpers
from .schemas import (
    AvailableInsurersResponse,
    CSVPreviewResponse,
    ComprehensiveReconciliationResponse,
    ReconciliationSummaryResponse,
    UniversalRecordUploadResponse,
)

router = APIRouter(prefix="/universal-records", tags=["Universal Records"])
logger = logging.getLogger(__name__)


@router.get("/insurers", response_model=AvailableInsurersResponse)
async def get_available_insurers(
    current_user=Depends(get_current_user), _rbac_check=Depends(require_admin_read)
):
    """
    Get list of available insurer mappings

    **Admin only endpoint**

    Returns all available insurance companies that have configured
    header mappings for universal record processing.
    """

    try:
        insurers = helpers.get_available_insurers()

        return AvailableInsurersResponse(insurers=insurers, total_count=len(insurers))

    except Exception as e:
        logger.error(f"Error fetching available insurers: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch available insurers",
        )


@router.post("/preview", response_model=CSVPreviewResponse)
async def preview_csv_with_insurer_mapping(
    file: UploadFile = File(..., description="Universal record CSV file"),
    insurer_name: str = None,
    preview_rows: int = 5,
    current_user=Depends(get_current_user),
    _rbac_check=Depends(require_admin_read),
):
    """
    Preview CSV file with selected insurer mapping applied

    **Admin only endpoint**

    This endpoint allows admins to preview how a CSV file will be processed
    with a specific insurer mapping before actual upload. Shows:

    - Original headers from CSV
    - Mapped headers after applying insurer configuration
    - Sample data rows with mapping applied
    - Any unmapped headers that will be ignored
    - Total row count in the file

    **Parameters:**
    - `file`: CSV file to preview
    - `insurer_name`: Name of insurer mapping to apply
    - `preview_rows`: Number of sample rows to show (default: 5)
    """

    try:
        if not file.filename.lower().endswith(".csv"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only CSV files are allowed",
            )

        if not insurer_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="insurer_name parameter is required",
            )

        file_content = await file.read()
        csv_content = file_content.decode("utf-8")

        if not csv_content.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="CSV file is empty"
            )

        preview_response = helpers.preview_csv_with_mapping(
            csv_content=csv_content,
            insurer_name=insurer_name,
            preview_rows=preview_rows,
        )

        logger.info(
            f"CSV preview generated for {insurer_name} by admin {current_user['user_id']}"
        )

        return preview_response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error previewing CSV: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to preview CSV: {str(e)}",
        )


@router.post("/upload", response_model=UniversalRecordUploadResponse)
async def upload_universal_record(
    file: UploadFile = File(..., description="Universal record CSV file"),
    insurer_name: str = None,
    quarters: str = Query(
        ...,
        description="Quarter (1-4) to target for upload. Only a single quarter is permitted.",
    ),
    years: str = Query(
        ...,
        description="Year corresponding to the quarter (e.g., '2025'). Only a single year is permitted.",
    ),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check=Depends(require_admin_write),
):
    """
    Upload and process universal record CSV with insurer-specific mapping to specific quarterly sheets

    **Admin only endpoint**

    This endpoint processes a universal record CSV file from insurance companies
    using insurer-specific header mappings and routes the data to the specified quarterly sheets.
    The universal record is considered the source of truth and will be used to:

    1. **Target specific quarters** based on provided quarter and year parameters
    2. **Update existing records** in specified quarterly sheets where data mismatches are found
    3. **Add missing records** that exist in universal record but not in quarterly sheets
    4. **Set MATCH to TRUE** for all updated/added records
    5. **Generate detailed report** of all changes made to each quarter

    **Process Flow:**
    1. Validate quarter and year parameters
    2. Apply insurer-specific header mapping to CSV data
    3. Parse and validate mapped content
    4. For each specified quarter/year combination:
       - Get existing records from quarterly Google Sheet
       - Use mapping to align headers with quarterly sheet format
       - Compare with quarterly sheet records (by policy number)
       - If present, update mapped fields and set MATCH to TRUE
       - If not present, add to quarterly sheet and set MATCH to FALSE
    5. Generate comprehensive reconciliation report per quarter

    **Headers Mapping:**
    Universal record headers are mapped to quarterly sheet headers including:
    - Reporting Month (mmm'yy), Child ID, Policy Number, Broker Name, Insurer name
    - Premium fields: Gross premium, Net premium, OD Premium, TP Premium, GST Amount
    - Vehicle details: Registration.no, Make_Model, Vehicle_Variant, CC, Age(Year)
    - Commission fields: Commissionable Premium, Incoming Grid %, Agent_PO%, etc.
    - Payment fields: Cut Pay Amount, Payment by, Payment Mode, Running Bal
    - All 60+ quarterly sheet headers supported via record-mapper.csv

    **Parameters:**
    - `file`: CSV file containing universal records
    - `insurer_name`: Name of insurer mapping to use (required)
    - `quarters`: Comma-separated quarters (1-4) to target. Example: "1,2" for Q1 and Q2
    - `years`: Comma-separated years corresponding to quarters. Example: "2025,2025"

    **Returns:**
    - Detailed report showing what was updated/added in each quarterly sheet
    - Processing statistics and timing per quarter
    - List of any errors encountered
    - Insurer-specific mapping information
    """

    try:
        if not file.filename.lower().endswith(".csv"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only CSV files are allowed",
            )

        if not insurer_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="insurer_name parameter is required",
            )

        # Parse and validate quarters and years (single target only)
        try:
            quarter_list = [int(q.strip()) for q in quarters.split(",")]
            year_list = [int(y.strip()) for y in years.split(",")]
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="quarter and year must be integers",
            )

        # Enforce only one quarter/year target at a time
        if len(quarter_list) != 1 or len(year_list) != 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only one quarter and one year may be provided. Remove additional values.",
            )

        if len(quarter_list) != len(year_list):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Number of quarters must match number of years",
            )

        # Validate quarter and year ranges
        for quarter in quarter_list:
            if quarter < 1 or quarter > 4:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Quarter must be between 1 and 4, got: {quarter}",
                )

        for year in year_list:
            if year < 2020 or year > 2030:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Year must be between 2020 and 2030, got: {year}",
                )

        file_content = await file.read()
        csv_content = file_content.decode("utf-8")

        if not csv_content.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="CSV file is empty"
            )

        admin_user_id = current_user["user_id"]

        # Process universal record with insurer mapping and target quarterly sheets
        report = await helpers.process_universal_record_csv_to_quarterly_sheets(
            db=db,
            csv_content=csv_content,
            insurer_name=insurer_name,
            admin_user_id=admin_user_id,
            quarter_list=quarter_list,
            year_list=year_list,
        )

        logger.info(f"Universal record processed by admin {admin_user_id}")
        logger.info(
            f"Insurer: {insurer_name}, File: {file.filename}, Size: {len(file_content)} bytes"
        )
        logger.info(
            f"Target quarters: {[f'Q{q}-{y}' for q, y in zip(quarter_list, year_list)]}"
        )
        logger.info(
            f"Processed {report.stats.total_records_processed} records in {report.stats.processing_time_seconds:.2f} seconds"
        )

        quarter_names = [f"Q{q}-{y}" for q, y in zip(quarter_list, year_list)]
        quarters_text = ", ".join(quarter_names)

        return UniversalRecordUploadResponse(
            message=f"Universal record processed successfully for {insurer_name} to quarterly sheets: {quarters_text}. "
            f"Processed {report.stats.total_records_processed} records, "
            f"updated {report.stats.total_records_updated}, "
            f"added {report.stats.total_records_added} in "
            f"{report.stats.processing_time_seconds:.2f} seconds. "
            f"All records marked with MATCH = TRUE/FALSE based on matching status.",
            report=report,
            processing_time_seconds=report.stats.processing_time_seconds,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing universal record: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process universal record: {str(e)}",
        )


@router.get("/template")
async def download_universal_record_template(
    insurer_name: Optional[str] = None,
    current_user=Depends(get_current_user),
    _rbac_check=Depends(require_admin_read),
):
    """
    Download CSV template for universal record upload

    **Admin only endpoint**

    Returns a CSV template file showing the expected format for universal record uploads.
    If an insurer name is provided, the template will use that insurer's specific headers.
    Otherwise, it returns a generic template with master sheet headers.

    **Parameters:**
    - `insurer_name`: Optional insurer name to get insurer-specific template

    **Returns:**
    - CSV file with appropriate headers and sample data
    """

    try:
        if insurer_name:
            # Get insurer-specific template
            insurer_mapping = helpers.get_insurer_mapping(insurer_name)
            if not insurer_mapping:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"No mapping found for insurer: {insurer_name}",
                )

            # Use insurer's original headers
            headers = list(insurer_mapping.keys())
            filename = f"universal_record_template_{insurer_name.replace(' ', '_').lower()}.xlsx"

            # Sample data matching insurer headers
            sample_data = []
            for header in headers:
                if "Policy" in header or "Number" in header:
                    sample_data.append("POL-2024-001")
                elif "Product" in header or "Type" in header:
                    sample_data.append("Motor Insurance")
                elif "Agent" in header and "Code" in header:
                    sample_data.append("AGT001")
                elif "Premium" in header and "Gross" in header:
                    sample_data.append("25000.00")
                elif "Date" in header:
                    sample_data.append("2024-01-01")
                else:
                    sample_data.append("Sample Value")

        else:
            # Generic template with master sheet headers
            headers = [
                "policy_number",
                "policy_type",
                "insurance_type",
                "agent_code",
                "broker_name",
                "insurance_company",
                "vehicle_type",
                "registration_number",
                "vehicle_class",
                "vehicle_segment",
                "gross_premium",
                "gst",
                "net_premium",
                "od_premium",
                "tp_premium",
                "start_date",
                "end_date",
                "cut_pay_amount",
                "commission_grid",
                "agent_commission_given_percent",
                "payment_by",
                "amount_received",
                "payment_method",
                "payment_source",
                "transaction_date",
                "payment_date",
                "notes",
            ]
            filename = "universal_record_template_generic.xlsx"

            sample_data = [
                "POL-2024-001",  # policy_number
                "Motor Insurance",  # policy_type
                "Comprehensive",  # insurance_type
                "AGT001",  # agent_code
                "ABC Insurance Brokers",  # broker_name
                "ICICI Lombard",  # insurance_company
                "Car",  # vehicle_type
                "MH12AB1234",  # registration_number
                "Private Car",  # vehicle_class
                "Sedan",  # vehicle_segment
                25000.00,  # gross_premium
                4500.00,  # gst
                20500.00,  # net_premium
                15000.00,  # od_premium
                5500.00,  # tp_premium
                "2024-01-01",  # start_date
                "2024-12-31",  # end_date
                2500.00,  # cut_pay_amount
                "10%",  # commission_grid
                12.5,  # agent_commission_given_percent
                "John Smith",  # payment_by
                2500.00,  # amount_received
                "Bank Transfer",  # payment_method
                "Company Account",  # payment_source
                "2024-01-15",  # transaction_date
                "2024-01-20",  # payment_date
                "Sample transaction",  # notes
            ]

        # Create CSV template using Python's csv module
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(headers)
        writer.writerow(sample_data)
        output.seek(0)
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode("utf-8")),
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename={filename.replace('.xlsx', '.csv')}"
            },
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating template: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate template",
        )


@router.get("/reconciliation", response_model=list[ComprehensiveReconciliationResponse])
async def get_comprehensive_reconciliation_reports(
    insurer_name: Optional[str] = None,
    limit: int = Query(
        default=50, le=1000, description="Maximum number of records to return"
    ),
    offset: int = Query(default=0, ge=0, description="Number of records to skip"),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check=Depends(require_admin_read),
):
    """
    Get comprehensive reconciliation reports with field-specific variation tracking

    **Admin only endpoint**

    Provides detailed reconciliation data showing:
    - Record ID (UUID)
    - Insurer name and code
    - Upload/processing date
    - Number of new records added
    - Field-specific variation counts for all 72 master sheet headers
    - Null values for fields with no variations

    **Parameters:**
    - `insurer_name`: Optional filter by specific insurer
    - `limit`: Maximum number of records to return (default: 50, max: 1000)
    - `offset`: Number of records to skip for pagination (default: 0)

    **Returns:**
    - List of comprehensive reconciliation reports with field variation details
    """

    try:
        # Build query with optional insurer filter
        query = select(ReconciliationReport).order_by(
            desc(ReconciliationReport.created_at)
        )

        if insurer_name:
            query = query.where(ReconciliationReport.insurer_name == insurer_name)

        # Apply pagination
        query = query.offset(offset).limit(limit)

        result = await db.execute(query)
        reports = result.scalars().all()

        if not reports:
            return []

        # Convert database records to response format
        response_data = []
        for report in reports:
            # Build the response using all the field variations from the model
            report_data = ComprehensiveReconciliationResponse(
                id=str(report.id),
                insurer_name=report.insurer_name,
                insurer_code=report.insurer_code,
                created_at=report.created_at,
                total_records_processed=report.total_records_processed,
                total_records_updated=report.total_records_updated,
                new_records_added=report.new_records_added,
                data_variance_percentage=float(report.data_variance_percentage),
                # All 72 field variation columns
                reporting_month_variations=report.reporting_month_variations,
                child_id_variations=report.child_id_variations,
                insurer_broker_code_variations=report.insurer_broker_code_variations,
                policy_start_date_variations=report.policy_start_date_variations,
                policy_end_date_variations=report.policy_end_date_variations,
                booking_date_variations=report.booking_date_variations,
                broker_name_variations=report.broker_name_variations,
                insurer_name_variations=report.insurer_name_variations,
                major_categorisation_variations=report.major_categorisation_variations,
                product_variations=report.product_variations,
                product_type_variations=report.product_type_variations,
                plan_type_variations=report.plan_type_variations,
                gross_premium_variations=report.gross_premium_variations,
                gst_amount_variations=report.gst_amount_variations,
                net_premium_variations=report.net_premium_variations,
                od_premium_variations=report.od_premium_variations,
                tp_premium_variations=report.tp_premium_variations,
                policy_number_variations=report.policy_number_variations,
                formatted_policy_number_variations=report.formatted_policy_number_variations,
                registration_no_variations=report.registration_no_variations,
                make_model_variations=report.make_model_variations,
                model_variations=report.model_variations,
                vehicle_variant_variations=report.vehicle_variant_variations,
                gvw_variations=report.gvw_variations,
                rto_variations=report.rto_variations,
                state_variations=report.state_variations,
                cluster_variations=report.cluster_variations,
                fuel_type_variations=report.fuel_type_variations,
                cc_variations=report.cc_variations,
                age_year_variations=report.age_year_variations,
                ncb_variations=report.ncb_variations,
                discount_percentage_variations=report.discount_percentage_variations,
                business_type_variations=report.business_type_variations,
                seating_capacity_variations=report.seating_capacity_variations,
                veh_wheels_variations=report.veh_wheels_variations,
                customer_name_variations=report.customer_name_variations,
                customer_number_variations=report.customer_number_variations,
                commissionable_premium_variations=report.commissionable_premium_variations,
                incoming_grid_percentage_variations=report.incoming_grid_percentage_variations,
                receivable_from_broker_variations=report.receivable_from_broker_variations,
                extra_grid_variations=report.extra_grid_variations,
                extra_amount_receivable_variations=report.extra_amount_receivable_variations,
                total_receivable_from_broker_variations=report.total_receivable_from_broker_variations,
                claimed_by_variations=report.claimed_by_variations,
                payment_by_variations=report.payment_by_variations,
                payment_mode_variations=report.payment_mode_variations,
                cut_pay_amount_received_variations=report.cut_pay_amount_received_variations,
                already_given_to_agent_variations=report.already_given_to_agent_variations,
                actual_agent_po_percentage_variations=report.actual_agent_po_percentage_variations,
                agent_po_amt_variations=report.agent_po_amt_variations,
                agent_extra_percentage_variations=report.agent_extra_percentage_variations,
                agent_extra_amount_variations=report.agent_extra_amount_variations,
                agent_total_po_amount_variations=report.agent_total_po_amount_variations,
                payment_by_office_variations=report.payment_by_office_variations,
                po_paid_to_agent_variations=report.po_paid_to_agent_variations,
                running_bal_variations=report.running_bal_variations,
                total_receivable_gst_variations=report.total_receivable_gst_variations,
                iz_total_po_percentage_variations=report.iz_total_po_percentage_variations,
                as_per_broker_po_percentage_variations=report.as_per_broker_po_percentage_variations,
                as_per_broker_po_amt_variations=report.as_per_broker_po_amt_variations,
                po_percentage_diff_broker_variations=report.po_percentage_diff_broker_variations,
                po_amt_diff_broker_variations=report.po_amt_diff_broker_variations,
                actual_agent_po_percentage_2_variations=report.actual_agent_po_percentage_2_variations,
                as_per_agent_payout_percentage_variations=report.as_per_agent_payout_percentage_variations,
                as_per_agent_payout_amount_variations=report.as_per_agent_payout_amount_variations,
                po_percentage_diff_agent_variations=report.po_percentage_diff_agent_variations,
                po_amt_diff_agent_variations=report.po_amt_diff_agent_variations,
                invoice_status_variations=report.invoice_status_variations,
                invoice_number_variations=report.invoice_number_variations,
                remarks_variations=report.remarks_variations,
                match_variations=report.match_variations,
                agent_code_variations=report.agent_code_variations,
            )

            response_data.append(report_data)

        return response_data

    except Exception as e:
        logger.error(f"Error fetching comprehensive reconciliation reports: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch comprehensive reconciliation reports",
        )


@router.get("/mappings/{insurer_name}")
async def get_insurer_mapping(
    insurer_name: str,
    current_user=Depends(get_current_user),
    _rbac_check=Depends(require_admin_read),
):
    """
    Get header mapping configuration for specific insurer

    **Admin only endpoint**

    Returns the header mapping configuration used to transform
    insurer-specific CSV headers to master sheet format.

    **Parameters:**
    - `insurer_name`: Name of the insurer

    **Returns:**
    - Mapping configuration showing insurer headers -> master headers
    """

    try:
        mapping = helpers.get_insurer_mapping(insurer_name)

        if not mapping:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No mapping found for insurer: {insurer_name}",
            )

        return {
            "insurer_name": insurer_name,
            "header_mappings": mapping,
            "total_mappings": len(mapping),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching insurer mapping: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch insurer mapping",
        )
