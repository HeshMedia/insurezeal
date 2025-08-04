from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.security import HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession
from config import get_db
from routers.auth.auth import get_current_user
from dependencies.rbac import (
    require_admin_read,
    require_admin_write
)
from .schemas import (
    MasterSheetResponse,
    MasterSheetRecord,
    BulkUpdateRequest,
    BulkUpdateResponse,
    MasterSheetStatsResponse,
    AgentMISResponse,
    AgentMISRecord,
    AgentMISStats
)
from .helpers import MISHelpers
from typing import Optional, Dict, Any
import logging
import csv
import io

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/mis", tags=["MIS - Management Information System"])
security = HTTPBearer()

mis_helpers = MISHelpers()


@router.get("/master-sheet", response_model=MasterSheetResponse)
async def get_master_sheet_data(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=1000, description="Items per page"),
    search: Optional[str] = Query(None, description="Search across key fields"),
    agent_code: Optional[str] = Query(None, description="Filter by agent code"),
    insurer_name: Optional[str] = Query(None, description="Filter by insurer name"),
    policy_number: Optional[str] = Query(None, description="Filter by policy number"),
    reporting_month: Optional[str] = Query(None, description="Filter by reporting month"),
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check = Depends(require_admin_read)
):
    """
    Get paginated data from Master Google Sheet
    
    **Admin/SuperAdmin only endpoint**
    
    This endpoint fetches data directly from the Master Google Sheet which serves as
    the single source of truth for all policy and CutPay transaction data.
    
    **Features:**
    - Paginated results for large datasets
    - Search across multiple key fields
    - Filter by specific fields
    - All master sheet columns included
    
    **Search & Filters:**
    - **search**: Searches across policy number, agent code, customer name, insurer name, broker name, registration number
    - **agent_code**: Filter by specific agent code
    - **insurer_name**: Filter by specific insurer name  
    - **policy_number**: Filter by specific policy number
    - **reporting_month**: Filter by specific reporting month
    
    **Returns:**
    - Complete record data with all master sheet fields
    - Pagination metadata
    - Row numbers for update operations
    """
    
    try:
        # Build filters dictionary
        filters = {}
        if agent_code:
            filters['agent_code'] = agent_code
        if insurer_name:
            filters['insurer_name'] = insurer_name
        if policy_number:
            filters['policy_number'] = policy_number
        if reporting_month:
            filters['reporting_month'] = reporting_month
        
        logger.info(f"Fetching master sheet data - Page: {page}, Size: {page_size}, Search: '{search}', Filters: {filters}")
        
        # Get data from master sheet
        result = await mis_helpers.get_master_sheet_data(
            page=page,
            page_size=page_size,
            search=search,
            filter_by=filters if filters else None
        )
        
        if "error" in result:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Master sheet access error: {result['error']}"
            )
        
        logger.info(f"Successfully retrieved {len(result['records'])} records from master sheet")
        
        return MasterSheetResponse(
            records=result["records"],
            total_count=result["total_count"],
            page=result["page"],
            page_size=result["page_size"],
            total_pages=result["total_pages"]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_master_sheet_data: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch master sheet data"
        )


@router.put("/master-sheet/bulk-update", response_model=BulkUpdateResponse)
async def bulk_update_master_sheet(
    update_request: BulkUpdateRequest,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check = Depends(require_admin_write)
):
    """
    Perform bulk updates on Master Google Sheet
    
    **Admin/SuperAdmin only endpoint**
    
    This endpoint allows updating multiple fields across multiple records in the Master 
    Google Sheet in a single operation. Changes are applied directly to the sheet.
    
    **Features:**
    - Update multiple fields per record
    - Update multiple records in one request
    - Atomic updates per record (all fields for a record succeed or fail together)
    - Detailed results for each update operation
    - Performance tracking
    
    **Request Format:**
    ```json
    {
      "updates": [
        {
          "record_id": "123",
          "field_name": "Payment By",
          "new_value": "John Doe"
        },
        {
          "record_id": "123", 
          "field_name": "Remarks",
          "new_value": "Updated via MIS"
        },
        {
          "record_id": "456",
          "field_name": "Invoice Status",
          "new_value": "Paid"
        }
      ]
    }
    ```
    
    **Field Names:**
    Use exact header names from the Master sheet. Common fields include:
    - Agent Code, Policy Number, Customer Name
    - Gross Premium, Net Premium, CutPay Amount
    - Payment By, Payment Method, Invoice Status
    - Remarks, Notes, Company
    - And all other master sheet columns
    
    **Returns:**
    - Detailed results for each update operation
    - Success/failure status per field update
    - Old and new values for successful updates
    - Error messages for failed updates
    - Performance metrics
    """
    
    try:
        admin_user_id = current_user["user_id"]
        
        logger.info(f"Starting bulk update for {len(update_request.updates)} field updates by admin {admin_user_id}")
        
        # Perform bulk update
        result = await mis_helpers.bulk_update_master_sheet(
            updates=update_request.updates,
            admin_user_id=admin_user_id
        )
        
        logger.info(f"Bulk update completed: {result['successful_updates']} successful, {result['failed_updates']} failed")
        
        return BulkUpdateResponse(
            message=result["message"],
            total_updates=result["total_updates"],
            successful_updates=result["successful_updates"],
            failed_updates=result["failed_updates"],
            results=result["results"],
            processing_time_seconds=result["processing_time_seconds"]
        )
        
    except Exception as e:
        logger.error(f"Error in bulk_update_master_sheet: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to perform bulk update: {str(e)}"
        )


@router.get("/master-sheet/stats", response_model=MasterSheetStatsResponse)
async def get_master_sheet_statistics(
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check = Depends(require_admin_read)
):
    """
    Get comprehensive statistics from Master Google Sheet
    
    **Admin/SuperAdmin only endpoint**
    
    This endpoint provides analytical insights and summary statistics derived
    from the Master Google Sheet data.
    
    **Statistics Included:**
    - Total record counts (policies, CutPay transactions)
    - Financial summaries (total premiums, CutPay amounts)
    - Top performing agents by premium volume
    - Top insurers by premium volume  
    - Monthly breakdown and trends
    
    **Use Cases:**
    - Dashboard overview widgets
    - Performance reporting
    - Business intelligence
    - Data quality monitoring
    """
    
    try:
        logger.info("Generating master sheet statistics")
        
        # Get statistics from master sheet
        stats = await mis_helpers.get_master_sheet_stats()
        
        if "error" in stats:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Master sheet statistics error: {stats['error']}"
            )
        
        logger.info("Successfully generated master sheet statistics")
        
        return MasterSheetStatsResponse(**stats)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_master_sheet_statistics: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate master sheet statistics"
        )


@router.get("/master-sheet/fields")
async def get_master_sheet_fields(
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check = Depends(require_admin_read)
):
    """
    Get list of all available fields in Master Google Sheet
    
    **Admin/SuperAdmin only endpoint**
    
    Returns the complete list of field names (headers) available in the Master sheet.
    This is useful for building dynamic UIs and validating field names for updates.
    
    **Returns:**
    - List of all master sheet column headers
    - Field descriptions where available
    - Data type hints for each field
    """
    
    try:
        from utils.google_sheets import google_sheets_sync
        
        headers = google_sheets_sync._get_master_sheet_headers()
        
        # Add field descriptions and types
        field_info = []
        for header in headers:
            field_info.append({
                "field_name": header,
                "description": f"Master sheet field: {header}",
                "data_type": "string",  # Most fields are strings in sheets
                "updatable": True
            })
        
        return {
            "total_fields": len(headers),
            "fields": field_info,
            "note": "Use exact field names for bulk update operations"
        }
        
    except Exception as e:
        logger.error(f"Error getting master sheet fields: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get master sheet fields"
        )


@router.get("/master-sheet/export")
async def export_master_sheet_data(
    format: str = Query("csv", description="Export format: csv or json"),
    search: Optional[str] = Query(None, description="Filter data before export"),
    agent_code: Optional[str] = Query(None, description="Filter by agent code"),
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check = Depends(require_admin_read)
):
    """
    Export Master Google Sheet data in various formats
    
    **Admin/SuperAdmin only endpoint**
    
    Export filtered master sheet data for external analysis or backup purposes.
    
    **Formats:**
    - **csv**: Comma-separated values for Excel/analysis tools
    - **json**: JSON format for programmatic processing
    
    **Note:** Large datasets are automatically paginated to prevent timeouts.
    """
    
    try:
        # Fetch all data from master sheet using helper (no pagination)
        filters = {}
        if agent_code:
            filters['agent_code'] = agent_code
        result = await mis_helpers.get_master_sheet_data(
            page=1,
            page_size=10000000,  # Large number to get all records
            search=search,
            filter_by=filters if filters else None
        )
        records = result.get("records", [])
        if not records:
            return {"message": "No data found for export."}

        # Ensure MATCH STATUS is present at the end
        for rec in records:
            if "MATCH STATUS" not in rec:
                rec["MATCH STATUS"] = False
        headers = list(records[0].keys())

        if format == "csv":
            def csv_generator():
                output = io.StringIO()
                writer = csv.DictWriter(output, fieldnames=headers)
                writer.writeheader()
                yield output.getvalue()
                output.seek(0)
                output.truncate(0)
                for row in records:
                    writer.writerow(row)
                    yield output.getvalue()
                    output.seek(0)
                    output.truncate(0)
            return StreamingResponse(csv_generator(), media_type="text/csv", headers={
                "Content-Disposition": "attachment; filename=master_sheet_export.csv"
            })
        elif format == "json":
            return JSONResponse(content=records, headers={
                "Content-Disposition": "attachment; filename=master_sheet_export.json"
            })
        else:
            return {
                "error": "Invalid format. Supported formats: csv, json"
            }
        
    except Exception as e:
        logger.error(f"Error in export_master_sheet_data: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to export master sheet data"
        )

@router.get("/agent-mis/{agent_code}", response_model=AgentMISResponse)
async def get_agent_mis_data(
    agent_code: str,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=500, description="Items per page"),
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check = Depends(require_admin_read)
):
    """
    Get filtered MIS data for a specific agent
    
    **Admin/SuperAdmin only endpoint**
    
    Returns master sheet data filtered for the specified agent with:
    - Only records where MATCH STATUS = TRUE
    - Sensitive broker commission fields removed
    - Calculated statistics (number of policies, running balance, total net premium)
    
    Fields excluded for agent privacy:
    - Detailed broker commission structure
    - Internal broker payout percentages
    - Broker financial details
    - CutPay internal calculations
    """
    try:
        logger.info(f"Fetching agent MIS data for agent: {agent_code}")
        
        result = await mis_helpers.get_agent_mis_data(
            agent_code=agent_code,
            page=page,
            page_size=page_size
        )
        
        if not result:
            logger.warning(f"No data found for agent: {agent_code}")
            return AgentMISResponse(
                records=[],
                stats=AgentMISStats(
                    number_of_policies=0,
                    running_balance=0.0,
                    total_net_premium=0.0
                ),
                total_count=0,
                page=page,
                page_size=page_size,
                total_pages=0
            )
            
        # Convert records to AgentMISRecord objects
        agent_records = []
        for record_dict in result["records"]:
            agent_records.append(AgentMISRecord(**record_dict))
            
        stats = AgentMISStats(**result["stats"])
        
        return AgentMISResponse(
            records=agent_records,
            stats=stats,
            total_count=result["total_count"],
            page=result["page"],
            page_size=result["page_size"],
            total_pages=result["total_pages"]
        )
        
    except Exception as e:
        logger.error(f"Error in get_agent_mis_data: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch agent MIS data for agent {agent_code}"
        )
