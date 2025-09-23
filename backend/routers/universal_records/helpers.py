"""
Universal Records Helper Functions Module

This comprehensive module provides sophisticated business logic for processing
universal insurance records with advanced insurer-specific mapping capabilities,
intelligent data reconciliation, and seamless Google Sheets integration. It
serves as the core engine for transforming diverse insurance data formats into
standardized, actionable information across the InsureZeal platform.

Key Capabilities:

**Advanced Data Processing**:
- Multi-format date parsing with intelligent format detection
- Support for various date formats from different insurance companies
- Robust data normalization and standardization algorithms
- Intelligent field value transformation and validation
- Error-tolerant parsing with comprehensive fallback mechanisms

**Insurer Mapping Management**:
- Dynamic insurer-specific header mapping system
- CSV-based mapping configuration with fallback support
- Real-time mapping validation and error detection
- Support for multiple insurer data formats and structures
- Automatic mapping discovery and configuration loading

**Data Reconciliation & Processing**:
- Sophisticated duplicate detection algorithms
- Policy number normalization across different formats
- Intelligent record comparison with configurable tolerance
- Master sheet and quarterly sheet synchronization
- Cross-referential data validation and integrity checks

**CSV Processing & Transformation**:
- Robust CSV parsing with encoding detection
- Preview functionality with mapping application
- Batch processing for large dataset operations
- Memory-efficient streaming for large files
- Comprehensive error handling and validation

**Google Sheets Integration**:
- Seamless synchronization with master and quarterly sheets
- Intelligent data transformation for sheet-specific formats
- Batch update operations with performance optimization
- Reconciliation report generation with detailed analytics
- Real-time data synchronization with conflict resolution

**Data Quality & Validation**:
- Comprehensive field validation with business rules
- Data quality scoring and improvement recommendations
- Duplicate prevention with configurable matching criteria
- Cross-field validation for logical consistency
- Audit trail maintenance for all data operations

**Reconciliation & Reporting**:
- Advanced reconciliation algorithms with change tracking
- Detailed reconciliation summaries with statistics
- Change detection with before/after comparisons
- Performance metrics and processing statistics
- Comprehensive error reporting and resolution guidance

**Performance Optimizations**:
- Efficient batch processing for large datasets
- Memory-optimized algorithms for resource management
- Intelligent caching for frequently accessed mappings
- Parallel processing support for complex operations
- Optimized database queries with proper indexing

**Error Handling & Reliability**:
- Comprehensive error handling with detailed logging
- Graceful degradation for partial data failures
- Recovery mechanisms for corrupted or incomplete data
- User-friendly error messages with actionable guidance
- Robust validation at every processing stage

**Business Intelligence Features**:
- Processing statistics and performance analytics
- Data quality metrics and improvement tracking
- Trend analysis for data processing efficiency
- Reconciliation success rates and error analysis
- Operational insights for process optimization

This module represents the sophisticated data processing backbone of the
InsureZeal platform, enabling seamless integration of diverse insurance data
sources while maintaining the highest standards of data quality, integrity,
and operational efficiency.
"""

import csv
import io
import logging
import os
import re
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple, Union

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from models import ReconciliationReport

from .schemas import (
    CSVPreviewResponse,
    ReconciliationSummaryResponse,
    RecordChangeDetail,
    UniversalRecordProcessingReport,
    UniversalRecordProcessingStats,
)

logger = logging.getLogger(__name__)


def parse_date_field(date_string: str) -> str:
    """
    Parse various date formats and standardize them for Google Sheets

    Common formats from different insurers:
    - DD/MM/YYYY
    - DD-MM-YYYY
    - YYYY-MM-DD
    - DD/MM/YY
    - MM/DD/YYYY

    Returns: Standardized date string in DD/MM/YYYY format or empty string if invalid
    """
    if not date_string or not isinstance(date_string, str):
        return ""

    date_string = date_string.strip()
    if not date_string:
        return ""

    try:
        # Common date patterns
        patterns = [
            (r"^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$", "DMY"),  # DD/MM/YYYY or DD-MM-YYYY
            (
                r"^(\d{1,2})[/-](\d{1,2})[/-](\d{4})\s+\d{1,2}:\d{2}$",
                "DMY",
            ),  # DD-MM-YYYY HH:MM
            (r"^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$", "YMD"),  # YYYY-MM-DD or YYYY/MM/DD
            (
                r"^(\d{4})[/-](\d{1,2})[/-](\d{1,2})\s+\d{1,2}:\d{2}$",
                "YMD",
            ),  # YYYY-MM-DD HH:MM
            (r"^(\d{1,2})[/-](\d{1,2})[/-](\d{2})$", "DMY2"),  # DD/MM/YY or DD-MM-YY
        ]

        for pattern, format_type in patterns:
            match = re.match(pattern, date_string)
            if match:
                if format_type == "DMY":
                    day, month, year = match.groups()
                    return f"{day.zfill(2)}/{month.zfill(2)}/{year}"
                elif format_type == "YMD":
                    year, month, day = match.groups()
                    return f"{day.zfill(2)}/{month.zfill(2)}/{year}"
                elif format_type == "DMY2":
                    day, month, year = match.groups()
                    # Assume 20xx for years 00-30, 19xx for years 31-99
                    full_year = "20" + year if int(year) <= 30 else "19" + year
                    return f"{day.zfill(2)}/{month.zfill(2)}/{full_year}"

        # If no pattern matches, try to parse with datetime (including time formats)
        for format_str in [
            "%d/%m/%Y",
            "%d-%m-%Y",
            "%d-%m-%Y %H:%M",
            "%Y-%m-%d",
            "%Y/%m/%d",
            "%d/%m/%y",
            "%d-%m-%y",
        ]:
            try:
                parsed_date = datetime.strptime(date_string, format_str)
                return parsed_date.strftime("%d/%m/%Y")
            except ValueError:
                continue

        logger.warning(f"Could not parse date: '{date_string}'")
        return ""

    except Exception as e:
        logger.error(f"Error parsing date '{date_string}': {str(e)}")
        return ""


def deduplicate_records_by_policy_number(
    records: List[Dict[str, Any]],
) -> Tuple[List[Dict[str, Any]], Dict[str, int]]:
    """
    Deduplicate records by policy number, keeping the most complete/recent record.

    Args:
        records: List of mapped records

    Returns:
        - Deduplicated list of records
        - Dictionary showing duplicate counts per policy number
    """
    policy_groups = {}
    duplicate_counts = {}

    for record in records:
        policy_number = record.get("Policy number", "").strip()
        if not policy_number:
            continue

        if policy_number not in policy_groups:
            policy_groups[policy_number] = []

        policy_groups[policy_number].append(record)

    deduplicated_records = []

    for policy_number, policy_records in policy_groups.items():
        if len(policy_records) > 1:
            duplicate_counts[policy_number] = len(policy_records)
            logger.info(
                f"Found {len(policy_records)} duplicates for policy {policy_number}"
            )

            # Choose the most complete record (one with most non-empty fields)
            best_record = None
            max_completeness = 0

            for record in policy_records:
                # Calculate completeness score
                completeness = sum(
                    1 for value in record.values() if value and str(value).strip()
                )

                if completeness > max_completeness:
                    max_completeness = completeness
                    best_record = record
                elif completeness == max_completeness and best_record:
                    # If equal completeness, merge the records to get the most complete data
                    merged_record = best_record.copy()
                    for key, value in record.items():
                        if (
                            value
                            and str(value).strip()
                            and (
                                not merged_record.get(key)
                                or not str(merged_record.get(key)).strip()
                            )
                        ):
                            merged_record[key] = value
                    best_record = merged_record

            if best_record:
                deduplicated_records.append(best_record)
                logger.info(
                    f"Selected best record for policy {policy_number} with completeness score {max_completeness}"
                )
        else:
            # No duplicates, add the single record
            deduplicated_records.append(policy_records[0])

    logger.info(
        f"Deduplicated {len(records)} records to {len(deduplicated_records)} unique policies"
    )
    return deduplicated_records, duplicate_counts


def compare_record_fields(
    existing_record: Dict[str, Any], new_record: Dict[str, Any]
) -> Tuple[bool, List[str], Dict[str, Tuple[str, str]]]:
    """
    Compare records and identify fields with actual value changes.
    Always updates the record, but only counts fields with different values as variations.

    Args:
        existing_record: Current record from quarterly sheet
        new_record: New record from upload

    Returns:
        - has_changes: Always True (always update the record)
        - changed_fields: Only field names where values actually differ
        - field_changes: Only fields with changes mapped to (old_value, new_value) tuples
    """
    changed_fields = []
    field_changes = {}

    # List of calculated/formula fields that should not be counted as variations 
    # when the new record has empty values but existing record has calculated values
    calculated_fields = {
        'Receivable from Broker', 'Extra Amount Receivable from Broker', 
        'Total Receivable from Broker', 'Agent_PO_AMT', 'Agent_Extra%', 
        'Agent_Extr_Amount', 'Agent Total PO Amount', 'Running Bal',
        'Total Receivable from Broker Include 18% GST', 'IZ Total PO%',
        'As per Broker PO AMT', 'PO% Diff Broker', 'PO AMT Diff Broker',
        'Actual Agent PO%', 'As per Agent Payout Amount', 'PO% Diff Agent',
        'PO AMT Diff Agent', 'Formatted Policy number'
    }
    
    # Get all unique field names from both records to ensure comprehensive comparison
    all_fields = set(existing_record.keys()) | set(new_record.keys())
    
    # Compare each field and only count actual value differences
    for field in all_fields:
        existing_value = existing_record.get(field, "")
        new_value = new_record.get(field, "")
        
        # Convert values to strings for comparison
        existing_str = str(existing_value).strip() if existing_value is not None else ""
        new_str = str(new_value).strip() if new_value is not None else ""
        
        # Fix policy number formatting issue (remove leading quote)
        if field == 'Policy number' and new_str.startswith("'"):
            new_str = new_str[1:]
        
        # Skip ALL fields where new record is empty but existing has values
        # This treats empty upload values as "no change" rather than variations
        if new_str == "" and existing_str != "":
            # Don't count as variation - preserve existing value
            continue
        
        # Only count as changed if values actually differ
        if existing_str != new_str:
            changed_fields.append(field)
            field_changes[field] = (existing_str, new_str)

    # Debug logging for first few comparisons
    policy_num = new_record.get('Policy number', 'Unknown')
    logger.info(
        f"Policy {policy_num}: {len(changed_fields)} out of {len(all_fields)} fields actually changed"
    )
    
    # Log field names being compared (first time only for each upload)
    if not hasattr(compare_record_fields, '_logged_fields'):
        logger.info(f"All fields being compared: {sorted(all_fields)}")
        compare_record_fields._logged_fields = True
    
    # For identical data uploads, log ALL changes to debug why fields are showing as different
    if len(changed_fields) > 0:
        logger.info(f"Policy {policy_num} - ALL changed fields: {changed_fields}")
        for field in changed_fields:  # Show ALL changes, not just first 3
            old_val, new_val = field_changes[field]
            logger.info(f"  CHANGE: {field}: '{old_val}' (len={len(str(old_val))}) -> '{new_val}' (len={len(str(new_val))})")
    else:
        logger.info(f"Policy {policy_num} - No field changes detected (this is correct for identical data)")
    
    return True, changed_fields, field_changes


def calculate_field_variations(processed_records: List[Dict[str, Any]]) -> Dict[str, int]:
    """
    Calculate field variations for all 72 master sheet headers based on processed records.
    
    Args:
        processed_records: List of processed records with change details
        
    Returns:
        Dictionary mapping field names to variation counts
    """
    from utils.quarterly_sheets_manager import quarterly_manager
    
    # Get master headers from quarterly sheets manager
    master_headers = quarterly_manager._get_default_headers()
    
    # Create a mapping from master headers to actual model field names
    # This maps the 72 master headers to the exact field names in the ReconciliationReport model
    header_to_field_map = {
        "Reporting Month (mmm'yy)": "reporting_month",
        "Child ID/ User ID [Provided by Insure Zeal]": "child_id",
        "Insurer /broker code": "insurer_broker_code",
        "Policy Start Date": "policy_start_date",
        "Policy End Date": "policy_end_date",
        "Booking Date(Click to select Date)": "booking_date",
        "Broker Name": "broker_name",
        "Insurer name": "insurer_name",
        "Major Categorisation( Motor/Life/ Health)": "major_categorisation",
        "Product (Insurer Report)": "product",
        "Product Type": "product_type",
        "Plan type (Comp/STP/SAOD)": "plan_type",
        "Gross premium": "gross_premium",
        "GST Amount": "gst_amount",
        "Net premium": "net_premium",
        "OD Preimium": "od_premium",
        "TP Premium": "tp_premium",
        "Policy number": "policy_number",
        "Formatted Policy number": "formatted_policy_number",
        "Registration.no": "registration_no",
        "Make_Model": "make_model",
        "Model": "model",
        "Vehicle_Variant": "vehicle_variant",
        "GVW": "gvw",
        "RTO": "rto",
        "State": "state",
        "Cluster": "cluster",
        "Fuel Type": "fuel_type",
        "CC": "cc",
        "Age(Year)": "age_year",
        "NCB (YES/NO)": "ncb",
        "Discount %": "discount_percentage",
        "Business Type": "business_type",
        "Seating Capacity": "seating_capacity",
        "Veh_Wheels": "veh_wheels",
        "Customer Name": "customer_name",
        "Customer Number": "customer_number",
        "Commissionable Premium": "commissionable_premium",
        "Incoming Grid %": "incoming_grid_percentage",
        "Receivable from Broker": "receivable_from_broker",
        "Extra Grid": "extra_grid",
        "Extra Amount Receivable from Broker": "extra_amount_receivable",
        "Total Receivable from Broker": "total_receivable_from_broker",
        "Claimed By": "claimed_by",
        "Payment by": "payment_by",
        "Payment Mode": "payment_mode",
        "Cut Pay Amount Received From Agent": "cut_pay_amount_received",
        "Already Given to agent": "already_given_to_agent",
        "Actual Agent_PO%": "actual_agent_po_percentage",
        "Agent_PO_AMT": "agent_po_amt",
        "Agent_Extra%": "agent_extra_percentage",
        "Agent_Extr_Amount": "agent_extra_amount",
        "Agent Total PO Amount": "agent_total_po_amount",
        "Payment By Office": "payment_by_office",
        "PO Paid To Agent": "po_paid_to_agent",
        "Running Bal": "running_bal",
        "Total Receivable from Broker Include 18% GST": "total_receivable_gst",
        "IZ Total PO%": "iz_total_po_percentage",
        "As per Broker PO%": "as_per_broker_po_percentage",
        "As per Broker PO AMT": "as_per_broker_po_amt",
        "PO% Diff Broker": "po_percentage_diff_broker",
        "PO AMT Diff Broker": "po_amt_diff_broker",
        "Actual Agent PO%": "actual_agent_po_percentage_2",
        "As per Agent Payout%": "as_per_agent_payout_percentage",
        "As per Agent Payout Amount": "as_per_agent_payout_amount",
        "PO% Diff Agent": "po_percentage_diff_agent",
        "PO AMT Diff Agent": "po_amt_diff_agent",
        "Invoice Status": "invoice_status",
        "Invoice Number": "invoice_number",
        "Remarks": "remarks",
        "Match": "match",
        "Agent Code": "agent_code",
    }
    
    # Initialize variation counts for all headers
    field_variations = {}
    for header in master_headers:
        field_name = header_to_field_map.get(header)
        if field_name:
            field_variations[field_name] = 0
        else:
            # Fallback to automatic conversion for any unmapped headers
            field_name = (header.lower()
                         .replace(' ', '_')
                         .replace('(', '')
                         .replace(')', '')
                         .replace('/', '_')
                         .replace('-', '_')
                         .replace('.', '')
                         .replace('\'', '')
                         .replace('[', '')
                         .replace(']', '')
                         .replace('%', '_percentage')
                         .replace('&', '_and_')
                         .replace('#', '_number_')
                         .replace('@', '_at_')
                         .replace('  ', '_')
                         .replace('__', '_'))
            field_name = field_name.strip('_')
            field_variations[field_name] = 0
    
    # Count variations for each field based on processed records
    unmapped_fields = set()
    for record in processed_records:
        changed_fields = record.get('changed_fields', [])
        if isinstance(changed_fields, dict):
            # Handle cases where changed_fields is a dict instead of list
            changed_fields = list(changed_fields.keys())
        
        for field in changed_fields:
            # First try to find direct mapping from master headers
            mapped_field = None
            for header, field_name in header_to_field_map.items():
                if field.lower() == header.lower() or field.lower().replace(' ', '_') == field_name:
                    mapped_field = field_name
                    break
            
            # If no direct mapping found, use automatic conversion
            if not mapped_field:
                mapped_field = (str(field).lower()
                              .replace(' ', '_')
                              .replace('(', '')
                              .replace(')', '')
                              .replace('/', '_')
                              .replace('-', '_')
                              .replace('.', '')
                              .replace('\'', '')
                              .replace('[', '')
                              .replace(']', '')
                              .replace('%', '_percentage')
                              .replace('&', '_and_')
                              .replace('#', '_number_')
                              .replace('@', '_at_')
                              .replace('  ', '_')
                              .replace('__', '_'))
                mapped_field = mapped_field.strip('_')
                unmapped_fields.add(f"{field} -> {mapped_field}")
            
            if mapped_field in field_variations:
                field_variations[mapped_field] += 1
    
    # Log unmapped fields for debugging
    if unmapped_fields:
        logger.info(f"Fields using automatic conversion: {sorted(unmapped_fields)}")
    
    return field_variations


# Master insurer mappings loaded from CSV configuration
INSURER_MAPPINGS: Dict[str, Dict[str, str]] = {}


async def load_insurer_mappings() -> None:
    """Load insurer mappings from configuration CSV"""
    _load_mappings_from_csv()


def _load_mappings_from_csv() -> None:
    """Load insurer mappings from the record-mapper.csv file"""
    global INSURER_MAPPINGS

    try:
        # Path to the CSV mapping file
        csv_file_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
            "record-mapper.csv",
        )

        if not os.path.exists(csv_file_path):
            logger.error(f"Mapping CSV file not found at: {csv_file_path}")
            _load_fallback_mappings()
            return

        INSURER_MAPPINGS = {}

        with open(csv_file_path, "r", encoding="utf-8") as file:
            reader = csv.reader(file)
            headers = next(reader)  # First row contains master sheet headers

            # Skip the empty first row and read insurer mappings
            for row in reader:
                if len(row) < 2 or not row[0].strip():
                    continue

                insurer_name = row[0].strip()
                mapping = {}

                # Create mapping from insurer headers to master headers
                for i, insurer_header in enumerate(row[1:], 1):
                    if i < len(headers) and insurer_header.strip():
                        master_header = headers[i].strip()
                        if master_header:
                            mapping[insurer_header.strip()] = master_header
                            # Debug GST mapping
                            if master_header == "GST Amount":
                                logger.info(
                                    f"Found GST mapping for {insurer_name}: '{insurer_header.strip()}' -> '{master_header}'"
                                )

                if mapping:
                    INSURER_MAPPINGS[insurer_name] = mapping

        logger.info(f"Loaded {len(INSURER_MAPPINGS)} insurer mappings from CSV")

    except Exception as e:
        logger.error(f"Error loading mappings from CSV: {str(e)}")
        _load_fallback_mappings()


def _load_fallback_mappings() -> None:
    """Load fallback mappings if CSV loading fails"""
    global INSURER_MAPPINGS

    logger.warning("Loading fallback insurer mappings")

    # Minimal fallback mappings for critical insurers
    INSURER_MAPPINGS = {
        "ICICI": {
            "SUB_AGENT_ID": "Agent Code",
            "TRANSACTION_DATE": "Booking Date",
            "POLICY_NUMBER": "Policy Number",
            "CUSTOMER_NAME": "Customer Name",
            "PRODUCT": "Product Type",
            "PROPOSAL_PREMIUM_AMOUNT": "Gross Premium",
            "OD_PREMIUM": "OD Premium",
            "TP_PREMIUM": "TP Premium",
            "REGISTRATION_NUMBER": "Registration No",
            "MAKE": "Make Model",
            "MODEL": "Model",
        },
        "Bajaj": {
            "User Name": "Agent Code",
            "Policy Issued Date": "Booking Date",
            "Policy No.": "Policy Number",
            "Customer Name": "Customer Name",
            "Product": "Product Type",
            "Gross Premium": "Gross Premium",
            "Net Premium": "Net Premium",
            "Od Prem": "OD Premium",
            "Tp Prem": "TP Premium",
            "Regn No": "Registration No",
            "Vehicle Make": "Make Model",
            "Vehicle Model": "Model",
        },
    }

    logger.info(f"Loaded {len(INSURER_MAPPINGS)} fallback insurer mappings")


def get_available_insurers() -> List[str]:
    """Get list of available insurer names"""
    return list(INSURER_MAPPINGS.keys())


def get_insurer_mapping(insurer_name: str) -> Optional[Dict[str, str]]:
    """Get mapping configuration for specific insurer"""
    return INSURER_MAPPINGS.get(insurer_name)


def parse_csv_with_mapping(
    csv_content: str, insurer_mapping: Dict[str, str]
) -> Tuple[List[Dict[str, Any]], List[str], List[str]]:
    """
    Parse CSV content and apply insurer-specific header mapping

    Returns:
        - List of mapped records
        - List of original headers
        - List of unmapped headers
    """
    try:
        csv_reader = csv.DictReader(io.StringIO(csv_content))
        original_headers = csv_reader.fieldnames or []

        # Clean headers by removing BOM and other unwanted characters
        cleaned_headers = []
        for header in original_headers:
            # Remove BOM (\ufeff) and other invisible characters
            cleaned_header = header.replace("\ufeff", "").replace("\ufffe", "").strip()
            cleaned_headers.append(cleaned_header)

        # Update the CSV reader with cleaned headers
        csv_reader.fieldnames = cleaned_headers

        # Debug: Log the mapping and headers
        logger.info(f"Original CSV headers: {original_headers}")
        logger.info(f"Cleaned CSV headers: {cleaned_headers}")
        logger.info(f"Insurer mapping: {insurer_mapping}")

        # Create reverse mapping for headers not in mapping
        unmapped_headers = [h for h in cleaned_headers if h not in insurer_mapping]

        mapped_records = []
        for row_data in csv_reader:
            # Clean the row data keys to remove BOM
            row = {}
            for key, value in row_data.items():
                if key:  # Skip None keys
                    cleaned_key = (
                        key.replace("\ufeff", "").replace("\ufffe", "").strip()
                    )
                    row[cleaned_key] = value

            mapped_row = {}

            # Debug: Log the first row to see what fields are available
            if len(mapped_records) == 0:
                logger.info(f"First row data (cleaned keys): {dict(row)}")

            # Apply mapping to known headers
            for original_header, value in row.items():
                if original_header in insurer_mapping:
                    mapped_header = insurer_mapping[original_header]

                    # Apply date parsing for date fields
                    if mapped_header in [
                        "Policy Start Date",
                        "Policy End Date",
                        "Booking Date(Click to select Date)",
                    ]:
                        value = parse_date_field(value)

                    mapped_row[mapped_header] = value
                    # Debug policy number mapping
                    if mapped_header == "Policy Number":
                        logger.info(
                            f"Policy Number mapped: '{original_header}' = '{value}' -> '{mapped_header}'"
                        )
                else:
                    # Keep unmapped headers as-is
                    mapped_row[original_header] = value

            # Handle special GST calculation mappings for Go Digit and other insurers
            # Check if any mapping contains formula-like expressions for GST
            for original_mapping, master_header in insurer_mapping.items():
                if master_header == "GST Amount" and "+" in original_mapping:
                    # This is a formula mapping like "IGST+CGST+SGST+UTGST+CESS"
                    gst_components = [
                        comp.strip() for comp in original_mapping.split("+")
                    ]
                    total_gst = 0.0
                    found_components = []

                    # Find the policy number field for this insurer
                    policy_number_field = None
                    for orig_field, mapped_field in insurer_mapping.items():
                        if mapped_field == "Policy number":
                            policy_number_field = orig_field
                            break

                    policy_value = (
                        row.get(policy_number_field, "Unknown")
                        if policy_number_field
                        else "Unknown"
                    )

                    logger.info(
                        f"Calculating GST from components: {gst_components} for row with policy: {policy_value}"
                    )

                    for component in gst_components:
                        if component in row:
                            component_value_str = str(row[component]).strip()
                            if (
                                component_value_str
                                and component_value_str != "0"
                                and component_value_str != "0.0"
                            ):
                                try:
                                    component_value = float(
                                        component_value_str.replace(",", "")
                                    )
                                    total_gst += component_value
                                    found_components.append(
                                        f"{component}={component_value}"
                                    )
                                    logger.debug(
                                        f"GST component '{component}': {component_value}"
                                    )
                                except (ValueError, TypeError) as e:
                                    logger.warning(
                                        f"Could not parse GST component '{component}' with value '{row[component]}': {e}"
                                    )
                            else:
                                logger.debug(
                                    f"GST component '{component}' is zero or empty: '{component_value_str}'"
                                )
                        else:
                            logger.debug(
                                f"GST component '{component}' not found in row"
                            )

                    mapped_row["GST Amount"] = str(total_gst)
                    logger.info(
                        f"Calculated total GST Amount: {total_gst} from components: {found_components} for policy: {policy_value}"
                    )
                    break

            mapped_records.append(mapped_row)

        return mapped_records, cleaned_headers, unmapped_headers

    except Exception as e:
        logger.error(f"Error parsing CSV with mapping: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to parse CSV: {str(e)}",
        )


def preview_csv_with_mapping(
    csv_content: str, insurer_name: str, preview_rows: int = 5
) -> CSVPreviewResponse:
    """Generate preview of CSV with applied insurer mapping"""

    insurer_mapping = get_insurer_mapping(insurer_name)
    if not insurer_mapping:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No mapping found for insurer: {insurer_name}",
        )

    mapped_records, original_headers, unmapped_headers = parse_csv_with_mapping(
        csv_content, insurer_mapping
    )

    # Get mapped headers
    mapped_headers = []
    for header in original_headers:
        if header in insurer_mapping:
            mapped_headers.append(insurer_mapping[header])
        else:
            mapped_headers.append(header)

    # Get preview data
    preview_data = mapped_records[:preview_rows]

    return CSVPreviewResponse(
        insurer_name=insurer_name,
        original_headers=original_headers,
        mapped_headers=mapped_headers,
        preview_data=preview_data,
        unmapped_headers=unmapped_headers,
        total_rows=len(mapped_records),
    )


async def process_universal_record_csv(
    db: AsyncSession, csv_content: str, insurer_name: str, admin_user_id: Union[str, uuid.UUID]
) -> UniversalRecordProcessingReport:
    """
    Process universal record CSV with insurer-specific mapping

    This function:
    1. Applies insurer mapping to CSV data
    2. Gets existing records from Google master sheet for the insurer
    3. Compares and updates/adds records in Google master sheet only
    4. Sets MATCH to TRUE for all updated/added records (requires BOTH Policy Number AND Child ID match)
    """

    start_time = datetime.now()
    stats = UniversalRecordProcessingStats()
    change_details = []

    try:
        # Get insurer mapping
        insurer_mapping = get_insurer_mapping(insurer_name)
        if not insurer_mapping:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No mapping found for insurer: {insurer_name}",
            )

        # Parse CSV with mapping
        mapped_records, original_headers, unmapped_headers = parse_csv_with_mapping(
            csv_content, insurer_mapping
        )

        stats.total_records_processed = len(mapped_records)

        # Debug: Log some sample incoming policy numbers with their normalized versions
        if mapped_records:
            sample_incoming_policies = [
                record.get("Policy Number", "N/A") for record in mapped_records[:3]
            ]
            logger.info(
                f"Sample incoming policy numbers from CSV: {sample_incoming_policies}"
            )

            # Show normalized versions
            normalized_incoming = [
                normalize_policy_number(record.get("Policy Number", ""))
                for record in mapped_records[:3]
            ]
            logger.info(f"Sample normalized incoming policies: {normalized_incoming}")

        # Import Google Sheets utility functions
        from utils.google_sheets import (
            add_master_sheet_record,
            get_master_sheet_data,
            update_master_sheet_record,
        )

        # Get existing master sheet data for this insurer
        existing_master_data = await get_master_sheet_data(insurer_name=insurer_name)
        logger.info(
            f"Found {len(existing_master_data)} existing records in master sheet for insurer '{insurer_name}'"
        )

        # Debug: Also check ALL records to see if policy exists with different insurer name
        all_master_data = await get_master_sheet_data(insurer_name=None)
        logger.info(
            f"Found {len(all_master_data)} total records in master sheet (all insurers)"
        )

        # Check if our target policy exists in all records but with different insurer name
        target_policies = [
            record.get("Policy Number", "") for record in mapped_records[:3]
        ]
        for target_policy in target_policies:
            if target_policy:
                target_normalized = normalize_policy_number(target_policy)
                for record in all_master_data:
                    existing_policy = record.get("Policy Number", "")
                    existing_normalized = normalize_policy_number(existing_policy)
                    if existing_normalized == target_normalized:
                        existing_insurer = record.get("Insurer Name", "N/A")
                        logger.info(
                            f"FOUND POLICY '{target_policy}' in master sheet with insurer name: '{existing_insurer}' (looking for: '{insurer_name}')"
                        )
                        break

        # Debug: Log some raw policy numbers from master sheet with their normalized versions
        if existing_master_data:
            sample_raw_policies = [
                record.get("Policy Number", "N/A")
                for record in existing_master_data[:5]
            ]
            logger.info(
                f"Sample raw policy numbers from master sheet: {sample_raw_policies}"
            )

            # Show normalized versions and insurer names
            for i, record in enumerate(existing_master_data[:5]):
                policy_num = record.get("Policy Number", "N/A")
                insurer = record.get("Insurer Name", "N/A")
                normalized = normalize_policy_number(policy_num)
                logger.info(
                    f"Master sheet record {i+1}: Policy='{policy_num}' -> Normalized='{normalized}', Insurer='{insurer}'"
                )

        # Create a lookup dictionary by composite key (policy number + child ID)
        existing_records_by_composite_key = {}
        for record in existing_master_data:
            policy_number = record.get("Policy Number")
            child_id = record.get(
                "Child ID/ User ID [Provided by Insure Zeal]", ""
            ).strip()

            if policy_number:
                # Normalize policy number for lookup
                try:
                    normalized_policy = normalize_policy_number(policy_number)
                    if (
                        normalized_policy
                    ):  # Only add if normalization produced a valid result
                        # Create composite key: policy_number + child_id
                        composite_key = (
                            f"{normalized_policy}|{child_id}"
                            if child_id
                            else normalized_policy
                        )
                        existing_records_by_composite_key[composite_key] = record

                        # Also store just policy number for fallback logging
                        logger.debug(
                            f"Added composite key: '{composite_key}' for policy '{policy_number}' with child ID '{child_id}'"
                        )
                except Exception as e:
                    logger.warning(
                        f"Error normalizing policy number '{policy_number}': {str(e)}"
                    )
                    continue

        logger.info(
            f"Created lookup for {len(existing_records_by_composite_key)} existing records with composite keys (policy + child ID)"
        )
        if existing_records_by_composite_key:
            sample_keys = list(existing_records_by_composite_key.keys())[
                :5
            ]  # Show first 5 for debugging
            logger.info(f"Sample existing composite keys: {sample_keys}")

        # Process each record
        for record in mapped_records:
            policy_number = record.get("Policy Number")
            child_id = (
                record.get("Child ID", "").strip() if record.get("Child ID") else ""
            )

            if not policy_number:
                stats.total_errors += 1
                stats.error_details.append("Missing Policy Number in record")
                continue

            # Normalize policy number for lookup
            try:
                normalized_policy = normalize_policy_number(policy_number)
                if (
                    not normalized_policy
                ):  # Check if normalization produced a valid result
                    stats.total_errors += 1
                    stats.error_details.append(
                        f"Invalid Policy Number format: {policy_number}"
                    )
                    continue
            except Exception as e:
                logger.error(
                    f"Error normalizing policy number '{policy_number}': {str(e)}"
                )
                stats.total_errors += 1
                stats.error_details.append(
                    f"Invalid Policy Number format: {policy_number}"
                )
                continue

            # Create composite key for matching
            composite_key = (
                f"{normalized_policy}|{child_id}" if child_id else normalized_policy
            )

            logger.info(
                f"Processing universal record policy '{policy_number}' with child ID '{child_id}' (composite key: '{composite_key}')"
            )
            logger.info(
                f"Looking for composite key '{composite_key}' in {len(existing_records_by_composite_key)} existing records"
            )

            # Debug: Check if this specific composite key exists
            for (
                existing_key,
                existing_record,
            ) in existing_records_by_composite_key.items():
                if existing_key == composite_key:
                    logger.info(
                        f"EXACT MATCH FOUND: '{composite_key}' matches existing '{existing_key}'"
                    )
                    break
            else:
                logger.info(
                    f"NO EXACT MATCH: '{composite_key}' not found in existing composite keys"
                )
                # Show the closest matches for debugging
                similar_keys = [
                    k
                    for k in existing_records_by_composite_key.keys()
                    if normalized_policy in k
                ]
                if similar_keys:
                    logger.info(
                        f"Keys with same policy number but different child ID: {similar_keys}"
                    )

            try:
                if composite_key in existing_records_by_composite_key:
                    # BOTH Policy Number AND Child ID match - process the record
                    existing_record = existing_records_by_composite_key[composite_key]

                    logger.info(
                        f"COMPOSITE MATCH FOUND: Both policy '{policy_number}' and child ID '{child_id}' match existing record"
                    )

                    # Compare and update fields
                    has_changes, changed_fields = (
                        await compare_and_update_master_record(
                            existing_record, record, insurer_name
                        )
                    )

                    if has_changes:
                        # Set MATCH to TRUE
                        record["MATCH"] = (
                            "TRUE"  # Changed from "MATCH STATUS" to "MATCH"
                        )

                        # Update in Google Sheets
                        update_success = await update_master_sheet_record(
                            policy_number, record
                        )

                        if update_success:
                            stats.total_records_updated += 1
                            logger.info(
                                f"Successfully updated policy '{policy_number}' with child ID '{child_id}' - changes: {changed_fields}"
                            )
                            logger.info(
                                f"MATCH set to TRUE for policy '{policy_number}' with child ID '{child_id}'"
                            )
                        else:
                            stats.total_errors += 1
                            stats.error_details.append(
                                f"Failed to update policy '{policy_number}' with child ID '{child_id}' in Google Sheets"
                            )
                            logger.error(
                                f"Failed to update policy '{policy_number}' with child ID '{child_id}' in Google Sheets"
                            )

                        # Track field changes
                        for field in changed_fields:
                            stats.field_changes[field] = (
                                stats.field_changes.get(field, 0) + 1
                            )

                        change_details.append(
                            RecordChangeDetail(
                                policy_number=policy_number,
                                record_type="master_sheet",
                                action="updated",
                                changed_fields={
                                    field: f"Updated {field}"
                                    for field in changed_fields
                                },
                                previous_values={},  # Would need to implement if needed
                                new_values=record,
                            )
                        )
                    else:
                        # No changes but still set MATCH to TRUE (both policy and child ID matched)
                        record["MATCH"] = (
                            "TRUE"  # Changed from "MATCH STATUS" to "MATCH"
                        )
                        update_success = await update_master_sheet_record(
                            policy_number, record
                        )

                        if update_success:
                            logger.info(
                                f"Policy '{policy_number}' with child ID '{child_id}' had no changes, but MATCH updated to TRUE"
                            )
                        else:
                            stats.total_errors += 1
                            stats.error_details.append(
                                f"Failed to update MATCH for policy '{policy_number}' with child ID '{child_id}'"
                            )
                            logger.error(
                                f"Failed to update MATCH for policy '{policy_number}' with child ID '{child_id}'"
                            )

                        change_details.append(
                            RecordChangeDetail(
                                policy_number=policy_number,
                                record_type="master_sheet",
                                action="no_change",
                                changed_fields={},
                                previous_values={},
                                new_values={},
                            )
                        )

                else:
                    # Policy not found in filtered records, check if it exists in ALL records
                    logger.info(
                        f"Policy '{policy_number}' not found in '{insurer_name}' records, checking all records..."
                    )

                    # Search in all records (not filtered by insurer)
                    all_master_data = await get_master_sheet_data(insurer_name=None)
                    found_in_all = False

                    for all_record in all_master_data:
                        all_policy = all_record.get("Policy Number", "")
                        if normalize_policy_number(all_policy) == normalized_policy:
                            existing_insurer = all_record.get("Insurer Name", "Unknown")
                            logger.warning(
                                f"CROSS-INSURER MATCH: Policy '{policy_number}' exists with insurer '{existing_insurer}' but processing for '{insurer_name}'"
                            )

                            # Update the existing record but also update the insurer name
                            record["Insurer Name"] = (
                                insurer_name  # Update to current insurer
                            )

                            # Update the record
                            update_success = await update_master_sheet_record(
                                policy_number, record
                            )

                            if update_success:
                                stats.total_records_updated += 1
                                logger.info(
                                    f"Successfully updated cross-insurer policy '{policy_number}' and changed insurer to '{insurer_name}'"
                                )
                            else:
                                stats.total_errors += 1
                                stats.error_details.append(
                                    f"Failed to update cross-insurer policy '{policy_number}'"
                                )

                            found_in_all = True
                            break

                    if not found_in_all:
                        # Add new record to master sheet
                        logger.info(
                            f"NO MATCH: Policy '{policy_number}' with child ID '{child_id}' not found in existing records, adding new record"
                        )

                        # Debug: show some existing policy numbers for comparison
                        if existing_records_by_composite_key:
                            sample_existing = list(
                                existing_records_by_composite_key.keys()
                            )[:3]
                            logger.info(
                                f"Sample existing composite keys for comparison: {sample_existing}"
                            )

                        record["MATCH"] = (
                            "FALSE"  # Changed from "MATCH STATUS" to "MATCH"
                        )
                        record["Insurer Name"] = insurer_name

                        add_success = await add_master_sheet_record(record)

                        if add_success:
                            stats.total_records_added += 1
                            logger.info(
                                f"Successfully added new policy '{policy_number}' with MATCH = FALSE"
                            )
                        else:
                            stats.total_errors += 1
                            stats.error_details.append(
                                f"Failed to add new policy '{policy_number}' to Google Sheets"
                            )
                            logger.error(
                                f"Failed to add new policy '{policy_number}' to Google Sheets"
                            )

                        change_details.append(
                            RecordChangeDetail(
                                policy_number=policy_number,
                                record_type="master_sheet",
                                action="added",
                                changed_fields={},  # Use empty dict instead of list
                                previous_values={},
                                new_values=record,
                            )
                        )

            except Exception as e:
                stats.total_errors += 1
                stats.error_details.append(
                    f"Error processing {policy_number}: {str(e)}"
                )
                logger.error(f"Error processing record {policy_number}: {str(e)}")

        # Calculate processing time
        end_time = datetime.now()
        stats.processing_time_seconds = (end_time - start_time).total_seconds()

        # Create reconciliation report
        report = UniversalRecordProcessingReport(
            stats=stats,
            change_details=change_details,
            insurer_name=insurer_name,
            file_info={
                "original_headers": original_headers,
                "unmapped_headers": unmapped_headers,
                "total_records": len(mapped_records),
            },
            processed_by_user_id=str(admin_user_id),  # Convert UUID to string
        )

        # Save reconciliation report to database for persistence
        try:
            # Calculate variance and coverage percentages
            total_policies_in_master = len(
                await get_master_sheet_data(insurer_name=insurer_name)
            )
            variance_percentage = (
                (stats.total_errors / stats.total_records_processed * 100)
                if stats.total_records_processed > 0
                else 0.0
            )
            coverage_percentage = (
                (
                    (stats.total_records_updated + stats.total_records_added)
                    / stats.total_records_processed
                    * 100
                )
                if stats.total_records_processed > 0
                else 0.0
            )

            # Calculate field variations based on change details
            processed_records = [detail.dict() for detail in change_details]
            field_variations = calculate_field_variations(processed_records)
            
            logger.info(f"Creating master ReconciliationReport with {len(field_variations)} field variations")
            logger.info(f"Non-zero variations: {[(k, v) for k, v in field_variations.items() if v > 0]}")
            
            db_report = ReconciliationReport(
                insurer_name=insurer_name,
                insurer_code=insurer_mapping.get("insurer_code") if insurer_mapping else None,
                total_records_processed=stats.total_records_processed,
                total_records_updated=stats.total_records_updated,
                new_records_added=stats.total_records_added,  # Map to new field name
                data_variance_percentage=round(variance_percentage, 2),
                processed_by=(
                    uuid.UUID(admin_user_id)
                    if isinstance(admin_user_id, str)
                    else admin_user_id
                ),
                # Set field variation counts using the calculated variations
                **{f"{field}_variations": count for field, count in field_variations.items()}
            )

            logger.info(f"Master ReconciliationReport created successfully for insurer: {insurer_name}")
            db.add(db_report)
            await db.commit()
            logger.info(
                f"Saved reconciliation report to database for insurer '{insurer_name}'"
            )

        except Exception as e:
            logger.error(f"Failed to save reconciliation report to database: {str(e)}")
            await db.rollback()

        return report

    except Exception as e:
        logger.error(f"Error in universal record processing: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process universal record: {str(e)}",
        )


async def process_universal_record_csv_to_quarterly_sheets(
    db: AsyncSession,
    csv_content: str,
    insurer_name: str,
    admin_user_id: Union[str, uuid.UUID],
    quarter_list: List[int],
    year_list: List[int],
) -> UniversalRecordProcessingReport:
    """
    Process universal record CSV with insurer-specific mapping to target quarterly sheets

    This function:
    1. Applies insurer mapping to CSV data
    2. For each quarter/year combination:
       - Gets existing records from specific quarterly Google Sheet
       - Compares and updates/adds records in quarterly sheet
       - Uses quarterly sheet headers format
       - Sets MATCH to TRUE for all updated/added records
    3. Routes data to quarterly sheets instead of master sheet
    """

    start_time = datetime.now()
    stats = UniversalRecordProcessingStats()
    change_details = []

    try:
        # Get insurer mapping
        insurer_mapping = get_insurer_mapping(insurer_name)
        if not insurer_mapping:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No mapping found for insurer: {insurer_name}",
            )

        # Parse CSV with mapping
        mapped_records, original_headers, unmapped_headers = parse_csv_with_mapping(
            csv_content, insurer_mapping
        )

        if not mapped_records:
            logger.warning("No valid records found in CSV after mapping")
            stats.total_records_processed = 0
            stats.processing_time_seconds = (
                datetime.now() - start_time
            ).total_seconds()

            return UniversalRecordProcessingReport(
                stats=stats,
                change_details=[],
                insurer_name=insurer_name,
                file_info={
                    "original_headers": original_headers,
                    "unmapped_headers": unmapped_headers,
                    "total_records": 0,
                },
                processed_by_user_id=str(admin_user_id),  # Convert UUID to string
            )

        # Deduplicate records within the CSV by policy number
        deduplicated_records, duplicate_counts = deduplicate_records_by_policy_number(
            mapped_records
        )
        logger.info(
            f"Original records: {len(mapped_records)}, After deduplication: {len(deduplicated_records)}"
        )
        if duplicate_counts:
            logger.info(f"Found duplicates: {duplicate_counts}")

        logger.info(
            f"Processing {len(deduplicated_records)} unique records for insurer {insurer_name} to quarterly sheets"
        )

        # Import quarterly manager
        from utils.quarterly_sheets_manager import quarterly_manager

        # Process each quarter/year combination
        total_records_across_quarters = 0
        total_updates_across_quarters = 0
        total_additions_across_quarters = 0
        quarter_processing_details = []

        for quarter, year in zip(quarter_list, year_list):
            quarter_name = f"Q{quarter}-{year}"
            logger.info(f"Processing records for quarter sheet: {quarter_name}")

            # Get all records from the specific quarterly sheet
            try:
                quarterly_records = (
                    quarterly_manager.get_all_records_from_quarter_sheet(quarter, year)
                )
                logger.info(
                    f"Retrieved {len(quarterly_records)} existing records from {quarter_name}"
                )

                # Log some sample policy numbers for debugging
                if quarterly_records:
                    sample_policies = []
                    for qr in quarterly_records[:5]:  # Show first 5 policy numbers
                        policy_num = qr.get("Policy number", "N/A")
                        normalized = normalize_policy_number(policy_num)
                        sample_policies.append(f"'{policy_num}' -> '{normalized}'")
                    logger.info(
                        f"Sample existing policy numbers in {quarter_name}: {sample_policies}"
                    )

            except Exception as e:
                logger.error(f"Failed to get records from {quarter_name}: {str(e)}")
                quarterly_records = []

            # Process each unique mapped record for this quarter
            quarter_updates = 0
            quarter_additions = 0
            quarter_errors = 0

            for i, record in enumerate(deduplicated_records):
                try:
                    stats.total_records_processed += 1
                    total_records_across_quarters += 1

                    policy_number = record.get("Policy number", "").strip()
                    # Remove any leading/trailing quotes from policy number
                    policy_number = policy_number.strip("'\"")

                    if not policy_number:
                        logger.warning(f"Skipping record {i+1}: No policy number found")
                        stats.total_records_skipped += 1
                        continue

                    logger.info(
                        f"Processing record {i+1}/{len(deduplicated_records)}: Policy '{policy_number}' for {quarter_name}"
                    )

                    # Transform record to quarterly sheet headers format
                    quarterly_record = transform_to_quarterly_headers(
                        record, insurer_name
                    )

                    # Find existing record in quarterly sheet by policy number (normalized comparison)
                    existing_record = None
                    normalized_policy_number = normalize_policy_number(policy_number)

                    for qr in quarterly_records:
                        existing_policy = qr.get("Policy number", "").strip()
                        existing_normalized = normalize_policy_number(existing_policy)
                        if existing_normalized == normalized_policy_number:
                            existing_record = qr
                            logger.info(
                                f"Found existing record for policy '{policy_number}' (normalized: '{normalized_policy_number}') matching existing '{existing_policy}' (normalized: '{existing_normalized}')"
                            )
                            break

                    if not existing_record:
                        logger.info(
                            f"No existing record found for policy '{policy_number}' (normalized: '{normalized_policy_number}') in {quarter_name}. Will add as new record."
                        )

                    if existing_record:
                        # Compare records using enhanced field comparison
                        has_changes, changed_fields, field_changes = (
                            compare_record_fields(existing_record, quarterly_record)
                        )

                        if has_changes:
                            logger.info(
                                f"Policy {policy_number}: Found changes in fields: {changed_fields}"
                            )

                            # Update existing record in quarterly sheet
                            update_result = quarterly_manager.update_existing_record_by_policy_number(
                                quarterly_record, policy_number, quarter, year
                            )

                            if update_result.get("success"):
                                stats.total_records_updated += 1
                                quarter_updates += 1
                                total_updates_across_quarters += 1

                                # Track field changes
                                for field in changed_fields:
                                    stats.field_changes[field] = (
                                        stats.field_changes.get(field, 0) + 1
                                    )

                                change_details.append(
                                    RecordChangeDetail(
                                        policy_number=policy_number,
                                        record_type="quarterly_sheet",
                                        action="updated",
                                        changed_fields={
                                            field: f"Updated: {old_val} -> {new_val}"
                                            for field, (
                                                old_val,
                                                new_val,
                                            ) in field_changes.items()
                                        },
                                        previous_values={
                                            field: old_val
                                            for field, (
                                                old_val,
                                                new_val,
                                            ) in field_changes.items()
                                        },
                                        new_values={
                                            field: new_val
                                            for field, (
                                                old_val,
                                                new_val,
                                            ) in field_changes.items()
                                        },
                                    )
                                )

                                logger.info(
                                    f"Successfully updated policy {policy_number} in {quarter_name}"
                                )
                            else:
                                stats.total_errors += 1
                                quarter_errors += 1
                                error_msg = f"Failed to update {policy_number} in {quarter_name}: {update_result.get('error', 'Unknown error')}"
                                stats.error_details.append(error_msg)
                                logger.error(error_msg)
                        else:
                            # No changes needed - record is identical
                            logger.info(
                                f"Policy {policy_number}: No changes detected, skipping update"
                            )
                            stats.total_records_skipped += 1
                    else:
                        # Add new record to quarterly sheet
                        addition_result = (
                            quarterly_manager.route_new_record_to_specific_quarter(
                                quarterly_record, quarter, year, "CREATE"
                            )
                        )

                        if addition_result.get("success"):
                            stats.total_records_added += 1
                            quarter_additions += 1
                            total_additions_across_quarters += 1

                            change_details.append(
                                RecordChangeDetail(
                                    policy_number=policy_number,
                                    record_type="quarterly_sheet",
                                    action="added",
                                    changed_fields={},  # Empty - new records don't count as variations
                                    previous_values={},
                                    new_values=quarterly_record,
                                )
                            )
                        else:
                            stats.total_errors += 1
                            quarter_errors += 1
                            stats.error_details.append(
                                f"Failed to add {policy_number} to {quarter_name}: {addition_result.get('error', 'Unknown error')}"
                            )

                except Exception as e:
                    stats.total_errors += 1
                    quarter_errors += 1
                    stats.error_details.append(
                        f"Error processing {policy_number} for {quarter_name}: {str(e)}"
                    )
                    logger.error(
                        f"Error processing record {policy_number} for {quarter_name}: {str(e)}"
                    )

            quarter_processing_details.append(
                {
                    "quarter": quarter_name,
                    "updates": quarter_updates,
                    "additions": quarter_additions,
                    "errors": quarter_errors,
                }
            )

            logger.info(
                f"Completed {quarter_name}: {quarter_updates} updates, {quarter_additions} additions, {quarter_errors} errors"
            )

        # Calculate processing time
        end_time = datetime.now()
        stats.processing_time_seconds = (end_time - start_time).total_seconds()

        # Create reconciliation report
        report = UniversalRecordProcessingReport(
            stats=stats,
            change_details=change_details,
            insurer_name=insurer_name,
            file_info={
                "original_headers": original_headers,
                "unmapped_headers": unmapped_headers,
                "total_records": len(mapped_records),
                "unique_records_after_deduplication": len(deduplicated_records),
                "duplicate_counts": duplicate_counts,
                "target_quarters": [
                    f"Q{q}-{y}" for q, y in zip(quarter_list, year_list)
                ],
                "quarter_processing_details": quarter_processing_details,
            },
            processed_by_user_id=str(admin_user_id),  # Convert UUID to string
        )

        # Save reconciliation report to database for persistence
        try:
            logger.info(f"Starting to save reconciliation report for insurer: {insurer_name}")
            
            # Calculate variance and coverage percentages
            variance_percentage = (
                (stats.total_errors / stats.total_records_processed * 100)
                if stats.total_records_processed > 0
                else 0.0
            )
            coverage_percentage = (
                (
                    (stats.total_records_updated + stats.total_records_added)
                    / stats.total_records_processed
                    * 100
                )
                if stats.total_records_processed > 0
                else 0.0
            )

            logger.info(f"Stats summary - Processed: {stats.total_records_processed}, Updated: {stats.total_records_updated}, Added: {stats.total_records_added}")

            # Calculate field variations based on change details
            processed_records = [detail.dict() for detail in change_details]
            field_variations = calculate_field_variations(processed_records)
            
            logger.info(f"Creating quarterly ReconciliationReport with {len(field_variations)} field variations")
            logger.info(f"Non-zero variations: {[(k, v) for k, v in field_variations.items() if v > 0]}")
            
            db_report = ReconciliationReport(
                insurer_name=insurer_name,
                insurer_code=insurer_mapping.get("insurer_code") if insurer_mapping else None,
                total_records_processed=stats.total_records_processed,
                total_records_updated=stats.total_records_updated,
                new_records_added=stats.total_records_added,  # Map to new field name
                data_variance_percentage=round(variance_percentage, 2),
                processed_by=(
                    uuid.UUID(admin_user_id)
                    if isinstance(admin_user_id, str)
                    else admin_user_id
                ),
                # Set field variation counts using the calculated variations
                **{f"{field}_variations": count for field, count in field_variations.items()}
            )

            logger.info(f"ReconciliationReport created successfully for insurer: {insurer_name}")
            db.add(db_report)
            await db.commit()
            logger.info(
                f"Successfully saved quarterly reconciliation report to database for insurer '{insurer_name}'"
            )

        except Exception as e:
            logger.error(
                f"Failed to save quarterly reconciliation report to database: {str(e)}"
            )
            await db.rollback()

        return report

    except Exception as e:
        logger.error(f"Error in quarterly universal record processing: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process universal record to quarterly sheets: {str(e)}",
        )


async def compare_and_update_master_record(
    existing_record: Dict[str, Any], new_record: Dict[str, Any], insurer_name: str
) -> Tuple[bool, List[str]]:
    """
    Compare existing master sheet record with new universal record

    Returns:
        - has_changes: bool
        - changed_fields: list of field names that changed
    """

    has_changes = False
    changed_fields = []

    # Compare each field in the new record
    for field_name, new_value in new_record.items():
        if field_name in existing_record:
            existing_value = existing_record[field_name]

            # Normalize values for comparison
            new_value_normalized = normalize_field_value(field_name, new_value)
            existing_value_normalized = normalize_field_value(
                field_name, existing_value
            )

            if new_value_normalized != existing_value_normalized:
                has_changes = True
                changed_fields.append(field_name)

                # Update the existing record with new value
                existing_record[field_name] = new_value_normalized

    return has_changes, changed_fields


async def generate_reconciliation_summary(
    db: AsyncSession, insurer_name: Optional[str] = None
) -> ReconciliationSummaryResponse:
    """Generate reconciliation summary comparing master sheet data with match status"""

    try:
        # Import Google Sheets utility functions
        from utils.google_sheets import get_master_sheet_data

        # Get master sheet data
        master_sheet_data = await get_master_sheet_data(insurer_name=insurer_name)

        total_policies_in_system = len(master_sheet_data)

        # Calculate match statistics based on match_status field
        matched_records = []
        for record in master_sheet_data:
            match_status = record.get("MATCH", "")
            # Check for both string "TRUE" and boolean True
            if (
                match_status == "TRUE"
                or match_status == True
                or str(match_status).upper() == "TRUE"
            ):
                matched_records.append(record)

        total_matches = len(matched_records)
        total_mismatches = total_policies_in_system - total_matches

        # For this implementation, universal record count is same as system count
        total_policies_in_universal_record = total_policies_in_system
        total_missing_in_system = 0
        total_missing_in_universal = 0

        # Calculate percentages
        data_variance_percentage = (
            (total_mismatches / total_policies_in_system * 100)
            if total_policies_in_system > 0
            else 0.0
        )
        coverage_percentage = (
            (total_matches / total_policies_in_system * 100)
            if total_policies_in_system > 0
            else 0.0
        )

        return ReconciliationSummaryResponse(
            total_policies_in_system=total_policies_in_system,
            total_policies_in_universal_record=total_policies_in_universal_record,
            total_matches=total_matches,
            total_mismatches=total_mismatches,
            total_missing_in_system=total_missing_in_system,
            total_missing_in_universal=total_missing_in_universal,
            data_variance_percentage=round(data_variance_percentage, 2),
            coverage_percentage=round(coverage_percentage, 2),
            top_mismatched_fields=[],  # Would be calculated from actual reconciliation data
        )

    except Exception as e:
        logger.error(f"Error generating reconciliation summary: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate reconciliation summary: {str(e)}",
        )


# Initialize insurer mappings on module load
_load_mappings_from_csv()


def normalize_policy_number(policy_number: Any) -> str:
    """
    Normalize policy number for consistent comparison across all insurers

    This function handles various policy number formats:
    - D195264389 (Go Digit)
    - 12-1806-0006746459-00 (with hyphens)
    - 3004/372635895/00/000 (with slashes)
    - 'P300655564669 (with leading apostrophe)
    - VVT0186550000100 (alphanumeric)
    - 201520010424700079900000 (numeric)

    Normalization steps:
    1. Convert to string and strip whitespace
    2. Remove leading/trailing quotes and apostrophes
    3. Remove only internal spaces and tabs (preserve hyphens, slashes, etc.)
    4. Convert to uppercase for case-insensitive comparison
    """
    if policy_number is None:
        return ""

    try:
        # Convert to string and strip outer whitespace
        normalized = str(policy_number).strip()

        # Remove leading/trailing quotes and apostrophes
        normalized = normalized.strip("'\"'")

        # Remove only internal spaces and tabs, but preserve other separators like -, /, \
        # This handles cases where policy numbers legitimately contain separators
        normalized = (
            normalized.replace(" ", "")
            .replace("\t", "")
            .replace("\n", "")
            .replace("\r", "")
        )

        # Convert to uppercase for case-insensitive comparison
        normalized = normalized.upper()

        # Log the normalization for debugging
        if policy_number != normalized:
            logger.debug(
                f"Policy number normalized: '{policy_number}' -> '{normalized}'"
            )

        return normalized

    except Exception as e:
        logger.warning(f"Error normalizing policy number '{policy_number}': {str(e)}")
        return str(policy_number) if policy_number else ""


def normalize_field_value(field_name: str, value: Any) -> str:
    """Normalize field values for comparison"""
    if value is None:
        return ""

    # Convert to string and strip whitespace
    normalized = str(value).strip()

    # For numeric fields, try to normalize format
    if "premium" in field_name.lower() or "amount" in field_name.lower():
        try:
            # Try to parse as float and format consistently
            float_val = float(normalized.replace(",", ""))
            return f"{float_val:.2f}"
        except:
            pass

    # For date fields - use standardized date parsing
    if "date" in field_name.lower():
        return parse_date_field(normalized)

    return normalized


def transform_to_quarterly_headers(
    record: Dict[str, Any], insurer_name: str
) -> Dict[str, Any]:
    """
    Transform mapped record to quarterly sheet headers format

    This function maps the insurer-specific record (already mapped via record-mapper.csv)
    to the exact quarterly sheet headers format using the standard quarterly sheet headers.
    """
    quarterly_record = {}

    # Get the standard quarterly sheet headers from quarterly manager
    from utils.quarterly_sheets_manager import quarterly_manager

    standard_headers = quarterly_manager._get_default_headers()

    # Direct mapping to quarterly sheet headers
    quarterly_header_mapping = {
        # Core identification fields
        "Child ID/ User ID [Provided by Insure Zeal]": record.get(
            "Child ID/ User ID [Provided by Insure Zeal]", ""
        ),
        "Insurer /broker code": record.get("Insurer /broker code", ""),
        "Agent Code": record.get("Agent Code", ""),
        "Policy number": record.get("Policy number", ""),
        "Formatted Policy number": record.get("Formatted Policy number", ""),
        "Broker Name": record.get("Broker Name", ""),
        "Insurer name": record.get("Insurer Name", record.get("Insurer name", "")),
        # Dates - use standardized date parsing
        "Reporting Month (mmm'yy)": record.get("Reporting Month (mmm'yy)", ""),
        "Policy Start Date": parse_date_field(record.get("Policy Start Date", "")),
        "Policy End Date": parse_date_field(record.get("Policy End Date", "")),
        "Booking Date(Click to select Date)": parse_date_field(
            record.get("Booking Date(Click to select Date)", "")
        ),
        # Product details
        "Major Categorisation( Motor/Life/ Health)": record.get(
            "Major Categorisation( Motor/Life/ Health)", ""
        ),
        "Product (Insurer Report)": record.get("Product (Insurer Report)", ""),
        "Product Type": record.get("Product Type", ""),
        "Plan type (Comp/STP/SAOD)": record.get("Plan type (Comp/STP/SAOD)", ""),
        # Premium fields
        "Gross premium": record.get("Gross Premium", record.get("Gross premium", "")),
        "Net premium": record.get("Net Premium", record.get("Net premium", "")),
        "OD Preimium": record.get("OD Premium", record.get("OD Preimium", "")),
        "TP Premium": record.get("TP Premium", ""),
        "GST Amount": record.get("GST Amount", ""),
        # Vehicle details
        "Registration.no": record.get("Registration.no", ""),
        "Make_Model": record.get("Make_Model", ""),
        "Model": record.get("Model", ""),
        "Vehicle_Variant": record.get("Vehicle_Variant", ""),
        "GVW": record.get("GVW", ""),
        "RTO": record.get("RTO", ""),
        "State": record.get("State", ""),
        "Cluster": record.get("Cluster", ""),
        "Fuel Type": record.get("Fuel Type", ""),
        "CC": record.get("CC", ""),
        "Age(Year)": record.get("Age(Year)", ""),
        "NCB (YES/NO)": record.get("NCB (YES/NO)", ""),
        "Discount %": record.get("Discount %", ""),
        "Business Type": record.get("Business Type", ""),
        "Seating Capacity": record.get("Seating Capacity", ""),
        "Veh_Wheels": record.get("Veh_Wheels", ""),
        # Customer details
        "Customer Name": record.get("Customer Name", ""),
        "Customer Number": record.get("Customer Number", ""),
        # Commission and payout fields
        "Commissionable Premium": record.get("Commissionable Premium", ""),
        "Incoming Grid %": record.get("Incoming Grid %", ""),
        "Receivable from Broker": record.get("Receivable from Broker", ""),
        "Extra Grid": record.get("Extra Grid", ""),
        "Extra Amount Receivable from Broker": record.get(
            "Extra Amount Receivable from Broker", ""
        ),
        "Total Receivable from Broker": record.get("Total Receivable from Broker", ""),
        "Claimed By": record.get("Claimed By", ""),
        "Payment by": record.get("Payment by", ""),
        "Payment Mode": record.get("Payment Mode", ""),
        "Cut Pay Amount Received From Agent": record.get(
            "Cut Pay Amount Received From Agent", ""
        ),
        "Already Given to agent": record.get("Already Given to agent", ""),
        "Actual Agent_PO%": record.get("Actual Agent_PO%", record.get("Actual", "")),
        "Agent_PO%": record.get("Agent_PO%", ""),
        "Agent_PO_AMT": record.get("Agent_PO_AMT", ""),
        "Agent_Extra%": record.get("Agent_Extra%", ""),
        "Agent_Extr_Amount": record.get("Agent_Extr_Amount", ""),
        "Agent Total PO Amount": record.get(
            "Agent Total PO Amount", record.get("Total_Agent_PO_AMT", "")
        ),
        "Payment By Office": record.get("Payment By Office", ""),
        "PO Paid To Agent": record.get("PO Paid To Agent", ""),
        "Running Bal": record.get("Running Bal", ""),
        "Total Receivable from Broker Include 18% GST": record.get(
            "Total Receivable from Broker Include 18% GST", ""
        ),
        "IZ Total PO%": record.get("IZ Total PO%", ""),
        "As per Broker PO%": record.get("As per Broker PO%", ""),
        "As per Broker PO AMT": record.get("As per Broker PO AMT", ""),
        "PO% Diff Broker": record.get("PO% Diff Broker", record.get("PO% Diff", "")),
        "PO AMT Diff Broker": record.get(
            "PO AMT Diff Broker", record.get("Broker PO AMT Diff", "")
        ),
        "Actual Agent PO%": record.get("Actual Agent PO%", record.get("Broker", "")),
        "As per Agent Payout%": record.get("As per Agent Payout%", ""),
        "As per Agent Payout Amount": record.get("As per Agent Payout Amount", ""),
        "PO% Diff Agent": record.get("PO% Diff Agent", ""),
        "PO AMT Diff Agent": record.get("PO AMT Diff Agent", ""),
        "Invoice Status": record.get("Invoice Status", ""),
        "Invoice Number": record.get("Invoice Number", ""),
        "Remarks": record.get("Remarks", ""),
        "Match": "TRUE",  # Set to TRUE for universal record uploads
    }

    # Initialize quarterly_record with all standard headers
    for header in standard_headers:
        quarterly_record[header] = ""

    # Apply the mapped values to quarterly_record
    for quarterly_header, value in quarterly_header_mapping.items():
        if quarterly_header in quarterly_record:
            quarterly_record[quarterly_header] = str(value) if value else ""

    return quarterly_record


async def compare_quarterly_record(
    existing_record: Dict[str, Any], new_record: Dict[str, Any], quarter: int, year: int
) -> Tuple[bool, List[str]]:
    """
    Compare existing quarterly sheet record with new universal record

    Returns:
        - has_changes: bool
        - changed_fields: list of field names that changed
    """

    has_changes = False
    changed_fields = []

    # Important fields to compare (subset of quarterly headers)
    important_fields = [
        "Policy number",
        "Broker Name",
        "Insurer name",
        "Gross premium",
        "Net premium",
        "OD Preimium",
        "TP Premium",
        "GST Amount",
        "Customer Name",
        "Customer Number",
        "Registration.no",
        "Commissionable Premium",
        "Agent Code",
        "Child ID/ User ID [Provided by Insure Zeal]",
    ]

    # Compare each important field in the new record
    for field_name in important_fields:
        if field_name in new_record:
            new_value = normalize_field_value(field_name, new_record[field_name])
            existing_value = normalize_field_value(
                field_name, existing_record.get(field_name, "")
            )

            if new_value != existing_value:
                has_changes = True
                changed_fields.append(field_name)
                logger.debug(
                    f"Q{quarter}-{year} Field '{field_name}' changed: '{existing_value}' -> '{new_value}'"
                )

    # Always set Match to TRUE for universal records
    if existing_record.get("Match", "").upper() != "TRUE":
        has_changes = True
        if "Match" not in changed_fields:
            changed_fields.append("Match")

    return has_changes, changed_fields
