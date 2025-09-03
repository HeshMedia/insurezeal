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
    
    async def get_master_sheet_stats(self) -> Dict[str, Any]:
        """Get statistics and summary data from master sheet"""
        try:
            if not self.sheets_client.client:
                return {"error": "Google Sheets not available"}
            
            # Get Master sheet
            master_sheet = self.sheets_client._get_or_create_worksheet(
                "Master", 
                self.sheets_client._get_master_sheet_headers()
            )
            
            if not master_sheet:
                return {"error": "Master sheet not accessible"}
            
            # Get all data
            all_data = master_sheet.get_all_records()
            
            # Calculate statistics
            total_records = len(all_data)
            total_policies = len([r for r in all_data if r.get('Policy Number')])
            total_cutpay_transactions = len([r for r in all_data if r.get('CutPay Amount')])
            
            # Calculate financial totals
            total_gross_premium = 0
            total_net_premium = 0
            total_cutpay_amount = 0
            
            agent_stats = {}
            insurer_stats = {}
            monthly_stats = {}
            
            for record in all_data:
                # Financial totals
                try:
                    if record.get('Gross Premium'):
                        total_gross_premium += float(record['Gross Premium'] or 0)
                except:
                    pass
                
                try:
                    if record.get('Net Premium'):
                        total_net_premium += float(record['Net Premium'] or 0)
                except:
                    pass
                
                try:
                    if record.get('CutPay Amount'):
                        total_cutpay_amount += float(record['CutPay Amount'] or 0)
                except:
                    pass
                
                # Agent statistics
                agent_code = record.get('Agent Code')
                if agent_code:
                    if agent_code not in agent_stats:
                        agent_stats[agent_code] = {'count': 0, 'total_premium': 0}
                    agent_stats[agent_code]['count'] += 1
                    try:
                        agent_stats[agent_code]['total_premium'] += float(record.get('Gross Premium', 0) or 0)
                    except:
                        pass
                
                # Insurer statistics
                insurer_name = record.get('Insurer Name')
                if insurer_name:
                    if insurer_name not in insurer_stats:
                        insurer_stats[insurer_name] = {'count': 0, 'total_premium': 0}
                    insurer_stats[insurer_name]['count'] += 1
                    try:
                        insurer_stats[insurer_name]['total_premium'] += float(record.get('Gross Premium', 0) or 0)
                    except:
                        pass
                
                # Monthly statistics
                reporting_month = record.get('Reporting Month')
                if reporting_month:
                    if reporting_month not in monthly_stats:
                        monthly_stats[reporting_month] = {'count': 0, 'total_premium': 0}
                    monthly_stats[reporting_month]['count'] += 1
                    try:
                        monthly_stats[reporting_month]['total_premium'] += float(record.get('Gross Premium', 0) or 0)
                    except:
                        pass
            
            # Top agents (by premium)
            top_agents = sorted(
                [{'agent_code': k, **v} for k, v in agent_stats.items()],
                key=lambda x: x['total_premium'],
                reverse=True
            )[:10]
            
            # Top insurers (by premium)
            top_insurers = sorted(
                [{'insurer_name': k, **v} for k, v in insurer_stats.items()],
                key=lambda x: x['total_premium'],
                reverse=True
            )[:10]
            
            # Monthly summary
            monthly_summary = sorted(
                [{'month': k, **v} for k, v in monthly_stats.items()],
                key=lambda x: x['month']
            )
            
            return {
                "total_records": total_records,
                "total_policies": total_policies,
                "total_cutpay_transactions": total_cutpay_transactions,
                "total_gross_premium": total_gross_premium,
                "total_net_premium": total_net_premium,
                "total_cutpay_amount": total_cutpay_amount,
                "top_agents": top_agents,
                "top_insurers": top_insurers,
                "monthly_summary": monthly_summary
            }
            
        except Exception as e:
            logger.error(f"Error getting master sheet stats: {str(e)}")
            return {"error": str(e)}
    
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
