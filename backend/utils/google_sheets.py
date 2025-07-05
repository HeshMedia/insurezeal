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
            
            worksheet.append_row(row_values, value_input_option='RAW')
            logger.info(f"Synced child ID request {child_id_data.get('id')} to Google Sheets")
        
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
            
            worksheet.append_row(row_values, value_input_option='RAW')
            logger.info(f"Synced cut pay transaction {cutpay_data.get('id')} to CutPay sheet")
        
        self._safe_sync(_sync)
    
    def sync_to_master_sheet(self, cutpay_data: Dict[str, Any], action: str = "CREATE"):
        """Sync completed CutPay transaction to Master Google Sheet"""
        def _sync():
            headers = [
                'id', 'type', 'policy_number', 'agent_code', 'code_type',
                'insurer_name', 'broker_name', 'child_id',
                'gross_amount', 'net_premium', 'commission_amount', 'cut_pay_amount',
                'payment_mode', 'payout_amount', 'amount_received',
                'transaction_date', 'status', 'created_at', 'action', 'synced_at'
            ]
            
            worksheet = self._get_or_create_worksheet("Master Transactions", headers)
            if not worksheet:
                return
            
            commission_amount = 0
            if cutpay_data.get('gross_amount') and cutpay_data.get('agent_commission_given_percent'):
                commission_amount = (cutpay_data.get('gross_amount', 0) * 
                                   cutpay_data.get('agent_commission_given_percent', 0)) / 100
            
            row_values = [
                str(cutpay_data.get('id', '')),
                'CutPay',  
                str(cutpay_data.get('policy_number', '')),
                str(cutpay_data.get('agent_code', '')),
                str(cutpay_data.get('code_type', '')),
                str(cutpay_data.get('insurer_name', '')),
                str(cutpay_data.get('broker_name', '')),
                str(cutpay_data.get('child_id', '')),
                str(cutpay_data.get('gross_amount', '')),
                str(cutpay_data.get('net_premium', '')),
                str(commission_amount),
                str(cutpay_data.get('cut_pay_amount', '')),
                str(cutpay_data.get('payment_mode', '')),
                str(cutpay_data.get('payout_amount', '')),
                str(cutpay_data.get('amount_received', '')),
                str(cutpay_data.get('transaction_date', '')),
                str(cutpay_data.get('status', '')),
                str(cutpay_data.get('created_at', '')),
                str(action),
                datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            ]

            row_values = [str(val) if val is not None else '' for val in row_values]
            
            worksheet.append_row(row_values, value_input_option='RAW')
            logger.info(f"Synced cut pay transaction {cutpay_data.get('id')} to Master sheet")
        
        self._safe_sync(_sync)

    def sync_policy(self, policy_data: Dict[str, Any], action: str = "CREATE"):
        """Sync policy to Google Sheets"""
        def _sync():
            headers = [
                'id', 'policy_number', 'policy_type', 'insurance_type',
                'agent_id', 'agent_code', 'child_id', 'broker_name', 'insurance_company',
                'vehicle_type', 'registration_number', 'vehicle_class', 'vehicle_segment',
                'gross_premium', 'gst', 'net_premium', 'od_premium', 'tp_premium',
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

            worksheet.append_row(row_values, value_input_option='RAW')
            logger.info(f"Synced policy {policy_data.get('policy_number')} to Google Sheets")
        
        self._safe_sync(_sync)
    
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
    
    async def sync_cutpay_to_sheets(self, cutpay) -> Dict[str, Any]:
        """
        Sync CutPay transaction to CutPay sheet with all comprehensive fields
        
        Maps all fields from the CutPay model to Google Sheets columns
        """
        try:
            if not self.client:
                return {"success": False, "error": "Google Sheets client not initialized"}
            
            # Get or create CutPay worksheet
            cutpay_sheet = self._get_or_create_cutpay_worksheet("CutPay")
            
            # Prepare comprehensive row data for CutPay sheet
            row_data = self._prepare_cutpay_row_data(cutpay)
            
            # Check if record already exists
            if cutpay.cutpay_sheet_row_id:
                # Update existing row
                row_number = int(cutpay.cutpay_sheet_row_id)
                cutpay_sheet.update(f"A{row_number}:AZ{row_number}", [row_data])
                logger.info(f"Updated CutPay sheet row {row_number} for transaction {cutpay.id}")
            else:
                # Add new row
                cutpay_sheet.append_row(row_data)
                row_number = len(cutpay_sheet.get_all_values())
                logger.info(f"Added new CutPay sheet row {row_number} for transaction {cutpay.id}")
            
            return {
                "success": True,
                "row_id": str(row_number),
                "sheet_name": "CutPay"
            }
            
        except Exception as e:
            logger.error(f"Failed to sync CutPay transaction {cutpay.id} to sheets: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def sync_to_master_sheet(self, cutpay) -> Dict[str, Any]:
        """
        Sync completed CutPay transaction to Master Sheet
        
        Only syncs completed transactions with all required Master Sheet fields
        """
        try:
            if not self.client:
                return {"success": False, "error": "Google Sheets client not initialized"}
            
            if cutpay.status != "completed":
                return {"success": False, "error": "Only completed transactions sync to Master Sheet"}
            
            # Get or create Master worksheet
            master_sheet = self._get_or_create_master_worksheet("Master")
            
            # Prepare comprehensive row data for Master sheet
            row_data = self._prepare_master_sheet_row_data(cutpay)
            
            # Check if record already exists
            if cutpay.master_sheet_row_id:
                # Update existing row
                row_number = int(cutpay.master_sheet_row_id)
                master_sheet.update(f"A{row_number}:AZ{row_number}", [row_data])
                logger.info(f"Updated Master sheet row {row_number} for transaction {cutpay.id}")
            else:
                # Add new row
                master_sheet.append_row(row_data)
                row_number = len(master_sheet.get_all_values())
                logger.info(f"Added new Master sheet row {row_number} for transaction {cutpay.id}")
            
            return {
                "success": True,
                "row_id": str(row_number),
                "sheet_name": "Master"
            }
            
        except Exception as e:
            logger.error(f"Failed to sync CutPay transaction {cutpay.id} to Master sheet: {str(e)}")
            return {"success": False, "error": str(e)}
    
    def _prepare_cutpay_row_data(self, cutpay) -> List[Any]:
        """
        Prepare comprehensive row data for CutPay sheet
        
        Maps all CutPay model fields to sheet columns
        """
        return [
            # Basic Information
            cutpay.id,
            cutpay.status,
            cutpay.reporting_month,
            cutpay.booking_date.isoformat() if cutpay.booking_date else "",
            cutpay.agent_code,
            cutpay.code_type,
            
            # Policy Information (Extracted)
            cutpay.policy_number,
            cutpay.formatted_policy_number,
            cutpay.customer_name,
            cutpay.major_categorisation,
            cutpay.product_insurer_report,
            cutpay.product_type,
            cutpay.plan_type,
            
            # Financial Details (Extracted)
            cutpay.gross_premium,
            cutpay.net_premium,
            cutpay.od_premium,
            cutpay.tp_premium,
            cutpay.gst_amount,
            
            # Vehicle Details (Extracted)
            cutpay.registration_no,
            cutpay.make_model,
            cutpay.model,
            cutpay.vehicle_variant,
            cutpay.gvw,
            cutpay.rto,
            cutpay.state,
            cutpay.cluster,
            cutpay.fuel_type,
            cutpay.cc,
            cutpay.age_year,
            cutpay.ncb,
            cutpay.discount_percent,
            cutpay.business_type,
            cutpay.seating_capacity,
            cutpay.veh_wheels,
            
            # Relationship Data (Auto-populated)
            cutpay.insurer_name,
            cutpay.broker_name,
            cutpay.insurer_broker_code,
            
            # Commission Configuration (Admin Input)
            cutpay.incoming_grid_percent,
            cutpay.agent_commission_given_percent,
            cutpay.extra_grid,
            cutpay.commissionable_premium,
            cutpay.agent_extra_percent,
            
            # Payment Configuration (Admin Input)
            cutpay.payment_by,
            cutpay.payment_method,
            cutpay.payout_on,
            cutpay.payment_by_office,
            
            # Calculated Amounts
            cutpay.receivable_from_broker,
            cutpay.extra_amount_receivable_from_broker,
            cutpay.total_receivable_from_broker,
            cutpay.total_receivable_from_broker_with_gst,
            cutpay.cut_pay_amount,
            cutpay.agent_po_amt,
            cutpay.agent_extra_amount,
            cutpay.total_agent_po_amt,
            
            # Tracking Fields
            cutpay.claimed_by,
            cutpay.already_given_to_agent,
            cutpay.po_paid_to_agent,
            cutpay.running_bal,
            cutpay.match_status,
            cutpay.invoice_number,
            
            # System Fields
            cutpay.synced_to_cutpay_sheet,
            cutpay.synced_to_master_sheet,
            cutpay.notes,
            cutpay.created_at.isoformat() if cutpay.created_at else "",
            cutpay.updated_at.isoformat() if cutpay.updated_at else ""
        ]
    
    def _prepare_master_sheet_row_data(self, cutpay) -> List[Any]:
        """
        Prepare comprehensive row data for Master sheet
        
        Includes all Master Sheet columns as per business requirements
        """
        return [
            # Core Transaction Data
            cutpay.id,
            cutpay.reporting_month,
            cutpay.booking_date.isoformat() if cutpay.booking_date else "",
            cutpay.agent_code,
            cutpay.code_type,
            cutpay.insurer_name,
            cutpay.broker_name,
            cutpay.insurer_broker_code,
            
            # Policy Information
            cutpay.policy_number,
            cutpay.formatted_policy_number,
            cutpay.customer_name,
            cutpay.major_categorisation,
            cutpay.product_insurer_report,
            cutpay.product_type,
            cutpay.plan_type,
            
            # Premium Details
            cutpay.gross_premium,
            cutpay.net_premium,
            cutpay.od_premium,
            cutpay.tp_premium,
            cutpay.gst_amount,
            cutpay.commissionable_premium,
            
            # Vehicle Details (if applicable)
            cutpay.registration_no,
            cutpay.make_model,
            cutpay.model,
            cutpay.vehicle_variant,
            cutpay.gvw,
            cutpay.rto,
            cutpay.state,
            cutpay.cluster,
            cutpay.fuel_type,
            cutpay.cc,
            cutpay.age_year,
            cutpay.ncb,
            cutpay.discount_percent,
            cutpay.business_type,
            cutpay.seating_capacity,
            cutpay.veh_wheels,
            
            # Commission Structure
            cutpay.incoming_grid_percent,
            cutpay.agent_commission_given_percent,
            cutpay.extra_grid,
            cutpay.agent_extra_percent,
            
            # Payment Configuration
            cutpay.payment_by,
            cutpay.payment_method,
            cutpay.payout_on,
            cutpay.payment_by_office,
            
            # Calculated Commission Amounts
            cutpay.receivable_from_broker,
            cutpay.extra_amount_receivable_from_broker,
            cutpay.total_receivable_from_broker,
            cutpay.total_receivable_from_broker_with_gst,
            
            # CutPay & Payout Amounts
            cutpay.cut_pay_amount,
            cutpay.agent_po_amt,
            cutpay.agent_extra_amount,
            cutpay.total_agent_po_amt,
            
            # Transaction Tracking
            cutpay.claimed_by,
            cutpay.already_given_to_agent,
            cutpay.po_paid_to_agent,
            cutpay.running_bal,
            cutpay.match_status,
            cutpay.invoice_number,
            
            # Status and Notes
            cutpay.status,
            cutpay.notes,
            
            # Timestamps
            cutpay.created_at.isoformat() if cutpay.created_at else "",
            cutpay.updated_at.isoformat() if cutpay.updated_at else ""
        ]
    
    def _get_or_create_cutpay_worksheet(self, sheet_name: str):
        """Get existing CutPay worksheet or create new one with headers"""
        try:
            # Try to get existing worksheet
            worksheet = self.spreadsheet.worksheet(sheet_name)
            return worksheet
        except gspread.exceptions.WorksheetNotFound:
            # Create new worksheet with CutPay headers
            worksheet = self.spreadsheet.add_worksheet(
                title=sheet_name,
                rows=1000,
                cols=100
            )
            
            headers = self._get_cutpay_sheet_headers()
            worksheet.append_row(headers)
            logger.info(f"Created new CutPay worksheet '{sheet_name}' with headers")
            return worksheet
    
    def _get_or_create_master_worksheet(self, sheet_name: str):
        """Get existing Master worksheet or create new one with headers"""
        try:
            # Try to get existing worksheet
            worksheet = self.spreadsheet.worksheet(sheet_name)
            return worksheet
        except gspread.exceptions.WorksheetNotFound:
            # Create new worksheet with Master headers
            worksheet = self.spreadsheet.add_worksheet(
                title=sheet_name,
                rows=1000,
                cols=100
            )
            
            headers = self._get_master_sheet_headers()
            worksheet.append_row(headers)
            logger.info(f"Created new Master worksheet '{sheet_name}' with headers")
            return worksheet

    def _get_or_create_worksheet(self, worksheet_name: str, headers: List[str]) -> Optional[gspread.Worksheet]:
        """Get comprehensive headers for CutPay sheet"""
        return [
            # Basic Information
            "ID", "Status", "Reporting Month", "Booking Date", "Agent Code", "Code Type",
            
            # Policy Information (Extracted)
            "Policy Number", "Formatted Policy Number", "Customer Name", "Major Categorisation",
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
            "Claimed By", "Already Given to Agent", "PO Paid to Agent", "Running Balance",
            "Match Status", "Invoice Number",
            
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
            "Policy Number", "Formatted Policy Number", "Customer Name", "Major Categorisation",
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
            "Claimed By", "Already Given to Agent", "PO Paid to Agent", "Running Balance",
            "Match Status", "Invoice Number",
            
            # Status and Notes
            "Status", "Notes",
            
            # Timestamps
            "Created At", "Updated At"
        ]

# =============================================================================
# CONVENIENCE FUNCTIONS
# =============================================================================

# Create global instance
google_sheets_sync = GoogleSheetsSync()

async def sync_cutpay_to_sheets(cutpay) -> Dict[str, Any]:
    """Convenience function to sync CutPay transaction to sheets"""
    return await google_sheets_sync.sync_cutpay_to_sheets(cutpay)

async def sync_to_master_sheet(cutpay) -> Dict[str, Any]:
    """Convenience function to sync completed transaction to Master sheet"""
    return await google_sheets_sync.sync_to_master_sheet(cutpay)
