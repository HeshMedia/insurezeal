"""
Policy Management Router for Insurezeal Backend API.

This module provides comprehensive policy management functionality for the insurance
platform, including policy creation, document processing, AI-powered data extraction,
and policy lifecycle management. It handles the core business operations related
to insurance policies with advanced automation and validation features.

Key Features:
- AI-powered PDF policy document extraction using Google Gemini
- Policy creation with automatic data validation
- File upload and storage integration with AWS S3
- Policy search, filtering, and pagination
- Child ID and agent assignment management
- Commission calculation and financial tracking
- Policy status tracking and lifecycle management
- Export functionality for reporting and analysis

Business Operations:
- Policy document processing and data extraction
- Insurance company and broker integration
- Agent assignment and commission tracking
- Policy validation and compliance checking
- Financial calculations and reporting
- Document storage and retrieval
- Policy lifecycle management from creation to completion

AI Integration:
- Automatic data extraction from policy PDFs
- Insurance company recognition and standardization
- Policy type identification and categorization
- Data validation and error correction
- OCR capabilities for scanned documents

Technical Features:
- Asynchronous file processing
- Multi-format document support
- Advanced search and filtering
- Pagination for large datasets
- Role-based access control
- Comprehensive error handling and logging
- Performance optimization for bulk operations

Security:
- User authentication and authorization
- Role-based permission checking
- Secure file upload validation
- Data privacy and protection
- Audit logging for all operations
"""

import json
import logging
import traceback
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from fastapi.concurrency import run_in_threadpool
from fastapi.security import HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from config import get_db
from dependencies.rbac import require_permission
from routers.auth.auth import get_current_user
from routers.policies.helpers import PolicyHelpers
from routers.policies.schemas import (
    AgentOption,
    AIExtractionResponse,
    ChildIdOption,
    PolicyCreateRequest,
    PolicyCreateResponse,
    PolicyDatabaseResponse,
    PolicyNumberCheckResponse,
    PolicySummaryResponse,
    PolicyUpdate,
    PolicyUploadResponse,
)
from utils.s3_utils import build_cloudfront_url, build_key, generate_presigned_put_url

# FastAPI Router Configuration for Policy Management
# Handles all policy-related endpoints with /policies prefix
# Tags: Used for API documentation grouping and organization
router = APIRouter(prefix="/policies", tags=["Policies"])

# HTTP Bearer Token Security for Authentication
# Ensures all policy operations require valid user authentication
security = HTTPBearer()

# Policy Helper Instance
# Provides business logic and database operations for policy management
policy_helpers = PolicyHelpers()

# Logger Configuration
# Tracks policy operations, errors, and business events
logger = logging.getLogger(__name__)

require_policy_read = require_permission("policies", "read")
require_policy_write = require_permission("policies", "write")
require_policy_manage = require_permission("policies", "manage")
require_quarterly_sheets_write = require_permission("admin/quarterly-sheets", "write")


@router.post("/extract-pdf-data", response_model=AIExtractionResponse)
async def extract_pdf_data_endpoint(
    file: UploadFile = File(..., description="Policy PDF file for extraction"),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check=Depends(require_policy_write),
):
    """
    Extract policy data from PDF using AI

    **Requires policy write permission**

    - **file**: Policy PDF file to extract data from
    Returns extracted policy data for review
    """
    try:
        if not file.filename or not file.filename.lower().endswith(".pdf"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Please upload a valid PDF file",
            )

        pdf_bytes = await file.read()

        if len(pdf_bytes) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty"
            )

        from utils.ai_utils import extract_policy_data_from_pdf_bytes

        extracted_data_dict = await extract_policy_data_from_pdf_bytes(pdf_bytes)

        if not extracted_data_dict:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to extract data from PDF. Please ensure the PDF contains readable policy information.",
            )

        confidence_score = extracted_data_dict.pop("confidence_score", 0.5)

        return AIExtractionResponse(
            extracted_data=extracted_data_dict,
            confidence_score=confidence_score,
            success=True,
            message="Policy data extracted successfully from PDF",
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error extracting PDF data: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to extract data from PDF",
        )


@router.post("/upload", response_model=PolicyUploadResponse)
async def upload_policy_document(
    policy_id: str = Form(
        ..., description="Policy ID to associate with the uploaded PDF"
    ),
    document_type: str = Form(
        "policy_pdf", description="Type of document: 'policy_pdf' or 'additional'"
    ),
    type: str = Form(
        ..., description="Document type - any string provided by frontend (required)"
    ),
    filename: str = Form(..., description="Filename for the document to upload"),
    content_type: str | None = Form(None),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check=Depends(require_policy_write),
):
    """
    Upload policy PDF file or additional documents using presigned URLs

    **Requires policy write permission**

    - **policy_id**: Policy ID to associate the file with
    - **document_type**: Type of document ('policy_pdf' for main policy PDF, 'additional' for additional documents)
    - **type**: Document type - accepts any string from frontend (required)
    - **filename**: Filename for the document to upload
    - **content_type**: MIME type of the file (optional, defaults to application/pdf)

    Always returns a presigned URL for direct upload to S3. For additional documents,
    the 'type' parameter will be used as the key in the additional_documents JSON field.
    If the same type is uploaded again, it will update the existing entry.
    """
    try:
        # Validate document type
        if document_type not in ["policy_pdf", "additional"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="document_type must be either 'policy_pdf' or 'additional'",
            )

        # Validate filename
        if not filename or not filename.lower().endswith(".pdf"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only PDF files are allowed",
            )

        user_id = current_user["user_id"]
        user_role = current_user.get("role", "agent")
        filter_user_id = user_id if user_role not in ["admin", "superadmin"] else None

        # Check if policy exists and user has access
        existing_policy = await PolicyHelpers.get_policy_by_id(
            db, policy_id, filter_user_id
        )
        if not existing_policy:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Policy not found or you don't have access to it",
            )

        # Generate S3 key and presigned URL
        key = build_key(prefix=f"policies/{user_id}", filename=filename)
        upload_url = generate_presigned_put_url(
            key=key, content_type=content_type or "application/pdf"
        )
        file_path = build_cloudfront_url(key)

        # Prepare update data based on document type
        update_data = {}
        if document_type == "policy_pdf":
            # For main policy PDF, replace existing
            update_data["policy_pdf_url"] = file_path
        else:  # additional documents
            # For additional documents, use type as key in JSON object
            current_additional_docs = existing_policy.additional_documents or ""
            existing_docs = {}

            # Parse existing documents (handle both JSON object and legacy formats)
            if current_additional_docs:
                try:
                    # Try to parse as JSON first
                    parsed_docs = json.loads(current_additional_docs)
                    if isinstance(parsed_docs, dict):
                        existing_docs = parsed_docs
                    elif isinstance(parsed_docs, list):
                        # Convert legacy list format to dict (use filename as key)
                        for doc in parsed_docs:
                            if isinstance(doc, dict) and doc.get("filename"):
                                existing_docs[doc.get("filename", "unknown")] = doc
                            elif isinstance(doc, str):
                                existing_docs[f"legacy_{len(existing_docs)}"] = doc
                except (json.JSONDecodeError, TypeError):
                    # Fallback for comma-separated format - convert to dict
                    doc_list = [
                        doc.strip()
                        for doc in current_additional_docs.split(",")
                        if doc.strip()
                    ]
                    for i, doc in enumerate(doc_list):
                        existing_docs[f"legacy_{i}"] = doc

            # Add/update document with the provided type as key
            type_clean = type.strip() if type else ""
            if not type_clean:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="'type' parameter is required for additional documents",
                )

            new_doc_info = {
                "filename": filename,
                "url": file_path,
                "uploaded_at": datetime.now().isoformat(),
                "uploaded_by": str(user_id),
                "document_type": type_clean,
            }

            # Update or add the document for this type (overwrites if type exists)
            existing_docs[type_clean] = new_doc_info

            # Store as JSON string
            update_data["additional_documents"] = json.dumps(existing_docs)

        # Update policy record
        await PolicyHelpers.update_policy(
            db,
            policy_id,
            update_data,
            filter_user_id,
        )

        return PolicyUploadResponse(
            policy_id=policy_id,
            extracted_data={},
            confidence_score=None,
            pdf_file_path=file_path,
            pdf_file_name=filename,
            message=f"Presigned URL generated for {document_type}"
            + (f" (type: {type})" if document_type != "policy_pdf" else "")
            + ". Upload directly to S3.",
            upload_url=upload_url,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating presigned URL for policy document: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate upload URL for policy document",
        )


@router.post("/submit", response_model=PolicyCreateResponse)
async def submit_policy(
    policy_data: PolicyCreateRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check=Depends(require_policy_write),
):
    """
    Submit final policy data after user review

    **Requires policy write permission**

    - **policy_data**: Complete policy information from frontend

    Saves essential fields to database and full data to Google Sheets
    """
    try:
        user_id = current_user["user_id"]
        user_role = current_user.get("role", "agent")

        # Extract essential fields for database storage (only fields that exist in Policy model)
        essential_fields = {
            "policy_number": policy_data.policy_number,
            "child_id": policy_data.child_id,
            "agent_code": policy_data.agent_code,
            "additional_documents": getattr(policy_data, "additional_documents", None),
            "policy_pdf_url": getattr(
                policy_data, "pdf_file_path", None
            ),  # Map from pdf_file_path
            "booking_date": getattr(policy_data, "booking_date", None),
            "policy_start_date": policy_data.start_date,
            "policy_end_date": policy_data.end_date,
        }

        # Save to database with only essential fields
        policy = await PolicyHelpers.create_simplified_policy(
            db=db, essential_data=essential_fields
        )

        logger.info(f"Created policy {policy.id} with essential fields in database")

        # Save full data to Google Sheets using our helper function
        try:
            from routers.policies.helpers import (
                prepare_complete_policy_sheets_data,
                validate_and_resolve_codes_with_names,
            )
            from utils.quarterly_sheets_manager import quarterly_manager

            # Resolve broker and insurer names from codes
            broker_id, insurer_id, broker_name, insurer_name = (
                await validate_and_resolve_codes_with_names(
                    db=db,
                    broker_code=policy_data.broker_code,
                    insurer_code=policy_data.insurer_code,
                )
            )

            logger.info(
                f"Resolved broker: {broker_name} (ID: {broker_id}), insurer: {insurer_name} (ID: {insurer_id})"
            )

            # Prepare complete data for Google Sheets using our helper function
            complete_sheets_data = prepare_complete_policy_sheets_data(
                policy_data=policy_data,
                policy_db_record=policy,
                broker_name=broker_name or "",
                insurer_name=insurer_name or "",
            )

            logger.info(
                f"Prepared {len(complete_sheets_data)} fields for quarterly Google Sheets"
            )

            # Route to current quarterly sheet
            quarterly_result = await run_in_threadpool(
                quarterly_manager.route_new_record_to_current_quarter,
                complete_sheets_data,
            )

            if quarterly_result and quarterly_result.get("success"):
                logger.info(
                    f"Policy {policy.id} successfully routed to quarterly sheet: {quarterly_result.get('sheet_name')}"
                )
            else:
                logger.error(
                    f"Failed to route policy {policy.id} to quarterly sheet: {quarterly_result.get('error') if quarterly_result else 'No result'}"
                )

        except Exception as sync_error:
            logger.error(
                f"Failed to route policy {policy.id} to quarterly sheet: {str(sync_error)}"
            )
            # Don't fail the main operation if Google Sheets sync fails

        return PolicyCreateResponse(
            id=policy.id,
            policy_number=policy.policy_number,
            message="Policy created successfully",
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error submitting policy: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to submit policy",
        )


@router.get("/", response_model=List[PolicySummaryResponse])
async def list_policies(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(
        100, ge=1, le=1000, description="Maximum number of records to return"
    ),
    quarter: Optional[int] = Query(
        None, ge=1, le=4, description="Filter by quarter (1-4)"
    ),
    year: Optional[int] = Query(None, ge=2020, le=2030, description="Filter by year"),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check=Depends(require_policy_read),
):
    """
    Get list of policies (simplified summary from database)

    **Requires policy read permission**

    Returns simplified policy summaries stored in database with only essential fields
    Including calculated quarter and year based on created_at timestamp

    **Optional Filtering:**
    - **quarter**: Filter policies by quarter (1-4) - Q1, Q2, Q3, Q4
    - **year**: Filter policies by year
    - If both quarter and year are provided, returns policies from that specific quarter/year
    - If only quarter is provided, returns policies from that quarter across all years
    - If only year is provided, returns policies from that year across all quarters
    - If neither is provided, returns all policies
    """

    def calculate_quarter_and_year(created_at: datetime) -> tuple:
        """Calculate quarter (Q1, Q2, Q3, Q4) and year from datetime"""
        month = created_at.month
        year = created_at.year

        if month in [1, 2, 3]:
            quarter = "Q1"
        elif month in [4, 5, 6]:
            quarter = "Q2"
        elif month in [7, 8, 9]:
            quarter = "Q3"
        else:  # month in [10, 11, 12]
            quarter = "Q4"

        return quarter, year

    try:
        from sqlalchemy import and_, extract, select

        from models import Policy
        from routers.policies.helpers import database_policy_response

        # Build query with optional quarter/year filtering
        query = select(Policy)

        # Role-based access control: agents see only their own policies
        user_role = current_user.get("role", "agent")
        if user_role not in ["admin", "superadmin"]:
            # Fetch the agent_code for the current user from UserProfile
            from models import UserProfile

            agent_code_result = await db.execute(
                select(UserProfile.agent_code).where(UserProfile.user_id == current_user["user_id"])  # type: ignore[index]
            )
            agent_code = agent_code_result.scalar_one_or_none()

            if not agent_code:
                # No agent_code associated; return empty list
                return []

            # Restrict to policies belonging to this agent
            query = query.where(Policy.agent_code == agent_code)

        # Apply date-based filtering if quarter/year are provided
        if quarter is not None or year is not None:
            filters = []

            if year is not None:
                filters.append(extract("year", Policy.created_at) == year)

            if quarter is not None:
                # Map quarter to months
                if quarter == 1:
                    filters.append(extract("month", Policy.created_at).in_([1, 2, 3]))
                elif quarter == 2:
                    filters.append(extract("month", Policy.created_at).in_([4, 5, 6]))
                elif quarter == 3:
                    filters.append(extract("month", Policy.created_at).in_([7, 8, 9]))
                elif quarter == 4:
                    filters.append(
                        extract("month", Policy.created_at).in_([10, 11, 12])
                    )

            if filters:
                query = query.where(and_(*filters))

        # Apply pagination and ordering
        query = query.offset(skip).limit(limit).order_by(Policy.created_at.desc())

        # Execute query
        result = await db.execute(query)
        policies = result.scalars().all()

        # Use helper function to return only database fields and add quarter/year
        policy_responses = []
        for policy in policies:
            policy_data = database_policy_response(policy)

            # Calculate quarter and year from created_at
            quarter_calc, year_calc = calculate_quarter_and_year(policy.created_at)
            policy_data["quarter"] = quarter_calc
            policy_data["year"] = year_calc

            policy_responses.append(PolicySummaryResponse(**policy_data))

        # Log filtering information
        filter_info = []
        if quarter is not None:
            filter_info.append(f"quarter=Q{quarter}")
        if year is not None:
            filter_info.append(f"year={year}")

        filter_description = (
            f" (filtered by {', '.join(filter_info)})" if filter_info else ""
        )
        logger.info(
            f"Returned {len(policy_responses)} policies with essential database fields including quarter/year calculations{filter_description}"
        )

        return policy_responses

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing policies: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch policies",
        )


# =============================================================================
# NEW POLICY ROUTES USING POLICY NUMBER + QUARTER/YEAR PATTERN (LIKE CUTPAY)
# =============================================================================


@router.get("/policy-details", response_model=Dict[str, Any])
async def get_policy_transaction_by_policy_number(
    policy_number: str = Query(..., description="Policy number to search for"),
    quarter: int = Query(
        ..., ge=1, le=4, description="Quarter number (1-4) where the policy is located"
    ),
    year: int = Query(
        ..., ge=2020, le=2030, description="Year where the policy is located"
    ),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check=Depends(require_policy_read),
):
    """
    Get complete Policy details by policy number from both database and specific quarterly Google Sheet

    This endpoint:
    1. Combines quarter and year into sheet name format (Q3-2025)
    2. Searches for the specific quarterly Google Sheet
    3. Fetches data from both the specific sheet AND database for the same policy number
    4. Returns combined results from both sources

    Parameters:
    - policy_number: The policy number to search for
    - quarter: Quarter number (1-4)
    - year: Year

    Returns combined data from both database and the specific quarterly sheet
    """
    try:
        # Step 1: Create quarter sheet name from quarter and year
        quarter_sheet_name = f"Q{quarter}-{year}"
        logger.info(
            f"Searching for policy '{policy_number}' in quarter sheet '{quarter_sheet_name}' and database"
        )

        # Step 2: Get record from database
        database_record = None
        broker_name = ""
        insurer_name = ""

        try:
            from sqlalchemy import desc, select

            from models import Policy
            from routers.policies.helpers import database_policy_response

            result = await db.execute(
                select(Policy)
                .where(Policy.policy_number == policy_number)
                .order_by(
                    desc(Policy.created_at)
                )  # Get the most recent one if multiple exist
            )
            policy = result.first()  # Use first() instead of scalar_one_or_none()

            if policy:
                policy = policy[0]  # Extract the Policy object from the Row
                await db.refresh(policy)
                database_record = database_policy_response(policy)

                logger.info(
                    f"Found policy '{policy_number}' in database with ID: {policy.id}"
                )
            else:
                logger.info(f"Policy '{policy_number}' not found in database")

        except Exception as db_error:
            logger.error(f"Database search error: {str(db_error)}")
            database_record = {"error": f"Database search failed: {str(db_error)}"}

        # Step 3: Search for the specific quarterly Google Sheet and get data
        sheets_data = {}
        sheet_found = False

        try:
            from utils.quarterly_sheets_manager import quarterly_manager

            # Get the specific quarter sheet by name
            target_sheet = quarterly_manager.get_quarterly_sheet(quarter, year)

            if not target_sheet:
                logger.warning(
                    f"Quarter sheet '{quarter_sheet_name}' not found in Google Sheets"
                )
                sheets_data = {
                    "error": f"Quarter sheet '{quarter_sheet_name}' not found"
                }
            else:
                logger.info(
                    f"Found quarter sheet '{quarter_sheet_name}' in Google Sheets"
                )
                sheet_found = True

                # Get all data from the specific sheet
                all_values = target_sheet.get_all_values()
                if not all_values:
                    sheets_data = {"error": "No data found in quarter sheet"}
                else:
                    headers = all_values[0] if all_values else []

                    # Find policy number column
                    policy_col_index = -1
                    for i, header in enumerate(headers):
                        if header.lower().strip() in ["policy number", "policy_number"]:
                            policy_col_index = i
                            logger.info(
                                f"Found policy number column at index {i}: '{header}'"
                            )
                            break

                    if policy_col_index == -1:
                        sheets_data = {
                            "error": "Policy number column not found in quarter sheet"
                        }
                        logger.warning(
                            "Policy number column not found in sheet headers"
                        )
                    else:
                        # Find the row with matching policy number
                        found_policy_data = None

                        # Skip header (row 1) and dummy/formula row (row 2)
                        for row_data in all_values[2:]:
                            if policy_col_index < len(row_data):
                                cell_value = row_data[policy_col_index].strip()
                                if cell_value == policy_number.strip():
                                    # Create a dictionary from headers and row data
                                    found_policy_data = {}
                                    for j, header in enumerate(headers):
                                        if j < len(row_data):
                                            found_policy_data[header] = row_data[j]
                                    break

                        if found_policy_data:
                            sheets_data = found_policy_data
                            logger.info(
                                f"Found policy '{policy_number}' in quarter sheet with {len(found_policy_data)} fields"
                            )
                        else:
                            sheets_data = {
                                "error": f"Policy '{policy_number}' not found in quarter sheet"
                            }
                            logger.info(
                                f"Policy '{policy_number}' not found in {len(all_values)-1} data rows"
                            )

        except Exception as sheets_error:
            logger.error(f"Failed to fetch from Google Sheets: {str(sheets_error)}")
            logger.error(f"Sheets error details: {traceback.format_exc()}")
            sheets_data = {
                "error": f"Failed to fetch from Google Sheets: {str(sheets_error)}"
            }

        # Step 4: Combine results from both sources
        response_data = {
            "policy_number": policy_number,
            "quarter": quarter,
            "year": year,
            "quarter_sheet_name": quarter_sheet_name,
            "database_record": database_record,
            "google_sheets_data": sheets_data,
            "broker_name": broker_name,
            "insurer_name": insurer_name,
            "found_in_database": database_record is not None
            and "error" not in str(database_record),
            "found_in_sheets": sheet_found and "error" not in sheets_data,
            "quarter_sheet_exists": sheet_found,
            "metadata": {
                "fetched_at": datetime.now().isoformat(),
                "search_quarter": quarter_sheet_name,
                "database_search_completed": True,
                "sheets_search_completed": True,
            },
        }

        logger.info(
            f"Search completed - DB: {response_data['found_in_database']}, Sheets: {response_data['found_in_sheets']}"
        )
        return response_data

    except Exception as e:
        logger.error(f"Error in policy search: {str(e)}")
        import traceback

        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch policy: {str(e)}",
        )


@router.put("/policy-update", response_model=PolicyDatabaseResponse)
async def update_policy_transaction_by_policy_number(
    policy_number: str = Query(..., description="Policy number to update"),
    quarter: int = Query(
        ..., ge=1, le=4, description="Quarter number (1-4) where the policy is located"
    ),
    year: int = Query(
        ..., ge=2020, le=2030, description="Year where the policy is located"
    ),
    policy_data: PolicyUpdate = ...,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    _rbac_check=Depends(require_policy_write),
):
    """
    Update Policy by policy number with selective DB storage and complete quarterly Google Sheets sync.

    This endpoint:
    1. Combines quarter and year into sheet name format (Q3-2025)
    2. Finds the policy in database by policy number
    3. Updates selective fields in database (essential fields only)
    4. Updates all fields in the specific quarterly Google Sheet

    Parameters:
    - policy_number: The policy number to update
    - quarter: Quarter number (1-4) where the policy is located
    - year: Year where the policy is located
    - policy_data: Update data for the policy

    Database updates only essential fields, Google Sheets updates all fields.
    """
    policy = None
    quarter_sheet_name = f"Q{quarter}-{year}"

    try:
        logger.info(
            f"Step 1: Beginning database update for policy '{policy_number}' in quarter '{quarter_sheet_name}' (selective fields only)."
        )
        async with db.begin():
            # Get the existing record by policy number
            from sqlalchemy import desc, select

            from models import Policy

            result = await db.execute(
                select(Policy)
                .where(Policy.policy_number == policy_number)
                .order_by(
                    desc(Policy.created_at)
                )  # Get the most recent one if multiple exist
            )
            policy = result.first()

            if policy:
                policy = policy[0]  # Extract the Policy object from the Row
            else:
                raise HTTPException(
                    status_code=404,
                    detail=f"Policy with policy number '{policy_number}' not found in database",
                )

            # Prepare selective data for database update (only essential fields)
            db_update_fields = {}

            # Essential document fields
            if policy_data.policy_pdf_url is not None:
                db_update_fields["policy_pdf_url"] = policy_data.policy_pdf_url
            if policy_data.additional_documents is not None:
                db_update_fields["additional_documents"] = (
                    policy_data.additional_documents
                )

            # Essential policy fields
            updated_policy_number = None
            if policy_data.policy_number is not None:
                db_update_fields["policy_number"] = policy_data.policy_number
                updated_policy_number = policy_data.policy_number

            # Essential dates
            if policy_data.start_date is not None:
                db_update_fields["policy_start_date"] = policy_data.start_date
            if policy_data.end_date is not None:
                db_update_fields["policy_end_date"] = policy_data.end_date

            # Essential identifiers
            if policy_data.agent_code is not None:
                db_update_fields["agent_code"] = policy_data.agent_code
            if policy_data.child_id is not None:
                db_update_fields["child_id"] = policy_data.child_id

            logger.info(
                f"Updating {len(db_update_fields)} essential fields in database: {list(db_update_fields.keys())}"
            )

            # Check for policy number uniqueness if policy number is being updated
            if updated_policy_number and updated_policy_number != policy.policy_number:
                existing_policy = await db.execute(
                    select(Policy).where(
                        (Policy.policy_number == updated_policy_number)
                        & (Policy.id != policy.id)  # Exclude current record
                    )
                )
                if existing_policy.scalar_one_or_none():
                    raise HTTPException(
                        status_code=400,
                        detail=f"Policy number '{updated_policy_number}' already exists in the database. Please use a unique policy number.",
                    )
                logger.info(
                    f"Policy number change to '{updated_policy_number}' is valid - proceeding with update"
                )

            # Apply updates to database
            for field, value in db_update_fields.items():
                if hasattr(policy, field):
                    old_value = getattr(policy, field)
                    setattr(policy, field, value)
                    logger.info(f"DB Update {field}: {old_value} -> {value}")
                else:
                    logger.warning(
                        f"Field '{field}' not found on Policy model - skipping"
                    )

        # Refresh to get committed data
        await db.refresh(policy)
        logger.info(
            f"Step 1 SUCCESS: Successfully updated policy '{policy_number}' (Policy ID {policy.id}) with selective fields."
        )

    except Exception as e:
        logger.critical(
            f"Step 1 FAILED: Database update failed for policy '{policy_number}'. Error: {str(e)}"
        )
        raise HTTPException(
            status_code=500, detail=f"Failed to update Policy in the database: {str(e)}"
        )

    # Google Sheets sync with complete data to specific quarterly sheet
    sync_results = None
    try:
        logger.info(
            f"Step 2: Starting quarterly Google Sheets sync for policy '{policy_number}' in '{quarter_sheet_name}' with ALL fields."
        )
        from routers.policies.helpers import (
            prepare_complete_policy_sheets_data_for_update,
            validate_and_resolve_codes_with_names,
        )
        from utils.quarterly_sheets_manager import quarterly_manager

        # Resolve broker and insurer names from codes if provided in update data
        broker_id, insurer_id, broker_name, insurer_name = (
            await validate_and_resolve_codes_with_names(
                db=db,
                broker_code=getattr(policy_data, "broker_code", None),
                insurer_code=getattr(policy_data, "insurer_code", None),
            )
        )

        logger.info(
            f"Final names for quarterly Google Sheets - Broker: '{broker_name or ''}', Insurer: '{insurer_name or ''}'"
        )

        # Prepare complete data for Google Sheets (all fields from request)
        complete_sheets_data = prepare_complete_policy_sheets_data_for_update(
            policy_data, policy, broker_name or "", insurer_name or ""
        )

        logger.info(
            f"Syncing {len(complete_sheets_data)} fields to quarterly sheet '{quarter_sheet_name}': {list(complete_sheets_data.keys())}"
        )

        # Use the update method that targets specific quarterly sheet by policy number
        target_policy_number = (
            updated_policy_number if updated_policy_number else policy_number
        )
        logger.info(
            f"🔍 QUARTERLY SHEETS UPDATE DEBUG for policy '{target_policy_number}' in '{quarter_sheet_name}':"
        )
        logger.info(f"   - Original policy number: '{policy_number}'")
        logger.info(f"   - Updated policy number: '{updated_policy_number}'")
        logger.info(f"   - Target policy number: '{target_policy_number}'")
        logger.info(f"   - Quarter: {quarter}, Year: {year}")

        # Update the specific quarterly sheet with quarter and year parameters
        quarterly_result = await run_in_threadpool(
            quarterly_manager.update_existing_record_by_policy_number,
            complete_sheets_data,
            target_policy_number,
            quarter,  # Specify quarter
            year,  # Specify year
        )

        sync_results = {"policy": quarterly_result}
        logger.info(
            f"Step 2 SUCCESS: Quarterly Google Sheets sync finished for policy '{target_policy_number}' in '{quarter_sheet_name}': {quarterly_result.get('operation', 'UPDATE')}"
        )

    except Exception as e:
        logger.critical(
            f"Step 2 FAILED: Quarterly Google Sheets sync failed for policy '{policy_number}', but database changes are saved. Error: {str(e)}"
        )
        from routers.policies.helpers import database_policy_response

        return database_policy_response(policy)

    if not sync_results:
        logger.warning("Step 3 SKIPPED: No sync results to update flags.")
        from routers.policies.helpers import database_policy_response

        return database_policy_response(policy)

    # Policy updates don't have sync flags like CutPay, so we just return the updated policy
    try:
        logger.info(
            f"Step 3 SUCCESS: Successfully updated policy '{policy_number}' (Policy ID {policy.id})."
        )
        logger.info(
            f"--- Update for policy '{policy_number}' in '{quarter_sheet_name}' finished successfully. ---"
        )
        from routers.policies.helpers import database_policy_response

        return database_policy_response(policy)

    except Exception as e:
        logger.critical(
            f"Step 3 FAILED: Finalizing update failed for policy '{policy_number}' (Policy ID {policy.id}). Error: {str(e)}"
        )
        from routers.policies.helpers import database_policy_response

        return database_policy_response(policy)


@router.delete("/policy-delete")
async def delete_policy_transaction_by_policy_number(
    policy_number: str = Query(..., description="Policy number to delete"),
    quarter: int = Query(
        ..., ge=1, le=4, description="Quarter number (1-4) where the policy is located"
    ),
    year: int = Query(
        ..., ge=2020, le=2030, description="Year where the policy is located"
    ),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check=Depends(require_policy_manage),
):
    """
    Delete Policy by policy number from both database and specific quarterly Google Sheet

    This endpoint:
    1. Combines quarter and year into sheet name format (Q3-2025)
    2. Finds the policy in database by policy number
    3. Deletes the record from database
    4. Deletes the record from the specific quarterly Google Sheet

    Parameters:
    - policy_number: The policy number to delete
    - quarter: Quarter number (1-4) where the policy is located
    - year: Year where the policy is located

    Returns deletion status for both database and Google Sheets
    """
    quarter_sheet_name = f"Q{quarter}-{year}"
    policy = None

    try:
        logger.info(
            f"Step 1: Finding and deleting policy '{policy_number}' from database"
        )

        # Get the existing record by policy number
        from sqlalchemy import desc, select

        from models import Policy

        result = await db.execute(
            select(Policy)
            .where(Policy.policy_number == policy_number)
            .order_by(
                desc(Policy.created_at)
            )  # Get the most recent one if multiple exist
        )
        policy = result.first()

        if policy:
            policy = policy[0]  # Extract the Policy object from the Row
        else:
            raise HTTPException(
                status_code=404,
                detail=f"Policy with policy number '{policy_number}' not found in database",
            )

        # Store policy_id for logging before deletion
        policy_id = policy.id
        logger.info(f"Found policy '{policy_number}' in database with ID: {policy_id}")

        # Delete from database
        await db.delete(policy)
        await db.commit()

        logger.info(
            f"Step 1 SUCCESS: Deleted policy '{policy_number}' (Policy ID {policy_id}) from database"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Step 1 FAILED: Database deletion failed for policy '{policy_number}': {str(e)}"
        )
        raise HTTPException(
            status_code=500, detail=f"Failed to delete Policy from database: {str(e)}"
        )

    # Delete from specific quarterly Google Sheet
    sheets_deletion_success = False
    sheets_deletion_message = ""

    try:
        logger.info(
            f"Step 2: Deleting policy '{policy_number}' from quarterly sheet '{quarter_sheet_name}'"
        )
        from utils.quarterly_sheets_manager import quarterly_manager

        # Get the specific quarter sheet
        target_sheet = quarterly_manager.get_quarterly_sheet(quarter, year)

        if not target_sheet:
            logger.warning(
                f"Quarter sheet '{quarter_sheet_name}' not found in Google Sheets"
            )
            sheets_deletion_message = f"Quarter sheet '{quarter_sheet_name}' not found - no Google Sheets deletion performed"
        else:
            logger.info(
                f"Found quarter sheet '{quarter_sheet_name}', searching for policy to delete..."
            )

            # Get all data from the sheet to find the policy row
            all_values = target_sheet.get_all_values()
            if not all_values:
                sheets_deletion_message = (
                    f"No data found in quarter sheet '{quarter_sheet_name}'"
                )
            else:
                headers = all_values[0] if all_values else []

                # Find policy number column
                policy_col_index = -1
                for i, header in enumerate(headers):
                    if header.lower().strip() in ["policy number", "policy_number"]:
                        policy_col_index = i
                        logger.info(
                            f"Found policy number column at index {i}: '{header}'"
                        )
                        break

                if policy_col_index == -1:
                    sheets_deletion_message = f"Policy number column not found in quarter sheet '{quarter_sheet_name}'"
                    logger.warning("Policy number column not found in sheet headers")
                else:
                    # Find the row with matching policy number
                    found_row_index = -1

                    # Skip header (row 1) and dummy/formula row (row 2)
                    for row_index, row_data in enumerate(all_values[2:], start=3):
                        if policy_col_index < len(row_data):
                            cell_value = row_data[policy_col_index].strip()
                            if cell_value == policy_number.strip():
                                found_row_index = row_index
                                logger.info(
                                    f"Found policy '{policy_number}' at row {row_index}"
                                )
                                break

                    if found_row_index == -1:
                        sheets_deletion_message = f"Policy '{policy_number}' not found in quarter sheet '{quarter_sheet_name}'"
                        logger.info(
                            f"Policy '{policy_number}' not found in {len(all_values)-1} data rows"
                        )
                    else:
                        # Delete the row from Google Sheets
                        target_sheet.delete_rows(found_row_index)
                        sheets_deletion_success = True
                        sheets_deletion_message = f"Successfully deleted policy '{policy_number}' from quarter sheet '{quarter_sheet_name}' at row {found_row_index}"
                        logger.info(
                            f"Step 2 SUCCESS: Deleted policy '{policy_number}' from quarter sheet row {found_row_index}"
                        )

    except Exception as sheets_error:
        logger.error(
            f"Step 2 FAILED: Quarterly Google Sheets deletion failed for policy '{policy_number}': {str(sheets_error)}"
        )
        import traceback

        logger.error(f"Sheets deletion error details: {traceback.format_exc()}")
        sheets_deletion_message = (
            f"Failed to delete from quarterly sheets: {str(sheets_error)}"
        )

    # Return deletion status
    response_data = {
        "message": f"Policy '{policy_number}' deletion completed",
        "policy_number": policy_number,
        "quarter": quarter,
        "year": year,
        "quarter_sheet_name": quarter_sheet_name,
        "database_deletion": {
            "success": True,
            "policy_id": str(policy_id) if policy else None,
            "message": "Successfully deleted from database",
        },
        "sheets_deletion": {
            "success": sheets_deletion_success,
            "message": sheets_deletion_message,
        },
        "overall_success": sheets_deletion_success,  # Both database and sheets must succeed
        "metadata": {
            "deleted_at": datetime.now().isoformat(),
            "deleted_by": current_user.get("user_id", "unknown"),
            "target_quarter": quarter_sheet_name,
        },
    }

    if sheets_deletion_success:
        logger.info(
            f"--- Deletion for policy '{policy_number}' in '{quarter_sheet_name}' completed successfully ---"
        )
    else:
        logger.warning(
            f"--- Deletion for policy '{policy_number}' completed with sheets deletion issues ---"
        )

    return response_data


@router.get("/helpers/check-policy-number", response_model=PolicyNumberCheckResponse)
async def check_policy_number_duplicate(
    policy_number: str = Query(
        ..., description="Policy number to check for duplicates"
    ),
    exclude_policy_id: Optional[str] = Query(
        None, description="Policy ID to exclude from check (for updates)"
    ),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check=Depends(require_policy_read),
):
    """
    Check if a policy number already exists in the database in real-time

    **Requires policy read permission**

    - **policy_number**: The policy number to check for duplicates
    - **exclude_policy_id**: Optional policy ID to exclude from the check (useful for updates)

    This endpoint is designed for real-time validation to prevent duplicate submissions
    before other form details are filled.
    """
    try:
        # Validate policy number format (basic validation)
        if not policy_number or not policy_number.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Policy number cannot be empty",
            )

        # Convert exclude_policy_id to UUID if provided
        exclude_uuid = None
        if exclude_policy_id:
            try:
                exclude_uuid = uuid.UUID(exclude_policy_id)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid exclude_policy_id format",
                )

        # Check for duplicate using helper method
        result = await policy_helpers.check_policy_number_duplicate(
            policy_number=policy_number, db=db, exclude_policy_id=exclude_uuid
        )

        return PolicyNumberCheckResponse(**result)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error checking policy number duplicate: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to check policy number",
        )


@router.get("/helpers/child-ids", response_model=List[ChildIdOption])
async def get_child_id_options(
    insurer_code: str = Query(
        ..., description="Required insurer code to filter child IDs"
    ),
    broker_code: Optional[str] = Query(
        None, description="Optional broker code to filter child IDs"
    ),
    agent_id: Optional[str] = Query(
        None, description="Optional agent ID to filter child IDs (admin only)"
    ),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check=Depends(require_policy_read),
):
    """
    Get available child IDs for dropdown with filtering

    **Requires policy read permission**

    - **insurer_code**: Required insurer code to filter by
    - **broker_code**: Optional broker code to filter by
    - **agent_id**: Optional agent ID to filter by (admin only)
    - Returns child IDs matching the filter criteria
    """
    try:
        user_role = current_user.get("role", "agent")
        user_id = current_user["user_id"]

        # Determine which agent_id to use for filtering
        if user_role not in ["admin", "superadmin"]:
            # For agents: always filter by their own user_id, ignore any provided agent_id
            agent_id = str(user_id)
        elif agent_id and user_role in ["admin", "superadmin"]:
            # For admin/superadmin: use provided agent_id if given
            agent_id = agent_id
        else:
            # For admin/superadmin without agent_id: no agent filtering
            agent_id = None

        # Use the new filtered method
        from routers.child.helpers import ChildHelpers

        child_helpers = ChildHelpers()

        filtered_requests = await child_helpers.get_filtered_child_ids(
            db=db, insurer_code=insurer_code, broker_code=broker_code, agent_id=agent_id
        )

        # Format the response to match ChildIdOption schema
        child_id_options = []
        for req in filtered_requests:
            # Extract the required fields
            child_id = req.child_id if req.child_id else ""
            broker_name = req.broker.name if req.broker else ""
            insurance_company = req.insurer.name if req.insurer else ""

            if child_id:  # Only include if child_id exists
                child_id_options.append(
                    ChildIdOption(
                        child_id=child_id,
                        broker_name=broker_name,
                        insurance_company=insurance_company,
                    )
                )

        return child_id_options

    except Exception as e:
        logger.error(f"Error fetching filtered child ID options: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch child ID options",
        )


@router.get("/helpers/agents", response_model=List[AgentOption])
async def get_agent_options(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rbac_check=Depends(require_policy_manage),
):
    """
    Get available agents for dropdown (admin only)

    **Requires policy manage permission**
    """
    try:
        agents = await PolicyHelpers.get_available_agents(db)

        return [AgentOption(**agent) for agent in agents]

    except Exception as e:
        logger.error(f"Error fetching agent options: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch agent options",
        )


@router.post("/create-quarter-sheet")
async def create_quarter_sheet(
    quarter: int = Query(..., ge=1, le=4, description="Quarter number (1-4)"),
    year: int = Query(..., ge=2020, le=2030, description="Year (e.g., 2025)"),
    current_user=Depends(get_current_user),
    _rbac_check=Depends(require_quarterly_sheets_write),
):
    """
    Manually create a new quarter sheet with template headers and formulas.

    **Requires admin or superadmin permission**

    - **quarter**: Quarter number (1, 2, 3, or 4)
    - **year**: Year for the quarter sheet (e.g., 2025)

    Creates a new quarterly Google Sheet with:
    - Headers copied from Master Template
    - Sample data row with formulas
    - Proper formatting (frozen headers, bold styling)
    """
    try:
        from utils.quarterly_sheets_manager import quarterly_manager

        logger.info(
            f"User {current_user.get('user_id')} requesting to create Q{quarter}-{year} sheet"
        )

        # Create the quarter sheet with template
        result = await run_in_threadpool(
            quarterly_manager.create_quarter_sheet_with_template, quarter, year
        )

        if result.get("success"):
            logger.info(f"Successfully created quarter sheet: {result.get('message')}")
            return {
                "success": True,
                "message": result.get("message"),
                "details": {
                    "sheet_name": result.get("sheet_name"),
                    "quarter": quarter,
                    "year": year,
                    "rows_copied": result.get("rows_copied"),
                    "columns": result.get("columns"),
                    "created_by": current_user.get("user_id"),
                },
            }
        else:
            logger.error(f"Failed to create quarter sheet: {result.get('error')}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result.get("error", "Failed to create quarter sheet"),
            )

    except Exception as e:
        logger.error(f"Error creating quarter sheet Q{quarter}-{year}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create quarter sheet: {str(e)}",
        )
