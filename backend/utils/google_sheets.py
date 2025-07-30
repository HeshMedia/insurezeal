import json
import os
from typing import List, Dict, Any, Optional
import gspread
from google.oauth2.service_account import Credentials
from datetime import datetime
import logging
from config import (
    GOOGLE_SHEETS_CREDENTIALS_JSON, 
    GOOGLE_SHEETS_DOCUMENT_ID
)

logger = logging.getLogger(__name__)

class GoogleSheetsSync:
    def __init__(self):
        self.credentials_path = GOOGLE_SHEETS_CREDENTIALS_JSON
        self.document_id = GOOGLE_SHEETS_DOCUMENT_ID
        self.client = None
        self.spreadsheet = None
        self._initialize_client()
    
    def _initialize_client(self):
        """Initialize Google Sheets client with service account credentials"""
        try:
            if not self.credentials_path or not self.document_id:
                logger.warning("Google Sheets credentials or document ID not configured")
                return
                
            scope = [
                'https://spreadsheets.google.com/feeds',
                'https://www.googleapis.com/auth/drive'
            ]
            
            if not os.path.exists(self.credentials_path):
                logger.warning(f"Google Sheets credentials file not found: {self.credentials_path}")
                return
            
            credentials = Credentials.from_service_account_file(
                self.credentials_path, 
                scopes=scope
            )
            
            self.client = gspread.authorize(credentials)
            self.spreadsheet = self.client.open_by_key(self.document_id)
            
            logger.info("Google Sheets client initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize Google Sheets client: {str(e)}")
    
    def _get_or_create_worksheet(self, worksheet_name: str, headers: List[str]) -> Optional[gspread.Worksheet]:
        """Get existing worksheet or create new one with headers"""
        try:
            if not self.spreadsheet:
                return None
                
            worksheet = self.spreadsheet.worksheet(worksheet_name)
            logger.info(f"Found existing worksheet: {worksheet_name}")
            
        except gspread.WorksheetNotFound:

            worksheet = self.spreadsheet.add_worksheet(
                title=worksheet_name, 
                rows=1000, 
                cols=len(headers)
            )
            
            worksheet.append_row(headers)
            logger.info(f"Created new worksheet: {worksheet_name} with headers")
        except Exception as e:
            logger.error(f"Error accessing worksheet {worksheet_name}: {str(e)}")
            return None
        
        return worksheet
    
    def _add_timestamp_row(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Add timestamp to data row"""
        data_with_timestamp = data.copy()
        data_with_timestamp['synced_at'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        return data_with_timestamp

    def _col_to_a1(self, col: int) -> str:
        """Converts a 1-based column index to A1 notation."""
        if col <= 0:
            raise ValueError("Column index must be positive.")
        
        result = ""
        while col > 0:
            col, remainder = divmod(col - 1, 26)
            result = chr(65 + remainder) + result
        return result
    
    def _find_next_empty_row(self, worksheet) -> int:
        """Find the next empty row in the worksheet starting from column A"""
        try:
            # Get all values in column A to find the last non-empty row
            col_a_values = worksheet.col_values(1)  # Column A (1-indexed)
            
            # Find the next empty row (add 1 to the length to get next row)
            next_row = len(col_a_values) + 1
            
            # Ensure we don't overwrite the header row
            if next_row <= 1:
                next_row = 2
                
            return next_row
            
        except Exception as e:
            logger.error(f"Error finding next empty row: {str(e)}")
            # Fallback to row 2 if there's an error
            return 2
    
    def _safe_sync(self, sync_function, *args, **kwargs):
        """Safely execute sync function with error handling"""
        try:
            if not self.client:
                logger.warning("Google Sheets client not initialized - skipping sync")
                return
            
            sync_function(*args, **kwargs)
        except Exception as e:
            logger.error(f"Google Sheets sync failed: {str(e)}")

    def sync_child_id_request(self, child_id_data: Dict[str, Any], action: str = "CREATE"):
        """Sync child ID request to Google Sheets"""
        def _sync():
            headers = [
                'id', 'user_id', 'insurance_company', 'broker', 'location', 
                'phone_number', 'email', 'preferred_rm_name', 'status', 
                'child_id', 'broker_code', 'branch_code', 'region',
                'created_at', 'updated_at', 'action', 'synced_at'
            ]
            
            worksheet = self._get_or_create_worksheet("Child ID Requests", headers)
            if not worksheet:
                return

            row_values = [
                str(child_id_data.get('id', '')),
                str(child_id_data.get('user_id', '')),
                str(child_id_data.get('insurance_company', '')),
                str(child_id_data.get('broker', '')),
                str(child_id_data.get('location', '')),
                str(child_id_data.get('phone_number', '')),
                str(child_id_data.get('email', '')),
                str(child_id_data.get('preferred_rm_name', '')),
                str(child_id_data.get('status', '')),
                str(child_id_data.get('child_id', '')),
                str(child_id_data.get('broker_code', '')),
                str(child_id_data.get('branch_code', '')),
                str(child_id_data.get('region', '')),
                str(child_id_data.get('created_at', '')),
                str(child_id_data.get('updated_at', '')),
                str(action),
                datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            ]
            
            row_values = [str(val) if val is not None else '' for val in row_values]
            
            # Find the next empty row starting from A column
            next_row = self._find_next_empty_row(worksheet)
            
            # Insert the row data starting from column A
            cell_range = f"A{next_row}:{self._col_to_a1(len(row_values))}{next_row}"
            worksheet.update(cell_range, [row_values], value_input_option='RAW')
            
            logger.info(f"Synced child ID request {child_id_data.get('id')} to Google Sheets at row {next_row}")
        
        self._safe_sync(_sync)   
    def sync_cutpay_transaction(self, cutpay_data: Dict[str, Any], action: str = "CREATE"):
        """Sync cut pay transaction to CutPay Google Sheets"""
        def _sync():
            headers = [
                'id', 'policy_number', 'agent_code', 'code_type', 
                'insurer_name', 'broker_name', 'child_id',
                'gross_amount', 'net_premium', 'commission_grid', 'agent_commission_given_percent',
                'cut_pay_amount', 'payment_mode', 'payout_amount',
                'payment_by', 'amount_received', 'payment_method', 'payment_source',
                'transaction_date', 'payment_date', 'status', 'notes', 
                'created_at', 'updated_at', 'action', 'synced_at'
            ]
            
            worksheet = self._get_or_create_worksheet("Cut Pay Transactions", headers)
            if not worksheet:
                return
            
            row_values = [
                str(cutpay_data.get('id', '')),
                str(cutpay_data.get('policy_number', '')),
                str(cutpay_data.get('agent_code', '')),
                str(cutpay_data.get('code_type', '')),
                str(cutpay_data.get('insurer_name', '')),
                str(cutpay_data.get('broker_name', '')),
                str(cutpay_data.get('child_id', '')),
                str(cutpay_data.get('gross_amount', '')),
                str(cutpay_data.get('net_premium', '')),
                str(cutpay_data.get('commission_grid', '')),
                str(cutpay_data.get('agent_commission_given_percent', '')),
                str(cutpay_data.get('cut_pay_amount', '')),
                str(cutpay_data.get('payment_mode', '')),
                str(cutpay_data.get('payout_amount', '')),
                str(cutpay_data.get('payment_by', '')),
                str(cutpay_data.get('amount_received', '')),
                str(cutpay_data.get('payment_method', '')),
                str(cutpay_data.get('payment_source', '')),
                str(cutpay_data.get('transaction_date', '')),
                str(cutpay_data.get('payment_date', '')),
                str(cutpay_data.get('status', '')),
                str(cutpay_data.get('notes', '')),
                str(cutpay_data.get('created_at', '')),
                str(cutpay_data.get('updated_at', '')),
                str(action),
                datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            ]

            row_values = [str(val) if val is not None else '' for val in row_values]
            
            # Find the next empty row starting from A column
            next_row = self._find_next_empty_row(worksheet)
            
            # Insert the row data starting from column A
            cell_range = f"A{next_row}:{self._col_to_a1(len(row_values))}{next_row}"
            worksheet.update(cell_range, [row_values], value_input_option='RAW')
            
            logger.info(f"Synced cut pay transaction {cutpay_data.get('id')} to CutPay sheet at row {next_row}")
        
        self._safe_sync(_sync)
    
    def sync_to_master_sheet(self, cutpay_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Syncs a CutPay transaction to the 'Master' sheet using a dictionary.
        Updates the row if master_sheet_row_id exists, otherwise creates a new row.
        """
        try:
            if not self.client:
                return {"success": False, "error": "Google Sheets client not initialized"}

            headers = self._get_master_sheet_headers()
            master_sheet = self._get_or_create_worksheet("Master", headers)

            if not master_sheet:
                return {"success": False, "error": "Failed to get or create Master worksheet"}

            row_data = self._prepare_master_sheet_row_data(cutpay_data)
            cutpay_id = cutpay_data.get('id')
            row_id = cutpay_data.get('master_sheet_row_id')

            if row_id:
                row_number = int(row_id)
                last_col = self._col_to_a1(len(headers))
                update_range = f"A{row_number}:{last_col}{row_number}"
                master_sheet.update(update_range, [row_data], value_input_option='USER_ENTERED')
                logger.info(f"Updated Master sheet row {row_number} for transaction {cutpay_id}")
            else:
                col_a_values = master_sheet.col_values(1)
                next_row_number = len(list(filter(None, col_a_values))) + 1
                last_col = self._col_to_a1(len(headers))
                update_range = f"A{next_row_number}:{last_col}{next_row_number}"
                master_sheet.update(update_range, [row_data], value_input_option='USER_ENTERED')
                row_number = next_row_number
                logger.info(f"Added new Master sheet row {row_number} for transaction {cutpay_id}")

            return {
                "success": True,
                "row_id": str(row_number),
                "sheet_name": "Master"
            }

        except Exception as e:
            logger.error(f"Failed to sync CutPay transaction {cutpay_data.get('id')} to Master sheet: {str(e)}")
            return {"success": False, "error": str(e)}

    def sync_policy(self, policy_data: Dict[str, Any], action: str = "CREATE"):
        """Sync policy to Google Sheets and Master sheet"""
        def _sync():
            # Sync to Policies sheet
            headers = [
                'id', 'policy_number', 'policy_type', 'insurance_type',
                'agent_id', 'agent_code', 'child_id', 'broker_name', 'insurance_company',
                'vehicle_type', 'registration_number', 'vehicle_class', 'vehicle_segment',
                'gross_premium', 'gst', 'net_premium', 'od_premium', 'tp_premium',
                'payment_by_office', 'total_agent_payout_amount',
                'start_date', 'end_date', 'uploaded_by', 'pdf_file_name',
                'ai_confidence_score', 'manual_override', 'created_at', 'updated_at', 
                'action', 'synced_at'
            ]
            
            worksheet = self._get_or_create_worksheet("Policies", headers)
            if not worksheet:
                return
            
            row_values = [
                str(policy_data.get('id', '')),
                str(policy_data.get('policy_number', '')),
                str(policy_data.get('policy_type', '')),
                str(policy_data.get('insurance_type', '')),
                str(policy_data.get('agent_id', '')),
                str(policy_data.get('agent_code', '')),
                str(policy_data.get('child_id', '')),
                str(policy_data.get('broker_name', '')),
                str(policy_data.get('insurance_company', '')),
                str(policy_data.get('vehicle_type', '')),
                str(policy_data.get('registration_number', '')),
                str(policy_data.get('vehicle_class', '')),
                str(policy_data.get('vehicle_segment', '')),
                str(policy_data.get('gross_premium', '')),
                str(policy_data.get('gst', '')),
                str(policy_data.get('net_premium', '')),
                str(policy_data.get('od_premium', '')),
                str(policy_data.get('tp_premium', '')),
                str(policy_data.get('payment_by_office', '')),
                str(policy_data.get('total_agent_payout_amount', '')),
                str(policy_data.get('start_date', '')),
                str(policy_data.get('end_date', '')),
                str(policy_data.get('uploaded_by', '')),
                str(policy_data.get('pdf_file_name', '')),
                str(policy_data.get('ai_confidence_score', '')),
                str(policy_data.get('manual_override', '')),
                str(policy_data.get('created_at', '')),
                str(policy_data.get('updated_at', '')),
                str(action),
                datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            ]
            
            row_values = [str(val) if val is not None else '' for val in row_values]

            # Find the next empty row starting from A column
            next_row = self._find_next_empty_row(worksheet)
            
            # Insert the row data starting from column A
            cell_range = f"A{next_row}:{self._col_to_a1(len(row_values))}{next_row}"
            worksheet.update(cell_range, [row_values], value_input_option='RAW')
            
            logger.info(f"Synced policy {policy_data.get('policy_number')} to Policies sheet at row {next_row}")
            
            # Also sync to Master sheet if it has relevant fields
            try:
                self._sync_policy_to_master_sheet(policy_data)
            except Exception as e:
                logger.error(f"Failed to sync policy to Master sheet: {str(e)}")
        
        self._safe_sync(_sync)
    
    def _sync_policy_to_master_sheet(self, policy_data: Dict[str, Any]):
        """Sync policy data to Master sheet with relevant fields"""
        master_headers = self._get_master_sheet_headers()
        master_sheet = self._get_or_create_worksheet("Master", master_headers)
        
        if not master_sheet:
            return
        
        # Map policy data to master sheet format
        master_row_data = [""] * len(master_headers)
        
        # Map fields that exist in both policy and master sheet
        field_mappings = {
            "ID": policy_data.get('id', ''),
            "Agent Code": policy_data.get('agent_code', ''),
            "Insurer Name": policy_data.get('insurance_company', ''),
            "Broker Name": policy_data.get('broker_name', ''),
            "Policy Number": policy_data.get('policy_number', ''),
            "Gross Premium": policy_data.get('gross_premium', ''),
            "Net Premium": policy_data.get('net_premium', ''),
            "OD Premium": policy_data.get('od_premium', ''),
            "TP Premium": policy_data.get('tp_premium', ''),
            "GST Amount": policy_data.get('gst', ''),
            "Registration No": policy_data.get('registration_number', ''),
            "Payment By Office": policy_data.get('payment_by_office', ''),
            "Total Agent PO": policy_data.get('total_agent_payout_amount', ''),
            "Created At": policy_data.get('created_at', ''),
            "Updated At": policy_data.get('updated_at', ''),
            "MATCH STATUS": 'False'  # Always set to False for policies
        }
        
        # Fill the row data based on header mappings
        for i, header in enumerate(master_headers):
            if header in field_mappings:
                master_row_data[i] = str(field_mappings[header]) if field_mappings[header] is not None else ''
        
        # Find next empty row and insert
        next_row = self._find_next_empty_row(master_sheet)
        last_col = self._col_to_a1(len(master_headers))
        cell_range = f"A{next_row}:{last_col}{next_row}"
        master_sheet.update(cell_range, [master_row_data], value_input_option='USER_ENTERED')
        
        logger.info(f"Synced policy {policy_data.get('policy_number')} to Master sheet at row {next_row}")
    
    def test_connection(self) -> bool:
        """Test Google Sheets connection"""
        try:
            if not self.spreadsheet:
                return False
                
            title = self.spreadsheet.title
            logger.info(f"Successfully connected to Google Sheets: {title}")
            return True
        except Exception as e:
            logger.error(f"Google Sheets connection test failed: {str(e)}")
            return False

    # =============================================================================
    # COMPREHENSIVE CUTPAY SYNC METHODS
    # =============================================================================
    
    def sync_cutpay_to_sheets(self, cutpay_data: Dict[str, Any]) -> Dict[str, Any]:
            """
            Syncs a CutPay transaction to the 'CutPay' sheet using a dictionary.
            Updates the row if cutpay_sheet_row_id exists, otherwise creates a new row.
            """
            try:
                if not self.client:
                    return {"success": False, "error": "Google Sheets client not initialized"}

                headers = self._get_cutpay_sheet_headers()
                cutpay_sheet = self._get_or_create_worksheet("CutPay", headers)

                if not cutpay_sheet:
                    return {"success": False, "error": "Failed to get or create CutPay worksheet"}

                row_data = self._prepare_cutpay_row_data(cutpay_data)
                cutpay_id = cutpay_data.get('id')
                row_id = cutpay_data.get('cutpay_sheet_row_id')

                if row_id:
                    row_number = int(row_id)
                    last_col = self._col_to_a1(len(headers))
                    update_range = f"A{row_number}:{last_col}{row_number}"
                    cutpay_sheet.update(update_range, [row_data], value_input_option='USER_ENTERED')
                    logger.info(f"Updated CutPay sheet row {row_number} for transaction {cutpay_id}")
                else:
                    col_a_values = cutpay_sheet.col_values(1)
                    next_row_number = len(list(filter(None, col_a_values))) + 1
                    last_col = self._col_to_a1(len(headers))
                    update_range = f"A{next_row_number}:{last_col}{next_row_number}"
                    cutpay_sheet.update(update_range, [row_data], value_input_option='USER_ENTERED')
                    row_number = next_row_number
                    logger.info(f"Added new CutPay sheet row {row_number} for transaction {cutpay_id}")

                return {
                    "success": True,
                    "row_id": str(row_number),
                    "sheet_name": "CutPay"
                }

            except Exception as e:
                logger.error(f"Failed to sync CutPay transaction {cutpay_data.get('id')} to sheets: {str(e)}")
                return {"success": False, "error": str(e)}
    

    def _prepare_cutpay_row_data(self, cutpay_data: Dict[str, Any]) -> List[Any]:
        """Prepares a list of values for a row in the 'CutPay' sheet, ordered according to headers."""
        keys_in_order = [
            'id', 'reporting_month', 'booking_date', 'agent_code', 'code_type',
            'policy_number', 'formatted_policy_number', 'customer_name', 'customer_phone_number', 'major_categorisation',
            'product_insurer_report', 'product_type', 'plan_type',
            'gross_premium', 'net_premium', 'od_premium', 'tp_premium', 'gst_amount',
            'registration_no', 'make_model', 'model', 'vehicle_variant', 'gvw', 'rto',
            'state', 'cluster', 'fuel_type', 'cc', 'age_year', 'ncb', 'discount_percent',
            'business_type', 'seating_capacity', 'vehicle_wheels',
            'insurer_name', 'broker_name', 'insurer_broker_code',
            'incoming_grid_perc', 'agent_commission_perc', 'extra_grid_perc', 'commissionable_premium', 'agent_extra_perc',
            'payment_by', 'payment_method', 'payout_on', 'payment_by_office',
            'receivable_from_broker', 'extra_amount_receivable_from_broker', 'total_receivable_from_broker',
            'total_receivable_from_broker_with_gst', 'cut_pay_amount', 'agent_po_amt', 'agent_extra_amount', 'total_agent_po_amt',
            'claimed_by', 'running_bal', 'cutpay_received',
            # Post-CutPay fields
            'already_given_to_agent', 'iz_total_po_percent', 'broker_po_percent', 'broker_payout_amount', 'invoice_status', 'remarks', 'company',
            'synced_to_cutpay_sheet', 'synced_to_master_sheet', 'notes', 'created_at', 'updated_at'
        ]
        
        # Prepare row data - AI already adds hash prefix to formatted_policy_number
        row = []
        for key in keys_in_order:
            value = cutpay_data.get(key, '')
            if value is not None:
                row.append(str(value))
            else:
                row.append('')
        return row

    def _prepare_master_sheet_row_data(self, cutpay_data: Dict[str, Any]) -> List[Any]:
        """Prepares a list of values for a row in the 'Master' sheet, ordered according to headers."""
        keys_in_order = [
            'id', 'reporting_month', 'booking_date', 'agent_code', 'code_type',
            'insurer_name', 'broker_name', 'insurer_broker_code',
            'policy_number', 'formatted_policy_number', 'customer_name', 'customer_phone_number', 'major_categorisation',
            'product_insurer_report', 'product_type', 'plan_type',
            'gross_premium', 'net_premium', 'od_premium', 'tp_premium', 'gst_amount', 'commissionable_premium',
            'registration_no', 'make_model', 'model', 'vehicle_variant', 'gvw', 'rto',
            'state', 'cluster', 'fuel_type', 'cc', 'age_year', 'ncb', 'discount_percent',
            'business_type', 'seating_capacity', 'vehicle_wheels',
            'incoming_grid_perc', 'agent_commission_perc', 'extra_grid_perc', 'agent_extra_perc',
            'payment_by', 'payment_method', 'payout_on', 'payment_by_office',
            'receivable_from_broker', 'extra_amount_receivable_from_broker', 'total_receivable_from_broker', 'total_receivable_from_broker_with_gst',
            'cut_pay_amount', 'agent_po_amt', 'agent_extra_amount', 'total_agent_po_amt',
            'claimed_by', 'running_bal', 'cutpay_received',
            # Post-CutPay fields
            'already_given_to_agent', 'iz_total_po_percent', 'broker_po_percent', 'broker_payout_amount', 'invoice_status', 'remarks', 'company',
            'notes',
            'created_at', 'updated_at'
        ]
        
        # Prepare row data - AI already adds hash prefix to formatted_policy_number
        row = []
        for key in keys_in_order:
            value = cutpay_data.get(key, '')
            if value is not None:
                row.append(str(value))
            else:
                row.append('')
        
        # Always add MATCH STATUS as False at the end
        row.append('False')
        return row

    def _get_cutpay_sheet_headers(self) -> List[str]:
        """Get comprehensive headers for CutPay sheet"""
        return [
            # Basic Information
            "ID", "Reporting Month", "Booking Date", "Agent Code", "Code Type",
            
            # Policy Information (Extracted)
            "Policy Number", "Formatted Policy Number", "Customer Name", "Customer Phone Number", "Major Categorisation",
            "Product Insurer Report", "Product Type", "Plan Type",
            
            # Financial Details (Extracted)
            "Gross Premium", "Net Premium", "OD Premium", "TP Premium", "GST Amount",
            
            # Vehicle Details (Extracted)
            "Registration No", "Make Model", "Model", "Vehicle Variant", "GVW", "RTO",
            "State", "Cluster", "Fuel Type", "CC", "Age Year", "NCB", "Discount Percent",
            "Business Type", "Seating Capacity", "Vehicle Wheels",
            
            # Relationship Data
            "Insurer Name", "Broker Name", "Insurer Broker Code",
            
            # Commission Configuration
            "Incoming Grid %", "Agent Commission %", "Extra Grid %", "Commissionable Premium", "Agent Extra %",
            
            # Payment Configuration
            "Payment By", "Payment Method", "Payout On", "Payment By Office",
            
            # Calculated Amounts
            "Receivable from Broker", "Extra Amount Receivable", "Total Receivable",
            "Total Receivable with GST", "CutPay Amount", "Agent PO Amount", "Agent Extra Amount", "Total Agent PO",
            
            # Tracking Fields
            "Claimed By", "Running Balance", "CutPay Received",
            
            # Post-CutPay Fields
            "Already Given to Agent", "IZ Total PO %", "Broker PO %", "Broker Payout Amount", "Invoice Status", "Remarks", "Company",
            
            # System Fields
            "Synced to CutPay Sheet", "Synced to Master Sheet", "Notes", "Created At", "Updated At"
        ]
    
    def _get_master_sheet_headers(self) -> List[str]:
        """Get comprehensive headers for Master sheet"""
        return [
            # Core Transaction Data
            "ID", "Reporting Month", "Booking Date", "Agent Code", "Code Type",
            "Insurer Name", "Broker Name", "Insurer Broker Code",
            
            # Policy Information
            "Policy Number", "Formatted Policy Number", "Customer Name", "Customer Phone Number", "Major Categorisation",
            "Product Insurer Report", "Product Type", "Plan Type",
            
            # Premium Details
            "Gross Premium", "Net Premium", "OD Premium", "TP Premium", "GST Amount", "Commissionable Premium",
            
            # Vehicle Details
            "Registration No", "Make Model", "Model", "Vehicle Variant", "GVW", "RTO",
            "State", "Cluster", "Fuel Type", "CC", "Age Year", "NCB", "Discount Percent",
            "Business Type", "Seating Capacity", "Vehicle Wheels",
            
            # Commission Structure
            "Incoming Grid %", "Agent Commission %", "Extra Grid %", "Agent Extra %",
            
            # Payment Configuration
            "Payment By", "Payment Method", "Payout On", "Payment By Office",
            
            # Calculated Commission Amounts
            "Receivable from Broker", "Extra Amount Receivable", "Total Receivable", "Total Receivable with GST",
            
            # CutPay & Payout Amounts
            "CutPay Amount", "Agent PO Amount", "Agent Extra Amount", "Total Agent PO",
            
            # Transaction Tracking
            "Claimed By", "Running Balance", "CutPay Received",
            
            # Post-CutPay Fields
            "Already Given to Agent", "IZ Total PO %", "Broker PO %", "Broker Payout Amount", "Invoice Status", "Remarks", "Company",
            
            # Notes
            "Notes",
            
            # Timestamps
            "Created At", "Updated At",
            
            # Match Status (always last)
            "MATCH STATUS"
        ]

# =============================================================================
# GLOBAL INSTANCE
# =============================================================================
google_sheets_sync = GoogleSheetsSync()

# =============================================================================
# CONVENIENCE FUNCTIONS FOR UNIVERSAL RECORDS
# =============================================================================

async def resolve_insurer_broker_names(cutpay_data: Dict[str, Any]) -> Dict[str, Any]:
    """Resolve insurer_id and broker_id to their respective names"""
    try:
        from config import AsyncSessionLocal
        from models import Insurer, Broker
        from sqlalchemy import select
        
        async with AsyncSessionLocal() as db:
            # Resolve insurer name
            if cutpay_data.get('insurer_id'):
                insurer_result = await db.execute(
                    select(Insurer.name).where(Insurer.id == cutpay_data['insurer_id'])
                )
                insurer_name = insurer_result.scalar_one_or_none()
                if insurer_name:
                    cutpay_data['insurer_name'] = insurer_name
                    logger.info(f"Resolved insurer_id {cutpay_data['insurer_id']} to name: {insurer_name}")
            
            # Resolve broker name  
            if cutpay_data.get('broker_id'):
                broker_result = await db.execute(
                    select(Broker.name).where(Broker.id == cutpay_data['broker_id'])
                )
                broker_name = broker_result.scalar_one_or_none()
                if broker_name:
                    cutpay_data['broker_name'] = broker_name
                    logger.info(f"Resolved broker_id {cutpay_data['broker_id']} to name: {broker_name}")
                    
    except Exception as e:
        logger.error(f"Error resolving insurer/broker names: {str(e)}")
    
    return cutpay_data


async def get_master_sheet_data(insurer_name: Optional[str] = None) -> List[Dict[str, Any]]:
    """Get all records from master sheet, optionally filtered by insurer name"""
    try:
        if not google_sheets_sync.client:
            logger.warning("Google Sheets client not initialized")
            return []
        
        master_sheet = google_sheets_sync._get_or_create_worksheet("Master Sheet", google_sheets_sync._get_master_sheet_headers())
        if not master_sheet:
            return []
        
        # Get all records
        records = master_sheet.get_all_records()
        
        # Filter by insurer name if provided
        if insurer_name:
            filtered_records = []
            for record in records:
                if record.get('Insurer Name', '').strip().lower() == insurer_name.lower():
                    filtered_records.append(record)
            return filtered_records
        
        return records
        
    except Exception as e:
        logger.error(f"Error getting master sheet data: {str(e)}")
        return []


async def update_master_sheet_record(policy_number: str, updated_data: Dict[str, Any]) -> bool:
    """Update existing record in master sheet by policy number"""
    try:
        if not google_sheets_sync.client:
            logger.warning("Google Sheets client not initialized")
            return False
        
        master_sheet = google_sheets_sync._get_or_create_worksheet("Master Sheet", google_sheets_sync._get_master_sheet_headers())
        if not master_sheet:
            return False
        
        # Find the row with matching policy number
        policy_numbers = master_sheet.col_values(9)  # Policy Number is column 9
        
        for i, existing_policy_number in enumerate(policy_numbers):
            if existing_policy_number == policy_number:
                row_index = i + 1
                
                # Prepare row data
                headers = google_sheets_sync._get_master_sheet_headers()
                row_data = []
                
                for header in headers:
                    if header in updated_data:
                        row_data.append(updated_data[header])
                    else:
                        # Keep existing value or empty
                        try:
                            existing_row = master_sheet.row_values(row_index)
                            header_index = headers.index(header)
                            if header_index < len(existing_row):
                                row_data.append(existing_row[header_index])
                            else:
                                row_data.append("")
                        except:
                            row_data.append("")
                
                # Update the row
                master_sheet.update(f"A{row_index}:{google_sheets_sync._col_to_a1(len(headers))}{row_index}", [row_data])
                logger.info(f"Updated master sheet record for policy {policy_number}")
                return True
        
        logger.warning(f"Policy number {policy_number} not found in master sheet")
        return False
        
    except Exception as e:
        logger.error(f"Error updating master sheet record: {str(e)}")
        return False


async def add_master_sheet_record(record_data: Dict[str, Any]) -> bool:
    """Add new record to master sheet"""
    try:
        if not google_sheets_sync.client:
            logger.warning("Google Sheets client not initialized")
            return False
        
        master_sheet = google_sheets_sync._get_or_create_worksheet("Master Sheet", google_sheets_sync._get_master_sheet_headers())
        if not master_sheet:
            return False
        
        # Prepare row data
        headers = google_sheets_sync._get_master_sheet_headers()
        row_data = []
        
        for header in headers:
            if header in record_data:
                row_data.append(record_data[header])
            elif header == "Created At":
                row_data.append(datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
            elif header == "Updated At":
                row_data.append(datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
            else:
                row_data.append("")
        
        # Add the row
        master_sheet.append_row(row_data)
        logger.info(f"Added new master sheet record for policy {record_data.get('Policy Number', 'unknown')}")
        return True
        
    except Exception as e:
        logger.error(f"Error adding master sheet record: {str(e)}")
        return False


# =============================================================================
# CONVENIENCE FUNCTIONS FOR POLICY/CUTPAY SYNC
# =============================================================================

def sync_policy_to_master_sheet(policy_data: Dict[str, Any]) -> Dict[str, Any]:
    """Sync policy data to master sheet with insurer/broker name resolution"""
    return google_sheets_sync._safe_sync(google_sheets_sync._sync_policy_to_master_sheet, policy_data)


def sync_cutpay_to_master_sheet(cutpay_data: Dict[str, Any]) -> Dict[str, Any]:
    """Sync cutpay data to master sheet with insurer/broker name resolution"""
    return google_sheets_sync._safe_sync(google_sheets_sync.sync_to_master_sheet, cutpay_data)
