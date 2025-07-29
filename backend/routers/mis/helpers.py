from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, Any, List, Optional
import logging
from utils.google_sheets import google_sheets_sync
from .schemas import MasterSheetRecord, BulkUpdateField, BulkUpdateResult
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
                    # Search across key fields
                    searchable_fields = [
                        record.policy_number, record.agent_code, record.customer_name,
                        record.insurer_name, record.broker_name, record.registration_no
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
        """Convert a sheet row dictionary to MasterSheetRecord"""
        # Map the headers to our schema fields
        field_mapping = {
            "ID": "id",
            "Reporting Month": "reporting_month",
            "Booking Date": "booking_date",
            "Agent Code": "agent_code",
            "Code Type": "code_type",
            "Insurer Name": "insurer_name",
            "Broker Name": "broker_name",
            "Insurer Broker Code": "insurer_broker_code",
            "Policy Number": "policy_number",
            "Formatted Policy Number": "formatted_policy_number",
            "Customer Name": "customer_name",
            "Customer Phone Number": "customer_phone_number",
            "Major Categorisation": "major_categorisation",
            "Product Insurer Report": "product_insurer_report",
            "Product Type": "product_type",
            "Plan Type": "plan_type",
            "Gross Premium": "gross_premium",
            "Net Premium": "net_premium",
            "OD Premium": "od_premium",
            "TP Premium": "tp_premium",
            "GST Amount": "gst_amount",
            "Commissionable Premium": "commissionable_premium",
            "Registration No": "registration_no",
            "Make Model": "make_model",
            "Model": "model",
            "Vehicle Variant": "vehicle_variant",
            "GVW": "gvw",
            "RTO": "rto",
            "State": "state",
            "Cluster": "cluster",
            "Fuel Type": "fuel_type",
            "CC": "cc",
            "Age Year": "age_year",
            "NCB": "ncb",
            "Discount Percent": "discount_percent",
            "Business Type": "business_type",
            "Seating Capacity": "seating_capacity",
            "Vehicle Wheels": "vehicle_wheels",
            "Incoming Grid %": "incoming_grid_perc",
            "Agent Commission %": "agent_commission_perc",
            "Extra Grid %": "extra_grid_perc",
            "Agent Extra %": "agent_extra_perc",
            "Payment By": "payment_by",
            "Payment Method": "payment_method",
            "Payout On": "payout_on",
            "Payment By Office": "payment_by_office",
            "Receivable from Broker": "receivable_from_broker",
            "Extra Amount Receivable": "extra_amount_receivable",
            "Total Receivable": "total_receivable",
            "Total Receivable with GST": "total_receivable_with_gst",
            "CutPay Amount": "cut_pay_amount",
            "Agent PO Amount": "agent_po_amount",
            "Agent Extra Amount": "agent_extra_amount",
            "Total Agent PO": "total_agent_po",
            "Claimed By": "claimed_by",
            "Running Balance": "running_balance",
            "CutPay Received": "cutpay_received",
            "Already Given to Agent": "already_given_to_agent",
            "IZ Total PO %": "iz_total_po_percent",
            "Broker PO %": "broker_po_percent",
            "Broker Payout Amount": "broker_payout_amount",
            "Invoice Status": "invoice_status",
            "Remarks": "remarks",
            "Company": "company",
            "Notes": "notes",
            "Created At": "created_at",
            "Updated At": "updated_at"
        }
        
        # Create record with mapped fields
        record_data = {"row_number": row_number}
        for sheet_header, field_name in field_mapping.items():
            record_data[field_name] = str(row_data.get(sheet_header, "")) if row_data.get(sheet_header) else None
        
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
