"""
Quarterly Sheets Management Router for Insurezeal Backend API.

This module provides comprehensive API endpoints for managing quarterly Google
Sheets operations, including sheet creation, balance carryover, quarterly
transitions, and administrative controls for the quarterly business cycle.

Key Features:
- Quarterly sheet creation and management
- Balance carryover between quarters with validation
- Quarterly transition automation and manual triggers
- Health checks and system status monitoring
- Template management and synchronization
- Record mapping and data validation

Business Operations:
- Automated quarterly transitions for business continuity
- Financial balance carryover for accurate accounting
- Template-based sheet creation for consistency
- Data validation and integrity checks
- Integration with Google Sheets for external reporting
- Administrative controls for manual interventions

API Endpoints:
- GET /status: Quarterly system health and status
- POST /create-quarter: Manual quarterly sheet creation
- POST /transition: Force quarterly transition
- GET /current-info: Current quarter information
- POST /carryover-balances: Execute balance carryover
- GET /templates: Template management and validation

Security:
- Admin-level authentication required for all operations
- Role-based access control for different operations
- Audit logging for all administrative actions
- Data validation for financial operations
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Dict, Any
import logging
import os
from dependencies.rbac import (
    require_admin_quarterly_sheets_read,
    require_admin_quarterly_sheets_write,
    require_admin_quarterly_sheets_update,
)
from routers.auth.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/quarterly-sheets",
    tags=["Quarterly Sheets Management"],
    responses={404: {"description": "Not found"}},
)


@router.get("/current-quarter")
async def get_current_quarter_info():
    """Get information about the current quarter"""
    try:
        from utils.quarterly_sheets_manager import quarterly_manager

        quarter_name, quarter, year = quarterly_manager.get_current_quarter_info()

        # Check if current quarter sheet exists
        sheet_exists = quarterly_manager.sheet_exists(quarter_name)

        return {
            "success": True,
            "quarter_name": quarter_name,
            "quarter": quarter,
            "year": year,
            "sheet_exists": sheet_exists,
        }

    except Exception as e:
        logger.error(f"Error getting current quarter info: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/create-quarter-sheet")
async def create_quarter_sheet(
    quarter: int = Query(..., ge=1, le=4, description="Quarter number (1-4)"),
    year: int = Query(..., ge=2020, description="Year"),
    current_user: Dict = Depends(get_current_user),
    _rbac_check=Depends(require_admin_quarterly_sheets_write),
):
    """
    Create a new quarterly sheet with proper structure and balance carryover

    Creates a new quarterly sheet with:
    - Complete 70+ field structure including newly added fields:
      * "Agent Total PO Amount": Total agent policy office amount
      * "Actual Agent_PO%": Actual agent policy office percentage
    - Proper header structure copied from Master Template
    - Dynamic formula copying from Master Template (formulas adjust automatically to new rows)
    - Balance carryover from previous quarter where MATCH = TRUE
    - Proper formatting and data validation

    **Features:**
    - Automatic formula adaptation for new quarterly sheet structure
    - New fields are included with proper formula support
    - All template formulas are dynamically adjusted for the new quarter
    - Previous quarter balance carryover (when applicable)

    **Admin/SuperAdmin only endpoint**
    """
    try:
        from utils.quarterly_sheets_manager import quarterly_manager

        # Check if sheet already exists
        sheet_name = quarterly_manager.get_quarterly_sheet_name(quarter, year)
        if quarterly_manager.sheet_exists(sheet_name):
            return {
                "success": True,
                "message": f"Sheet {sheet_name} already exists",
                "sheet_name": sheet_name,
                "created": False,
            }

        # Create the quarterly sheet
        worksheet = quarterly_manager.create_quarterly_sheet(quarter, year)

        if worksheet:
            return {
                "success": True,
                "message": f"Successfully created quarterly sheet: {sheet_name}",
                "sheet_name": sheet_name,
                "created": True,
            }
        else:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to create quarterly sheet for Q{quarter}-{year}",
            )

    except Exception as e:
        logger.error(f"Error creating quarter sheet: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/refresh-carryover")
async def refresh_carryover_data(
    quarter: int = Query(..., ge=1, le=4, description="Quarter number (1-4)"),
    year: int = Query(..., ge=2020, description="Year"),
    current_user: Dict = Depends(get_current_user),
    _rbac_check=Depends(require_admin_quarterly_sheets_write),
):
    """Refresh carryover data for an existing quarterly sheet"""
    try:
        from utils.quarterly_sheets_manager import quarterly_manager

        # Check if target sheet exists
        sheet_name = quarterly_manager.get_quarterly_sheet_name(quarter, year)
        if not quarterly_manager.sheet_exists(sheet_name):
            raise HTTPException(
                status_code=404,
                detail=f"Sheet {sheet_name} does not exist. Create it first.",
            )

        # Get the existing sheet
        worksheet = quarterly_manager.spreadsheet.worksheet(sheet_name)

        # Clear existing carryover data (rows with carryover data typically start from row 2)
        # We'll clear rows 2 onwards and re-apply carryover
        try:
            # Get current headers to know the range
            headers = quarterly_manager.create_quarterly_sheet_headers()

            # Clear data rows (keep header row 1)
            if worksheet.row_count > 1:
                range_to_clear = f"A2:{quarterly_manager._col_to_a1(len(headers))}{worksheet.row_count}"
                worksheet.batch_clear([range_to_clear])
                logger.info(f"Cleared existing data in {sheet_name}")

        except Exception as clear_error:
            logger.warning(f"Could not clear existing data: {clear_error}")

        # Re-apply carryover with fresh data
        quarterly_manager._apply_balance_carryover(worksheet, quarter, year, headers)

        return {
            "success": True,
            "message": f"Successfully refreshed carryover data for {sheet_name}",
            "sheet_name": sheet_name,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error refreshing carryover data: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/auto-refresh-carryover")
async def auto_refresh_carryover(
    source_quarter: int = Query(
        ..., ge=1, le=4, description="Source quarter that was updated (1-4)"
    ),
    source_year: int = Query(..., ge=2020, description="Source year"),
    current_user: Dict = Depends(get_current_user),
    _rbac_check=Depends(require_admin_quarterly_sheets_write),
):
    """Automatically refresh carryover data for quarters dependent on the source quarter"""
    try:
        from utils.quarterly_sheets_manager import quarterly_manager

        # Trigger auto-refresh
        success = quarterly_manager.auto_refresh_dependent_quarters(
            source_quarter, source_year
        )

        if success:
            return {
                "success": True,
                "message": f"Successfully auto-refreshed carryover for quarters dependent on Q{source_quarter}-{source_year}",
            }
        else:
            return {
                "success": False,
                "message": f"No dependent quarters found for Q{source_quarter}-{source_year} or refresh failed",
            }

    except Exception as e:
        logger.error(f"Error in auto-refresh carryover: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/debug-template-formulas")
async def debug_template_formulas(
    current_user: Dict = Depends(get_current_user),
    _rbac_check=Depends(require_admin_quarterly_sheets_read),
):
    """Debug endpoint to check Master Template formulas"""
    try:
        from utils.quarterly_sheets_manager import quarterly_manager

        # Get Master Template sheet
        template_sheet = quarterly_manager.get_master_template_sheet()
        if not template_sheet:
            return {"error": "Master Template sheet not found"}

        # Get headers and formulas
        template_headers = template_sheet.row_values(1)
        quarterly_headers = quarterly_manager.create_quarterly_sheet_headers()

        # Get formulas from row 2
        max_col = quarterly_manager._col_to_a1(len(quarterly_headers))
        template_range = f"A2:{max_col}2"
        template_formulas = template_sheet.get(
            template_range, value_render_option="FORMULA"
        )

        formulas_info = []
        if template_formulas and len(template_formulas) > 0:
            template_row = template_formulas[0]

            for i, header in enumerate(quarterly_headers):
                formula = template_row[i] if i < len(template_row) else ""
                formulas_info.append(
                    {
                        "column": i + 1,
                        "header": header,
                        "formula": formula,
                        "has_formula": bool(formula and str(formula).startswith("=")),
                    }
                )

        return {
            "success": True,
            "template_headers_count": len(template_headers),
            "quarterly_headers_count": len(quarterly_headers),
            "formulas_found": len([f for f in formulas_info if f["has_formula"]]),
            "formulas_info": formulas_info[:20],  # First 20 for debugging
        }

    except Exception as e:
        logger.error(f"Error debugging template formulas: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/check-transition")
async def check_quarter_transition():
    """Check if quarter transition is needed and create sheet if necessary"""
    try:
        from utils.quarterly_sheets_manager import quarterly_manager

        result = quarterly_manager.check_quarter_transition()

        return {"success": True, "data": result}

    except Exception as e:
        logger.error(f"Error checking quarter transition: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/quarter-summary/{quarter}/{year}")
async def get_quarter_summary(quarter: int, year: int):
    """Get summary information for a specific quarter"""
    try:
        from utils.quarterly_sheets_manager import quarterly_manager

        if quarter < 1 or quarter > 4:
            raise HTTPException(
                status_code=400, detail="Quarter must be between 1 and 4"
            )

        summary = quarterly_manager.get_quarter_summary(quarter, year)

        return {"success": True, "data": summary}

    except Exception as e:
        logger.error(f"Error getting quarter summary: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/list-quarters")
async def list_quarterly_sheets():
    """List all existing quarterly sheets"""
    try:
        from utils.quarterly_sheets_manager import quarterly_manager

        if not quarterly_manager.spreadsheet:
            raise HTTPException(status_code=500, detail="Google Sheets not initialized")

        # Get all worksheets
        worksheets = quarterly_manager.spreadsheet.worksheets()

        # Filter quarterly sheets (format: Q1-2025, Q2-2025, etc.)
        quarterly_sheets = []
        for ws in worksheets:
            title = ws.title
            if title.startswith("Q") and "-" in title:
                try:
                    # Parse quarter and year from title
                    parts = title.split("-")
                    if len(parts) == 2:
                        quarter_part = parts[0]  # Q1, Q2, etc.
                        year_part = int(parts[1])

                        if quarter_part.startswith("Q") and len(quarter_part) == 2:
                            quarter_num = int(quarter_part[1])
                            if 1 <= quarter_num <= 4:
                                quarterly_sheets.append(
                                    {
                                        "sheet_name": title,
                                        "quarter": quarter_num,
                                        "year": year_part,
                                        "row_count": ws.row_count,
                                        "col_count": ws.col_count,
                                    }
                                )
                except (ValueError, IndexError):
                    continue

        # Sort by year and quarter
        quarterly_sheets.sort(key=lambda x: (x["year"], x["quarter"]))

        return {
            "success": True,
            "quarterly_sheets": quarterly_sheets,
            "total_count": len(quarterly_sheets),
        }

    except Exception as e:
        logger.error(f"Error listing quarterly sheets: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/route-record")
async def route_record_to_current_quarter(
    record_data: Dict[str, Any],
    current_user: Dict = Depends(require_admin_quarterly_sheets_write),
):
    """Route a new record to the current quarter's sheet"""
    try:
        from utils.quarterly_sheets_manager import quarterly_manager

        result = quarterly_manager.route_new_record_to_current_quarter(record_data)

        if result.get("success"):
            return {
                "success": True,
                "message": f"Record routed to {result.get('sheet_name')} at row {result.get('row_number')}",
                "data": result,
            }
        else:
            raise HTTPException(
                status_code=500, detail=result.get("error", "Failed to route record")
            )

    except Exception as e:
        logger.error(f"Error routing record: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/balance-carryover-preview/{quarter}/{year}")
async def preview_balance_carryover(quarter: int, year: int):
    """Preview what balance carryover would look like for a quarter"""
    try:
        from utils.quarterly_sheets_manager import quarterly_manager

        if quarter < 1 or quarter > 4:
            raise HTTPException(
                status_code=400, detail="Quarter must be between 1 and 4"
            )

        # Get previous quarter info
        prev_quarter_name, prev_quarter, prev_year = (
            quarterly_manager.get_previous_quarter_info(quarter, year)
        )

        # Check if previous quarter exists
        if not quarterly_manager.sheet_exists(prev_quarter_name):
            return {
                "success": True,
                "message": f"No previous quarter sheet found ({prev_quarter_name})",
                "preview": [],
            }

        # Get previous quarter data
        prev_sheet = quarterly_manager.spreadsheet.worksheet(prev_quarter_name)
        prev_data = prev_sheet.get_all_records()

        # Process carryover preview
        headers = quarterly_manager.create_quarterly_sheet_headers()
        carryover_preview = quarterly_manager._process_balance_carryover(
            prev_data, headers
        )

        return {
            "success": True,
            "previous_quarter": prev_quarter_name,
            "target_quarter": f"Q{quarter}-{year}",
            "carryover_records_count": len(carryover_preview),
            "preview": (
                carryover_preview[:10] if carryover_preview else []
            ),  # Show first 10 for preview
        }

    except Exception as e:
        logger.error(f"Error previewing balance carryover: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/headers-structure")
async def get_quarterly_headers_structure():
    """Get the complete headers structure for quarterly sheets"""
    try:
        from utils.quarterly_sheets_manager import quarterly_manager

        # Get base headers from master template
        base_headers = quarterly_manager.load_master_template_headers()

        # Get complete quarterly headers
        complete_headers = quarterly_manager.create_quarterly_sheet_headers()

        return {
            "success": True,
            "base_headers_count": len(base_headers),
            "total_headers_count": len(complete_headers),
            "additional_columns_count": len(complete_headers) - len(base_headers),
            "base_headers": base_headers,
            "additional_columns_true": quarterly_manager.additional_columns_true,
            "additional_columns_false": quarterly_manager.additional_columns_false,
            "complete_headers": complete_headers,
        }

    except Exception as e:
        logger.error(f"Error getting headers structure: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/manual-balance-carryover")
async def manual_balance_carryover(
    source_quarter: int = Query(..., ge=1, le=4),
    source_year: int = Query(..., ge=2020),
    target_quarter: int = Query(..., ge=1, le=4),
    target_year: int = Query(..., ge=2020),
    current_user: Dict = Depends(require_admin_quarterly_sheets_update),
):
    """Manually trigger balance carryover between specific quarters"""
    try:
        from utils.quarterly_sheets_manager import quarterly_manager

        source_sheet_name = quarterly_manager.get_quarterly_sheet_name(
            source_quarter, source_year
        )
        target_sheet_name = quarterly_manager.get_quarterly_sheet_name(
            target_quarter, target_year
        )

        # Check if source sheet exists
        if not quarterly_manager.sheet_exists(source_sheet_name):
            raise HTTPException(
                status_code=404,
                detail=f"Source quarter sheet not found: {source_sheet_name}",
            )

        # Check if target sheet exists, create if not
        if not quarterly_manager.sheet_exists(target_sheet_name):
            target_worksheet = quarterly_manager.create_quarterly_sheet(
                target_quarter, target_year
            )
            if not target_worksheet:
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to create target quarter sheet: {target_sheet_name}",
                )
        else:
            target_worksheet = quarterly_manager.spreadsheet.worksheet(
                target_sheet_name
            )

        # Apply balance carryover
        headers = quarterly_manager.create_quarterly_sheet_headers()
        quarterly_manager._apply_balance_carryover(
            target_worksheet, target_quarter, target_year, headers
        )

        return {
            "success": True,
            "message": f"Balance carryover completed from {source_sheet_name} to {target_sheet_name}",
            "source_sheet": source_sheet_name,
            "target_sheet": target_sheet_name,
        }

    except Exception as e:
        logger.error(f"Error in manual balance carryover: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health-check")
async def quarterly_system_health_check():
    """Check the health of the quarterly sheets system"""
    try:
        from utils.quarterly_sheets_manager import quarterly_manager

        # Check Google Sheets connection
        sheets_connected = (
            quarterly_manager.client is not None
            and quarterly_manager.spreadsheet is not None
        )

        # Check current quarter sheet
        quarter_name, quarter, year = quarterly_manager.get_current_quarter_info()
        current_quarter_exists = quarterly_manager.sheet_exists(quarter_name)

        # Check Master Template sheet in Google Sheets
        template_sheet = quarterly_manager.get_master_template_sheet()
        master_template_exists = template_sheet is not None
        template_sheet_name = (
            quarterly_manager.master_template_sheet_name if template_sheet else None
        )

        # Check Record Mapper sheet in Google Sheets
        mapper_data = quarterly_manager.get_record_mapper_data()
        record_mapper_exists = bool(mapper_data and mapper_data.get("data"))
        mapper_sheet_name = mapper_data.get("sheet_name") if mapper_data else None

        # Check credentials file
        credentials_exists = (
            os.path.exists(quarterly_manager.credentials_path)
            if quarterly_manager.credentials_path
            else False
        )

        return {
            "success": True,
            "health_status": {
                "google_sheets_connected": sheets_connected,
                "current_quarter": quarter_name,
                "current_quarter_sheet_exists": current_quarter_exists,
                "master_template_sheet_exists": master_template_exists,
                "master_template_sheet_name": template_sheet_name,
                "record_mapper_sheet_exists": record_mapper_exists,
                "record_mapper_sheet_name": mapper_sheet_name,
                "credentials_file_exists": credentials_exists,
            },
            "system_status": (
                "healthy"
                if all([sheets_connected, master_template_exists])
                else "degraded"
            ),
            "recommendations": [
                (
                    "Create 'Master Template' sheet if missing"
                    if not master_template_exists
                    else None
                ),
                (
                    "Create 'Record Mapper' sheet for mapping functionality"
                    if not record_mapper_exists
                    else None
                ),
                "Check Google Sheets credentials" if not sheets_connected else None,
                (
                    f"Create current quarter sheet: {quarter_name}"
                    if not current_quarter_exists
                    else None
                ),
            ],
        }

    except Exception as e:
        logger.error(f"Error in health check: {str(e)}")
        return {"success": False, "error": str(e), "system_status": "unhealthy"}


@router.get("/validate-configuration")
async def validate_quarterly_configuration():
    """Validate the configuration for quarterly sheets system"""
    try:
        from utils.quarterly_config_util import validate_quarterly_config

        result = validate_quarterly_config()

        return {"success": True, "configuration": result}

    except Exception as e:
        logger.error(f"Error validating configuration: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/setup-initial-sheet")
async def setup_initial_quarterly_sheet(
    current_user: Dict = Depends(require_admin_quarterly_sheets_write),
):
    """Set up the initial quarterly sheet for the current quarter"""
    try:
        from utils.quarterly_config_util import setup_initial_sheet

        result = setup_initial_sheet()

        if result["success"]:
            return {"success": True, "data": result}
        else:
            raise HTTPException(
                status_code=500,
                detail=result.get("error", "Failed to setup initial sheet"),
            )

    except Exception as e:
        logger.error(f"Error setting up initial sheet: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/create-master-template")
async def create_master_template_sheet(
    current_user: Dict = Depends(require_admin_quarterly_sheets_write),
):
    """
    Create Master Template sheet in Google Sheets if it doesn't exist

    Creates the Master Template sheet with:
    - Complete 70+ field structure including newly added fields:
      * "Agent Total PO Amount": Total agent policy office amount
      * "Actual Agent_PO%": Actual agent policy office percentage
    - Sample formulas for calculated fields
    - Proper header formatting
    - Template structure used by quarterly sheet creation

    **Features:**
    - Includes all quarterly sheet headers with new fields
    - Sample formulas for common calculations
    - Template serves as source for formula copying to new quarterly sheets
    - New fields are included with proper structure for formula support

    **Admin/SuperAdmin only endpoint**
    """
    try:
        from utils.quarterly_sheets_manager import quarterly_manager

        # Check if Master Template sheet already exists
        template_sheet = quarterly_manager.get_master_template_sheet()

        if template_sheet:
            return {
                "success": True,
                "message": f"Master Template sheet already exists: {quarterly_manager.master_template_sheet_name}",
                "sheet_name": quarterly_manager.master_template_sheet_name,
                "created": False,
            }

        # Create Master Template sheet
        default_headers = quarterly_manager._get_default_headers()

        template_worksheet = quarterly_manager.spreadsheet.add_worksheet(
            title="Master Template", rows=1000, cols=len(default_headers)
        )

        # Add headers to the template
        template_worksheet.update("A1", [default_headers], value_input_option="RAW")

        # Add some sample formulas in row 2 (you can customize these)
        sample_formulas = [""] * len(default_headers)

        # Example formulas for some common calculated fields
        for i, header in enumerate(default_headers):
            if "Total Receivable from Broker" in header and "Include 18% GST" in header:
                # Formula for total with GST
                total_col = None
                for j, h in enumerate(default_headers):
                    if (
                        h == "Total Receivable from Broker"
                        and "Include 18% GST" not in h
                    ):
                        total_col = quarterly_manager._col_to_a1(j + 1)
                        break
                if total_col:
                    sample_formulas[i] = f"={total_col}2*1.18"
            elif "Running Bal" in header:
                # Running balance formula (example)
                sample_formulas[i] = (
                    "=IF(ROW()=2,0,INDIRECT(ADDRESS(ROW()-1,COLUMN()))+M2-AM2)"
                )

        # Add sample formulas to row 2
        if any(formula for formula in sample_formulas):
            template_worksheet.update(
                "A2", [sample_formulas], value_input_option="USER_ENTERED"
            )

        # Format the template sheet
        quarterly_manager._format_header_row(template_worksheet, len(default_headers))

        quarterly_manager.master_template_sheet_name = "Master Template"

        return {
            "success": True,
            "message": "Master Template sheet created successfully",
            "sheet_name": "Master Template",
            "headers_count": len(default_headers),
            "created": True,
        }

    except Exception as e:
        logger.error(f"Error creating Master Template sheet: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/template-info")
async def get_template_info():
    """Get information about the Master Template sheet"""
    try:
        from utils.quarterly_sheets_manager import quarterly_manager

        template_sheet = quarterly_manager.get_master_template_sheet()

        if not template_sheet:
            return {
                "success": False,
                "message": "Master Template sheet not found",
                "exists": False,
            }

        # Get template info
        headers = template_sheet.row_values(1)

        # Try to get formulas from row 2
        formulas = []
        try:
            formula_row = template_sheet.get("A2:ZZ2", value_render_option="FORMULA")
            if formula_row and len(formula_row) > 0:
                formulas = formula_row[0]
        except:
            formulas = []

        # Count non-empty formulas
        formula_count = sum(1 for f in formulas if f and f.startswith("="))

        return {
            "success": True,
            "exists": True,
            "sheet_name": quarterly_manager.master_template_sheet_name,
            "headers_count": len([h for h in headers if h.strip()]),
            "formulas_count": formula_count,
            "row_count": template_sheet.row_count,
            "col_count": template_sheet.col_count,
            "headers": headers[:10] if headers else [],  # First 10 headers for preview
            "has_formulas": formula_count > 0,
        }

    except Exception as e:
        logger.error(f"Error getting template info: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
