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

            # First, add the actual record data
            range_notation = f"A{next_row}:{self._col_to_a1(len(headers))}{next_row}"
            current_sheet.update(
                range_notation, [row_data], value_input_option="USER_ENTERED"
            )

            # Then, copy ONLY the formulas from row 2 to the new row (preserving our data)
            logger.info(
                f"DEBUG: About to copy formulas to new record at row {next_row}"
            )
            formula_copy_success = self._copy_formulas_only_to_row(
                current_sheet, next_row
            )  # Data rows only
            logger.info(
                f"DEBUG: Formula copy to new record row {next_row} success: {formula_copy_success}"
            )

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
def get_current_quarter_sheet() -> Optional[gspread.Worksheet]:
    """Get current quarter sheet"""
    return quarterly_manager.get_current_quarter_sheet()


def route_record_to_current_quarter(record_data: Dict[str, Any]) -> Dict[str, Any]:
    """Route record to current quarter"""
    return quarterly_manager.route_new_record_to_current_quarter(record_data)


def get_quarter_summary_data(quarter: int, year: int) -> Dict[str, Any]:
    """Get summary for specific quarter"""
    return quarterly_manager.get_quarter_summary(quarter, year)
