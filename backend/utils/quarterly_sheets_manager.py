"""
Quarterly Google Sheets Management System for Insurezeal Backend API.

This module implements a comprehensive quarterly data management system for
quarterly business sheets in Google Sheets. It provides data processing,
template management, and data routing capabilities.

Key Features:
- Data routing to existing quarterly sheets
- Master template management and synchronization
- Record mapping and data validation
- Sheet access and data retrieval
- Comprehensive error handling and logging

Business Logic:
The quarterly sheets system supports critical business operations including:
- Insurance policy data organization by quarters (within existing sheets)
- Commission tracking and data management
- Client information management across time periods
- Regulatory compliance reporting
- Data retrieval and historical tracking
- Template standardization access

Architecture:
- Google Sheets API integration for cloud-based data access
- Service account authentication for secure access
- Template-driven data operations for consistency
- Configurable master templates and record mappings

Data Flow:
1. Access existing quarterly sheets (created by Google Apps Script)
2. Route data to appropriate quarterly sheets
3. Retrieve and validate data from sheets
4. Health checks and connectivity validation

Dependencies:
- gspread: Google Sheets API client library
- google.oauth2: Service account authentication
- config: Credentials and configuration management
- logging: Comprehensive operation monitoring

Note: Quarterly sheet creation is handled by Google Apps Script (runs one day before new quarter).
Cross-quarter aggregation and summaries are also handled by Google Apps Script.
This manager focuses on data operations within existing sheets only - no sheet creation.
"""

from typing import List, Dict, Any, Optional
import gspread
from google.oauth2.service_account import Credentials
from datetime import datetime, date
import logging
from config import GOOGLE_SHEETS_CREDENTIALS, GOOGLE_SHEETS_DOCUMENT_ID

logger = logging.getLogger(__name__)


class QuarterlySheetManager:
    """
    Comprehensive manager for quarterly Google Sheets data operations and access.

    This class orchestrates quarterly sheet data management including record routing,
    data retrieval, and template access. It serves as the central controller for
    quarterly business operations in the insurance platform.

    The manager ensures business continuity by:
    - Accessing existing quarterly sheets (created by Google Apps Script)
    - Routing data to appropriate quarterly sheets
    - Retrieving data from quarterly sheets
    - Providing template structure access

    Attributes:
        credentials (dict): Google Sheets service account credentials
        document_id (str): Target Google Sheets document identifier
        client (gspread.Client): Authenticated Google Sheets client
        spreadsheet (gspread.Spreadsheet): Active spreadsheet instance
        master_template_sheet_name (str): Name of the master template sheet

    Key Operations:
        - Data routing and record management
        - Data validation and integrity checks
        - Error handling and recovery processes
        - Sheet access and connectivity checks

    Integration Points:
        - Google Sheets API for cloud operations
        - Master Template sheet for structure definition
        - Record Mapper for data field mapping
        - Backend database for operational data
        - Google Apps Script for sheet creation (automated)

    Note: Quarterly sheet creation is handled by Google Apps Script (runs one day before new quarter).
    Cross-quarter aggregation is handled by Google Apps Script.
    This manager focuses on data operations within existing sheets only.
    """

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

    def __init__(self):
        self.credentials = GOOGLE_SHEETS_CREDENTIALS

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
                    # Use default values if quarter cannot be determined
                    target_quarter = 1
                    target_year = 2025
            except:
                # Use default values if parsing fails
                target_quarter = 1
                target_year = 2025

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

    def _adjust_formula_for_row(
        self, formula: str, source_row: int, target_row: int
    ) -> str:
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

        if not formula or not formula.startswith("="):
            return formula

        # More comprehensive pattern to match cell references like A2, B2, AA2, etc.
        # This pattern will match column letters followed by the source row number
        pattern = r"([A-Z]+)" + str(source_row) + r"(?![0-9])"

        # Replace all occurrences of the source row with target row
        def replace_func(match):
            column_part = match.group(1)
            return f"{column_part}{target_row}"

        adjusted_formula = re.sub(pattern, replace_func, formula)

        # Log the adjustment for debugging
        if adjusted_formula != formula:
            logger.debug(
                f"Formula adjusted from row {source_row} to {target_row}: {formula} -> {adjusted_formula}"
            )

        return adjusted_formula

    def _adapt_template_formulas_for_target(
        self,
        template_combined_row: List[str],
        template_headers: List[str],
        quarterly_headers: List[str],
        target_quarter: int,
        target_year: int,
    ) -> List[str]:
        """
        Adapt template formulas and values for the target quarterly sheet structure

        Args:
            template_combined_row: Combined formulas and values from template row 2
            template_headers: Headers from the master template
            quarterly_headers: Headers for the quarterly sheet (may include additional columns)
            target_quarter: Target quarter number (1-4)
            target_year: Target year

        Returns:
            List of adapted formulas/values matching quarterly_headers structure
        """
        try:
            adapted_formulas = []

            # Map template data to quarterly headers
            for i, quarterly_header in enumerate(quarterly_headers):
                adapted_value = ""

                # Try to find matching column in template
                if i < len(template_combined_row):
                    template_value = template_combined_row[i]

                    # If it's a formula, decode it for the target quarter
                    if template_value and str(template_value).startswith("="):
                        try:
                            adapted_value = self._decode_master_template_formulas(
                                template_value, target_quarter, target_year, 2
                            )
                        except Exception as formula_error:
                            logger.warning(
                                f"Could not decode formula for {quarterly_header}: {formula_error}"
                            )
                            adapted_value = (
                                template_value  # Use original if decoding fails
                            )
                    else:
                        # Regular value, use as-is
                        adapted_value = template_value
                else:
                    # This is an additional column not in template, leave empty
                    adapted_value = ""

                adapted_formulas.append(adapted_value)

            logger.info(
                f"Adapted {len(adapted_formulas)} formulas/values for quarterly sheet structure"
            )

            # Count formulas vs values for logging
            formula_count = len(
                [f for f in adapted_formulas if f and str(f).startswith("=")]
            )
            value_count = len(
                [f for f in adapted_formulas if f and not str(f).startswith("=") and f]
            )
            empty_count = len([f for f in adapted_formulas if not f])

            logger.info(
                f"Adaptation result: {formula_count} formulas, {value_count} values, {empty_count} empty cells"
            )

            return adapted_formulas

        except Exception as e:
            logger.error(f"Error adapting template formulas for target: {str(e)}")
            return []

    def _decode_master_template_formulas(
        self, formula: str, target_quarter: int, target_year: int, target_row: int
    ) -> str:
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
            if (
                decoded_formula.startswith('"')
                and decoded_formula.endswith('"')
                and decoded_formula.count('"') >= 2
            ):
                # Check if removing outer quotes gives us a valid formula
                inner_content = decoded_formula[1:-1]
                if inner_content.startswith("="):
                    decoded_formula = inner_content
                    logger.debug(
                        f"Removed outer quotes: {original_formula} -> {decoded_formula}"
                    )
                else:
                    logger.debug(
                        f"Keeping quotes - inner content is not a formula: {inner_content}"
                    )

            # If it's not a formula after processing, return the original
            if not decoded_formula.startswith("="):
                logger.debug(f"Not a formula after processing: {decoded_formula}")
                return original_formula

            # Calculate previous quarter - FIXED LOGIC
            if target_quarter == 1:
                prev_quarter = 4
                prev_year = target_year - 1
            else:
                prev_quarter = target_quarter - 1
                prev_year = target_year

            logger.debug(
                f"Quarter calculation: Q{target_quarter}-{target_year} -> previous quarter: Q{prev_quarter}-{prev_year}"
            )

            # Replace quarter and year placeholders
            decoded_formula = decoded_formula.replace("{quarter-1}", str(prev_quarter))
            decoded_formula = decoded_formula.replace("{year}", str(prev_year))
            decoded_formula = decoded_formula.replace("{row}", str(target_row))

            # Replace generic quarter sheet references with actual sheet names
            prev_quarter_name = f"Q{prev_quarter}-{prev_year}"
            decoded_formula = decoded_formula.replace(
                "'Q{quarter-1}-{year}'!", f"'{prev_quarter_name}'!"
            )

            # CRITICAL FIX: Adjust row references from row 2 to target_row
            # This ensures formulas like =AY2*AL2 become =AY3*AL3 for row 3
            formula_before_adjustment = decoded_formula
            decoded_formula = self._adjust_formula_for_row(
                decoded_formula, 2, target_row
            )

            if formula_before_adjustment != decoded_formula:
                logger.debug(
                    f"Row adjustment applied for row {target_row}: {formula_before_adjustment} -> {decoded_formula}"
                )

            # More careful quote fixing - only fix specific patterns that are clearly wrong
            # Fix double quotes in string literals BUT preserve empty string literals
            decoded_formula = decoded_formula.replace('""TRUE""', '"TRUE"')
            decoded_formula = decoded_formula.replace('""FALSE""', '"FALSE"')

            # Don't automatically replace all "" - preserve empty string literals like BR:BR<>""
            # Only fix clearly wrong patterns like quadruple quotes
            decoded_formula = decoded_formula.replace('""""', '""')

            logger.debug(
                f"Final decoded formula for row {target_row}: {original_formula} -> {decoded_formula}"
            )
            return decoded_formula

        except Exception as e:
            logger.error(f"Error decoding Master Template formula: {e}")
            return formula

    def _copy_formulas_only_to_row(
        self, worksheet: gspread.Worksheet, target_row: int
    ) -> bool:
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
            logger.info(
                f"DEBUG: Starting _copy_formulas_only_to_row for row {target_row}"
            )

            # Get the correct column range based on the number of headers
            headers = self.create_quarterly_sheet_headers()
            max_col = self._col_to_a1(len(headers))

            logger.info(f"DEBUG: Using {len(headers)} headers, max column: {max_col}")

            # Get the current values in the target row (our actual data)
            target_range = f"A{target_row}:{max_col}{target_row}"
            current_values = worksheet.get(
                target_range, value_render_option="UNFORMATTED_VALUE"
            )
            if not current_values:
                current_values = [[]]
            current_row_data = current_values[0] if current_values else []

            logger.info(
                f"DEBUG: Current row {target_row} has {len(current_row_data)} data values"
            )

            # Get original formulas from Master Template (not from quarterly sheet row 2)
            template_sheet = self.get_master_template_sheet()
            if not template_sheet:
                logger.error("DEBUG: Could not access Master Template sheet")
                return False

            logger.info("DEBUG: Successfully accessed Master Template sheet")

            template_range = f"A2:{max_col}2"
            logger.info(
                f"DEBUG: Getting Master Template formulas from range: {template_range}"
            )

            # Get both formulas AND values since formulas might be stored as text
            template_formulas = template_sheet.get(
                template_range, value_render_option="FORMULA"
            )
            template_values = template_sheet.get(
                template_range, value_render_option="UNFORMATTED_VALUE"
            )

            logger.info(
                f"DEBUG: Retrieved formula data - formulas: {len(template_formulas[0]) if template_formulas and template_formulas[0] else 0}"
            )
            logger.info(
                f"DEBUG: Retrieved value data - values: {len(template_values[0]) if template_values and template_values[0] else 0}"
            )

            # Log template information
            if template_values and template_values[0]:
                logger.info(
                    f"DEBUG: Template has {len(template_values[0])} value columns"
                )
            if template_formulas and template_formulas[0]:
                logger.info(
                    f"DEBUG: Template has {len(template_formulas[0])} formula columns"
                )

            if template_formulas and template_formulas[0]:
                template_formula_row = template_formulas[0] if template_formulas else []
                template_value_row = template_values[0] if template_values else []

                logger.info(
                    f"DEBUG: Template formula row length: {len(template_formula_row)}"
                )
                logger.info(
                    f"DEBUG: Template value row length: {len(template_value_row)}"
                )

                # Count formulas in template
                formula_count_in_template = len(
                    [f for f in template_formula_row if f and str(f).startswith("=")]
                )
                logger.info(
                    f"DEBUG: Found {formula_count_in_template} formulas in Master Template row 2"
                )

                # Ensure both rows have the same length
                max_len = max(len(template_formula_row), len(template_value_row))
                template_formula_row.extend(
                    [""] * (max_len - len(template_formula_row))
                )
                template_value_row.extend([""] * (max_len - len(template_value_row)))

                # Get target quarter info from worksheet name (e.g., "Q4-2025")
                worksheet_name = worksheet.title
                try:
                    # Parse worksheet name like "Q4-2025"
                    if worksheet_name.startswith("Q") and "-" in worksheet_name:
                        parts = worksheet_name.split("-")
                        quarter = int(parts[0][1:])  # Remove 'Q' and convert to int
                        year = int(parts[1])
                        logger.info(
                            f"DEBUG: Target worksheet quarter info: Q{quarter}-{year}"
                        )
                    else:
                        # Use default values if worksheet name doesn't match expected format
                        quarter, year = 1, 2025
                        logger.warning(
                            f"DEBUG: Could not parse worksheet name '{worksheet_name}', using default: Q{quarter}-{year}"
                        )
                except:
                    # Use default values if parsing fails
                    quarter, year = 1, 2025
                    logger.warning(
                        f"DEBUG: Error parsing worksheet name '{worksheet_name}', using default: Q{quarter}-{year}"
                    )

                # Process each cell: apply data formulas from Master Template
                updated_row = []
                formulas_applied = 0
                errors_encountered = 0

                for i, value_cell in enumerate(template_value_row):
                    formula_cell = (
                        template_formula_row[i] if i < len(template_formula_row) else ""
                    )

                    try:
                        # Check if the value cell contains a formula (stored as text)
                        value_has_formula = (
                            value_cell
                            and isinstance(value_cell, str)
                            and (
                                value_cell.startswith("=")
                                or (value_cell.startswith('"') and "=" in value_cell)
                                or (value_cell.startswith("'") and "=" in value_cell)
                            )
                        )

                        # Check if the formula cell contains an actual formula
                        formula_has_formula = (
                            formula_cell
                            and isinstance(formula_cell, str)
                            and formula_cell.startswith("=")
                        )

                        if value_has_formula:
                            # The formula is stored as text in the value - decode it
                            decoded_formula = self._decode_master_template_formulas(
                                value_cell, quarter, year, target_row
                            )
                            if decoded_formula and decoded_formula.startswith("="):
                                updated_row.append(decoded_formula)
                                formulas_applied += 1
                                logger.debug(
                                    f"DEBUG: Column {i+1}: Applied decoded formula from VALUE for row {target_row}"
                                )
                            else:
                                # Keep existing data
                                if i < len(current_row_data):
                                    updated_row.append(current_row_data[i])
                                else:
                                    updated_row.append("")
                        elif formula_has_formula:
                            # The formula is in the formula cell - decode it
                            decoded_formula = self._decode_master_template_formulas(
                                formula_cell, quarter, year, target_row
                            )
                            if decoded_formula and decoded_formula.startswith("="):
                                updated_row.append(decoded_formula)
                                formulas_applied += 1
                                logger.debug(
                                    f"DEBUG: Column {i+1}: Applied decoded formula from FORMULA for row {target_row}"
                                )
                            else:
                                # Keep existing data
                                if i < len(current_row_data):
                                    updated_row.append(current_row_data[i])
                                else:
                                    updated_row.append("")
                        else:
                            # This is data - keep our actual data value
                            if i < len(current_row_data):
                                updated_row.append(current_row_data[i])
                            else:
                                updated_row.append("")
                            logger.debug(f"DEBUG: Column {i+1}: Preserved data value")

                    except Exception as cell_error:
                        errors_encountered += 1
                        logger.error(
                            f"DEBUG: Error processing column {i+1}: {cell_error}"
                        )
                        # Keep original data on error
                        if i < len(current_row_data):
                            updated_row.append(current_row_data[i])
                        else:
                            updated_row.append("")

                logger.info(
                    f"DEBUG: About to apply {formulas_applied} data formulas to row {target_row} ({errors_encountered} errors encountered)"
                )

                # Update the row with formulas preserved but our data intact
                worksheet.update(
                    target_range, [updated_row], value_input_option="USER_ENTERED"
                )

                formula_count = len(
                    [f for f in updated_row if f and str(f).startswith("=")]
                )
                logger.info(
                    f"DEBUG: Successfully applied {formula_count} decoded formulas to row {target_row} while preserving data"
                )
                return True
            else:
                logger.warning("No formulas found in template row 2")
                return False

        except Exception as e:
            logger.error(f"Error copying formulas only to row {target_row}: {e}")
            return False

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
        Note: This method is deprecated since automatic quarter detection was removed.
        Use route_record_to_specific_quarter() instead.

        Args:
            record_data: The record data to add
            operation_type: "CREATE" for new records, "UPDATE" for existing records

        Returns:
            Error message indicating deprecation
        """
        return {
            "success": False,
            "error": "Automatic quarter routing is no longer supported. Please use route_record_to_specific_quarter() with explicit quarter and year parameters.",
        }

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
                    f"Quarter sheet {quarter_name} not found and automatic creation is disabled"
                )
                return {
                    "success": False,
                    "error": f"Quarter sheet {quarter_name} does not exist. Please create it manually using Google Apps Script.",
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
                    return {
                        "success": False,
                        "error": f"Quarter sheet {quarter_name} not found. Please create it manually using Google Apps Script.",
                    }
            else:
                return {
                    "success": False,
                    "error": "Quarter and year parameters are required since automatic quarter detection is disabled.",
                }

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
            for row_index, row_data in enumerate(
                all_values[1:], start=2
            ):  # Skip header row
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
def route_record_to_current_quarter(record_data: Dict[str, Any]) -> Dict[str, Any]:
    """Route record to current quarter"""
    return quarterly_manager.route_new_record_to_current_quarter(record_data)


def get_quarter_summary_data(quarter: int, year: int) -> Dict[str, Any]:
    """Get summary for specific quarter"""
    return quarterly_manager.get_quarter_summary(quarter, year)
