"""
Quarterly Sheets Management System

This module handles the automatic creation and management of quarterly sheets
with proper balance carryover functionality for the InsureZeal Google Sheets system.

Features:
- Automatic quarterly sheet creation with proper naming (Q1-2025, Q2-2025, etc.)
- Balance carryover from previous quarter where match status = true
- Formula replication from master sheet template
- Data routing to current quarter sheet
"""

import json
import os
from typing import List, Dict, Any, Optional, Tuple
import gspread
from google.oauth2.service_account import Credentials
from datetime import datetime, date
import logging
from config import (
    GOOGLE_SHEETS_CREDENTIALS_JSON, 
    GOOGLE_SHEETS_DOCUMENT_ID
)

logger = logging.getLogger(__name__)


class QuarterlySheetManager:
    """Manages quarterly sheet creation, balance carryover, and data routing"""
    
    def __init__(self):
        self.credentials_path = GOOGLE_SHEETS_CREDENTIALS_JSON
        self.document_id = GOOGLE_SHEETS_DOCUMENT_ID
        self.client = None
        self.spreadsheet = None
        self._initialize_client()
        
        # Master template sheet name in Google Sheets (instead of local CSV)
        self.master_template_sheet_name = "Master Template"
    
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
            
            logger.info("Google Sheets client initialized successfully for quarterly management")
            
        except Exception as e:
            logger.error(f"Failed to initialize Google Sheets client: {str(e)}")
    
    def get_current_quarter_info(self, target_date: Optional[date] = None) -> Tuple[str, int, int]:
        """
        Get current quarter information
        
        Returns:
            Tuple of (quarter_name, quarter_number, year)
        """
        if target_date is None:
            target_date = date.today()
        
        year = target_date.year
        month = target_date.month
        
        if month <= 3:
            quarter = 1
        elif month <= 6:
            quarter = 2
        elif month <= 9:
            quarter = 3
        else:
            quarter = 4
        
        quarter_name = f"Q{quarter}-{year}"
        return quarter_name, quarter, year
    
    def get_previous_quarter_info(self, current_quarter: int, current_year: int) -> Tuple[str, int, int]:
        """Get previous quarter information"""
        if current_quarter == 1:
            prev_quarter = 4
            prev_year = current_year - 1
        else:
            prev_quarter = current_quarter - 1
            prev_year = current_year
        
        prev_quarter_name = f"Q{prev_quarter}-{prev_year}"
        return prev_quarter_name, prev_quarter, prev_year
    
    def get_master_template_sheet(self) -> Optional[gspread.Worksheet]:
        """Get the Master Template sheet from Google Sheets"""
        try:
            if not self.spreadsheet:
                logger.error("Spreadsheet not initialized")
                return None
            
            # Try to get the Master Template sheet
            try:
                template_sheet = self.spreadsheet.worksheet(self.master_template_sheet_name)
                logger.info(f"Found Master Template sheet: {self.master_template_sheet_name}")
                return template_sheet
            except gspread.WorksheetNotFound:
                logger.warning(f"Master Template sheet '{self.master_template_sheet_name}' not found")
                
                # Try alternative names
                alternative_names = ["Master Template", "Template", "Master_Template", "MasterTemplate"]
                for alt_name in alternative_names:
                    try:
                        template_sheet = self.spreadsheet.worksheet(alt_name)
                        logger.info(f"Found Master Template sheet with alternative name: {alt_name}")
                        self.master_template_sheet_name = alt_name  # Update the name
                        return template_sheet
                    except gspread.WorksheetNotFound:
                        continue
                
                # If no template sheet found, check if we can use Master sheet as template
                try:
                    master_sheet = self.spreadsheet.worksheet("Master")
                    logger.warning("Using 'Master' sheet as template since 'Master Template' not found")
                    self.master_template_sheet_name = "Master"
                    return master_sheet
                except gspread.WorksheetNotFound:
                    logger.error("No suitable template sheet found (Master Template, Template, or Master)")
                    return None
                    
        except Exception as e:
            logger.error(f"Error getting master template sheet: {str(e)}")
            return None
    
    def load_master_template_headers(self) -> List[str]:
        """Load headers from Master Template sheet in Google Sheets"""
        try:
            template_sheet = self.get_master_template_sheet()
            if not template_sheet:
                logger.warning("Master template sheet not found, using default headers")
                return self._get_default_headers()
            
            # Get the first row (headers) from the template sheet
            headers = template_sheet.row_values(1)
            
            # Clean headers - remove empty strings and strip whitespace
            headers = [header.strip() for header in headers if header.strip()]
            
            logger.info(f"Loaded {len(headers)} headers from Google Sheets template: {self.master_template_sheet_name}")
            return headers
            
        except Exception as e:
            logger.error(f"Error loading headers from Google Sheets template: {str(e)}")
            return self._get_default_headers()
    
    def copy_template_structure_and_formulas(self, target_worksheet: gspread.Worksheet) -> bool:
        """
        Copy structure, formatting, and formulas from Master Template sheet to target worksheet
        
        Args:
            target_worksheet: The worksheet to copy template structure to
            
        Returns:
            True if successful, False otherwise
        """
        try:
            template_sheet = self.get_master_template_sheet()
            if not template_sheet:
                logger.error("Cannot copy template - Master Template sheet not found")
                return False

            # Extract quarter info from target sheet name (e.g., "Q3-2025")
            target_sheet_name = target_worksheet.title
            try:
                if target_sheet_name.startswith('Q') and '-' in target_sheet_name:
                    quarter_part, year_part = target_sheet_name[1:].split('-')
                    target_quarter = int(quarter_part)
                    target_year = int(year_part)
                else:
                    # Fallback to current quarter
                    _, target_quarter, target_year = self.get_current_quarter_info()
            except:
                # Fallback to current quarter
                _, target_quarter, target_year = self.get_current_quarter_info()
            
            logger.info(f"Copying template structure from {self.master_template_sheet_name} to {target_worksheet.title} (Q{target_quarter}-{target_year})")
            
            # 1. Copy headers (row 1)
            template_headers = template_sheet.row_values(1)
            quarterly_headers = self.create_quarterly_sheet_headers()
            
            # Update headers in target sheet
            target_worksheet.update('A1', [quarterly_headers], value_input_option='RAW')
            
            # 2. Copy data and formulas from template row 2 (sample data + formulas)
            try:
                # Get the actual range based on the number of headers
                max_col = self._col_to_a1(len(quarterly_headers))
                template_range = f"A2:{max_col}2"
                
                logger.info(f"Getting data and formulas from template range: {template_range}")
                
                # Get both values and formulas from row 2 of template
                template_values = template_sheet.get(template_range, value_render_option='UNFORMATTED_VALUE')
                template_formulas = template_sheet.get(template_range, value_render_option='FORMULA')
                
                if template_formulas and len(template_formulas) > 0 and template_values and len(template_values) > 0:
                    template_formula_row = template_formulas[0] if template_formulas else []
                    template_value_row = template_values[0] if template_values else []
                    
                    # Ensure both rows have the same length
                    max_len = max(len(template_formula_row), len(template_value_row))
                    template_formula_row.extend([''] * (max_len - len(template_formula_row)))
                    template_value_row.extend([''] * (max_len - len(template_value_row)))
                    
                    logger.info(f"Retrieved {len(template_formula_row)} cells from template (formulas + values)")
                    
                    # Create combined row: use formula if exists, otherwise use value
                    template_combined_row = []
                    for i in range(max_len):
                        formula = template_formula_row[i] if i < len(template_formula_row) else ""
                        value = template_value_row[i] if i < len(template_value_row) else ""
                        
                        # If there's a formula, use it; otherwise use the value
                        if formula and str(formula).startswith('='):
                            template_combined_row.append(formula)
                        else:
                            template_combined_row.append(value)
                    
                    # Adapt formulas and values for quarterly sheet structure
                    adapted_formulas = self._adapt_template_formulas_for_target(template_combined_row, template_headers, quarterly_headers, target_quarter, target_year)
                    
                    if adapted_formulas:
                        # Apply formulas and values to row 2 of target sheet
                        range_notation = f"A2:{self._col_to_a1(len(adapted_formulas))}2"
                        target_worksheet.update(range_notation, [adapted_formulas], value_input_option='USER_ENTERED')
                        
                        formula_count = len([f for f in adapted_formulas if f and str(f).startswith('=')])
                        value_count = len([f for f in adapted_formulas if f and not str(f).startswith('=') and f != ''])
                        logger.info(f"Successfully copied {formula_count} formulas and {value_count} values to target sheet")
                    else:
                        logger.warning("No adapted formulas/values to apply")
                else:
                    logger.warning("No data found in template row 2")
                    
            except Exception as e:
                logger.error(f"Could not copy formulas from template: {str(e)}")
                import traceback
                logger.error(f"Formula copy traceback: {traceback.format_exc()}")
            
            # 3. Copy formatting from template headers
            try:
                self._copy_template_formatting(template_sheet, target_worksheet, len(quarterly_headers))
            except Exception as e:
                logger.warning(f"Could not copy formatting from template: {str(e)}")
            
            # 4. Copy data validations and conditional formatting if any
            try:
                self._copy_template_validations(template_sheet, target_worksheet)
            except Exception as e:
                logger.warning(f"Could not copy validations from template: {str(e)}")
            
            logger.info("Template structure and formulas copied successfully")
            return True
            
        except Exception as e:
            logger.error(f"Error copying template structure: {str(e)}")
            return False
    
   

    def _copy_template_formatting(self, template_sheet: gspread.Worksheet, target_sheet: gspread.Worksheet, num_cols: int):
        """Copy formatting from template sheet to target sheet"""
        try:
            # Copy header row formatting
            header_range = f"A1:{self._col_to_a1(num_cols)}1"
            
            # Apply standard header formatting
            target_sheet.format(header_range, {
                "textFormat": {"bold": True},
                "backgroundColor": {"red": 0.9, "green": 0.9, "blue": 0.9},
                "horizontalAlignment": "CENTER"
            })
            
            # Freeze header row
            target_sheet.freeze(rows=1)
            
            logger.info("Applied header formatting to target sheet")
            
        except Exception as e:
            logger.warning(f"Error copying template formatting: {str(e)}")
    
    def _copy_template_validations(self, template_sheet: gspread.Worksheet, target_sheet: gspread.Worksheet):
        """Copy data validations from template sheet to target sheet"""
        try:
            # This is a placeholder for copying data validations
            # Google Sheets API has limited support for copying validations
            # You might need to manually recreate important validations
            
            logger.info("Template validations copy completed (placeholder)")
            
        except Exception as e:
            logger.warning(f"Error copying template validations: {str(e)}")
    
    def _get_default_headers(self) -> List[str]:
        """Default headers based on the template analysis"""
        return [
            "Reporting Month (mmm'yy)", "Child ID/ User ID [Provided by Insure Zeal]", "Insurer /broker code",
            "Policy Start Date", "Policy End Date", "Booking Date(Click to select Date)", "Broker Name", 
            "Insurer name", "Major Categorisation( Motor/Life/ Health)", "Product (Insurer Report)", 
            "Product Type", "Plan type (Comp/STP/SAOD)", "Gross premium", "GST Amount", "Net premium", 
            "OD Preimium", "TP Premium", "Policy number", "Formatted Policy number", "Registration.no", 
            "Make_Model", "Model", "Vehicle_Variant", "GVW", "RTO", "State", "Cluster", "Fuel Type", 
            "CC", "Age(Year)", "NCB (YES/NO)", "Discount %", "Business Type", "Seating Capacity", 
            "Veh_Wheels", "Customer Name", "Customer Number", "Commissionable Premium", "Incoming Grid %", 
            "Receivable from Broker", "Extra Grid", "Extra Amount Receivable from Broker", 
            "Total Receivable from Broker", "Claimed By", "Payment by", "Payment Mode", 
            "Cut Pay Amount Received From Agent", "Already Given to agent", "Match", "Agent_PO%", 
            "Agent_PO_AMT", "Agent_Extra%", "Agent_Extr_Amount", "Total_Agent_PO_AMT", "Payment By Office", 
            "PO Paid To Agent", "Running Bal", "Total Receivable from Broker Include 18% GST", "IZ Total PO%", 
            "According to Agent Payout%", "According to Agent Payout Amount", "Broker PO%", "Broker PO AMT", 
            "Invoice Status", "Invoice Number", "Remarks"
        ]
    
    def create_quarterly_sheet_headers(self) -> List[str]:
        """Create headers for quarterly sheet from Master Template"""
        # Get data headers from Master Template
        complete_headers = self.load_master_template_headers()
        
        logger.info(f"Created quarterly sheet headers with {len(complete_headers)} data columns from Master Template")
        return complete_headers
    
    def get_quarterly_sheet_name(self, quarter: int, year: int) -> str:
        """Generate quarterly sheet name"""
        return f"Q{quarter}-{year}"
    
    def sheet_exists(self, sheet_name: str) -> bool:
        """Check if a sheet with given name exists"""
        try:
            if not self.spreadsheet:
                return False
            
            worksheet_list = self.spreadsheet.worksheets()
            existing_names = [ws.title for ws in worksheet_list]
            return sheet_name in existing_names
        except Exception as e:
            logger.error(f"Error checking if sheet exists: {str(e)}")
            return False
    
    def create_quarterly_sheet(self, quarter: int, year: int) -> Optional[gspread.Worksheet]:
        """
        Create a new quarterly sheet with proper structure and formulas from Google Sheets template
        
        Args:
            quarter: Quarter number (1-4)
            year: Year (e.g., 2025)
            
        Returns:
            Created worksheet or None if failed
        """
        try:
            if not self.spreadsheet:
                logger.error("Spreadsheet not initialized")
                return None
            
            sheet_name = self.get_quarterly_sheet_name(quarter, year)
            
            # Check if sheet already exists
            if self.sheet_exists(sheet_name):
                logger.info(f"Sheet {sheet_name} already exists")
                return self.spreadsheet.worksheet(sheet_name)
            
            # Get complete headers
            headers = self.create_quarterly_sheet_headers()
            
            # Create new worksheet
            worksheet = self.spreadsheet.add_worksheet(
                title=sheet_name,
                rows=5000,  # Start with 5000 rows for quarterly data
                cols=len(headers)
            )
            
            logger.info(f"Created new worksheet: {sheet_name}")
            
            # Copy structure, formulas, and formatting from template
            template_copied = self.copy_template_structure_and_formulas(worksheet)
            
            if not template_copied:
                # Fallback: Add headers manually and basic formatting
                worksheet.update('A1', [headers], value_input_option='RAW')
                self._format_header_row(worksheet, len(headers))
                logger.warning("Template copy failed, applied basic structure")
            
            # Apply balance carryover if this is not Q1 or if previous quarter exists
            if quarter > 1 or year > 2025:  # Assuming 2025 is the starting year
                self._apply_balance_carryover(worksheet, quarter, year, headers)
            
            logger.info(f"Successfully created quarterly sheet: {sheet_name}")
            return worksheet
            
        except Exception as e:
            logger.error(f"Error creating quarterly sheet Q{quarter}-{year}: {str(e)}")
            return None
    
    def _format_header_row(self, worksheet: gspread.Worksheet, num_cols: int):
        """Apply formatting to header row"""
        try:
            # Format header row - bold and freeze
            header_range = f"A1:{self._col_to_a1(num_cols)}1"
            worksheet.format(header_range, {
                "textFormat": {"bold": True},
                "backgroundColor": {"red": 0.9, "green": 0.9, "blue": 0.9}
            })
            
            # Freeze header row
            worksheet.freeze(rows=1)
            
            logger.info("Applied header formatting and freeze")
            
        except Exception as e:
            logger.error(f"Error formatting header row: {str(e)}")
    
    def _col_to_a1(self, col: int) -> str:
        """Convert column number to A1 notation"""
        if col <= 0:
            raise ValueError("Column index must be positive.")
        
        result = ""
        while col > 0:
            col, remainder = divmod(col - 1, 26)
            result = chr(65 + remainder) + result
        return result
    
    def _adjust_formula_for_row(self, formula: str, source_row: int, target_row: int) -> str:
        """
        Adjust formula row references from source_row to target_row
        
        Args:
            formula: The formula string to adjust
            source_row: The original row number in the formula
            target_row: The new row number for the formula
            
        Returns:
            The adjusted formula with updated row references
        """
        import re
        
        # Pattern to match cell references like A2, B2, C2, etc.
        # Use a more specific pattern to avoid issues with group references
        pattern = r'([A-Z]+)' + str(source_row) + r'(?![0-9])'
        
        # Replace all occurrences of the source row with target row
        def replace_func(match):
            column_part = match.group(1)
            return f"{column_part}{target_row}"
        
        adjusted_formula = re.sub(pattern, replace_func, formula)
        
        return adjusted_formula
    
    def _decode_master_template_formulas(self, formula: str, target_quarter: int, target_year: int, target_row: int) -> str:
        """
        Decode and adjust Master Template formulas for quarterly sheets
        
        Handles dynamic replacements for:
        - Removes outer quotes from text-stored formulas
        - {quarter-1} and {year} for previous quarter references
        - {row} for current row references
        - Quarter sheet name references
        - Fixes double quotes to single quotes
        
        Args:
            formula: The formula from Master Template (may be quoted text)
            target_quarter: Quarter for the new sheet (1-4)
            target_year: Year for the new sheet
            target_row: Row number to apply the formula to
            
        Returns:
            Decoded and adjusted formula
        """
        if not formula or not isinstance(formula, str):
            return formula
        
        try:
            decoded_formula = str(formula).strip()
            original_formula = decoded_formula
            
            # More careful quote removal - only remove outer quotes if they wrap the entire formula
            if (decoded_formula.startswith('"') and decoded_formula.endswith('"') and 
                decoded_formula.count('"') >= 2):
                # Check if removing outer quotes gives us a valid formula
                inner_content = decoded_formula[1:-1]
                if inner_content.startswith('='):
                    decoded_formula = inner_content
                    logger.debug(f"Removed outer quotes: {original_formula} -> {decoded_formula}")
                else:
                    logger.debug(f"Keeping quotes - inner content is not a formula: {inner_content}")
            
            # If it's not a formula after processing, return the original
            if not decoded_formula.startswith('='):
                logger.debug(f"Not a formula after processing: {decoded_formula}")
                return original_formula
            
            # Calculate previous quarter - FIXED LOGIC
            if target_quarter == 1:
                prev_quarter = 4
                prev_year = target_year - 1
            else:
                prev_quarter = target_quarter - 1
                prev_year = target_year
            
            logger.debug(f"Quarter calculation: Q{target_quarter}-{target_year} -> previous quarter: Q{prev_quarter}-{prev_year}")
            
            # Replace quarter and year placeholders
            decoded_formula = decoded_formula.replace('{quarter-1}', str(prev_quarter))
            decoded_formula = decoded_formula.replace('{year}', str(prev_year))
            decoded_formula = decoded_formula.replace('{row}', str(target_row))
            
            # Replace generic quarter sheet references with actual sheet names
            prev_quarter_name = f"Q{prev_quarter}-{prev_year}"
            decoded_formula = decoded_formula.replace("'Q{quarter-1}-{year}'!", f"'{prev_quarter_name}'!")
            
            # More careful quote fixing - only fix specific patterns that are clearly wrong
            # Fix double quotes in string literals BUT preserve empty string literals
            decoded_formula = decoded_formula.replace('""TRUE""', '"TRUE"')
            decoded_formula = decoded_formula.replace('""FALSE""', '"FALSE"')
            
            # Don't automatically replace all "" - preserve empty string literals like BR:BR<>""
            # Only fix clearly wrong patterns like quadruple quotes
            decoded_formula = decoded_formula.replace('""""', '""')
            
            logger.debug(f"Final decoded formula for row {target_row}: {original_formula} -> {decoded_formula}")
            return decoded_formula
            
        except Exception as e:
            logger.error(f"Error decoding Master Template formula: {e}")
            return formula
    
    def _copy_formulas_only_to_row(self, worksheet: gspread.Worksheet, target_row: int) -> bool:
        """
        Copy ONLY the data formulas from Master Template to the target row, without overwriting the data we just added.
        This preserves our actual record data while adding the properly decoded Master Template formulas.
        
        Args:
            worksheet: The worksheet to operate on
            target_row: The row number to copy formulas to
            
        Returns:
            True if successful, False otherwise
        """
        try:
            logger.info(f"DEBUG: Starting _copy_formulas_only_to_row for row {target_row}")
            
            # Get the correct column range based on the number of headers
            headers = self.create_quarterly_sheet_headers()
            max_col = self._col_to_a1(len(headers))
            
            logger.info(f"DEBUG: Using {len(headers)} headers, max column: {max_col}")
            
            # Get the current values in the target row (our actual data)
            target_range = f"A{target_row}:{max_col}{target_row}"
            current_values = worksheet.get(target_range, value_render_option='UNFORMATTED_VALUE')
            if not current_values:
                current_values = [[]]
            current_row_data = current_values[0] if current_values else []
            
            logger.info(f"DEBUG: Current row {target_row} has {len(current_row_data)} data values")
            
            # Get original formulas from Master Template (not from quarterly sheet row 2)
            template_sheet = self.get_master_template_sheet()
            if not template_sheet:
                logger.error("DEBUG: Could not access Master Template sheet")
                return False
                
            logger.info("DEBUG: Successfully accessed Master Template sheet")
                
            template_range = f"A2:{max_col}2"
            logger.info(f"DEBUG: Getting Master Template formulas from range: {template_range}")
            
            # Get both formulas AND values since formulas might be stored as text
            template_formulas = template_sheet.get(template_range, value_render_option='FORMULA')
            template_values = template_sheet.get(template_range, value_render_option='UNFORMATTED_VALUE')
            
            logger.info(f"DEBUG: Retrieved formula data - formulas: {len(template_formulas[0]) if template_formulas and template_formulas[0] else 0}")
            logger.info(f"DEBUG: Retrieved value data - values: {len(template_values[0]) if template_values and template_values[0] else 0}")
            
            # Log template information
            if template_values and template_values[0]:
                logger.info(f"DEBUG: Template has {len(template_values[0])} value columns")
            if template_formulas and template_formulas[0]:
                logger.info(f"DEBUG: Template has {len(template_formulas[0])} formula columns")
            
            if template_formulas and template_formulas[0]:
                template_formula_row = template_formulas[0] if template_formulas else []
                template_value_row = template_values[0] if template_values else []
                
                logger.info(f"DEBUG: Template formula row length: {len(template_formula_row)}")
                logger.info(f"DEBUG: Template value row length: {len(template_value_row)}")
                
                # Count formulas in template
                formula_count_in_template = len([f for f in template_formula_row if f and str(f).startswith('=')])
                logger.info(f"DEBUG: Found {formula_count_in_template} formulas in Master Template row 2")
                
                # Ensure both rows have the same length
                max_len = max(len(template_formula_row), len(template_value_row))
                template_formula_row.extend([''] * (max_len - len(template_formula_row)))
                template_value_row.extend([''] * (max_len - len(template_value_row)))
                
                # Get target quarter info from worksheet name (e.g., "Q4-2025")
                worksheet_name = worksheet.title
                try:
                    # Parse worksheet name like "Q4-2025"
                    if worksheet_name.startswith('Q') and '-' in worksheet_name:
                        parts = worksheet_name.split('-')
                        quarter = int(parts[0][1:])  # Remove 'Q' and convert to int
                        year = int(parts[1])
                        logger.info(f"DEBUG: Target worksheet quarter info: Q{quarter}-{year}")
                    else:
                        # Fallback to current quarter
                        _, quarter, year = self.get_current_quarter_info()
                        logger.warning(f"DEBUG: Could not parse worksheet name '{worksheet_name}', using current quarter: Q{quarter}-{year}")
                except:
                    # Fallback to current quarter
                    _, quarter, year = self.get_current_quarter_info()
                    logger.warning(f"DEBUG: Error parsing worksheet name '{worksheet_name}', using current quarter: Q{quarter}-{year}")
                
                # Process each cell: apply data formulas from Master Template
                updated_row = []
                formulas_applied = 0
                errors_encountered = 0
                
                for i, value_cell in enumerate(template_value_row):
                    formula_cell = template_formula_row[i] if i < len(template_formula_row) else ""
                    
                    try:
                        # Check if the value cell contains a formula (stored as text)
                        value_has_formula = value_cell and isinstance(value_cell, str) and (
                            value_cell.startswith('=') or 
                            (value_cell.startswith('"') and '=' in value_cell) or
                            (value_cell.startswith("'") and '=' in value_cell)
                        )
                        
                        # Check if the formula cell contains an actual formula
                        formula_has_formula = formula_cell and isinstance(formula_cell, str) and formula_cell.startswith('=')
                        
                        if value_has_formula:
                            # The formula is stored as text in the value - decode it
                            decoded_formula = self._decode_master_template_formulas(value_cell, quarter, year, target_row)
                            if decoded_formula and decoded_formula.startswith('='):
                                updated_row.append(decoded_formula)
                                formulas_applied += 1
                                logger.debug(f"DEBUG: Column {i+1}: Applied decoded formula from VALUE for row {target_row}")
                            else:
                                # Keep existing data
                                if i < len(current_row_data):
                                    updated_row.append(current_row_data[i])
                                else:
                                    updated_row.append('')
                        elif formula_has_formula:
                            # The formula is in the formula cell - decode it
                            decoded_formula = self._decode_master_template_formulas(formula_cell, quarter, year, target_row)
                            if decoded_formula and decoded_formula.startswith('='):
                                updated_row.append(decoded_formula)
                                formulas_applied += 1
                                logger.debug(f"DEBUG: Column {i+1}: Applied decoded formula from FORMULA for row {target_row}")
                            else:
                                # Keep existing data
                                if i < len(current_row_data):
                                    updated_row.append(current_row_data[i])
                                else:
                                    updated_row.append('')
                        else:
                            # This is data - keep our actual data value
                            if i < len(current_row_data):
                                updated_row.append(current_row_data[i])
                            else:
                                updated_row.append('')
                            logger.debug(f"DEBUG: Column {i+1}: Preserved data value")
                            
                    except Exception as cell_error:
                        errors_encountered += 1
                        logger.error(f"DEBUG: Error processing column {i+1}: {cell_error}")
                        # Keep original data on error
                        if i < len(current_row_data):
                            updated_row.append(current_row_data[i])
                        else:
                            updated_row.append('')
                
                logger.info(f"DEBUG: About to apply {formulas_applied} data formulas to row {target_row} ({errors_encountered} errors encountered)")
                
                # Update the row with formulas preserved but our data intact
                worksheet.update(target_range, [updated_row], value_input_option='USER_ENTERED')
                
                formula_count = len([f for f in updated_row if f and str(f).startswith('=')])
                logger.info(f"DEBUG: Successfully applied {formula_count} decoded formulas to row {target_row} while preserving data")
                return True
            else:
                logger.warning("No formulas found in template row 2")
                return False
                
        except Exception as e:
            logger.error(f"Error copying formulas only to row {target_row}: {e}")
            return False
    
    
    def get_current_quarter_sheet(self) -> Optional[gspread.Worksheet]:
        """Get the current quarter's sheet, creating it if necessary"""
        try:
            quarter_name, quarter, year = self.get_current_quarter_info()
            
            # Check if current quarter sheet exists
            if self.sheet_exists(quarter_name):
                return self.spreadsheet.worksheet(quarter_name)
            else:
                # Create current quarter sheet
                return self.create_quarterly_sheet(quarter, year)
                
        except Exception as e:
            logger.error(f"Error getting current quarter sheet: {str(e)}")
            return None
    
    def auto_refresh_dependent_quarters(self, source_quarter: int, source_year: int):
        """
        Automatically refresh carryover data in quarters that depend on the source quarter
        
        Args:
            source_quarter: Quarter that was updated (1-4)
            source_year: Year of the updated quarter
        """
        try:
            # Determine next quarter that depends on this source quarter
            if source_quarter == 4:
                next_quarter = 1
                next_year = source_year + 1
            else:
                next_quarter = source_quarter + 1
                next_year = source_year
            
            next_quarter_name = f"Q{next_quarter}-{next_year}"
            source_quarter_name = f"Q{source_quarter}-{source_year}"
            
            # Check if the dependent quarter exists
            if self.sheet_exists(next_quarter_name):
                logger.info(f"Auto-refreshing carryover: {source_quarter_name} -> {next_quarter_name}")
                
                # Get the dependent quarter sheet
                dependent_sheet = self.spreadsheet.worksheet(next_quarter_name)
                
                # Get headers for the dependent sheet
                headers = self.create_quarterly_sheet_headers()
                
                # Clear existing carryover data (keep headers and new records, only clear carryover rows)
                self._clear_carryover_data_only(dependent_sheet, headers)
                
                # Re-apply carryover with fresh data
                self._apply_balance_carryover(dependent_sheet, next_quarter, next_year, headers)
                
                logger.info(f"Successfully auto-refreshed carryover from {source_quarter_name} to {next_quarter_name}")
                return True
            else:
                logger.debug(f"Dependent quarter {next_quarter_name} does not exist - no refresh needed")
                return False
                
        except Exception as e:
            logger.error(f"Error auto-refreshing dependent quarters: {str(e)}")
            return False
    
   
    def route_new_record_to_current_quarter(self, record_data: Dict[str, Any], operation_type: str = "CREATE") -> Dict[str, Any]:
        """
        Route new record to current quarter's sheet
        
        Args:
            record_data: The record data to add
            operation_type: "CREATE" for new records, "UPDATE" for existing records
            
        Returns:
            Success status and details
        """
        try:
            # Get current quarter sheet
            current_sheet = self.get_current_quarter_sheet()
            
            if not current_sheet:
                return {"success": False, "error": "Could not access current quarter sheet"}
            
            # Get headers
            headers = self.create_quarterly_sheet_headers()
            
            # Prepare row data
            row_data = []
            for header in headers:
                value = record_data.get(header, '') or record_data.get(header.replace(' ', '_').lower(), '')
                row_data.append(str(value) if value else '')
            
            # Find next empty row
            next_row = self._find_next_empty_row(current_sheet)
            
            # First, add the actual record data
            range_notation = f"A{next_row}:{self._col_to_a1(len(headers))}{next_row}"
            current_sheet.update(range_notation, [row_data], value_input_option='USER_ENTERED')
            
            # Then, copy ONLY the formulas from row 2 to the new row (preserving our data)
            logger.info(f"DEBUG: About to copy formulas to new record at row {next_row}")
            formula_copy_success = self._copy_formulas_only_to_row(current_sheet, next_row)  # Data rows only
            logger.info(f"DEBUG: Formula copy to new record row {next_row} success: {formula_copy_success}")
            
            quarter_name, quarter, year = self.get_current_quarter_info()
            
            logger.info(f"Successfully {operation_type.lower()}d record to {quarter_name} at row {next_row} with formulas")
            
            # Auto-refresh dependent quarters when new data is added
            quarter_name, quarter, year = self.get_current_quarter_info()
            self.auto_refresh_dependent_quarters(quarter, year)
            
            return {
                "success": True,
                "sheet_name": quarter_name,
                "row_number": next_row
            }
            
        except Exception as e:
            logger.error(f"Error routing record to current quarter: {str(e)}")
            return {"success": False, "error": str(e)}
    
    def _find_next_empty_row(self, worksheet: gspread.Worksheet) -> int:
        """Find the next empty row in the worksheet"""
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
            
            # Ensure we don't overwrite the header row (row 1) or template formulas row (row 2)
            if next_row <= 2:
                next_row = 3  # Start from row 3 to preserve template formulas in row 2
                
            logger.info(f"Found next empty row: {next_row} (last data row was: {last_row_with_data})")
            return next_row
            
        except Exception as e:
            logger.error(f"Error finding next empty row: {str(e)}")
            return 2
    
    def check_quarter_transition(self) -> Dict[str, Any]:
        """
        Check if we need to transition to a new quarter and create sheet if needed
        
        Returns:
            Status of quarter transition check
        """
        try:
            quarter_name, quarter, year = self.get_current_quarter_info()
            
            # Check if current quarter sheet exists
            if not self.sheet_exists(quarter_name):
                logger.info(f"Current quarter sheet {quarter_name} doesn't exist - creating it")
                new_sheet = self.create_quarterly_sheet(quarter, year)
                
                if new_sheet:
                    return {
                        "transition_needed": True,
                        "new_sheet_created": True,
                        "sheet_name": quarter_name,
                        "message": f"Created new quarterly sheet: {quarter_name}"
                    }
                else:
                    return {
                        "transition_needed": True,
                        "new_sheet_created": False,
                        "error": f"Failed to create quarterly sheet: {quarter_name}"
                    }
            else:
                return {
                    "transition_needed": False,
                    "current_sheet": quarter_name,
                    "message": f"Current quarter sheet {quarter_name} already exists"
                }
                
        except Exception as e:
            logger.error(f"Error checking quarter transition: {str(e)}")
            return {
                "transition_needed": False,
                "error": str(e)
            }
    
    def get_quarter_summary(self, quarter: int, year: int) -> Dict[str, Any]:
        """Get summary information for a specific quarter"""
        try:
            sheet_name = self.get_quarterly_sheet_name(quarter, year)
            
            if not self.sheet_exists(sheet_name):
                return {"exists": False, "sheet_name": sheet_name}
            
            worksheet = self.spreadsheet.worksheet(sheet_name)
            all_records = worksheet.get_all_records()
            
            # Count records by match status
            true_match_count = sum(1 for record in all_records if str(record.get('Match', '')).strip().lower() == 'true')
            false_match_count = sum(1 for record in all_records if str(record.get('Match', '')).strip().lower() == 'false')
            total_records = len(all_records)
            
            return {
                "exists": True,
                "sheet_name": sheet_name,
                "total_records": total_records,
                "true_match_count": true_match_count,
                "false_match_count": false_match_count,
                "last_updated": datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            }
            
        except Exception as e:
            logger.error(f"Error getting quarter summary: {str(e)}")
            return {"exists": False, "error": str(e)}


# Global instance
quarterly_manager = QuarterlySheetManager()


# Convenience functions for integration
def get_current_quarter_sheet() -> Optional[gspread.Worksheet]:
    """Get current quarter sheet"""
    return quarterly_manager.get_current_quarter_sheet()


def route_record_to_current_quarter(record_data: Dict[str, Any]) -> Dict[str, Any]:
    """Route record to current quarter"""
    return quarterly_manager.route_new_record_to_current_quarter(record_data)


def check_and_create_quarterly_sheet() -> Dict[str, Any]:
    """Check if quarterly sheet needs to be created"""
    return quarterly_manager.check_quarter_transition()


def create_quarterly_sheet_for_date(target_date: date) -> Optional[gspread.Worksheet]:
    """Create quarterly sheet for specific date"""
    quarter_name, quarter, year = quarterly_manager.get_current_quarter_info(target_date)
    return quarterly_manager.create_quarterly_sheet(quarter, year)


def check_and_refresh_dependent_quarters(quarter: int, year: int) -> Dict[str, Any]:
    """
    Convenience function to manually trigger carryover refresh for dependent quarters
    """
    success = quarterly_manager.auto_refresh_dependent_quarters(quarter, year)
    return {
        "success": success,
        "message": f"Carryover refresh {'completed' if success else 'failed'} for Q{quarter}-{year} dependents"
    }


def get_quarter_summary_data(quarter: int, year: int) -> Dict[str, Any]:
    """Get summary for specific quarter"""
    return quarterly_manager.get_quarter_summary(quarter, year)
