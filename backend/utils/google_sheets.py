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
from .quarterly_sheets_manager import quarterly_manager

logger = logging.getLogger(__name__)


def normalize_policy_number_for_sheets(policy_number: Any) -> str:
    """
    Normalize policy number for consistent comparison in Google Sheets
    Must match the normalization used in universal_records/helpers.py
    
    This function handles various policy number formats:
    - D195264389 (Go Digit)
    - 12-1806-0006746459-00 (with hyphens)
    - 3004/372635895/00/000 (with slashes)
    - 'P300655564669 (with leading apostrophe)
    - VVT0186550000100 (alphanumeric)
    - 201520010424700079900000 (numeric)
    """
    if policy_number is None:
        return ""
    
    try:
        # Convert to string and strip outer whitespace
        normalized = str(policy_number).strip()
        
        # Remove leading/trailing quotes and apostrophes
        normalized = normalized.strip('\'"\'')
        
        # Remove only internal spaces and tabs, but preserve other separators like -, /, \
        # This handles cases where policy numbers legitimately contain separators
        normalized = normalized.replace(' ', '').replace('\t', '').replace('\n', '').replace('\r', '')
        
        # Convert to uppercase for case-insensitive comparison
        normalized = normalized.upper()
        
        return normalized
        
    except Exception:
        return str(policy_number) if policy_number else ""


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
            # Get all values from the worksheet to find the actual last row with data
            all_values = worksheet.get_all_values()
            
            # Find the last row that contains any data
            last_row_with_data = 0
            for i, row in enumerate(all_values):
                if any(cell.strip() for cell in row):
                    last_row_with_data = i + 1  # gspread uses 1-based indexing
            
            # Next empty row is the one after the last row with data
            next_row = last_row_with_data + 1
            
            # Ensure we don't overwrite the header row
            if next_row <= 1:
                next_row = 2
                
            logger.info(f"Google Sheets utility - Found next empty row: {next_row} (last data row was: {last_row_with_data})")
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
        Also routes data to current quarterly sheet.
        """
        try:
            if not self.client:
                return {"success": False, "error": "Google Sheets client not initialized"}

            # First, sync to quarterly sheet
            quarterly_result = self._sync_to_quarterly_sheet(cutpay_data)

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

            result = {
                "success": True,
                "row_id": str(row_number),
                "sheet_name": "Master"
            }
            
            # Include quarterly sync result
            if quarterly_result:
                result["quarterly_sync"] = quarterly_result

            return result

        except Exception as e:
            logger.error(f"Failed to sync CutPay transaction {cutpay_data.get('id')} to Master sheet: {str(e)}")
            return {"success": False, "error": str(e)}

    def _sync_to_quarterly_sheet(self, cutpay_data: Dict[str, Any]) -> Dict[str, Any]:
        """Sync data to current quarterly sheet"""
        try:
            # Import here to avoid circular imports
            from .quarterly_sheets_manager import quarterly_manager
            
            # Check if quarterly sheet needs to be created
            transition_check = quarterly_manager.check_quarter_transition()
            
            # Route the data to current quarter
            quarterly_result = quarterly_manager.route_new_record_to_current_quarter(cutpay_data)
            
            return {
                "quarterly_sheet_result": quarterly_result,
                "transition_check": transition_check
            }
            
        except Exception as e:
            logger.error(f"Error syncing to quarterly sheet: {str(e)}")
            return {"error": str(e)}

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
        """Sync policy data to Master sheet with relevant fields using new header structure"""
        master_headers = self._get_master_sheet_headers()
        master_sheet = self._get_or_create_worksheet("Master", master_headers)
        
        if not master_sheet:
            return
        
        # Map policy data to new master sheet format
        field_mappings = {
            "Reporting Month (mmm'yy)": policy_data.get('reporting_month', ''),
            "Child ID/ User ID [Provided by Insure Zeal]": policy_data.get('child_id', ''),
            "Insurer /broker code": policy_data.get('agent_code', ''),
            "Policy Start Date": policy_data.get('start_date', ''),
            "Policy End Date": policy_data.get('end_date', ''),
            "Booking Date(Click to select Date)": '',  # Not available in policy data
            "Broker Name": policy_data.get('broker_name', ''),
            "Insurer name": policy_data.get('insurance_company', ''),
            "Major Categorisation( Motor/Life/ Health)": policy_data.get('major_categorisation', ''),
            "Product (Insurer Report)": policy_data.get('product_insurer_report', ''),
            "Product Type": policy_data.get('product_type', ''),
            "Plan type (Comp/STP/SAOD)": policy_data.get('plan_type', ''),
            "Gross premium": policy_data.get('gross_premium', ''),
            "GST Amount": policy_data.get('gst', ''),
            "Net premium": policy_data.get('net_premium', ''),
            "OD Preimium": policy_data.get('od_premium', ''),
            "TP Premium": policy_data.get('tp_premium', ''),
            "Policy number": policy_data.get('policy_number', ''),
            "Formatted Policy number": policy_data.get('formatted_policy_number', ''),
            "Registration.no": policy_data.get('registration_number', ''),
            "Make_Model": policy_data.get('make_model', ''),
            "Model": policy_data.get('model', ''),
            "Vehicle_Variant": policy_data.get('vehicle_variant', ''),
            "GVW": policy_data.get('gvw', ''),
            "RTO": policy_data.get('rto', ''),
            "State": policy_data.get('state', ''),
            "Cluster": policy_data.get('cluster', ''),
            "Fuel Type": policy_data.get('fuel_type', ''),
            "CC": policy_data.get('cc', ''),
            "Age(Year)": policy_data.get('age_year', ''),
            "NCB (YES/NO)": policy_data.get('ncb', ''),
            "Discount %": policy_data.get('discount_percent', ''),
            "Business Type": policy_data.get('business_type', ''),
            "Seating Capacity": policy_data.get('seating_capacity', ''),
            "Veh_Wheels": policy_data.get('veh_wheels', ''),
            "Customer Name": policy_data.get('customer_name', ''),
            "Customer Number": policy_data.get('customer_phone_number', ''),
            "Payment By Office": policy_data.get('payment_by_office', ''),
            "PO Paid To Agent": policy_data.get('total_agent_payout_amount', ''),
            "Running Bal": policy_data.get('running_bal', ''),
            "Match": 'False'  # Always set to False for policies
        }
        
        # Create row data based on header order
        master_row_data = []
        for header in master_headers:
            value = field_mappings.get(header, '')
            if value is not None:
                master_row_data.append(str(value))
            else:
                master_row_data.append('')
        
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
            'registration_number', 'make_model', 'model', 'vehicle_variant', 'gvw', 'rto',
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
        """Prepares a list of values for a row in the 'Master' sheet, ordered according to new headers."""
        # Updated mapping based on new header structure
        field_mappings = {
            "Reporting Month (mmm'yy)": cutpay_data.get('reporting_month', ''),
            "Child ID/ User ID [Provided by Insure Zeal]": cutpay_data.get('admin_child_id', ''),
            "Insurer /broker code": cutpay_data.get('insurer_broker_code', ''),
            "Policy Start Date": cutpay_data.get('start_date', ''),
            "Policy End Date": cutpay_data.get('end_date', ''),
            "Booking Date(Click to select Date)": cutpay_data.get('booking_date', ''),
            "Broker Name": cutpay_data.get('broker_name', ''),
            "Insurer name": cutpay_data.get('insurer_name', ''),
            "Major Categorisation( Motor/Life/ Health)": cutpay_data.get('major_categorisation', ''),
            "Product (Insurer Report)": cutpay_data.get('product_insurer_report', ''),
            "Product Type": cutpay_data.get('product_type', ''),
            "Plan type (Comp/STP/SAOD)": cutpay_data.get('plan_type', ''),
            "Gross premium": cutpay_data.get('gross_premium', ''),
            "GST Amount": cutpay_data.get('gst_amount', ''),
            "Net premium": cutpay_data.get('net_premium', ''),
            "OD Preimium": cutpay_data.get('od_premium', ''),
            "TP Premium": cutpay_data.get('tp_premium', ''),
            "Policy number": cutpay_data.get('policy_number', ''),
            "Formatted Policy number": cutpay_data.get('formatted_policy_number', ''),
            "Registration.no": cutpay_data.get('registration_number', ''),
            "Make_Model": cutpay_data.get('make_model', ''),
            "Model": cutpay_data.get('model', ''),
            "Vehicle_Variant": cutpay_data.get('vehicle_variant', ''),
            "GVW": cutpay_data.get('gvw', ''),
            "RTO": cutpay_data.get('rto', ''),
            "State": cutpay_data.get('state', ''),
            "Cluster": cutpay_data.get('cluster', ''),
            "Fuel Type": cutpay_data.get('fuel_type', ''),
            "CC": cutpay_data.get('cc', ''),
            "Age(Year)": cutpay_data.get('age_year', ''),
            "NCB (YES/NO)": cutpay_data.get('ncb', ''),
            "Discount %": cutpay_data.get('discount_percent', ''),
            "Business Type": cutpay_data.get('business_type', ''),
            "Seating Capacity": cutpay_data.get('seating_capacity', ''),
            "Veh_Wheels": cutpay_data.get('veh_wheels', ''),
            "Customer Name": cutpay_data.get('customer_name', ''),
            "Customer Number": cutpay_data.get('customer_phone_number', ''),
            "Commissionable Premium": cutpay_data.get('commissionable_premium', ''),
            "Incoming Grid %": cutpay_data.get('incoming_grid_percent', ''),
            "Receivable from Broker": cutpay_data.get('receivable_from_broker', ''),
            "Extra Grid": cutpay_data.get('extra_grid', ''),
            "Extra Amount Receivable from Broker": cutpay_data.get('extra_amount_receivable_from_broker', ''),
            " Total Receivable from Broker ": cutpay_data.get('total_receivable_from_broker', ''),
            " Claimed By ": cutpay_data.get('claimed_by', ''),
            "Payment by": cutpay_data.get('payment_by', ''),
            "Payment Mode": cutpay_data.get('payment_method', ''),
            "Cut Pay Amount Received From Agent": cutpay_data.get('cut_pay_amount', ''),
            "Already Given to agent": cutpay_data.get('already_given_to_agent', ''),
            " Actual Agent_PO%": cutpay_data.get('agent_commission_given_percent', ''),
            "Agent_PO_AMT": cutpay_data.get('agent_po_amt', ''),
            "Agent_Extra%": cutpay_data.get('agent_extra_percent', ''),
            "Agent_Extr_Amount": cutpay_data.get('agent_extra_amount', ''),
            "Payment By Office": cutpay_data.get('payment_by_office', ''),
            "PO Paid To Agent": cutpay_data.get('total_agent_po_amt', ''),
            "Running Bal": cutpay_data.get('running_bal', ''),
            " Total Receivable from Broker Include 18% GST ": cutpay_data.get('total_receivable_from_broker_with_gst', ''),
            " IZ Total PO%  ": cutpay_data.get('iz_total_po_percent', ''),
            " As per Broker PO%  ": cutpay_data.get('broker_po_percent', ''),
            " As per Broker PO AMT  ": cutpay_data.get('broker_payout_amount', ''),
            " PO% Diff Broker ": '',  # New field - needs to be calculated
            " PO AMT Diff Broker ": '',  # New field - needs to be calculated
            " As per Agent Payout% ": '',  # New field - needs to be calculated
            " As per Agent Payout Amount ": '',  # New field - needs to be calculated
            " PO% Diff Agent ": '',  # New field - needs to be calculated
            " PO AMT Diff Agent ": '',  # New field - needs to be calculated
            "  Invoice Status  ": cutpay_data.get('invoice_status', ''),
            "  Invoice Number  ": '',  # New field - needs to be added to model
            " Remarks ": cutpay_data.get('remarks', ''),
            "Match": 'False'  # Default match status
        }
        
        # Get headers and prepare row data
        headers = self._get_master_sheet_headers()
        row_data = []
        
        for header in headers:
            value = field_mappings.get(header, '')
            if value is not None:
                row_data.append(str(value))
            else:
                row_data.append('')
        
        return row_data

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
        """Get comprehensive headers for Master sheet based on new requirements"""
        return [
            # Updated headers according to new master sheet requirements
            "Reporting Month (mmm'yy)",
            "Child ID/ User ID [Provided by Insure Zeal]",
            "Insurer /broker code",
            "Policy Start Date",
            "Policy End Date",
            "Booking Date(Click to select Date)",
            "Broker Name",
            "Insurer name",
            "Major Categorisation( Motor/Life/ Health)",
            "Product (Insurer Report)",
            "Product Type",
            "Plan type (Comp/STP/SAOD)",
            "Gross premium",
            "GST Amount",
            "Net premium",
            "OD Preimium",
            "TP Premium",
            "Policy number",
            "Formatted Policy number",
            "Registration.no",
            "Make_Model",
            "Model",
            "Vehicle_Variant",
            "GVW",
            "RTO",
            "State",
            "Cluster",
            "Fuel Type",
            "CC",
            "Age(Year)",
            "NCB (YES/NO)",
            "Discount %",
            "Business Type",
            "Seating Capacity",
            "Veh_Wheels",
            "Customer Name",
            "Customer Number",
            "Commissionable Premium",
            "Incoming Grid %",
            "Receivable from Broker",
            "Extra Grid",
            "Extra Amount Receivable from Broker",
            " Total Receivable from Broker ",
            " Claimed By ",
            "Payment by",
            "Payment Mode",
            "Cut Pay Amount Received From Agent",
            "Already Given to agent",
            " Actual Agent_PO%",
            "Agent_PO_AMT",
            "Agent_Extra%",
            "Agent_Extr_Amount",
            "Payment By Office",
            "PO Paid To Agent",
            "Running Bal",
            " Total Receivable from Broker Include 18% GST ",
            " IZ Total PO%  ",
            " As per Broker PO%  ",
            " As per Broker PO AMT  ",
            " PO% Diff Broker ",
            " PO AMT Diff Broker ",
            " As per Agent Payout% ",
            " As per Agent Payout Amount ",
            " PO% Diff Agent ",
            " PO AMT Diff Agent ",
            "  Invoice Status  ",
            "  Invoice Number  ",
            " Remarks ",
            "Match"
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
        
        master_sheet = google_sheets_sync._get_or_create_worksheet("Master", google_sheets_sync._get_master_sheet_headers())
        if not master_sheet:
            return []
        
        # Get all records
        records = master_sheet.get_all_records()
        
        # Filter by insurer name if provided
        if insurer_name:
            filtered_records = []
            for record in records:
                # Handle both string and non-string values in insurer name comparison
                record_insurer = record.get('Insurer Name', '')
                try:
                    if str(record_insurer).strip().lower() == insurer_name.lower():
                        filtered_records.append(record)
                except Exception as e:
                    logger.warning(f"Error comparing insurer name '{record_insurer}' with '{insurer_name}': {str(e)}")
                    continue
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

        master_sheet = google_sheets_sync._get_or_create_worksheet("Master", google_sheets_sync._get_master_sheet_headers())
        if not master_sheet:
            return False

        # Get all records to find the matching policy number
        all_records = master_sheet.get_all_records()
        headers = google_sheets_sync._get_master_sheet_headers()
        
        # Find the row with matching policy number (using new header structure)
        target_policy = normalize_policy_number_for_sheets(policy_number)
        row_to_update = None
        row_index = None
        
        for i, record in enumerate(all_records):
            existing_policy = normalize_policy_number_for_sheets(record.get('Policy number', ''))
            if existing_policy == target_policy:
                row_to_update = record
                row_index = i + 2  # +2 because of header row and 1-based indexing
                break
        
        if row_to_update is None:
            logger.warning(f"Policy number '{policy_number}' not found in master sheet")
            return False
        
        # Prepare row data by merging existing data with updates
        row_data = []
        for header in headers:
            if header in updated_data and updated_data[header] is not None:
                # Use updated value
                row_data.append(updated_data[header])
            elif header in row_to_update:
                # Keep existing value
                row_data.append(row_to_update[header])
            elif header == "Updated At":
                # Set updated timestamp
                row_data.append(datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
            else:
                # Empty value
                row_data.append("")
        
        # Update the row
        range_to_update = f"A{row_index}:{google_sheets_sync._col_to_a1(len(headers))}{row_index}"
        master_sheet.update(range_to_update, [row_data])
        logger.info(f"Updated master sheet record for policy '{policy_number}' at row {row_index}")
        return True
        
    except Exception as e:
        logger.error(f"Error updating master sheet record for policy '{policy_number}': {str(e)}")
        return False
async def add_master_sheet_record(record_data: Dict[str, Any]) -> bool:
    """Add new record to master sheet"""
    try:
        if not google_sheets_sync.client:
            logger.warning("Google Sheets client not initialized")
            return False
        
        master_sheet = google_sheets_sync._get_or_create_worksheet("Master", google_sheets_sync._get_master_sheet_headers())
        if not master_sheet:
            return False
        
        # Prepare row data
        headers = google_sheets_sync._get_master_sheet_headers()
        row_data = []
        
        for header in headers:
            if header in record_data:
                row_data.append(record_data[header])
            else:
                row_data.append("")
        
        # Add the row
        master_sheet.append_row(row_data)
        logger.info(f"Added new master sheet record for policy {record_data.get('Policy number', 'unknown')}")
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
