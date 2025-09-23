"""
Quarterly Sheets Management System

This module handles data routing and template management for the InsureZeal Google Sheets system.
Quarterly sheet creation and balance carryover are now handled by Google Apps Script.

Features:
- Data routing to existing quarter sheets
- Formula replication from master sheet template
- Template management and header creation
- Sheet access and validation utilities
"""

import logging
from datetime import date, datetime
from typing import Any, Dict, List, Optional, Tuple

import gspread
from google.oauth2.service_account import Credentials

from config import GOOGLE_SHEETS_CREDENTIALS, GOOGLE_SHEETS_DOCUMENT_ID

logger = logging.getLogger(__name__)


class QuarterlySheetManager:
    """Manages data routing to existing quarterly sheets and template management.
    Sheet creation and balance carryover are handled by Google Apps Script."""

    def __init__(self):
        self.credentials = GOOGLE_SHEETS_CREDENTIALS
        self.document_id = GOOGLE_SHEETS_DOCUMENT_ID
        self.client = None
        self.spreadsheet = None
        self._initialize_client()

        # Master template sheet name in Google Sheets (instead of local CSV)
        self.master_template_sheet_name = "Master Template"

    def _initialize_client(self):
        """Initialize Google Sheets client with service account credentials"""
        try:
            if not self.credentials or not self.document_id:
                logger.warning(
                    "Google Sheets credentials or document ID not configured"
                )
                return

            scope = [
                "https://spreadsheets.google.com/feeds",
                "https://www.googleapis.com/auth/drive",
            ]

            # Create credentials from dictionary instead of file
            credentials = Credentials.from_service_account_info(
                self.credentials, scopes=scope
            )

            self.client = gspread.authorize(credentials)
            self.spreadsheet = self.client.open_by_key(self.document_id)

            logger.info(
                "Google Sheets client initialized successfully for quarterly management"
            )

        except Exception as e:
            logger.error(f"Failed to initialize Google Sheets client: {str(e)}")

    def _col_to_a1(self, col_num: int) -> str:
        """
        Convert column number to A1 notation (1->A, 26->Z, 27->AA, etc.)
        
        Args:
            col_num: Column number (1-based)
            
        Returns:
            A1 notation string (e.g., 'A', 'Z', 'AA')
        """
        result = ""
        while col_num > 0:
            col_num -= 1  # Convert to 0-based
            result = chr(col_num % 26 + ord('A')) + result
            col_num //= 26
        return result

    def _copy_formulas_only_to_row(self, worksheet: gspread.Worksheet, target_row: int) -> bool:
        """
        Copy formulas from row 2 (template row) to target row, intelligently determining
        which columns should get formulas vs. preserve data values.
        
        Args:
            worksheet: The worksheet to operate on
            target_row: The row number to copy formulas to
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # Get the number of columns we're working with
            headers = self.create_quarterly_sheet_headers()
            num_columns = len(headers)
            last_col = self._col_to_a1(num_columns)
            
            # Get all values and formulas from row 2 (template row)
            template_row = 2
            
            # Get the range of data (use our actual column count)
            template_range = f"A{template_row}:{last_col}{template_row}"
            
            logger.info(f"🔍 Getting formulas from template range: {template_range}")
            
            # Get formulas from template row
            try:
                template_formulas = worksheet.batch_get([template_range], 
                                                      value_render_option='FORMULA')[0]
                if not template_formulas or not template_formulas[0]:
                    logger.warning(f"⚠️ No formulas found in template row {template_row}")
                    return True  # Not an error, just no formulas to copy
                    
                template_formula_row = template_formulas[0]
                logger.info(f"📊 Found template row with {len(template_formula_row)} cells")
            except Exception as e:
                logger.warning(f"⚠️ Could not get formulas from template row {template_row}: {str(e)}")
                return True  # Continue without formulas
            
            # Get current values from target row to preserve data
            target_range = f"A{target_row}:{last_col}{target_row}"
            try:
                current_values = worksheet.batch_get([target_range])[0]
                if not current_values or not current_values[0]:
                    logger.info(f"ℹ️ Target row {target_row} is empty, will populate with formulas where appropriate")
                    current_value_row = [""] * num_columns  # Create empty row
                else:
                    current_value_row = current_values[0]
                    logger.info(f"📋 Target row {target_row} has {len(current_value_row)} existing values")
            except Exception as e:
                logger.warning(f"⚠️ Could not get current values from target row {target_row}: {str(e)}")
                current_value_row = [""] * num_columns  # Create empty row
            
            # Identify which columns typically contain formulas vs data
            formula_column_keywords = [
                'running balance', 'running bal', 'balance', 'total', 'amount', 
                'percentage', 'percent', '%', 'calculation', 'calc', 'computed',
                'sum', 'subtotal', 'grand total', 'net', 'gross', 'commission',
                'brokerage', 'fee', 'charge', 'due', 'outstanding', 'difference',
                'variance', 'match', 'status', 'receivable', 'payable', 'gst',
                'diff', 'extra', 'actual', 'paid', 'invoice'
            ]
            
            # Prepare update data with intelligent formula vs data preservation
            update_row = []
            formulas_copied = 0
            data_preserved = 0
            
            logger.info(f"🧮 Processing {len(template_formula_row)} columns for formula/data decision")
            
            for i, template_cell in enumerate(template_formula_row):
                current_value = current_value_row[i] if i < len(current_value_row) else ""
                header_name = headers[i].lower() if i < len(headers) else f"column_{i+1}"
                
                # Check if this column likely contains formulas based on header name
                is_likely_formula_column = any(keyword in header_name for keyword in formula_column_keywords)
                
                # Log the decision process for first few columns and formula columns
                if i < 5 or is_likely_formula_column:
                    logger.debug(f"Column {i+1} '{headers[i] if i < len(headers) else 'Unknown'}': template='{str(template_cell)[:30]}', current='{str(current_value)[:30]}', formula_column={is_likely_formula_column}")
                
                # Decision logic for formula vs data
                if template_cell and str(template_cell).startswith('='):
                    # Template has a formula
                    if is_likely_formula_column:
                        # This is likely a calculated column - always use formula
                        updated_formula = self._update_formula_references(template_cell, template_row, target_row)
                        update_row.append(updated_formula)
                        formulas_copied += 1
                        if i < 10:  # Log first 10 for debugging
                            logger.info(f"✅ Column {i+1} ({header_name}): Applied original template formula")
                    elif not current_value or str(current_value).strip() == "":
                        # Data column but empty - use formula as fallback
                        updated_formula = self._update_formula_references(template_cell, template_row, target_row)
                        update_row.append(updated_formula)
                        formulas_copied += 1
                        if i < 10:
                            logger.info(f"🔄 Column {i+1} ({header_name}): Applied original template formula (empty data)")
                    elif str(current_value).startswith('='):
                        # Current value is already a formula - update it
                        updated_formula = self._update_formula_references(template_cell, template_row, target_row)
                        update_row.append(updated_formula)
                        formulas_copied += 1
                        if i < 10:
                            logger.info(f"🔄 Column {i+1} ({header_name}): Updated existing formula with original template")
                    else:
                        # Data column with actual data - preserve the data
                        update_row.append(current_value)
                        data_preserved += 1
                        if i < 10:
                            logger.info(f"📝 Column {i+1} ({header_name}): Preserved data: '{str(current_value)[:20]}'")
                else:
                    # Template doesn't have a formula - preserve current value or use empty
                    if i < len(current_value_row):
                        update_row.append(current_value)
                        if current_value and str(current_value).strip():
                            data_preserved += 1
                    else:
                        update_row.append("")
            
            # Update the target row with intelligent formula/data handling
            if update_row:
                logger.info(f"🚀 Updating row {target_row} with {len(update_row)} values")
                worksheet.update(target_range, [update_row], value_input_option="USER_ENTERED")
                
                logger.info(f"✅ Successfully updated row {target_row}:")
                logger.info(f"   📊 Original template formulas copied: {formulas_copied}")
                logger.info(f"   📄 Data values preserved: {data_preserved}")
                logger.info(f"   🎯 Total columns processed: {len(update_row)}")
                
                # Log some examples of what was applied
                formula_examples = []
                for i, cell in enumerate(update_row[:10]):  # First 10 columns
                    if cell and str(cell).startswith('='):
                        header = headers[i] if i < len(headers) else f"Col{i+1}"
                        formula_examples.append(f"{header}: {str(cell)[:30]}")
                
                if formula_examples:
                    logger.info(f"   🧮 Original formula examples: {'; '.join(formula_examples[:3])}")
                
                return True
            else:
                logger.warning(f"❌ No data to update in row {target_row}")
                return False
                
        except Exception as e:
            logger.error(f"❌ Error copying formulas to row {target_row}: {str(e)}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return False

    def _update_formula_references(self, formula: str, source_row: int, target_row: int) -> str:
        """
        Update row references in a formula when copying from source_row to target_row.
        Preserves original formula structure exactly as in template.
        
        Args:
            formula: The original formula (e.g., "=B2+C2*$D$2")
            source_row: The row the formula was copied from
            target_row: The row the formula is being copied to
            
        Returns:
            Updated formula with row references adjusted, preserving original structure
        """
        try:
            import re
            
            # Pattern to match cell references (e.g., A1, B2, $C$3, etc.)
            # This matches: optional $, letters, optional $, numbers
            pattern = r'(\$?)([A-Z]+)(\$?)(\d+)'
            
            def replace_reference(match):
                dollar1, col_letters, dollar2, row_num = match.groups()
                row_num = int(row_num)
                
                # If row is absolute ($), don't change it
                if dollar2:
                    return match.group(0)
                
                # If the row number matches the source row, update it to target row
                if row_num == source_row:
                    row_num = target_row
                # Otherwise, adjust relative references
                elif row_num > source_row:
                    # Relative reference below the source - adjust by the difference
                    row_num = row_num + (target_row - source_row)
                
                return f"{dollar1}{col_letters}{dollar2}{row_num}"
            
            updated_formula = re.sub(pattern, replace_reference, formula)
            
            # REMOVED: Formula improvements - preserve original formula exactly as in template
            # updated_formula = self._improve_formula_for_text_handling(updated_formula)
            
            logger.debug(f"Formula updated: {formula} -> {updated_formula}")
            return updated_formula
            
        except Exception as e:
            logger.warning(f"Could not update formula references for '{formula}': {str(e)}")
            return formula  # Return original formula if update fails

    def _improve_formula_for_text_handling(self, formula: str) -> str:
        """
        Improve formulas to handle text values and empty cells properly.
        
        Args:
            formula: The formula to improve
            
        Returns:
            Improved formula with better error handling
        """
        try:
            # Handle common problematic patterns
            
            # Pattern 1: Simple arithmetic operations that might encounter text
            # Example: =BB2-BA2-AU2+BC2 becomes =IFERROR(IFNA(BB2,0)-IFNA(BA2,0)-IFNA(AU2,0)+IFNA(BC2,0),0)
            if "=" in formula and any(op in formula for op in ["+", "-", "*", "/"]):
                # Check if it's a simple arithmetic formula without existing error handling
                if not any(func in formula.upper() for func in ["IFERROR", "IFNA", "ISERROR", "ISBLANK"]):
                    # Extract cell references
                    import re
                    cell_pattern = r'([A-Z]+\d+)'
                    cells = re.findall(cell_pattern, formula)
                    
                    if len(cells) >= 2 and len(formula) < 100:  # Only process simple formulas
                        # Wrap the entire formula in IFERROR
                        inner_formula = formula[1:]  # Remove the = sign
                        
                        # Replace each cell reference with IFNA(cell,0) to handle text/empty values
                        for cell in set(cells):  # Use set to avoid duplicates
                            inner_formula = inner_formula.replace(cell, f"IFNA({cell},0)")
                        
                        improved_formula = f"=IFERROR({inner_formula},0)"
                        logger.info(f"Improved formula: {formula} -> {improved_formula}")
                        return improved_formula
            
            # Pattern 2: Division operations that might cause #DIV/0 errors
            if "/" in formula and "IFERROR" not in formula.upper():
                # Wrap in IFERROR to handle division by zero
                improved_formula = f"=IFERROR({formula[1:]},0)"
                logger.info(f"Added division error handling: {formula} -> {improved_formula}")
                return improved_formula
            
            return formula
            
        except Exception as e:
            logger.warning(f"Could not improve formula '{formula}': {str(e)}")
            return formula

    def create_quarter_sheet_with_template(self, quarter: int, year: int) -> Dict[str, Any]:
        """
        Manually create a new quarter sheet and copy template headers and formulas from master sheet.
        
        Args:
            quarter: Quarter number (1-4)
            year: Year (e.g., 2025)
            
        Returns:
            Dict with success status and details
        """
        try:
            quarter_name = self.get_quarterly_sheet_name(quarter, year)
            
            # Check if sheet already exists
            if self.sheet_exists(quarter_name):
                return {
                    "success": False,
                    "error": f"Quarter sheet '{quarter_name}' already exists",
                    "sheet_name": quarter_name
                }
            
            # Create the new quarter sheet
            logger.info(f"Creating new quarter sheet: {quarter_name}")
            new_sheet = self.spreadsheet.add_worksheet(
                title=quarter_name, 
                rows=1000, 
                cols=len(self.create_quarterly_sheet_headers())
            )
            
            # Get the Master Template sheet
            try:
                master_sheet = self.spreadsheet.worksheet("Master Template")
            except gspread.WorksheetNotFound:
                # Try to find any sheet with "template" in the name
                all_sheets = self.spreadsheet.worksheets()
                master_sheet = None
                for sheet in all_sheets:
                    if "template" in sheet.title.lower() or "master" in sheet.title.lower():
                        master_sheet = sheet
                        break
                
                if not master_sheet:
                    logger.warning("No master template sheet found, creating sheet with headers only")
                    # Just add headers if no template is found
                    headers = self.create_quarterly_sheet_headers()
                    new_sheet.update("A1:1", [headers], value_input_option="USER_ENTERED")
                    return {
                        "success": True,
                        "message": f"Created quarter sheet '{quarter_name}' with headers only (no template found)",
                        "sheet_name": quarter_name,
                        "rows_copied": 1
                    }
            
            # Copy first 2 rows (headers + sample data) from master template
            num_columns = len(self.create_quarterly_sheet_headers())
            last_col = self._col_to_a1(num_columns)
            
            # Get headers (row 1)
            headers_range = f"A1:{last_col}1"
            try:
                headers_data = master_sheet.batch_get([headers_range])[0]
                if headers_data:
                    new_sheet.update(headers_range, headers_data, value_input_option="USER_ENTERED")
                    logger.info(f"Copied headers to {quarter_name}")
            except Exception as e:
                logger.warning(f"Could not copy headers from master template: {str(e)}")
                # Fallback to programmatic headers
                headers = self.create_quarterly_sheet_headers()
                new_sheet.update("A1:1", [headers], value_input_option="USER_ENTERED")
            
            # Get sample data and formulas (row 2)
            sample_range = f"A2:{last_col}2"
            try:
                # Get both values and formulas from row 2
                sample_values = master_sheet.batch_get([sample_range])[0]
                sample_formulas = master_sheet.batch_get([sample_range], value_render_option='FORMULA')[0]
                
                if sample_formulas and sample_formulas[0]:
                    # Use formulas if available, otherwise use values
                    sample_data = []
                    for i, (value, formula) in enumerate(zip(
                        sample_values[0] if sample_values and sample_values[0] else [],
                        sample_formulas[0] if sample_formulas and sample_formulas[0] else []
                    )):
                        if formula and isinstance(formula, str) and formula.startswith('='):
                            # Preserve original formula exactly as in template
                            sample_data.append(formula)  # Use original formula unchanged
                        else:
                            sample_data.append(str(value) if value else "")  # Use value as string
                    
                    new_sheet.update(sample_range, [sample_data], value_input_option="USER_ENTERED")
                    logger.info(f"Copied sample data and original template formulas to {quarter_name}")
                elif sample_values and sample_values[0]:
                    # Just copy values if no formulas
                    new_sheet.update(sample_range, sample_values, value_input_option="USER_ENTERED")
                    logger.info(f"Copied sample data to {quarter_name}")
                    
            except Exception as e:
                logger.warning(f"Could not copy sample data from master template: {str(e)}")
            
            # Format the sheet (freeze header row, set basic formatting)
            try:
                # Freeze the first row (headers)
                new_sheet.freeze(rows=1)
                
                # Make header row bold
                new_sheet.format(f"A1:{last_col}1", {
                    "textFormat": {"bold": True},
                    "backgroundColor": {"red": 0.9, "green": 0.9, "blue": 0.9}
                })
                
                logger.info(f"Applied formatting to {quarter_name}")
            except Exception as e:
                logger.warning(f"Could not apply formatting to {quarter_name}: {str(e)}")
            
            return {
                "success": True,
                "message": f"Successfully created quarter sheet '{quarter_name}' with template",
                "sheet_name": quarter_name,
                "rows_copied": 2,
                "columns": num_columns
            }
            
        except Exception as e:
            logger.error(f"Error creating quarter sheet Q{quarter}-{year}: {str(e)}")
            return {
                "success": False,
                "error": f"Failed to create quarter sheet: {str(e)}"
            }

    def get_current_quarter_info(
        self, target_date: Optional[date] = None
    ) -> Tuple[str, int, int]:
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

    def get_previous_quarter_info(
        self, current_quarter: int, current_year: int
    ) -> Tuple[str, int, int]:
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
                template_sheet = self.spreadsheet.worksheet(
                    self.master_template_sheet_name
                )
                logger.info(
                    f"Found Master Template sheet: {self.master_template_sheet_name}"
                )
                return template_sheet
            except gspread.WorksheetNotFound:
                logger.warning(
                    f"Master Template sheet '{self.master_template_sheet_name}' not found"
                )

                # Try alternative names
                alternative_names = [
                    "Master Template",
                    "Template",
                    "Master_Template",
                    "MasterTemplate",
                ]
                for alt_name in alternative_names:
                    try:
                        template_sheet = self.spreadsheet.worksheet(alt_name)
                        logger.info(
                            f"Found Master Template sheet with alternative name: {alt_name}"
                        )
                        self.master_template_sheet_name = alt_name  # Update the name
                        return template_sheet
                    except gspread.WorksheetNotFound:
                        continue

                # If no template sheet found, check if we can use Master sheet as template
                try:
                    master_sheet = self.spreadsheet.worksheet("Master")
                    logger.warning(
                        "Using 'Master' sheet as template since 'Master Template' not found"
                    )
                    self.master_template_sheet_name = "Master"
                    return master_sheet
                except gspread.WorksheetNotFound:
                    logger.error(
                        "No suitable template sheet found (Master Template, Template, or Master)"
                    )
                    return None

        except Exception as e:
            logger.error(f"Error getting master template sheet: {str(e)}")
            return None

    def get_summary_sheet(self) -> Optional[gspread.Worksheet]:
        """Get the Summary sheet from Google Sheets"""
        try:
            if not self.spreadsheet:
                logger.error("Spreadsheet not initialized")
                return None

            # Try to get the Summary sheet
            try:
                summary_sheet = self.spreadsheet.worksheet("Summary")
                logger.info("Found Summary sheet")
                return summary_sheet
            except gspread.WorksheetNotFound:
                logger.warning("Summary sheet not found")

                # Try alternative names for summary sheet
                alternative_names = [
                    "SUMMARY",
                    "Summary Report",
                    "Agent Summary",
                    "Financial Summary",
                ]
                for alt_name in alternative_names:
                    try:
                        summary_sheet = self.spreadsheet.worksheet(alt_name)
                        logger.info(
                            f"Found Summary sheet with alternative name: {alt_name}"
                        )
                        return summary_sheet
                    except gspread.WorksheetNotFound:
                        continue

                logger.error("No Summary sheet found with any expected name")
                return None

        except Exception as e:
            logger.error(f"Error getting summary sheet: {str(e)}")
            return None

    def get_broker_sheet(self) -> Optional[gspread.Worksheet]:
        """Get the Broker sheet from Google Sheets"""
        try:
            if not self.spreadsheet:
                logger.error("Spreadsheet not initialized")
                return None

            # Try to get the Broker sheet
            try:
                broker_sheet = self.spreadsheet.worksheet("Broker Sheet")
                logger.info("Found Broker Sheet")
                return broker_sheet
            except gspread.WorksheetNotFound:
                logger.warning("Broker Sheet not found")

                # Try alternative names for broker sheet
                alternative_names = [
                    "Broker",
                    "BROKER SHEET",
                    "Broker Data",
                    "Brokers",
                    "Broker Report",
                ]
                for alt_name in alternative_names:
                    try:
                        broker_sheet = self.spreadsheet.worksheet(alt_name)
                        logger.info(
                            f"Found Broker sheet with alternative name: {alt_name}"
                        )
                        return broker_sheet
                    except gspread.WorksheetNotFound:
                        continue

                logger.error("No Broker sheet found with any expected name")
                return None

        except Exception as e:
            logger.error(f"Error getting broker sheet: {str(e)}")
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

            logger.info(
                f"Loaded {len(headers)} headers from Google Sheets template: {self.master_template_sheet_name}"
            )
            return headers

        except Exception as e:
            logger.error(f"Error loading headers from Google Sheets template: {str(e)}")
            return self._get_default_headers()

    def copy_template_structure_and_formulas(
        self, target_worksheet: gspread.Worksheet
    ) -> bool:
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
                if target_sheet_name.startswith("Q") and "-" in target_sheet_name:
                    quarter_part, year_part = target_sheet_name[1:].split("-")
                    target_quarter = int(quarter_part)
                    target_year = int(year_part)
                else:
                    # Fallback to current quarter
                    _, target_quarter, target_year = self.get_current_quarter_info()
            except:
                # Fallback to current quarter
                _, target_quarter, target_year = self.get_current_quarter_info()

            logger.info(
                f"Copying template structure from {self.master_template_sheet_name} to {target_worksheet.title} (Q{target_quarter}-{target_year})"
            )

            # 1. Copy headers (row 1)
            template_headers = template_sheet.row_values(1)
            quarterly_headers = self.create_quarterly_sheet_headers()

            # Update headers in target sheet
            target_worksheet.update("A1", [quarterly_headers], value_input_option="RAW")

            # 2. Copy data and formulas from template row 2 (sample data + formulas)
            try:
                # Get the actual range based on the number of headers
                max_col = self._col_to_a1(len(quarterly_headers))
                template_range = f"A2:{max_col}2"

                logger.info(
                    f"Getting data and formulas from template range: {template_range}"
                )

                # Get both values and formulas from row 2 of template
                template_values = template_sheet.get(
                    template_range, value_render_option="UNFORMATTED_VALUE"
                )
                template_formulas = template_sheet.get(
                    template_range, value_render_option="FORMULA"
                )

                if (
                    template_formulas
                    and len(template_formulas) > 0
                    and template_values
                    and len(template_values) > 0
                ):
                    template_formula_row = (
                        template_formulas[0] if template_formulas else []
                    )
                    template_value_row = template_values[0] if template_values else []

                    # Ensure both rows have the same length
                    max_len = max(len(template_formula_row), len(template_value_row))
                    template_formula_row.extend(
                        [""] * (max_len - len(template_formula_row))
                    )
                    template_value_row.extend(
                        [""] * (max_len - len(template_value_row))
                    )

                    logger.info(
                        f"Retrieved {len(template_formula_row)} cells from template (formulas + values)"
                    )

                    # Create combined row: use formula if exists, otherwise use value
                    template_combined_row = []
                    for i in range(max_len):
                        formula = (
                            template_formula_row[i]
                            if i < len(template_formula_row)
                            else ""
                        )
                        value = (
                            template_value_row[i] if i < len(template_value_row) else ""
                        )

                        # If there's a formula, use it; otherwise use the value
                        if formula and str(formula).startswith("="):
                            template_combined_row.append(formula)
                        else:
                            template_combined_row.append(value)

                    # Adapt formulas and values for quarterly sheet structure
                    adapted_formulas = self._adapt_template_formulas_for_target(
                        template_combined_row,
                        template_headers,
                        quarterly_headers,
                        target_quarter,
                        target_year,
                    )

                    if adapted_formulas:
                        # Apply formulas and values to row 2 of target sheet
                        range_notation = f"A2:{self._col_to_a1(len(adapted_formulas))}2"
                        target_worksheet.update(
                            range_notation,
                            [adapted_formulas],
                            value_input_option="USER_ENTERED",
                        )

                        formula_count = len(
                            [
                                f
                                for f in adapted_formulas
                                if f and str(f).startswith("=")
                            ]
                        )
                        value_count = len(
                            [
                                f
                                for f in adapted_formulas
                                if f and not str(f).startswith("=") and f != ""
                            ]
                        )
                        logger.info(
                            f"Successfully copied {formula_count} formulas and {value_count} values to target sheet"
                        )
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
                self._copy_template_formatting(
                    template_sheet, target_worksheet, len(quarterly_headers)
                )
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

    def _copy_template_formatting(
        self,
        template_sheet: gspread.Worksheet,
        target_sheet: gspread.Worksheet,
        num_cols: int,
    ):
        """Copy formatting from template sheet to target sheet"""
        try:
            # Copy header row formatting
            header_range = f"A1:{self._col_to_a1(num_cols)}1"

            # Apply standard header formatting
            target_sheet.format(
                header_range,
                {
                    "textFormat": {"bold": True},
                    "backgroundColor": {"red": 0.9, "green": 0.9, "blue": 0.9},
                    "horizontalAlignment": "CENTER",
                },
            )

            # Freeze header row
            target_sheet.freeze(rows=1)

            logger.info("Applied header formatting to target sheet")

        except Exception as e:
            logger.warning(f"Error copying template formatting: {str(e)}")

    def _copy_template_validations(
        self, template_sheet: gspread.Worksheet, target_sheet: gspread.Worksheet
    ):
        """Copy data validations from template sheet to target sheet"""
        try:
            # This is a placeholder for copying data validations
            # Google Sheets API has limited support for copying validations
            # You might need to manually recreate important validations

            logger.info("Template validations copy completed (placeholder)")

        except Exception as e:
            logger.warning(f"Error copying template validations: {str(e)}")

    def _get_default_headers(self) -> List[str]:
        """Default headers based on the complete template analysis - Updated to match current quarterly sheets"""
        return [
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
            "Total Receivable from Broker",
            "Claimed By",
            "Payment by",
            "Payment Mode",
            "Cut Pay Amount Received From Agent",
            "Already Given to agent",
            "Actual Agent_PO%",
            "Agent_PO_AMT",
            "Agent_Extra%",
            "Agent_Extr_Amount",
            "Agent Total PO Amount",
            "Payment By Office",
            "PO Paid To Agent",
            "Running Bal",
            "Total Receivable from Broker Include 18% GST",
            "IZ Total PO%",
            "As per Broker PO%",
            "As per Broker PO AMT",
            "PO% Diff Broker",
            "PO AMT Diff Broker",
            "Actual Agent PO%",
            "As per Agent Payout%",
            "As per Agent Payout Amount",
            "PO% Diff Agent",
            "PO AMT Diff Agent",
            "Invoice Status",
            "Invoice Number",
            "Remarks",
            "Match",
            "Agent Code",
        ]

    def create_quarterly_sheet_headers(self) -> List[str]:
        """Create headers for quarterly sheet from Master Template"""
        # Get data headers from Master Template
        complete_headers = self.load_master_template_headers()

        logger.info(
            f"Created quarterly sheet headers with {len(complete_headers)} data columns from Master Template"
        )
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

    def get_current_quarter_sheet(self) -> Optional[gspread.Worksheet]:
        """Get the current quarter's sheet - expects sheet to be created externally via Google Apps Script"""
        try:
            quarter_name, quarter, year = self.get_current_quarter_info()

            # Check if current quarter sheet exists
            if self.sheet_exists(quarter_name):
                return self.spreadsheet.worksheet(quarter_name)
            else:
                logger.warning(
                    f"Current quarter sheet {quarter_name} does not exist. Sheet creation is handled by Google Apps Script."
                )
                return None

        except Exception as e:
            logger.error(f"Error getting current quarter sheet: {str(e)}")
            return None

    def get_quarterly_sheet(
        self, quarter: int, year: int
    ) -> Optional[gspread.Worksheet]:
        """Get a specific quarter's sheet by quarter and year"""
        try:
            quarter_name = self.get_quarterly_sheet_name(quarter, year)

            # Check if the specified quarter sheet exists
            if self.sheet_exists(quarter_name):
                return self.spreadsheet.worksheet(quarter_name)
            else:
                logger.warning(f"Quarter sheet {quarter_name} does not exist")
                return None

        except Exception as e:
            logger.error(f"Error getting quarter sheet Q{quarter}-{year}: {str(e)}")
            return None

    def route_new_record_to_current_quarter(
        self, record_data: Dict[str, Any], operation_type: str = "CREATE"
    ) -> Dict[str, Any]:
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
                return {
                    "success": False,
                    "error": "Could not access current quarter sheet",
                }

            # Get headers
            headers = self.create_quarterly_sheet_headers()

            # Prepare row data
            row_data = []
            for header in headers:
                value = record_data.get(header, "") or record_data.get(
                    header.replace(" ", "_").lower(), ""
                )
                row_data.append(str(value) if value else "")

            # Find next empty row
            next_row = self._find_next_empty_row(current_sheet)
            logger.info(f"Found next empty row: {next_row} in quarter sheet")

            # First, add the actual record data
            range_notation = f"A{next_row}:{self._col_to_a1(len(headers))}{next_row}"
            logger.info(f"Inserting policy data to range: {range_notation}")
            current_sheet.update(
                range_notation, [row_data], value_input_option="USER_ENTERED"
            )
            logger.info(f"Successfully inserted policy data to row {next_row}")

            # Then, copy ONLY the formulas from row 2 to the new row (preserving our data)
            logger.info(
                f"Starting formula copy process from template row 2 to row {next_row}"
            )
            formula_copy_success = self._copy_formulas_only_to_row(
                current_sheet, next_row
            )
            
            if formula_copy_success:
                logger.info(f"✅ Formula copy to row {next_row} completed successfully")
            else:
                logger.warning(f"⚠️ Formula copy to row {next_row} failed or had issues")

            quarter_name, quarter, year = self.get_current_quarter_info()

            logger.info(
                f"Successfully {operation_type.lower()}d record to {quarter_name} at row {next_row} with formulas"
            )

            return {"success": True, "sheet_name": quarter_name, "row_number": next_row}

        except Exception as e:
            logger.error(f"Error routing record to current quarter: {str(e)}")
            return {"success": False, "error": str(e)}

    def route_new_record_to_specific_quarter(
        self,
        record_data: Dict[str, Any],
        quarter: int,
        year: int,
        operation_type: str = "CREATE",
    ) -> Dict[str, Any]:
        """
        Route new record to a specific quarter's sheet

        Args:
            record_data: The record data to add
            quarter: Target quarter (1-4)
            year: Target year
            operation_type: "CREATE" for new records, "UPDATE" for existing records

        Returns:
            Success status and details
        """
        try:
            # Get specific quarter sheet
            quarter_name = f"Q{quarter}-{year}"
            try:
                target_sheet = self.spreadsheet.worksheet(quarter_name)
                logger.info(f"Found target quarter sheet: {quarter_name}")
            except gspread.WorksheetNotFound:
                logger.error(
                    f"Quarter sheet {quarter_name} not found. Sheet creation is handled by Google Apps Script."
                )
                return {
                    "success": False,
                    "error": f"Quarter sheet {quarter_name} does not exist. Sheets must be created via Google Apps Script.",
                }

            # Get headers
            headers = self.create_quarterly_sheet_headers()

            # Prepare row data
            row_data = []
            for header in headers:
                value = record_data.get(header, "") or record_data.get(
                    header.replace(" ", "_").lower(), ""
                )
                row_data.append(str(value) if value else "")

            # Find next empty row
            next_row = self._find_next_empty_row(target_sheet)

            # First, add the actual record data
            range_notation = f"A{next_row}:{self._col_to_a1(len(headers))}{next_row}"
            target_sheet.update(
                range_notation, [row_data], value_input_option="USER_ENTERED"
            )

            # Then, copy ONLY the formulas from row 2 to the new row (preserving our data)
            logger.info(
                f"DEBUG: About to copy formulas to new record at row {next_row} in {quarter_name}"
            )
            formula_copy_success = self._copy_formulas_only_to_row(
                target_sheet, next_row
            )
            logger.info(
                f"DEBUG: Formula copy to new record row {next_row} in {quarter_name} success: {formula_copy_success}"
            )

            logger.info(
                f"Successfully {operation_type.lower()}d record to {quarter_name} at row {next_row} with formulas"
            )

            return {"success": True, "sheet_name": quarter_name, "row_number": next_row}

        except Exception as e:
            logger.error(
                f"Error routing record to specific quarter {quarter}-{year}: {str(e)}"
            )
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

            logger.info(
                f"Found next empty row: {next_row} (last data row was: {last_row_with_data})"
            )
            return next_row

        except Exception as e:
            logger.error(f"Error finding next empty row: {str(e)}")
            return 2

    def test_formula_copying(self, sheet_name: Optional[str] = None, target_row: Optional[int] = None) -> Dict[str, Any]:
        """
        Test formula copying functionality - useful for debugging
        
        Args:
            sheet_name: Optional sheet name to test on (defaults to current quarter)
            target_row: Optional target row (defaults to next empty row)
            
        Returns:
            Test results with detailed information
        """
        try:
            # Get the worksheet to test on
            if sheet_name:
                try:
                    worksheet = self.spreadsheet.worksheet(sheet_name)
                except gspread.WorksheetNotFound:
                    return {
                        "success": False,
                        "error": f"Sheet '{sheet_name}' not found"
                    }
            else:
                worksheet = self.get_current_quarter_sheet()
                if not worksheet:
                    return {
                        "success": False,
                        "error": "Could not get current quarter sheet"
                    }
                sheet_name = worksheet.title
            
            # Determine target row
            if not target_row:
                target_row = self._find_next_empty_row(worksheet)
            
            logger.info(f"🧪 Testing formula copying on sheet '{sheet_name}', row {target_row}")
            
            # Get current state of the worksheet
            headers = self.create_quarterly_sheet_headers()
            num_columns = len(headers)
            last_col = self._col_to_a1(num_columns)
            
            # Get template row (row 2) formulas
            template_range = f"A2:{last_col}2"
            try:
                template_formulas = worksheet.batch_get([template_range], 
                                                      value_render_option='FORMULA')[0]
                template_formula_row = template_formulas[0] if template_formulas else []
            except Exception as e:
                return {
                    "success": False,
                    "error": f"Could not read template formulas: {str(e)}"
                }
            
            # Count formulas in template
            template_formula_count = sum(1 for cell in template_formula_row if str(cell).startswith('='))
            
            # Add some test data to the target row first
            test_data = ["Test Policy"] + [""] * (num_columns - 1)  # Just put something in first column
            target_range = f"A{target_row}:{last_col}{target_row}"
            worksheet.update(target_range, [test_data], value_input_option="USER_ENTERED")
            
            # Now test the formula copying
            formula_copy_result = self._copy_formulas_only_to_row(worksheet, target_row)
            
            # Check the results
            try:
                result_formulas = worksheet.batch_get([target_range], 
                                                    value_render_option='FORMULA')[0]
                result_formula_row = result_formulas[0] if result_formulas else []
            except Exception as e:
                return {
                    "success": False,
                    "error": f"Could not read result formulas: {str(e)}"
                }
            
            result_formula_count = sum(1 for cell in result_formula_row if str(cell).startswith('='))
            
            # Create detailed report
            formula_examples = []
            for i, (template_cell, result_cell) in enumerate(zip(template_formula_row, result_formula_row)):
                if str(template_cell).startswith('=') or str(result_cell).startswith('='):
                    header_name = headers[i] if i < len(headers) else f"Col{i+1}"
                    formula_examples.append({
                        "column": i + 1,
                        "header": header_name,
                        "template": str(template_cell),
                        "result": str(result_cell),
                        "copied": str(result_cell).startswith('=')
                    })
            
            return {
                "success": True,
                "sheet_name": sheet_name,
                "target_row": target_row,
                "template_formulas_found": template_formula_count,
                "result_formulas_copied": result_formula_count,
                "formula_copy_success": formula_copy_result,
                "formula_examples": formula_examples[:10],  # First 10 for brevity
                "test_summary": f"Copied {result_formula_count}/{template_formula_count} formulas to row {target_row}"
            }
            
        except Exception as e:
            logger.error(f"❌ Error testing formula copying: {str(e)}")
            import traceback
            return {
                "success": False,
                "error": str(e),
                "traceback": traceback.format_exc()
            }

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
                logger.warning(
                    f"Current quarter sheet {quarter_name} doesn't exist - sheet creation is handled by Google Apps Script"
                )
                return {
                    "transition_needed": True,
                    "new_sheet_created": False,
                    "sheet_name": quarter_name,
                    "message": f"Quarter sheet {quarter_name} needs to be created via Google Apps Script",
                }
            else:
                return {
                    "transition_needed": False,
                    "current_sheet": quarter_name,
                    "message": f"Current quarter sheet {quarter_name} already exists",
                }

        except Exception as e:
            logger.error(f"Error checking quarter transition: {str(e)}")
            return {"transition_needed": False, "error": str(e)}

    def get_quarter_summary(self, quarter: int, year: int) -> Dict[str, Any]:
        """Get summary information for a specific quarter"""
        try:
            sheet_name = self.get_quarterly_sheet_name(quarter, year)

            if not self.sheet_exists(sheet_name):
                return {"exists": False, "sheet_name": sheet_name}

            worksheet = self.spreadsheet.worksheet(sheet_name)
            all_records = worksheet.get_all_records()

            # Count records by match
            true_match_count = sum(
                1
                for record in all_records
                if str(record.get("Match", "")).strip().lower() == "true"
            )
            false_match_count = sum(
                1
                for record in all_records
                if str(record.get("Match", "")).strip().lower() == "false"
            )
            total_records = len(all_records)

            return {
                "exists": True,
                "sheet_name": sheet_name,
                "total_records": total_records,
                "true_match_count": true_match_count,
                "false_match_count": false_match_count,
                "last_updated": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            }

        except Exception as e:
            logger.error(f"Error getting quarter summary: {str(e)}")
            return {"exists": False, "error": str(e)}

    def update_existing_record_by_policy_number(
        self,
        record_data: Dict[str, Any],
        policy_number: str,
        quarter: Optional[int] = None,
        year: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Find and update an existing record by policy number in a specific or current quarter sheet

        Args:
            record_data: The updated record data
            policy_number: Policy number to search for
            quarter: Optional specific quarter (1-4) to search in
            year: Optional specific year to search in

        Returns:
            Success status and details
        """
        try:
            # Get target quarter sheet
            if quarter and year:
                quarter_name = f"Q{quarter}-{year}"
                try:
                    target_sheet = self.spreadsheet.worksheet(quarter_name)
                    logger.info(f"Targeting specific quarter sheet: {quarter_name}")
                except gspread.WorksheetNotFound:
                    logger.warning(
                        f"Quarter sheet {quarter_name} not found, falling back to current quarter"
                    )
                    target_sheet = self.get_current_quarter_sheet()
            else:
                target_sheet = self.get_current_quarter_sheet()
                quarter_name, quarter, year = self.get_current_quarter_info()
                logger.info(f"Using current quarter sheet: {quarter_name}")

            if not target_sheet:
                return {
                    "success": False,
                    "error": "Could not access target quarter sheet",
                }

            # Get all records to find the one with matching policy number
            all_values = target_sheet.get_all_values()
            headers = all_values[0] if all_values else []

            # Find policy number column index
            policy_col_index = -1
            for i, header in enumerate(headers):
                if header.lower().strip() in ["policy number", "policy_number"]:
                    policy_col_index = i
                    break

            if policy_col_index == -1:
                return {
                    "success": False,
                    "error": "Policy number column not found in sheet",
                }

            # Find the row with matching policy number
            target_row = -1
            # Skip header (row 1) and dummy/formula row (row 2)
            for row_index, row_data in enumerate(
                all_values[2:], start=3
            ):
                if policy_col_index < len(row_data):
                    if row_data[policy_col_index].strip() == policy_number.strip():
                        target_row = row_index
                        break

            if target_row == -1:
                # Policy number not found - do NOT create new record, return error instead
                logger.error(
                    f"Policy number '{policy_number}' not found in quarter sheet '{quarter_name}'. Available policy numbers in sheet: {[row[policy_col_index] for row in all_values[1:] if policy_col_index < len(row)][:10]}"
                )  # Show first 10 for debugging
                return {
                    "success": False,
                    "error": f"Policy number '{policy_number}' not found in quarter sheet '{quarter_name}' for update. Use create endpoint to add new policies.",
                }

            logger.info(
                f"Found policy '{policy_number}' at row {target_row} in quarter sheet '{quarter_name}'"
            )

            # Prepare updated row data
            quarterly_headers = self.create_quarterly_sheet_headers()
            updated_row_data = []
            for header in quarterly_headers:
                value = record_data.get(header, "") or record_data.get(
                    header.replace(" ", "_").lower(), ""
                )
                updated_row_data.append(str(value) if value else "")

            # Update the existing row
            range_notation = (
                f"A{target_row}:{self._col_to_a1(len(quarterly_headers))}{target_row}"
            )
            target_sheet.update(
                range_notation, [updated_row_data], value_input_option="USER_ENTERED"
            )

            # Copy formulas to the updated row (preserving our data but updating calculated fields)
            formula_copy_success = self._copy_formulas_only_to_row(
                target_sheet, target_row
            )

            # Use the determined quarter info (either specified or current)
            final_quarter_name = f"Q{quarter}-{year}"

            logger.info(
                f"Successfully updated existing record with policy number '{policy_number}' in {final_quarter_name} at row {target_row}"
            )

            return {
                "success": True,
                "sheet_name": final_quarter_name,
                "row_number": target_row,
                "operation": "UPDATE",
                "policy_number": policy_number,
            }

        except Exception as e:
            logger.error(f"Error updating existing record by policy number: {str(e)}")
            return {"success": False, "error": str(e)}

    def get_all_records_from_quarter_sheet(
        self, quarter: int, year: int
    ) -> List[Dict[str, Any]]:
        """
        Get all records from a specific quarterly sheet

        Args:
            quarter: Quarter number (1-4)
            year: Year (e.g., 2025)

        Returns:
            List of dictionaries representing all records in the sheet (starting from row 3)
        """
        try:
            sheet_name = self.get_quarterly_sheet_name(quarter, year)

            # Check if quarter sheet exists
            if not self.sheet_exists(sheet_name):
                logger.warning(f"Quarter sheet {sheet_name} does not exist")
                return []

            # Get the worksheet
            worksheet = self.spreadsheet.worksheet(sheet_name)

            # Get all records as dictionaries, but skip the first data row (row 2 - dummy data)
            # Row 1 = headers, Row 2 = dummy data with formulas, Row 3+ = actual data
            all_values = worksheet.get_all_values()

            if len(all_values) < 3:  # Need at least header + dummy + 1 data row
                logger.info(
                    f"No data rows found in {sheet_name} (only header and/or dummy row)"
                )
                return []

            # Extract headers from row 1 and data from row 3 onwards
            headers = all_values[0]  # Row 1 - headers
            data_rows = all_values[
                2:
            ]  # Row 3 onwards - actual data (skip row 2 dummy data)

            # Convert to list of dictionaries
            all_records = []
            for row in data_rows:
                # Skip completely empty rows
                if all(cell.strip() == "" for cell in row):
                    continue

                record = {}
                for i, header in enumerate(headers):
                    if i < len(row):
                        record[header] = row[i]
                    else:
                        record[header] = ""  # Fill missing columns with empty string
                all_records.append(record)

            logger.info(
                f"Retrieved {len(all_records)} records from {sheet_name} (skipped dummy row)"
            )
            return all_records

        except Exception as e:
            logger.error(
                f"Error getting all records from quarter sheet Q{quarter}-{year}: {str(e)}"
            )
            return []

    def get_oldest_quarter_sheet_name(self) -> Optional[str]:
        """
        Get the name of the oldest quarterly sheet available in the workbook

        Returns:
            Optional[str]: Name of the oldest quarter sheet (e.g., "Q1-2023") or None if no sheets found
        """
        try:
            if not self.spreadsheet:
                logger.error("Google Sheets spreadsheet not initialized")
                return None

            # Get all worksheets
            all_worksheets = self.spreadsheet.worksheets()
            quarter_sheets = []

            # Filter for quarterly sheets (format: Q{quarter}-{year})
            import re

            quarter_pattern = re.compile(r"^Q([1-4])-(\d{4})$")

            for sheet in all_worksheets:
                match = quarter_pattern.match(sheet.title)
                if match:
                    quarter = int(match.group(1))
                    year = int(match.group(2))
                    quarter_sheets.append((year, quarter, sheet.title))

            if not quarter_sheets:
                logger.info("No quarterly sheets found")
                return None

            # Sort by year, then by quarter to find the oldest
            quarter_sheets.sort(
                key=lambda x: (x[0], x[1])
            )  # Sort by year, then quarter
            oldest_sheet = quarter_sheets[0]
            oldest_name = oldest_sheet[2]

            logger.info(f"Found oldest quarterly sheet: {oldest_name}")
            return oldest_name

        except Exception as e:
            logger.error(f"Error getting oldest quarter sheet name: {str(e)}")
            return None


# Global instance
quarterly_manager = QuarterlySheetManager()


# Convenience functions for integration
def get_current_quarter_sheet() -> Optional[gspread.Worksheet]:
    """Get current quarter sheet"""
    return quarterly_manager.get_current_quarter_sheet()


def route_record_to_current_quarter(record_data: Dict[str, Any]) -> Dict[str, Any]:
    """Route record to current quarter"""
    return quarterly_manager.route_new_record_to_current_quarter(record_data)


def get_quarter_summary_data(quarter: int, year: int) -> Dict[str, Any]:
    """Get summary for specific quarter"""
    return quarterly_manager.get_quarter_summary(quarter, year)
