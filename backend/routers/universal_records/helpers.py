"""
Universal Records Helper Functions

This module provides helper functions for processing universal records with
insurer-specific mapping and reconciliation logic.
"""

import csv
import io
import logging
import os
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, date
from decimal import Decimal, InvalidOperation
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from fastapi import HTTPException, status

from models import Policy, CutPay
from utils.google_sheets import sync_policy_to_master_sheet, sync_cutpay_to_master_sheet
from .schemas import (
    UniversalRecordProcessingReport, 
    UniversalRecordProcessingStats,
    RecordChangeDetail,
    InsurerMappingConfig,
    CSVPreviewResponse,
    ReconciliationSummaryResponse
)

logger = logging.getLogger(__name__)

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
        csv_file_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "record-mapper.csv")
        
        if not os.path.exists(csv_file_path):
            logger.error(f"Mapping CSV file not found at: {csv_file_path}")
            _load_fallback_mappings()
            return
        
        INSURER_MAPPINGS = {}
        
        with open(csv_file_path, 'r', encoding='utf-8') as file:
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
            "MODEL": "Model"
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
            "Vehicle Model": "Model"
        }
    }
    
    logger.info(f"Loaded {len(INSURER_MAPPINGS)} fallback insurer mappings")


def get_available_insurers() -> List[str]:
    """Get list of available insurer names"""
    return list(INSURER_MAPPINGS.keys())


def get_insurer_mapping(insurer_name: str) -> Optional[Dict[str, str]]:
    """Get mapping configuration for specific insurer"""
    return INSURER_MAPPINGS.get(insurer_name)


def parse_csv_with_mapping(
    csv_content: str, 
    insurer_mapping: Dict[str, str]
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
        
        # Create reverse mapping for headers not in mapping
        unmapped_headers = [h for h in original_headers if h not in insurer_mapping]
        
        mapped_records = []
        for row in csv_reader:
            mapped_row = {}
            
            # Apply mapping to known headers
            for original_header, value in row.items():
                if original_header in insurer_mapping:
                    mapped_header = insurer_mapping[original_header]
                    mapped_row[mapped_header] = value
                else:
                    # Keep unmapped headers as-is
                    mapped_row[original_header] = value
            
            mapped_records.append(mapped_row)
        
        return mapped_records, original_headers, unmapped_headers
        
    except Exception as e:
        logger.error(f"Error parsing CSV with mapping: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to parse CSV: {str(e)}"
        )


def preview_csv_with_mapping(
    csv_content: str,
    insurer_name: str,
    preview_rows: int = 5
) -> CSVPreviewResponse:
    """Generate preview of CSV with applied insurer mapping"""
    
    insurer_mapping = get_insurer_mapping(insurer_name)
    if not insurer_mapping:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No mapping found for insurer: {insurer_name}"
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
        total_rows=len(mapped_records)
    )


def normalize_field_value(field_name: str, value: Any) -> Any:
    """Normalize field values based on expected data types"""
    
    if value is None or value == '':
        return None
    
    # String fields
    string_fields = [
        'Policy Number', 'Product Type', 'Agent Code', 'Broker Name',
        'Insurer Name', 'Customer Name', 'Registration No', 'Make Model',
        'Model', 'Notes', 'Payment Method', 'Payment By'
    ]
    
    # Decimal fields
    decimal_fields = [
        'Gross Premium', 'Net Premium', 'OD Premium', 'TP Premium',
        'GST Amount', 'CutPay Amount', 'Agent Commission %'
    ]
    
    # Date fields
    date_fields = ['Booking Date', 'Created At', 'Updated At']
    
    try:
        if field_name in string_fields:
            return str(value).strip() if value else None
        
        elif field_name in decimal_fields:
            if isinstance(value, (int, float)):
                return Decimal(str(value))
            elif isinstance(value, str):
                # Remove currency symbols and commas
                clean_value = value.replace(',', '').replace('₹', '').replace('$', '').strip()
                if clean_value:
                    return Decimal(clean_value)
            return None
        
        elif field_name in date_fields:
            if isinstance(value, str):
                # Try multiple date formats
                for fmt in ['%Y-%m-%d', '%d/%m/%Y', '%m/%d/%Y', '%d-%m-%Y']:
                    try:
                        return datetime.strptime(value.strip(), fmt).date()
                    except ValueError:
                        continue
            return None
        
        else:
            # Return as-is for unknown fields
            return value
            
    except (ValueError, InvalidOperation) as e:
        logger.warning(f"Failed to normalize {field_name} with value {value}: {str(e)}")
        return None


async def process_universal_record_csv(
    db: AsyncSession,
    csv_content: str,
    insurer_name: str,
    admin_user_id: int
) -> UniversalRecordProcessingReport:
    """
    Process universal record CSV with insurer-specific mapping
    
    This function:
    1. Applies insurer mapping to CSV data
    2. Gets existing records from Google master sheet for the insurer
    3. Compares and updates/adds records in Google master sheet only
    4. Sets MATCH STATUS to TRUE for all updated/added records
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
                detail=f"No mapping found for insurer: {insurer_name}"
            )
        
        # Parse CSV with mapping
        mapped_records, original_headers, unmapped_headers = parse_csv_with_mapping(
            csv_content, insurer_mapping
        )
        
        stats.total_records_processed = len(mapped_records)
        
        # Import Google Sheets utility functions
        from utils.google_sheets import (
            get_master_sheet_data,
            update_master_sheet_record,
            add_master_sheet_record
        )
        
        # Get existing master sheet data for this insurer
        existing_master_data = await get_master_sheet_data(insurer_name=insurer_name)
        
        # Create a lookup dictionary by policy number
        existing_records_by_policy = {}
        for record in existing_master_data:
            policy_number = record.get('Policy Number')
            if policy_number:
                existing_records_by_policy[policy_number] = record
        
        # Process each record
        for record in mapped_records:
            policy_number = record.get('Policy Number')
            if not policy_number:
                stats.total_errors += 1
                stats.error_details.append("Missing Policy Number in record")
                continue
            
            try:
                if policy_number in existing_records_by_policy:
                    # Update existing record in master sheet
                    existing_record = existing_records_by_policy[policy_number]
                    
                    # Compare and update fields
                    has_changes, changed_fields = await compare_and_update_master_record(
                        existing_record, record, insurer_name
                    )
                    
                    if has_changes:
                        # Set MATCH STATUS to TRUE
                        record['Match Status'] = True
                        
                        # Update in Google Sheets
                        await update_master_sheet_record(policy_number, record)
                        
                        stats.total_records_updated += 1
                        
                        # Track field changes
                        for field in changed_fields:
                            stats.field_changes[field] = stats.field_changes.get(field, 0) + 1
                        
                        change_details.append(RecordChangeDetail(
                            policy_number=policy_number,
                            record_type="master_sheet",
                            action="updated",
                            changed_fields=changed_fields,
                            previous_values={},  # Would need to implement if needed
                            new_values=record
                        ))
                    else:
                        # No changes but still set MATCH STATUS to TRUE
                        record['Match Status'] = True
                        await update_master_sheet_record(policy_number, record)
                        
                        change_details.append(RecordChangeDetail(
                            policy_number=policy_number,
                            record_type="master_sheet",
                            action="no_change",
                            changed_fields=[],
                            previous_values={},
                            new_values={}
                        ))
                
                else:
                    # Add new record to master sheet
                    record['Match Status'] = True
                    record['Insurer Name'] = insurer_name
                    
                    await add_master_sheet_record(record)
                    
                    stats.total_records_added += 1
                    
                    change_details.append(RecordChangeDetail(
                        policy_number=policy_number,
                        record_type="master_sheet",
                        action="added",
                        changed_fields=list(record.keys()),
                        previous_values={},
                        new_values=record
                    ))
                    
            except Exception as e:
                stats.total_errors += 1
                stats.error_details.append(f"Error processing {policy_number}: {str(e)}")
                logger.error(f"Error processing record {policy_number}: {str(e)}")
        
        # Calculate processing time
        end_time = datetime.now()
        stats.processing_time_seconds = (end_time - start_time).total_seconds()
        
        return UniversalRecordProcessingReport(
            stats=stats,
            change_details=change_details,
            insurer_name=insurer_name,
            file_info={
                "original_headers": original_headers,
                "unmapped_headers": unmapped_headers,
                "total_records": len(mapped_records)
            },
            processed_by_user_id=admin_user_id
        )
        
    except Exception as e:
        logger.error(f"Error in universal record processing: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process universal record: {str(e)}"
        )


async def compare_and_update_master_record(
    existing_record: Dict[str, Any],
    new_record: Dict[str, Any],
    insurer_name: str
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
            existing_value_normalized = normalize_field_value(field_name, existing_value)
            
            if new_value_normalized != existing_value_normalized:
                has_changes = True
                changed_fields.append(field_name)
                
                # Update the existing record with new value
                existing_record[field_name] = new_value_normalized
    
    return has_changes, changed_fields


async def generate_reconciliation_summary(
    db: AsyncSession,
    insurer_name: Optional[str] = None
) -> ReconciliationSummaryResponse:
    """Generate reconciliation summary comparing master sheet data with match status"""
    
    try:
        # Import Google Sheets utility functions
        from utils.google_sheets import get_master_sheet_data
        
        # Get master sheet data
        master_sheet_data = await get_master_sheet_data(insurer_name=insurer_name)
        
        total_policies_in_system = len(master_sheet_data)
        
        # Calculate match statistics based on match_status field
        matched_records = [record for record in master_sheet_data if record.get('Match Status') == True]
        total_matches = len(matched_records)
        total_mismatches = total_policies_in_system - total_matches
        
        # For this implementation, universal record count is same as system count
        total_policies_in_universal_record = total_policies_in_system
        total_missing_in_system = 0
        total_missing_in_universal = 0
        
        # Calculate percentages
        data_variance_percentage = (total_mismatches / total_policies_in_system * 100) if total_policies_in_system > 0 else 0.0
        coverage_percentage = (total_matches / total_policies_in_system * 100) if total_policies_in_system > 0 else 0.0
        
        return ReconciliationSummaryResponse(
            total_policies_in_system=total_policies_in_system,
            total_policies_in_universal_record=total_policies_in_universal_record,
            total_matches=total_matches,
            total_mismatches=total_mismatches,
            total_missing_in_system=total_missing_in_system,
            total_missing_in_universal=total_missing_in_universal,
            data_variance_percentage=round(data_variance_percentage, 2),
            coverage_percentage=round(coverage_percentage, 2),
            top_mismatched_fields=[]  # Would be calculated from actual reconciliation data
        )
        
    except Exception as e:
        logger.error(f"Error generating reconciliation summary: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate reconciliation summary: {str(e)}"
        )


# Initialize insurer mappings on module load
_load_mappings_from_csv()
