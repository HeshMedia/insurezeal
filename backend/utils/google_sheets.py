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

google_sheets_sync = GoogleSheetsSync()
