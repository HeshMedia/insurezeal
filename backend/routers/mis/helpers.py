from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, Any, List, Optional
import logging
from utils.google_sheets import google_sheets_sync
from .schemas import (
    MasterSheetRecord, 
    MasterSheetResponse, 
    AgentMISRecord, 
    AgentMISResponse, 
    AgentMISStats,
    BulkUpdateField,
    BulkUpdateResult,
    BulkUpdateResponse
)
import time
from datetime import datetime

logger = logging.getLogger(__name__)

class MISHelpers:
    """
    Helper functions for MIS operations
    
    FUNCTIONS:
    - get_master_sheet_data() - Get paginated data from master sheet
    - bulk_update_master_sheet() - Update multiple fields in master sheet
    - get_master_sheet_stats() - Get statistics from master sheet
    - _convert_row_to_record() - Convert sheet row to record object
    - _find_record_row() - Find row number for a record ID
    """
    
    def __init__(self):
        self.sheets_client = google_sheets_sync
    
    async def get_master_sheet_data(
        self,
        page: int = 1,
        page_size: int = 50,
        search: Optional[str] = None,
        filter_by: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """
        Get paginated data from master Google sheet
        
        Args:
            page: Page number (1-based)
            page_size: Number of records per page
            search: Search term to filter records
            filter_by: Dictionary of field:value filters
            
        Returns:
            Dictionary with records, pagination info, and metadata
        """
        try:
            if not self.sheets_client.client:
                logger.error("Google Sheets client not initialized")
                return {
                    "records": [],
                    "total_count": 0,
                    "page": page,
                    "page_size": page_size,
                    "total_pages": 0,
                    "error": "Google Sheets not available"
                }
            
            # Get Master sheet
            master_sheet = self.sheets_client._get_or_create_worksheet(
                "Master", 
                self.sheets_client._get_master_sheet_headers()
            )
            
            if not master_sheet:
                logger.error("Could not access Master sheet")
                return {
                    "records": [],
                    "total_count": 0,
                    "page": page,
                    "page_size": page_size,
                    "total_pages": 0,
                    "error": "Master sheet not accessible"
                }
            
            # Get all data from the sheet
            all_data = master_sheet.get_all_records()
            headers = self.sheets_client._get_master_sheet_headers()
            
            logger.info(f"Retrieved {len(all_data)} records from Master sheet")
            
            # Convert to our record format
            all_records = []
            for idx, row_data in enumerate(all_data):
                record = self._convert_row_to_record(row_data, idx + 2)  # +2 because row 1 is headers, and we're 0-indexed
                all_records.append(record)
            
            # Apply search filter if provided
            if search and search.strip():
                search_term = search.strip().lower()
                filtered_records = []
                for record in all_records:
                    # Search across key fields using new field names
                    searchable_fields = [
                        record.policy_number, record.child_id, record.customer_name,
                        record.insurer_name, record.broker_name, record.registration_number
                    ]
                    
                    if any(field and search_term in str(field).lower() for field in searchable_fields):
                        filtered_records.append(record)
                
                all_records = filtered_records
                logger.info(f"Search '{search}' filtered to {len(all_records)} records")
            
            # Apply field filters if provided
            if filter_by:
                for field_name, filter_value in filter_by.items():
                    if filter_value and filter_value.strip():
                        filter_val = filter_value.strip().lower()
                        all_records = [
                            record for record in all_records
                            if hasattr(record, field_name) and 
                            getattr(record, field_name) and
                            filter_val in str(getattr(record, field_name)).lower()
                        ]
                logger.info(f"Field filters applied, {len(all_records)} records remaining")
            
            total_count = len(all_records)
            total_pages = (total_count + page_size - 1) // page_size
            
            # Apply pagination
            start_idx = (page - 1) * page_size
            end_idx = start_idx + page_size
            paginated_records = all_records[start_idx:end_idx]
            
            logger.info(f"Returning page {page} with {len(paginated_records)} records")
            
            return {
                "records": paginated_records,
                "total_count": total_count,
                "page": page,
                "page_size": page_size,
                "total_pages": total_pages
            }
            
        except Exception as e:
            logger.error(f"Error getting master sheet data: {str(e)}")
            return {
                "records": [],
                "total_count": 0,
                "page": page,
                "page_size": page_size,
                "total_pages": 0,
                "error": str(e)
            }
    
    async def get_quarterly_sheet_data(
        self,
        quarter: int,
        year: int,
        page: int = 1,
        page_size: int = 50,
        search: Optional[str] = None,
        filter_by: Optional[Dict[str, str]] = None
    ) -> MasterSheetResponse:
        """
        Get paginated data from specific quarterly Google sheet
        
        Args:
            quarter: Quarter number (1-4)
            year: Year (e.g., 2025)
            page: Page number (1-based)
            page_size: Number of records per page
            search: Search term to filter records
            filter_by: Dictionary of field:value filters
            
        Returns:
            MasterSheetResponse with records, pagination info, and metadata
        """
        try:
            if not self.sheets_client.client:
                logger.error("Google Sheets client not initialized")
                return MasterSheetResponse(
                    records=[],
                    total_count=0,
                    page=page,
                    page_size=page_size,
                    total_pages=0
                )
            
            # Construct quarterly sheet name
            sheet_name = f"Q{quarter}-{year}"
            logger.info(f"Fetching data from quarterly sheet: {sheet_name}")
            
            # Use quarterly_sheets_manager to get data from specific quarterly sheet
            from utils.quarterly_sheets_manager import quarterly_manager
            
            # Get all records from the quarterly sheet
            quarterly_records = quarterly_manager.get_all_records_from_quarter_sheet(quarter, year)
            
            if not quarterly_records:
                logger.warning(f"No data found in quarterly sheet: {sheet_name}")
                return MasterSheetResponse(
                    records=[],
                    total_count=0,
                    page=page,
                    page_size=page_size,
                    total_pages=0
                )
            
            # Convert to record objects (similar to master sheet processing)
            all_records = []
            for record_dict in quarterly_records:
                try:
                    # Convert all values to strings to match MasterSheetRecord schema expectations
                    converted_record = {}
                    for key, value in record_dict.items():
                        # Convert all values to strings, handling None values
                        if value is None:
                            converted_record[key] = ""
                        elif isinstance(value, (int, float)):
                            converted_record[key] = str(value)
                        else:
                            converted_record[key] = str(value) if value else ""
                    
                    # Log field names for debugging
                    if len(all_records) == 0:  # Log only for first record to avoid spam
                        logger.info(f"Debug: Available fields in {sheet_name}: {list(converted_record.keys())}")
                    
                    # Convert to MasterSheetRecord with string values
                    record_obj = MasterSheetRecord(**converted_record)
                    all_records.append(record_obj)
                except Exception as e:
                    logger.warning(f"Skipping invalid record in {sheet_name}: {e}")
                    # Log the first few characters of problematic record for debugging
                    if len(all_records) < 3:  # Only log first few failed records
                        sample_fields = {k: v for i, (k, v) in enumerate(record_dict.items()) if i < 5}
                        logger.debug(f"Failed record sample: {sample_fields}")
                    continue
            
            # Apply search filter if provided
            if search and search.strip():
                search_term = search.strip().lower()
                filtered_records = []
                for record in all_records:
                    # Search across key fields
                    searchable_text = " ".join([
                        str(getattr(record, 'policy_number', '') or ''),
                        str(getattr(record, 'agent_code', '') or ''),
                        str(getattr(record, 'customer_name', '') or ''),
                        str(getattr(record, 'insurer_name', '') or ''),
                        str(getattr(record, 'broker_name', '') or ''),
                        str(getattr(record, 'registration_number', '') or '')
                    ]).lower()
                    
                    if search_term in searchable_text:
                        filtered_records.append(record)
                
                all_records = filtered_records
                logger.info(f"Search '{search}' filtered to {len(all_records)} records in {sheet_name}")
            
            # Apply field filters if provided
            if filter_by:
                for field_name, filter_value in filter_by.items():
                    if filter_value and filter_value.strip():
                        filter_val = filter_value.strip().lower()
                        all_records = [
                            record for record in all_records
                            if hasattr(record, field_name) and 
                            getattr(record, field_name) and
                            filter_val in str(getattr(record, field_name)).lower()
                        ]
                logger.info(f"Field filters applied to {sheet_name}, {len(all_records)} records remaining")
            
            total_count = len(all_records)
            total_pages = (total_count + page_size - 1) // page_size
            
            # Apply pagination
            start_idx = (page - 1) * page_size
            end_idx = start_idx + page_size
            paginated_records = all_records[start_idx:end_idx]
            
            logger.info(f"Returning page {page} with {len(paginated_records)} records from {sheet_name}")
            
            return MasterSheetResponse(
                records=paginated_records,
                total_count=total_count,
                page=page,
                page_size=page_size,
                total_pages=total_pages
            )
            
        except Exception as e:
            logger.error(f"Error getting quarterly sheet data for Q{quarter}-{year}: {str(e)}")
            return MasterSheetResponse(
                records=[],
                total_count=0,
                page=page,
                page_size=page_size,
                total_pages=0
            )

    async def bulk_update_master_sheet(
        self,
        updates: List[BulkUpdateField],
        admin_user_id: str
    ) -> Dict[str, Any]:
        """
        Perform bulk updates on master sheet
        
        Args:
            updates: List of field updates to apply
            admin_user_id: ID of admin performing the update
            
        Returns:
            Dictionary with update results and statistics
        """
        start_time = time.time()
        results = []
        successful_updates = 0
        failed_updates = 0
        
        try:
            if not self.sheets_client.client:
                logger.error("Google Sheets client not initialized")
                return {
                    "message": "Google Sheets not available",
                    "total_updates": len(updates),
                    "successful_updates": 0,
                    "failed_updates": len(updates),
                    "results": [],
                    "processing_time_seconds": time.time() - start_time
                }
            
            # Get Master sheet
            master_sheet = self.sheets_client._get_or_create_worksheet(
                "Master", 
                self.sheets_client._get_master_sheet_headers()
            )
            
            if not master_sheet:
                logger.error("Could not access Master sheet")
                return {
                    "message": "Master sheet not accessible",
                    "total_updates": len(updates),
                    "successful_updates": 0,
                    "failed_updates": len(updates),
                    "results": [],
                    "processing_time_seconds": time.time() - start_time
                }
            
            headers = self.sheets_client._get_master_sheet_headers()
            
            # Group updates by record ID for efficiency
            updates_by_record = {}
            for update in updates:
                if update.record_id not in updates_by_record:
                    updates_by_record[update.record_id] = []
                updates_by_record[update.record_id].append(update)
            
            logger.info(f"Processing bulk update for {len(updates_by_record)} records with {len(updates)} total field updates")
            
            # Process each record's updates
            for record_id, record_updates in updates_by_record.items():
                try:
                    # Find the row for this record
                    row_number = await self._find_record_row(master_sheet, record_id)
                    
                    if not row_number:
                        # Record not found
                        for update in record_updates:
                            results.append(BulkUpdateResult(
                                record_id=record_id,
                                field_name=update.field_name,
                                old_value=None,
                                new_value=update.new_value,
                                success=False,
                                error_message=f"Record with ID '{record_id}' not found"
                            ))
                            failed_updates += 1
                        continue
                    
                    # Get current row data to capture old values
                    current_row = master_sheet.row_values(row_number)
                    while len(current_row) < len(headers):
                        current_row.append("")  # Pad with empty strings if needed
                    
                    # Prepare updates for this row
                    updated_row = current_row.copy()
                    
                    for update in record_updates:
                        try:
                            # Find column index for the field
                            if update.field_name not in headers:
                                results.append(BulkUpdateResult(
                                    record_id=record_id,
                                    field_name=update.field_name,
                                    old_value=None,
                                    new_value=update.new_value,
                                    success=False,
                                    error_message=f"Field '{update.field_name}' not found in headers"
                                ))
                                failed_updates += 1
                                continue
                            
                            col_index = headers.index(update.field_name)
                            old_value = current_row[col_index] if col_index < len(current_row) else ""
                            
                            # Update the value
                            updated_row[col_index] = update.new_value or ""
                            
                            results.append(BulkUpdateResult(
                                record_id=record_id,
                                field_name=update.field_name,
                                old_value=old_value,
                                new_value=update.new_value,
                                success=True
                            ))
                            successful_updates += 1
                            
                        except Exception as field_error:
                            results.append(BulkUpdateResult(
                                record_id=record_id,
                                field_name=update.field_name,
                                old_value=None,
                                new_value=update.new_value,
                                success=False,
                                error_message=str(field_error)
                            ))
                            failed_updates += 1
                    
                    # Update the entire row in the sheet
                    if updated_row != current_row:
                        last_col = self.sheets_client._col_to_a1(len(headers))
                        update_range = f"A{row_number}:{last_col}{row_number}"
                        master_sheet.update(update_range, [updated_row], value_input_option='USER_ENTERED')
                        logger.info(f"Updated row {row_number} for record {record_id}")
                
                except Exception as record_error:
                    logger.error(f"Error updating record {record_id}: {str(record_error)}")
                    for update in record_updates:
                        results.append(BulkUpdateResult(
                            record_id=record_id,
                            field_name=update.field_name,
                            old_value=None,
                            new_value=update.new_value,
                            success=False,
                            error_message=str(record_error)
                        ))
                        failed_updates += 1
            
            processing_time = time.time() - start_time
            
            logger.info(f"Bulk update completed: {successful_updates} successful, {failed_updates} failed in {processing_time:.2f}s")
            
            return {
                "message": f"Bulk update completed: {successful_updates} successful, {failed_updates} failed",
                "total_updates": len(updates),
                "successful_updates": successful_updates,
                "failed_updates": failed_updates,
                "results": results,
                "processing_time_seconds": processing_time
            }
            
        except Exception as e:
            logger.error(f"Error in bulk update: {str(e)}")
            processing_time = time.time() - start_time
            
            return {
                "message": f"Bulk update failed: {str(e)}",
                "total_updates": len(updates),
                "successful_updates": successful_updates,
                "failed_updates": len(updates) - successful_updates,
                "results": results,
                "processing_time_seconds": processing_time
            }
    
    async def bulk_update_quarterly_sheet(
        self,
        updates: List[BulkUpdateField],
        quarter: int,
        year: int,
        admin_user_id: str
    ) -> Dict[str, Any]:
        """
        Perform bulk updates on quarterly sheet
        
        Args:
            updates: List of field updates to apply
            quarter: Quarter number (1-4)
            year: Year (e.g., 2025)
            admin_user_id: ID of admin performing the update
            
        Returns:
            Dictionary with update results and statistics
        """
        start_time = time.time()
        results = []
        successful_updates = 0
        failed_updates = 0
        
        try:
            if not self.sheets_client.client:
                logger.error("Google Sheets client not initialized")
                return {
                    "message": "Google Sheets not available",
                    "total_updates": len(updates),
                    "successful_updates": 0,
                    "failed_updates": len(updates),
                    "results": [],
                    "processing_time_seconds": time.time() - start_time
                }
            
            # Construct quarterly sheet name
            sheet_name = f"Q{quarter}-{year}"
            logger.info(f"Performing bulk update on quarterly sheet: {sheet_name}")
            
            # Use quarterly_sheets_manager to access the sheet
            from utils.quarterly_sheets_manager import quarterly_manager
            
            # Get the quarterly sheet directly using quarterly manager
            quarterly_sheet = quarterly_manager.get_quarterly_sheet(quarter, year)
            
            if not quarterly_sheet:
                error_msg = f"Quarterly sheet {sheet_name} not found or not accessible"
                logger.error(error_msg)
                return {
                    "message": error_msg,
                    "total_updates": len(updates),
                    "successful_updates": 0,
                    "failed_updates": len(updates),
                    "results": [],
                    "processing_time_seconds": time.time() - start_time
                }
            
            # Get headers from the quarterly sheet
            headers = quarterly_sheet.row_values(1)
            logger.info(f"Quarterly sheet {sheet_name} headers: {headers}")
            
            # Get all data (skipping header row and dummy row)
            all_data = quarterly_sheet.get_all_values()
            
            if len(all_data) <= 2:  # Only header and dummy row, no actual data
                logger.warning(f"No data rows found in quarterly sheet {sheet_name}")
                return {
                    "message": f"No data rows found in quarterly sheet {sheet_name}",
                    "total_updates": len(updates),
                    "successful_updates": 0,
                    "failed_updates": len(updates),
                    "results": [],
                    "processing_time_seconds": time.time() - start_time
                }
            
            # Skip header row (index 0) and dummy row (index 1), start from actual data (index 2)
            data_rows = all_data[2:]  # Start from row 3 (index 2)
            
            # Find the Policy Number column index
            policy_number_col_index = None
            for idx, header in enumerate(headers):
                if header.lower().strip() == "policy number":
                    policy_number_col_index = idx
                    break
            
            if policy_number_col_index is None:
                error_msg = f"Policy Number column not found in quarterly sheet {sheet_name}"
                logger.error(error_msg)
                return {
                    "message": error_msg,
                    "total_updates": len(updates),
                    "successful_updates": 0,
                    "failed_updates": len(updates),
                    "results": [],
                    "processing_time_seconds": time.time() - start_time
                }
            
            # Group updates by record_id for batch processing
            updates_by_record = {}
            for update in updates:
                if update.record_id not in updates_by_record:
                    updates_by_record[update.record_id] = []
                updates_by_record[update.record_id].append(update)
            
            # Process each record (using policy number as record_id)
            for policy_number, record_updates in updates_by_record.items():
                try:
                    # Find the row for this policy number
                    row_found = False
                    row_index = -1
                    row_number = -1
                    
                    for idx, row in enumerate(data_rows):
                        if idx < len(data_rows) and policy_number_col_index < len(row):
                            if str(row[policy_number_col_index]).strip() == str(policy_number).strip():
                                row_index = idx
                                row_number = idx + 3  # Actual row number in sheet (1-based, +3 because we skip header and dummy row)
                                row_found = True
                                break
                    
                    if not row_found:
                        logger.error(f"Policy number {policy_number} not found in quarterly sheet {sheet_name}")
                        for update in record_updates:
                            results.append(BulkUpdateResult(
                                record_id=policy_number,
                                field_name=update.field_name,
                                old_value=None,
                                new_value=update.new_value,
                                success=False,
                                error_message=f"Policy number {policy_number} not found in quarterly sheet"
                            ))
                            failed_updates += 1
                        continue
                    
                    current_row = data_rows[row_index][:]  # Copy the row
                    
                    # Ensure the row has enough columns
                    while len(current_row) < len(headers):
                        current_row.append("")
                    
                    updated_row = current_row[:]
                    
                    # Apply all field updates for this record
                    for update in record_updates:
                        try:
                            # Validate field name exists in headers
                            if update.field_name not in headers:
                                results.append(BulkUpdateResult(
                                    record_id=policy_number,
                                    field_name=update.field_name,
                                    old_value=None,
                                    new_value=update.new_value,
                                    success=False,
                                    error_message=f"Field '{update.field_name}' not found in quarterly sheet {sheet_name}. Available fields: {headers}"
                                ))
                                failed_updates += 1
                                continue
                            
                            col_index = headers.index(update.field_name)
                            old_value = current_row[col_index] if col_index < len(current_row) else ""
                            
                            # Update the value
                            updated_row[col_index] = update.new_value or ""
                            
                            results.append(BulkUpdateResult(
                                record_id=policy_number,
                                field_name=update.field_name,
                                old_value=old_value,
                                new_value=update.new_value,
                                success=True
                            ))
                            successful_updates += 1
                            
                        except Exception as field_error:
                            results.append(BulkUpdateResult(
                                record_id=policy_number,
                                field_name=update.field_name,
                                old_value=None,
                                new_value=update.new_value,
                                success=False,
                                error_message=str(field_error)
                            ))
                            failed_updates += 1
                    
                    # Update the entire row in the quarterly sheet
                    if updated_row != current_row:
                        last_col = self.sheets_client._col_to_a1(len(headers))
                        update_range = f"A{row_number}:{last_col}{row_number}"
                        quarterly_sheet.update(update_range, [updated_row], value_input_option='USER_ENTERED')
                        logger.info(f"Updated row {row_number} for policy {policy_number} in quarterly sheet {sheet_name}")
                
                except Exception as record_error:
                    logger.error(f"Error updating policy {policy_number} in quarterly sheet {sheet_name}: {str(record_error)}")
                    for update in record_updates:
                        results.append(BulkUpdateResult(
                            record_id=policy_number,
                            field_name=update.field_name,
                            old_value=None,
                            new_value=update.new_value,
                            success=False,
                            error_message=str(record_error)
                        ))
                        failed_updates += 1
            
            processing_time = time.time() - start_time
            
            logger.info(f"Quarterly sheet {sheet_name} bulk update completed: {successful_updates} successful, {failed_updates} failed in {processing_time:.2f}s")
            
            return {
                "message": f"Quarterly sheet {sheet_name} bulk update completed: {successful_updates} successful, {failed_updates} failed",
                "total_updates": len(updates),
                "successful_updates": successful_updates,
                "failed_updates": failed_updates,
                "results": results,
                "processing_time_seconds": processing_time
            }
            
        except Exception as e:
            logger.error(f"Error in quarterly sheet {quarter}-{year} bulk update: {str(e)}")
            processing_time = time.time() - start_time
            
            return {
                "message": f"Quarterly sheet Q{quarter}-{year} bulk update failed: {str(e)}",
                "total_updates": len(updates),
                "successful_updates": successful_updates,
                "failed_updates": len(updates) - successful_updates,
                "results": results,
                "processing_time_seconds": processing_time
            }

    async def get_master_sheet_stats(self) -> Dict[str, Any]:
        """Get complete data from Summary sheet"""
        try:
            if not self.sheets_client.client:
                return {"error": "Google Sheets not available"}
            
            # Import quarterly manager to access Summary sheet
            from utils.quarterly_sheets_manager import quarterly_manager
            
            # Get the Summary sheet
            summary_sheet = quarterly_manager.get_summary_sheet()
            
            if not summary_sheet:
                logger.error("Summary sheet not found")
                return {"error": "Summary sheet not accessible"}
            
            logger.info("Successfully accessed Summary sheet")
            
            # Get all data from the Summary sheet
            all_values = summary_sheet.get_all_values()
            
            if not all_values or len(all_values) < 2:
                logger.warning("No data found in Summary sheet")
                return {"error": "No data found in Summary sheet"}
            
            # Extract headers and data rows
            headers = all_values[0]
            data_rows = all_values[1:]
            
            logger.info(f"Summary sheet has {len(headers)} columns and {len(data_rows)} data rows")
            
            # Convert to list of dictionaries
            summary_data = []
            for row in data_rows:
                # Ensure row has the same length as headers
                while len(row) < len(headers):
                    row.append("")
                
                row_dict = {}
                for i, header in enumerate(headers):
                    row_dict[header] = row[i] if i < len(row) else ""
                
                summary_data.append(row_dict)
            
            # Prepare response with complete Summary sheet data
            response = {
                "sheet_name": "Summary",
                "total_rows": len(data_rows),
                "total_columns": len(headers),
                "headers": headers,
                "data": summary_data,
                "last_updated": "Real-time data from Google Sheets"
            }
            
            logger.info(f"Successfully retrieved {len(summary_data)} records from Summary sheet")
            return response
            
        except Exception as e:
            logger.error(f"Error accessing Summary sheet: {str(e)}")
            return {"error": f"Failed to access Summary sheet: {str(e)}"}

    async def get_broker_sheet_data(self) -> Dict[str, Any]:
        """Get complete data from Broker sheet"""
        try:
            if not self.sheets_client.client:
                return {"error": "Google Sheets not available"}
            
            # Import quarterly manager to access Broker sheet
            from utils.quarterly_sheets_manager import quarterly_manager
            
            # Get the Broker sheet
            broker_sheet = quarterly_manager.get_broker_sheet()
            
            if not broker_sheet:
                logger.error("Broker sheet not found")
                return {"error": "Broker sheet not accessible"}
            
            logger.info("Successfully accessed Broker sheet")
            
            # Get all data from the Broker sheet
            all_values = broker_sheet.get_all_values()
            
            if not all_values or len(all_values) < 2:
                logger.warning("No data found in Broker sheet")
                return {"error": "No data found in Broker sheet"}
            
            # Extract headers and data rows
            headers = all_values[0]
            data_rows = all_values[1:]
            
            logger.info(f"Broker sheet has {len(headers)} columns and {len(data_rows)} data rows")
            
            # Convert to list of dictionaries
            broker_data = []
            for row in data_rows:
                # Ensure row has the same length as headers
                while len(row) < len(headers):
                    row.append("")
                
                row_dict = {}
                for i, header in enumerate(headers):
                    row_dict[header] = row[i] if i < len(row) else ""
                
                broker_data.append(row_dict)
            
            # Prepare response with complete Broker sheet data
            response = {
                "sheet_name": "Broker Sheet",
                "total_rows": len(data_rows),
                "total_columns": len(headers),
                "headers": headers,
                "data": broker_data,
                "last_updated": "Real-time data from Google Sheets"
            }
            
            logger.info(f"Successfully retrieved {len(broker_data)} records from Broker sheet")
            return response
            
        except Exception as e:
            logger.error(f"Error accessing Broker sheet: {str(e)}")
            return {"error": f"Failed to access Broker sheet: {str(e)}"}
    
    def _convert_row_to_record(self, row_data: Dict[str, Any], row_number: int) -> MasterSheetRecord:
        """Convert a sheet row dictionary to MasterSheetRecord using new header structure"""
        
        # Create record using field aliases for new headers
        record_data = {}
        
        # Map each new header to its corresponding field
        for header_key, value in row_data.items():
            # Use the header key directly as it matches our field aliases
            record_data[header_key] = str(value) if value is not None else ""
        
        # Add row number for tracking
        record_data["row_number"] = row_number
        
        # Create the record using field aliases
        return MasterSheetRecord(**record_data)
    
    async def _find_record_row(self, worksheet, record_id: str) -> Optional[int]:
        """Find the row number for a record with given ID"""
        try:
            # Get the ID column (first column)
            id_column = worksheet.col_values(1)  # Column A
            
            # Find the record (skip header row)
            for idx, cell_value in enumerate(id_column[1:], start=2):  # Start from row 2
                if str(cell_value) == str(record_id):
                    return idx
            
            return None
            
        except Exception as e:
            logger.error(f"Error finding record row for ID {record_id}: {str(e)}")
            return None

    async def get_agent_mis_data(
        self,
        agent_code: str,
        page: int = 1,
        page_size: int = 50
    ) -> Dict[str, Any]:
        """
        Get filtered master sheet data for specific agent with removed sensitive fields
        Only returns records where MATCH = TRUE
        
        Args:
            agent_code: Agent code to filter by
            page: Page number (1-based)
            page_size: Number of records per page
            
        Returns:
            Dictionary with filtered records, statistics, and pagination info
        """
        try:
            if not self.sheets_client.client:
                logger.error("Google Sheets client not initialized")
                return {
                    "records": [],
                    "stats": {"number_of_policies": 0, "running_balance": 0.0, "total_net_premium": 0.0},
                    "total_count": 0,
                    "page": page,
                    "page_size": page_size,
                    "total_pages": 0
                }

            # Get Master sheet
            master_sheet = self.sheets_client._get_or_create_worksheet(
                "Master", 
                self.sheets_client._get_master_sheet_headers()
            )
            
            if not master_sheet:
                logger.error("Could not access Master sheet")
                return {
                    "records": [],
                    "stats": {"number_of_policies": 0, "running_balance": 0.0, "total_net_premium": 0.0},
                    "total_count": 0,
                    "page": page,
                    "page_size": page_size,
                    "total_pages": 0
                }

            # Get all data from the sheet as dictionaries
            all_data = master_sheet.get_all_records()
            logger.info(f"Retrieved {len(all_data)} total records from Master sheet")
            
            # Filter records for this agent
            filtered_records = []
            for record in all_data:
                # Check if agent code matches (try both possible field names)
                record_agent_code = str(record.get('Agent Code', record.get('agent_code', ''))).strip()
                
                # Check if MATCH is TRUE (try different possible field names)
                match_status = str(record.get('MATCH', record.get('Match Status', record.get('match_status', 'TRUE')))).upper().strip()
                
                logger.info(f"Record agent code: '{record_agent_code}', Match status: '{match_status}', Target: '{agent_code}'")
                
                if record_agent_code == agent_code and match_status == 'TRUE':
                    filtered_records.append(record)
            
            logger.info(f"Filtered to {len(filtered_records)} records for agent: {agent_code}")
            
            # Calculate statistics
            running_balance = 0.0
            total_net_premium = 0.0
            
            for record in filtered_records:
                try:
                    # Get running balance value with better parsing
                    balance_val = record.get('Running Balance', record.get('running_balance', '0'))
                    if balance_val and str(balance_val).strip():
                        balance_str = str(balance_val).replace(',', '').replace('₹', '').strip()
                        if balance_str and balance_str != '':
                            running_balance += float(balance_str)
                            logger.info(f"Added balance: {balance_str} -> running total: {running_balance}")
                except (ValueError, TypeError) as e:
                    logger.warning(f"Could not parse running balance '{balance_val}': {e}")
                    
                try:
                    # Get net premium value with better parsing
                    net_val = record.get('Net Premium', record.get('net_premium', '0'))
                    if net_val and str(net_val).strip():
                        net_str = str(net_val).replace(',', '').replace('₹', '').strip()
                        if net_str and net_str != '':
                            total_net_premium += float(net_str)
                            logger.info(f"Added net premium: {net_str} -> running total: {total_net_premium}")
                except (ValueError, TypeError) as e:
                    logger.warning(f"Could not parse net premium '{net_val}': {e}")
            
            logger.info(f"Final statistics - Running Balance: {running_balance}, Net Premium: {total_net_premium}")

            total_count = len(filtered_records)
            
            # Pagination
            total_pages = (total_count + page_size - 1) // page_size if page_size > 0 else 1
            start_idx = (page - 1) * page_size
            end_idx = start_idx + page_size
            paginated_records = filtered_records[start_idx:end_idx]

            # Convert to AgentMISRecord format with filtered fields
            agent_records = []
            for record in paginated_records:
                agent_record = self._convert_record_to_agent_mis_record(record)
                if agent_record:
                    agent_records.append(agent_record)

            return {
                "records": agent_records,
                "stats": {
                    "number_of_policies": total_count,
                    "running_balance": running_balance,
                    "total_net_premium": total_net_premium
                },
                "total_count": total_count,
                "page": page,
                "page_size": page_size,
                "total_pages": total_pages
            }

        except Exception as e:
            logger.error(f"Error fetching agent MIS data: {str(e)}")
            return {
                "records": [],
                "stats": {"number_of_policies": 0, "running_balance": 0.0, "total_net_premium": 0.0},
                "total_count": 0,
                "page": page,
                "page_size": page_size,
                "total_pages": 0
            }

    def _convert_record_to_agent_mis_record(self, record: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Convert master sheet record dictionary to AgentMISRecord with filtered fields
        """
        try:
            # Field mapping for AgentMISRecord (using actual Google Sheet header names)
            agent_mis_record = {
                "id": record.get("ID", record.get("id")),
                "reporting_month": record.get("Reporting Month", record.get("reporting_month")),
                "booking_date": record.get("Booking Date", record.get("booking_date")),
                "agent_code": record.get("Agent Code", record.get("agent_code")),
                "insurer_name": record.get("Insurer Name", record.get("insurer_name")),
                "broker_name": record.get("Broker Name", record.get("broker_name")),
                "policy_number": record.get("Policy Number", record.get("policy_number")),
                "formatted_policy_number": record.get("Formatted Policy Number", record.get("formatted_policy_number")),
                "customer_name": record.get("Customer Name", record.get("customer_name")),
                "customer_phone_number": record.get("Customer Phone Number", record.get("customer_phone_number")),
                "major_categorisation": record.get("Major Categorisation", record.get("major_categorisation")),
                "product_insurer_report": record.get("Product Insurer Report", record.get("product_insurer_report")),
                "product_type": record.get("Product Type", record.get("product_type")),
                "plan_type": record.get("Plan Type", record.get("plan_type")),
                "gross_premium": record.get("Gross Premium", record.get("gross_premium")),
                "net_premium": record.get("Net Premium", record.get("net_premium")),
                "registration_number": record.get("Registration No", record.get("registration_number")),
                "make_model": record.get("Make Model", record.get("make_model")),
                "model": record.get("Model", record.get("model")),
                "agent_commission_perc": record.get("Agent Commission %", record.get("agent_commission_perc")),
                "agent_po_amount": record.get("Agent PO Amount", record.get("agent_po_amount")),
                "total_agent_po": record.get("Total Agent PO", record.get("total_agent_po")),
                "running_balance": record.get("Running Balance", record.get("running_balance")),
                "already_given_to_agent": record.get("Already Given to Agent", record.get("already_given_to_agent")),
                "created_at": record.get("Created At", record.get("created_at")),
                "updated_at": record.get("Updated At", record.get("updated_at"))
            }

            # Clean None values and convert to strings where needed
            for key, value in agent_mis_record.items():
                if value is not None:
                    agent_mis_record[key] = str(value).strip() if str(value).strip() else None
                else:
                    agent_mis_record[key] = None

            return agent_mis_record

        except Exception as e:
            logger.error(f"Error converting record to agent MIS record: {str(e)}")
            return None

    async def get_quarterly_sheet_agent_data(
        self,
        agent_code: str,
        quarter: int,
        year: int,
        page: int = 1,
        page_size: int = 50
    ) -> Dict[str, Any]:
        """
        Get complete quarterly sheet data for a specific agent
        
        Args:
            agent_code: Agent code to filter by
            quarter: Quarter number (1-4)
            year: Year (e.g., 2025)
            page: Page number (1-based)
            page_size: Number of records per page
            
        Returns:
            Dictionary with complete quarterly records for the agent
        """
        try:
            from utils.quarterly_sheets_manager import quarterly_manager
            
            # Get the quarterly sheet
            quarterly_sheet = quarterly_manager.get_quarterly_sheet(quarter, year)
            if not quarterly_sheet:
                logger.error(f"Quarterly sheet Q{quarter}-{year} not found")
                return {
                    "records": [],
                    "total_count": 0,
                    "page": page,
                    "page_size": page_size,
                    "total_pages": 0
                }

            # Get all data from the quarterly sheet as dictionaries
            all_data = quarterly_sheet.get_all_records()
            logger.info(f"Retrieved {len(all_data)} total records from Q{quarter}-{year} sheet")
            
            # Filter records for this agent (both MATCH = TRUE and FALSE)
            filtered_records = []
            for record in all_data:
                # Check if agent code matches
                record_agent_code = str(record.get('Agent Code', record.get('agent_code', ''))).strip()
                
                if record_agent_code == agent_code:
                    # Convert all values to strings for consistency
                    clean_record = {}
                    for key, value in record.items():
                        clean_record[key] = str(value) if value is not None else ""
                    filtered_records.append(clean_record)
            
            logger.info(f"Found {len(filtered_records)} records for agent {agent_code} in Q{quarter}-{year}")
            
            # Calculate pagination
            total_count = len(filtered_records)
            total_pages = (total_count + page_size - 1) // page_size
            start_idx = (page - 1) * page_size
            end_idx = start_idx + page_size
            paginated_records = filtered_records[start_idx:end_idx]
            
            return {
                "records": paginated_records,
                "total_count": total_count,
                "page": page,
                "page_size": page_size,
                "total_pages": total_pages
            }
            
        except Exception as e:
            logger.error(f"Error fetching quarterly sheet agent data: {str(e)}")
            return {
                "records": [],
                "total_count": 0,
                "page": page,
                "page_size": page_size,
                "total_pages": 0
            }

    async def get_agent_summary_data(self, agent_code: str) -> Dict[str, Any]:
        """
        Get agent summary data from Summary sheet
        
        Args:
            agent_code: Agent code to get summary for
            
        Returns:
            Dictionary with agent's summary data
        """
        try:
            from utils.quarterly_sheets_manager import quarterly_manager
            
            # Get the Summary sheet
            summary_sheet = quarterly_manager.get_summary_sheet()
            if not summary_sheet:
                logger.error("Summary sheet not found")
                return {}

            # Get all data from the summary sheet as dictionaries
            all_data = summary_sheet.get_all_records()
            logger.info(f"Retrieved {len(all_data)} total records from Summary sheet")
            
            # Filter records for this agent
            agent_summary = None
            for record in all_data:
                # Check if agent code matches (try different possible field names)
                record_agent_code = str(record.get('Agent Code', record.get('agent_code', record.get('Agent_Code', '')))).strip()
                
                if record_agent_code == agent_code:
                    # Convert all values to strings for consistency
                    clean_record = {}
                    for key, value in record.items():
                        clean_record[key] = str(value) if value is not None else ""
                    agent_summary = clean_record
                    break
            
            if agent_summary:
                logger.info(f"Found summary data for agent {agent_code}")
                return agent_summary
            else:
                logger.warning(f"No summary data found for agent {agent_code}")
                return {}
                
        except Exception as e:
            logger.error(f"Error fetching agent summary data: {str(e)}")
            return {}

    async def get_quarterly_sheet_agent_filtered_data(
        self,
        agent_code: str,
        quarter: int,
        year: int,
        page: int = 1,
        page_size: int = 50,
        match_only: bool = True
    ) -> Dict[str, Any]:
        """
        Get filtered quarterly sheet data for specific agent with AgentMISRecord compatible fields
        
        Args:
            agent_code: Agent code to filter by
            quarter: Quarter number (1-4)
            year: Year (e.g., 2025)
            page: Page number (1-based)
            page_size: Number of records per page
            match_only: If True, only return records where MATCH = TRUE
            
        Returns:
            Dictionary with filtered records, statistics, and pagination info
        """
        try:
            from utils.quarterly_sheets_manager import quarterly_manager
            
            # Get quarterly sheet
            quarterly_sheet = quarterly_manager.get_quarterly_sheet(quarter, year)
            if not quarterly_sheet:
                logger.error(f"Quarterly sheet Q{quarter}-{year} not found")
                return {
                    "records": [],
                    "total_count": 0,
                    "page": page,
                    "page_size": page_size,
                    "total_pages": 0,
                    "stats": {"running_balance": 0.0, "total_net_premium": 0.0, "commissionable_premium": 0.0}
                }

            # Get all data from the quarterly sheet as dictionaries
            try:
                # Use manual approach to handle duplicate/problematic headers
                all_values = quarterly_sheet.get_all_values()
                if not all_values or len(all_values) < 2:
                    logger.warning(f"No data found in quarterly sheet Q{quarter}-{year}")
                    return {
                        "records": [],
                        "total_count": 0,
                        "page": page,
                        "page_size": page_size,
                        "total_pages": 0,
                        "stats": {"running_balance": 0.0, "total_net_premium": 0.0, "commissionable_premium": 0.0}
                    }
                
                # Get and clean headers
                headers = all_values[0]
                cleaned_headers = []
                header_map = {}
                
                for i, header in enumerate(headers):
                    cleaned_header = str(header).strip()
                    if cleaned_header:
                        cleaned_headers.append(cleaned_header)
                        header_map[i] = cleaned_header
                    else:
                        cleaned_headers.append(f"Column_{i}")
                        header_map[i] = f"Column_{i}"
                
                # Convert rows to dictionaries using cleaned headers
                all_data = []
                for row_values in all_values[1:]:  # Skip header row
                    record = {}
                    for i, value in enumerate(row_values):
                        if i in header_map:
                            record[header_map[i]] = value
                    all_data.append(record)
                
                logger.info(f"Retrieved {len(all_data)} total records from Q{quarter}-{year} using manual parsing")
                
            except Exception as e:
                logger.error(f"Error getting records from quarterly sheet: {str(e)}")
                # Try to get headers to diagnose the issue
                try:
                    headers = quarterly_sheet.row_values(1)
                    logger.error(f"Headers in Q{quarter}-{year}: {headers}")
                    # Check for duplicates
                    seen = set()
                    duplicates = []
                    for header in headers:
                        if header in seen:
                            duplicates.append(header)
                        seen.add(header)
                    if duplicates:
                        logger.error(f"Duplicate headers found: {duplicates}")
                    else:
                        logger.error("No duplicate headers found, but get_all_records() still failing")
                except Exception as header_e:
                    logger.error(f"Could not retrieve headers: {str(header_e)}")
                
                return {
                    "records": [],
                    "total_count": 0,
                    "page": page,
                    "page_size": page_size,
                    "total_pages": 0,
                    "stats": {"running_balance": 0.0, "total_net_premium": 0.0, "commissionable_premium": 0.0}
                }
            
            # Filter records for this agent
            filtered_records = []
            total_running_balance = 0.0
            total_net_premium = 0.0
            total_commissionable_premium = 0.0
            
            for record in all_data:
                # Check if agent code matches
                record_agent_code = str(record.get('Agent Code', '')).strip()
                
                # Check MATCH status if match_only is True
                match_status = str(record.get('Match', record.get('MATCH', 'TRUE'))).upper().strip()
                
                if record_agent_code == agent_code:
                    if not match_only or match_status == 'TRUE':
                        filtered_records.append(record)
                        
                        # Calculate statistics
                        try:
                            running_bal = float(str(record.get('Running Bal', record.get('Running Balance', 0))).replace(',', '') or 0)
                            total_running_balance += running_bal
                        except (ValueError, TypeError):
                            pass
                            
                        try:
                            net_premium = float(str(record.get('Net premium', record.get('Net Premium', 0))).replace(',', '') or 0)
                            total_net_premium += net_premium
                        except (ValueError, TypeError):
                            pass
                            
                        try:
                            commissionable_premium = float(str(record.get('Commissionable Premium', record.get('commissionable_premium', 0))).replace(',', '') or 0)
                            total_commissionable_premium += commissionable_premium
                        except (ValueError, TypeError):
                            pass
            
            logger.info(f"Found {len(filtered_records)} filtered records for agent {agent_code} in Q{quarter}-{year}")
            
            # Pagination
            total_count = len(filtered_records)
            total_pages = (total_count + page_size - 1) // page_size
            start_idx = (page - 1) * page_size
            end_idx = start_idx + page_size
            paginated_records = filtered_records[start_idx:end_idx]
            
            # Statistics
            stats = {
                "running_balance": total_running_balance,
                "total_net_premium": total_net_premium,
                "commissionable_premium": total_commissionable_premium
            }
            
            return {
                "records": paginated_records,
                "total_count": total_count,
                "page": page,
                "page_size": page_size,
                "total_pages": total_pages,
                "stats": stats
            }
            
        except Exception as e:
            logger.error(f"Error fetching quarterly sheet agent filtered data: {str(e)}")
            return {
                "records": [],
                "total_count": 0,
                "page": page,
                "page_size": page_size,
                "total_pages": 0,
                "stats": {"running_balance": 0.0, "total_net_premium": 0.0, "commissionable_premium": 0.0}
            }
