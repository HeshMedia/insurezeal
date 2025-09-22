from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, desc, or_
from sqlalchemy.orm import selectinload
from sqlalchemy.exc import IntegrityError
from models import Policy, UserProfile, ChildIdRequest, Broker, Insurer
from fastapi import HTTPException, status, UploadFile
from typing import Optional, Dict, Any, List, Tuple
import logging
import uuid
from datetime import datetime, date
from utils.pdf_utils import PDFProcessor
from utils.ai_utils import gemini_extractor
from utils.model_utils import model_data_from_orm
from config import get_supabase_admin_client, SUPABASE_STORAGE_BUCKET

logger = logging.getLogger(__name__)


class PolicyHelpers:
    @staticmethod
    def _convert_date_strings(policy_data: Dict[str, Any]) -> Dict[str, Any]:
        """Convert date strings from AI extraction to proper date objects"""
        date_fields = ["start_date", "end_date"]

        for field in date_fields:
            if field in policy_data and policy_data[field]:
                try:
                    if isinstance(policy_data[field], str):
                        policy_data[field] = datetime.strptime(
                            policy_data[field], "%Y-%m-%d"
                        ).date()
                except (ValueError, TypeError) as e:
                    logger.warning(
                        f"Failed to parse date field {field}: {policy_data[field]}, error: {e}"
                    )
                    policy_data[field] = None

        return policy_data

    @staticmethod
    async def save_uploaded_file(file: UploadFile, user_id: str) -> Tuple[str, str]:
        """Save uploaded PDF file to S3 and return URL and name"""
        try:
            file_extension = (
                file.filename.split(".")[-1] if "." in file.filename else "pdf"
            )
            unique_filename = f"policies/{user_id}/{uuid.uuid4()}.{file_extension}"
            file_content = await file.read()
            from utils.s3_utils import put_object, build_cloudfront_url

            put_object(
                key=unique_filename, body=file_content, content_type="application/pdf"
            )
            url_result = build_cloudfront_url(unique_filename)
            return url_result, file.filename
        except Exception as e:
            logger.error(f"Error saving uploaded file to S3: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to save uploaded file",
            )

    @staticmethod
    async def save_uploaded_file_from_bytes(
        file_content: bytes, filename: str, user_id: str
    ) -> Tuple[str, str]:
        """Save uploaded PDF file from bytes to S3 and return URL and name"""
        try:
            file_extension = filename.split(".")[-1] if "." in filename else "pdf"
            unique_filename = f"policies/{user_id}/{uuid.uuid4()}.{file_extension}"
            from utils.s3_utils import put_object, build_cloudfront_url

            put_object(
                key=unique_filename, body=file_content, content_type="application/pdf"
            )
            url_result = build_cloudfront_url(unique_filename)
            return url_result, filename
        except Exception as e:
            logger.error(f"Error saving uploaded file to S3: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to save uploaded file",
            )

    @staticmethod
    async def process_policy_pdf(file_content: bytes) -> Optional[Dict[str, Any]]:
        """Extract text from PDF content and process with AI"""
        try:
            pdf_text = PDFProcessor.extract_text_from_bytes(file_content)
            if not pdf_text:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Could not extract text from PDF",
                )

            if not gemini_extractor:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="AI service not available",
                )

            extracted_data = gemini_extractor.extract_policy_data(pdf_text)
            if not extracted_data:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to extract policy data with AI",
                )

            return extracted_data

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error processing policy PDF: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to process PDF",
            )

    @staticmethod
    async def get_agent_by_user_id(
        db: AsyncSession, user_id: str
    ) -> Optional[UserProfile]:
        """Get agent profile by user ID"""
        try:
            user_uuid = uuid.UUID(user_id)
            result = await db.execute(
                select(UserProfile).where(
                    and_(
                        UserProfile.user_id == user_uuid,
                        UserProfile.user_role.in_(["agent", "admin"]),
                    )
                )
            )
            return result.scalar_one_or_none()
        except ValueError as e:
            logger.error(f"Invalid UUID format for user_id {user_id}: {str(e)}")
            return None
        except Exception as e:
            logger.error(f"Error fetching agent: {str(e)}")
            return None

    @staticmethod
    async def get_child_id_details(
        db: AsyncSession, child_id: str
    ) -> Optional[ChildIdRequest]:
        """Get child ID details using the same working pattern as child router"""
        try:
            # Validate child_id format before querying
            if not child_id or not child_id.strip():
                logger.warning(f"Empty or invalid child_id provided: '{child_id}'")
                return None

            # Use the working pattern from child helpers
            from routers.child.helpers import ChildHelpers

            child_helpers = ChildHelpers()

            # Build query similar to child helpers pattern
            query = select(ChildIdRequest).where(ChildIdRequest.child_id == child_id)
            result = await db.execute(query)

            # Use the working .scalars().all() pattern then get first item
            child_requests = result.scalars().all()

            if child_requests:
                return child_requests[0]  # Return first match
            return None

        except Exception as e:
            logger.error(f"Error fetching child ID details for '{child_id}': {str(e)}")
            return None

    @staticmethod
    async def get_available_child_ids(
        db: AsyncSession, agent_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get available child IDs for dropdown, filtered by agent_id if provided"""
        try:
            # Build the query step by step
            query = select(ChildIdRequest)
            query = query.where(ChildIdRequest.status == "accepted")

            if agent_id:
                try:
                    agent_uuid = uuid.UUID(agent_id)
                    query = query.where(ChildIdRequest.user_id == agent_uuid)
                except ValueError:
                    logger.error(f"Invalid UUID format for agent_id: {agent_id}")
                    return []

            # Execute the query
            result = await db.execute(query)

            # Use same pattern as get_available_agents
            child_requests = result.scalars().all()

            return [
                {
                    "child_id": req.child_id,
                    "broker_name": req.broker,
                    "insurance_company": req.insurance_company,
                }
                for req in child_requests
                if req.child_id
            ]

        except Exception as e:
            logger.error(f"Error fetching child IDs for agent {agent_id}: {str(e)}")
            return []

    @staticmethod
    async def get_available_agents(db: AsyncSession) -> List[Dict[str, Any]]:
        """Get available agents for admin dropdown"""
        try:
            result = await db.execute(
                select(UserProfile).where(
                    and_(
                        UserProfile.user_role == "agent",
                        UserProfile.agent_code.isnot(None),
                    )
                )
            )
            agents = result.scalars().all()

            return [
                {
                    "agent_id": agent.user_id,
                    "agent_code": agent.agent_code,
                    "full_name": f"{agent.first_name} {agent.last_name}".strip(),
                }
                for agent in agents
            ]

        except Exception as e:
            logger.error(f"Error fetching agents: {str(e)}")
            return []

    @staticmethod
    async def create_policy(
        db: AsyncSession,
        policy_data: Dict[str, Any],
        file_path: str,
        file_name: str,
        uploaded_by: str,
    ) -> Policy:
        """Create a new policy record"""
        try:
            policy_data = PolicyHelpers._convert_date_strings(policy_data)
            policy_data = PolicyHelpers._provide_default_values(policy_data)

            policy = Policy(
                uploaded_by=uuid.UUID(uploaded_by),
                pdf_file_path=file_path,
                pdf_file_name=file_name,
                **policy_data,
            )

            db.add(policy)
            await db.commit()
            await db.refresh(policy)

            logger.info(f"Created policy {policy.id} for user {uploaded_by}")
            return policy

        except IntegrityError as e:
            await db.rollback()
            logger.error(f"Integrity error creating policy: {str(e)}")

            if "duplicate key value violates unique constraint" in str(
                e
            ) and "policy_number" in str(e):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Policy number already exists",
                )

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Data integrity error"
            )

        except Exception as e:
            await db.rollback()
            logger.error(f"Error creating policy: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create policy",
            )

    @staticmethod
    async def get_policies(
        db: AsyncSession,
        page: int = 1,
        page_size: int = 20,
        user_id: Optional[str] = None,
        agent_id: Optional[str] = None,
        policy_type: Optional[str] = None,
        search: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get policies with pagination and filters"""
        try:
            query = select(Policy)
            count_query = select(func.count(Policy.id))

            if user_id:
                query = query.where(Policy.uploaded_by == uuid.UUID(user_id))
                count_query = count_query.where(
                    Policy.uploaded_by == uuid.UUID(user_id)
                )

            if agent_id:
                query = query.where(Policy.agent_id == uuid.UUID(agent_id))
                count_query = count_query.where(Policy.agent_id == uuid.UUID(agent_id))

            if policy_type:
                query = query.where(Policy.policy_type == policy_type)
                count_query = count_query.where(Policy.policy_type == policy_type)

            if search:
                search_filter = or_(
                    Policy.policy_number.ilike(f"%{search}%"),
                    Policy.registration_number.ilike(f"%{search}%"),
                    Policy.agent_code.ilike(f"%{search}%"),
                )
                query = query.where(search_filter)
                count_query = count_query.where(search_filter)

            total_result = await db.execute(count_query)
            total_count = total_result.scalar()

            offset = (page - 1) * page_size
            query = (
                query.order_by(desc(Policy.created_at)).offset(offset).limit(page_size)
            )

            result = await db.execute(query)
            policies = result.scalars().all()

            return {
                "policies": policies,
                "total_count": total_count or 0,
                "page": page,
                "page_size": page_size,
                "total_pages": (
                    (total_count + page_size - 1) // page_size if total_count else 0
                ),
            }

        except Exception as e:
            logger.error(f"Error fetching policies: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to fetch policies",
            )

    @staticmethod
    async def get_policy_by_id(
        db: AsyncSession, policy_id: str, user_id: Optional[str] = None
    ) -> Optional[Policy]:
        """Get policy by ID with optional user restriction"""
        try:
            query = select(Policy).where(Policy.id == uuid.UUID(policy_id))

            if user_id:
                query = query.where(Policy.uploaded_by == uuid.UUID(user_id))

            result = await db.execute(query)
            return result.scalar_one_or_none()

        except Exception as e:
            logger.error(f"Error fetching policy: {str(e)}")
            return None

    @staticmethod
    async def update_policy(
        db: AsyncSession,
        policy_id: str,
        update_data: Dict[str, Any],
        user_id: Optional[str] = None,
    ) -> Optional[Policy]:
        """Update policy"""
        try:
            policy = await PolicyHelpers.get_policy_by_id(db, policy_id, user_id)
            if not policy:
                return None

            for field, value in update_data.items():
                if hasattr(policy, field) and value is not None:
                    setattr(policy, field, value)

            policy.updated_at = datetime.utcnow()

            await db.commit()
            await db.refresh(policy)

            return policy

        except IntegrityError as e:
            await db.rollback()
            logger.error(f"Integrity error updating policy: {str(e)}")

            if "duplicate key value violates unique constraint" in str(
                e
            ) and "policy_number" in str(e):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Policy number already exists",
                )

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Data integrity error"
            )

        except Exception as e:
            await db.rollback()
            logger.error(f"Error updating policy: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update policy",
            )

    @staticmethod
    async def delete_policy(
        db: AsyncSession, policy_id: str, user_id: Optional[str] = None
    ) -> bool:
        """Delete policy and associated PDF from S3"""
        try:
            policy = await PolicyHelpers.get_policy_by_id(db, policy_id, user_id)
            if not policy:
                return False
            try:
                if policy.pdf_file_path:
                    from utils.s3_utils import delete_object_by_url

                    delete_object_by_url(policy.pdf_file_path)
            except Exception as e:
                logger.warning(f"Failed to delete PDF file from S3: {str(e)}")

            await db.delete(policy)
            await db.commit()

            return True

        except Exception as e:
            await db.rollback()
            logger.error(f"Error deleting policy: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete policy",
            )

    @staticmethod
    def _provide_default_values(policy_data: Dict[str, Any]) -> Dict[str, Any]:
        """Provide default values for required fields that cannot be null"""

        if not policy_data.get("insurance_type"):
            policy_type = (policy_data.get("policy_type") or "").lower()
            vehicle_type = (policy_data.get("vehicle_type") or "").lower()

            if "motor" in policy_type or "vehicle" in vehicle_type:
                policy_data["insurance_type"] = "Comprehensive"
            elif "health" in policy_type:
                policy_data["insurance_type"] = "Individual"
            elif "life" in policy_type:
                policy_data["insurance_type"] = "Term"
            else:
                policy_data["insurance_type"] = "Standard"

        return policy_data

    @staticmethod
    async def export_policies_to_csv(
        db: AsyncSession,
        user_id: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> str:
        """Export policies to CSV format"""
        try:
            import csv
            import io

            query = select(Policy)
            if user_id:
                query = query.where(Policy.uploaded_by == uuid.UUID(user_id))

            if start_date and end_date:
                query = query.where(
                    and_(
                        Policy.created_at
                        >= datetime.combine(start_date, datetime.min.time()),
                        Policy.created_at
                        <= datetime.combine(end_date, datetime.max.time()),
                    )
                )
            elif start_date:
                query = query.where(
                    Policy.created_at
                    >= datetime.combine(start_date, datetime.min.time())
                )
            elif end_date:
                query = query.where(
                    Policy.created_at <= datetime.combine(end_date, datetime.max.time())
                )

            query = query.order_by(desc(Policy.created_at))

            result = await db.execute(query)
            policies = result.scalars().all()

            output = io.StringIO()
            writer = csv.writer(output)

            headers = [
                "ID",
                "Policy Number",
                "Policy Type",
                "Insurance Type",
                "Agent ID",
                "Agent Code",
                "Child ID",
                "Broker Name",
                "Insurance Company",
                "Vehicle Type",
                "Registration Number",
                "Vehicle Class",
                "Vehicle Segment",
                "Gross Premium",
                "GST",
                "Net Premium",
                "OD Premium",
                "TP Premium",
                "Start Date",
                "End Date",
                "Uploaded By",
                "PDF File Name",
                "AI Confidence Score",
                "Manual Override",
                "Created At",
                "Updated At",
            ]
            writer.writerow(headers)

            for policy in policies:
                row = [
                    str(policy.id),
                    policy.policy_number or "",
                    policy.policy_type or "",
                    policy.insurance_type or "",
                    str(policy.agent_id) if policy.agent_id else "",
                    policy.agent_code or "",
                    policy.child_id or "",
                    policy.broker_name or "",
                    policy.insurance_company or "",
                    policy.vehicle_type or "",
                    policy.registration_number or "",
                    policy.vehicle_class or "",
                    policy.vehicle_segment or "",
                    policy.gross_premium or "",
                    policy.gst or "",
                    policy.net_premium or "",
                    policy.od_premium or "",
                    policy.tp_premium or "",
                    policy.start_date.strftime("%Y-%m-%d") if policy.start_date else "",
                    policy.end_date.strftime("%Y-%m-%d") if policy.end_date else "",
                    str(policy.uploaded_by) if policy.uploaded_by else "",
                    policy.pdf_file_name or "",
                    policy.ai_confidence_score or "",
                    "Yes" if policy.manual_override else "No",
                    (
                        policy.created_at.strftime("%Y-%m-%d %H:%M:%S")
                        if policy.created_at
                        else ""
                    ),
                    (
                        policy.updated_at.strftime("%Y-%m-%d %H:%M:%S")
                        if policy.updated_at
                        else ""
                    ),
                ]
                writer.writerow(row)

            csv_content = output.getvalue()
            output.close()

            logger.info(f"CSV export generated with {len(policies)} policies")
            return csv_content

        except Exception as e:
            logger.error(f"Error exporting policies to CSV: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to export policies to CSV",
            )

    @staticmethod
    @staticmethod
    async def get_agent_policies(
        db: AsyncSession,
        agent_code: str,
        page: int = 1,
        page_size: int = 20,
        search: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Get paginated policies for a specific agent
        Returns only relevant policy fields (excluding cutpay/incoming grid/calculation fields)
        """
        try:
            # Build base query
            query = select(Policy).where(Policy.agent_code == agent_code)

            # Add search filter if provided
            if search:
                search_filter = or_(
                    Policy.policy_number.ilike(f"%{search}%"),
                    Policy.customer_name.ilike(f"%{search}%"),
                    Policy.registration_number.ilike(f"%{search}%"),
                )
                query = query.where(search_filter)

            # Count total records
            count_query = select(func.count()).select_from(query.subquery())
            count_result = await db.execute(count_query)
            total_count = count_result.scalar()

            # Apply pagination and ordering
            query = query.order_by(desc(Policy.created_at))
            query = query.offset((page - 1) * page_size).limit(page_size)

            # Execute query
            result = await db.execute(query)
            policies = result.scalars().all()

            # Convert to response format (excluding cutpay/incoming grid/calculation fields)
            policy_list = []
            for policy in policies:
                policy_data = model_data_from_orm(policy)

                # Only include relevant policy fields (exclude cutpay/incoming grid/calculation fields)
                filtered_policy_data = {
                    # Basic identifiers
                    "id": policy_data.get("id"),
                    "policy_number": policy_data.get("policy_number"),
                    "formatted_policy_number": policy_data.get(
                        "formatted_policy_number"
                    ),
                    # Agent & Child Info
                    "agent_id": policy_data.get("agent_id"),
                    "agent_code": policy_data.get("agent_code"),
                    "child_id": policy_data.get("child_id"),
                    "broker_name": policy_data.get("broker_name"),
                    "insurance_company": policy_data.get("insurance_company"),
                    # Policy Details
                    "major_categorisation": policy_data.get("major_categorisation"),
                    "product_insurer_report": policy_data.get("product_insurer_report"),
                    "product_type": policy_data.get("product_type"),
                    "plan_type": policy_data.get("plan_type"),
                    "customer_name": policy_data.get("customer_name"),
                    "customer_phone_number": policy_data.get("customer_phone_number"),
                    "policy_type": policy_data.get("policy_type"),
                    "insurance_type": policy_data.get("insurance_type"),
                    # Vehicle Details
                    "vehicle_type": policy_data.get("vehicle_type"),
                    "registration_number": policy_data.get("registration_number"),
                    "vehicle_class": policy_data.get("vehicle_class"),
                    "vehicle_segment": policy_data.get("vehicle_segment"),
                    "make_model": policy_data.get("make_model"),
                    "model": policy_data.get("model"),
                    "vehicle_variant": policy_data.get("vehicle_variant"),
                    "gvw": policy_data.get("gvw"),
                    "rto": policy_data.get("rto"),
                    "state": policy_data.get("state"),
                    "fuel_type": policy_data.get("fuel_type"),
                    "cc": policy_data.get("cc"),
                    "age_year": policy_data.get("age_year"),
                    "ncb": policy_data.get("ncb"),
                    "discount_percent": policy_data.get("discount_percent"),
                    "business_type": policy_data.get("business_type"),
                    "seating_capacity": policy_data.get("seating_capacity"),
                    "veh_wheels": policy_data.get("veh_wheels"),
                    # Premium Details
                    "gross_premium": policy_data.get("gross_premium"),
                    "gst": policy_data.get("gst"),
                    "gst_amount": policy_data.get("gst_amount"),
                    "net_premium": policy_data.get("net_premium"),
                    "od_premium": policy_data.get("od_premium"),
                    "tp_premium": policy_data.get("tp_premium"),
                    # Agent Commission Fields (only these two for policies)
                    "agent_commission_given_percent": policy_data.get(
                        "agent_commission_given_percent"
                    ),
                    "agent_extra_percent": policy_data.get("agent_extra_percent"),
                    # Agent Financial Tracking
                    "payment_by_office": policy_data.get("payment_by_office"),
                    "total_agent_payout_amount": policy_data.get(
                        "total_agent_payout_amount"
                    ),
                    # Additional Configuration
                    "code_type": policy_data.get("code_type"),
                    "payment_by": policy_data.get("payment_by"),
                    "payment_method": policy_data.get("payment_method"),
                    "cluster": policy_data.get("cluster"),
                    # Dates and other fields
                    "start_date": policy_data.get("start_date"),
                    "end_date": policy_data.get("end_date"),
                    "notes": policy_data.get("notes"),
                    "ai_confidence_score": policy_data.get("ai_confidence_score"),
                    "manual_override": policy_data.get("manual_override"),
                    "created_at": policy_data.get("created_at"),
                    "updated_at": policy_data.get("updated_at"),
                }

                policy_list.append(filtered_policy_data)

            # Calculate pagination
            total_pages = (total_count + page_size - 1) // page_size

            return {
                "policies": policy_list,
                "total_count": total_count,
                "total_pages": total_pages,
                "current_page": page,
                "page_size": page_size,
            }

        except Exception as e:
            logger.error(f"Error getting agent policies for {agent_code}: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to fetch policies for agent {agent_code}",
            )

    async def check_policy_number_duplicate(
        self,
        policy_number: str,
        db: AsyncSession,
        exclude_policy_id: Optional[uuid.UUID] = None,
    ) -> Dict[str, Any]:
        """
        Check if a policy number already exists in the database

        Args:
            policy_number: The policy number to check
            db: Database session
            exclude_policy_id: Optional policy ID to exclude from the check (useful for updates)

        Returns:
            Dict containing duplicate check results
        """
        try:
            # Normalize policy number (strip whitespace, convert to uppercase)
            normalized_policy_number = policy_number.strip().upper()

            # Build query to check for existing policy number
            query = select(Policy).where(
                Policy.policy_number.ilike(normalized_policy_number)
            )

            # If excluding a specific policy (for updates), add that condition
            if exclude_policy_id:
                query = query.where(Policy.id != exclude_policy_id)

            result = await db.execute(query)
            existing_policy = result.scalar_one_or_none()

            if existing_policy:
                return {
                    "policy_number": policy_number,
                    "is_duplicate": True,
                    "message": f"Policy number '{policy_number}' already exists in the system",
                    "existing_policy_id": existing_policy.id,
                }
            else:
                return {
                    "policy_number": policy_number,
                    "is_duplicate": False,
                    "message": f"Policy number '{policy_number}' is available",
                    "existing_policy_id": None,
                }

        except Exception as e:
            logger.error(
                f"Error checking policy number duplicate for {policy_number}: {str(e)}"
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to check policy number availability",
            )

    @staticmethod
    async def create_simplified_policy(
        db: AsyncSession, essential_data: Dict[str, Any]
    ) -> Policy:
        """
        Create a simplified policy record with only essential fields

        Args:
            db: Database session
            essential_data: Dictionary containing only essential policy fields

        Returns:
            Created Policy instance
        """
        try:
            # Create policy with only essential fields
            policy = Policy(
                policy_number=essential_data.get("policy_number"),
                child_id=essential_data.get("child_id"),
                agent_code=essential_data.get("agent_code"),
                additional_documents=essential_data.get("additional_documents"),
                policy_pdf_url=essential_data.get("policy_pdf_url"),
                booking_date=essential_data.get("booking_date"),
                policy_start_date=essential_data.get("policy_start_date"),
                policy_end_date=essential_data.get("policy_end_date"),
            )

            db.add(policy)
            await db.commit()
            await db.refresh(policy)

            logger.info(f"Created simplified policy: {policy.policy_number}")
            return policy

        except IntegrityError as e:
            await db.rollback()
            if "unique constraint" in str(e).lower():
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Policy number {essential_data.get('policy_number')} already exists",
                )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Database constraint violation: {str(e)}",
            )
        except Exception as e:
            await db.rollback()
            logger.error(f"Error creating simplified policy: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to create policy: {str(e)}",
            )


# =============================================================================
# BROKER AND INSURER CODE RESOLUTION HELPERS
# =============================================================================


async def resolve_broker_code_to_details(
    db: AsyncSession, broker_code: str
) -> tuple[Optional[int], Optional[str]]:
    """Resolve broker code to broker ID and name"""
    if not broker_code:
        return None, None

    result = await db.execute(
        select(Broker.id, Broker.name).where(
            and_(Broker.broker_code == broker_code, Broker.is_active == True)
        )
    )
    broker = result.first()

    if not broker:
        logger.warning(f"Broker with code '{broker_code}' not found or inactive")
        return None, None

    return broker.id, broker.name


async def resolve_insurer_code_to_details(
    db: AsyncSession, insurer_code: str
) -> tuple[Optional[int], Optional[str]]:
    """Resolve insurer code to insurer ID and name"""
    if not insurer_code:
        return None, None

    result = await db.execute(
        select(Insurer.id, Insurer.name).where(
            and_(Insurer.insurer_code == insurer_code, Insurer.is_active == True)
        )
    )
    insurer = result.first()

    if not insurer:
        logger.warning(f"Insurer with code '{insurer_code}' not found or inactive")
        return None, None

    return insurer.id, insurer.name


async def validate_and_resolve_codes_with_names(
    db: AsyncSession, broker_code: Optional[str], insurer_code: Optional[str]
) -> tuple[Optional[int], Optional[int], Optional[str], Optional[str]]:
    """Validate and resolve both broker and insurer codes to IDs and names"""
    broker_id = None
    insurer_id = None
    broker_name = None
    insurer_name = None

    if broker_code:
        broker_id, broker_name = await resolve_broker_code_to_details(db, broker_code)

    if insurer_code:
        insurer_id, insurer_name = await resolve_insurer_code_to_details(
            db, insurer_code
        )

    return broker_id, insurer_id, broker_name, insurer_name


# =============================================================================
# GOOGLE SHEETS DATA PREPARATION HELPERS
# =============================================================================


def prepare_complete_policy_sheets_data(
    policy_data: Any,
    policy_db_record: Any = None,
    broker_name: str = "",
    insurer_name: str = "",
) -> Dict[str, Any]:
    """
    Prepare complete policy data for Google Sheets including all fields from the request.
    This function maps all possible policy fields to the Google Sheets column headers.

    Args:
        policy_data: PolicyCreateRequest object with all the form data
        policy_db_record: Policy database record (optional)
        broker_name: Broker name from database lookup
        insurer_name: Insurer name from database lookup

    Returns:
        Dictionary with Google Sheets column headers as keys and data as values
    """
    sheets_data = {}

    # Calculate reporting month from booking date or start date
    date_for_month = getattr(policy_data, "start_date", None)
    if date_for_month:
        # Format as MMM'YY (e.g., Jan'25)
        reporting_month = date_for_month.strftime("%b'%y")
    else:
        reporting_month = ""

    # Core Information - exact header names from your Google Sheets
    sheets_data.update(
        {
            "Reporting Month (mmm'yy)": reporting_month,
            "Child ID/ User ID [Provided by Insure Zeal]": getattr(
                policy_data, "child_id", ""
            )
            or "",
            "Insurer /broker code": getattr(policy_data, "broker_code", "")
            or getattr(policy_data, "insurer_code", "")
            or "",
            "Policy Start Date": (
                getattr(policy_data, "start_date", "").isoformat()
                if getattr(policy_data, "start_date", None)
                else ""
            ),
            "Policy End Date": (
                getattr(policy_data, "end_date", "").isoformat()
                if getattr(policy_data, "end_date", None)
                else ""
            ),
            "Booking Date(Click to select Date)": (
                getattr(policy_db_record, "booking_date", "").isoformat()
                if policy_db_record and getattr(policy_db_record, "booking_date", None)
                else ""
            ),
            "Broker Name": broker_name or getattr(policy_data, "broker_name", "") or "",
            "Insurer name": insurer_name
            or getattr(policy_data, "insurance_company", "")
            or "",
        }
    )

    # Policy and Product Information
    sheets_data.update(
        {
            "Major Categorisation( Motor/Life/ Health)": getattr(
                policy_data, "major_categorisation", ""
            )
            or "",
            "Product (Insurer Report)": getattr(
                policy_data, "product_insurer_report", ""
            )
            or "",
            "Product Type": getattr(policy_data, "product_type", "") or "",
            "Plan type (Comp/STP/SAOD)": getattr(policy_data, "plan_type", "") or "",
        }
    )

    # Premium Information
    sheets_data.update(
        {
            "Gross premium": getattr(policy_data, "gross_premium", 0) or 0,
            "GST Amount": getattr(policy_data, "gst_amount", 0)
            or getattr(policy_data, "gst", 0)
            or 0,
            "Net premium": getattr(policy_data, "net_premium", 0) or 0,
            "OD Preimium": getattr(policy_data, "od_premium", 0) or 0,
            "TP Premium": getattr(policy_data, "tp_premium", 0) or 0,
        }
    )

    # Policy and Vehicle Details
    sheets_data.update(
        {
            "Policy number": getattr(policy_data, "policy_number", "") or "",
            "Formatted Policy number": getattr(
                policy_data, "formatted_policy_number", ""
            )
            or "",
            "Registration.no": getattr(policy_data, "registration_number", "") or "",
            "Make_Model": getattr(policy_data, "make_model", "") or "",
            "Model": getattr(policy_data, "model", "") or "",
            "Vehicle_Variant": getattr(policy_data, "vehicle_variant", "") or "",
            "GVW": getattr(policy_data, "gvw", 0) or 0,
            "RTO": getattr(policy_data, "rto", "") or "",
            "State": getattr(policy_data, "state", "") or "",
            "Cluster": getattr(policy_data, "cluster", "") or "",
            "Fuel Type": getattr(policy_data, "fuel_type", "") or "",
            "CC": getattr(policy_data, "cc", 0) or 0,
            "Age(Year)": getattr(policy_data, "age_year", 0) or 0,
            "NCB (YES/NO)": getattr(policy_data, "ncb", "") or "",
            "Discount %": getattr(policy_data, "discount_percent", 0) or 0,
            "Business Type": getattr(policy_data, "business_type", "") or "",
            "Seating Capacity": getattr(policy_data, "seating_capacity", 0) or 0,
            "Veh_Wheels": getattr(policy_data, "veh_wheels", 0) or 0,
        }
    )

    # Customer Information
    sheets_data.update(
        {
            "Customer Name": getattr(policy_data, "customer_name", "") or "",
            "Customer Number": getattr(policy_data, "customer_phone_number", "") or "",
        }
    )

    # Commission and Financial Fields (with default values)
    sheets_data.update(
        {
            "Commissionable Premium": 0,  # Calculate based on business logic
            "Incoming Grid %": 0,
            "Receivable from Broker": 0,
            "Extra Grid": 0,
            "Extra Amount Receivable from Broker": 0,
            "Total Receivable from Broker": 0,
            "Claimed By": "",
            "Payment by": getattr(policy_data, "payment_by", "") or "",
            "Payment Mode": getattr(policy_data, "payment_method", "") or "",
            "Cut Pay Amount Received From Agent": 0,
            "Already Given to agent": 0,
            "Actual Agent_PO%": getattr(
                policy_data, "agent_commission_given_percent", 0
            )
            or 0,
            "Agent_PO_AMT": 0,
            "Agent_Extra%": 0,
            "Agent_Extr_Amount": 0,
            "Payment By Office": getattr(policy_data, "payment_by_office", 0) or 0,
            "PO Paid To Agent": getattr(policy_data, "total_agent_payout_amount", 0)
            or 0,
            "Running Bal": getattr(policy_data, "running_bal", 0) or 0,
        }
    )

    # Additional Financial Calculation Fields
    sheets_data.update(
        {
            "Total Receivable from Broker Include 18% GST": 0,
            "IZ Total PO%": 0,
            "As per Broker PO%": 0,
            "As per Broker PO AMT": 0,
            "PO% Diff Broker": 0,
            "PO AMT Diff Broker": 0,
            "As per Agent Payout%": 0,
            "As per Agent Payout Amount": 0,
            "PO% Diff Agent": 0,
            "PO AMT Diff Agent": 0,
            "Invoice Status": "",
            "Invoice Number": "",
            "Remarks": getattr(policy_data, "notes", "") or "",
            "Match": "FALSE",
            "Agent Code": getattr(policy_data, "agent_code", "") or "",
        }
    )

    return sheets_data
    sheets_data.update(
        {
            "Match": "FALSE",  # Default to FALSE for new records
            "Verified": "FALSE",  # Default verification status
            "Status": "ACTIVE",  # Default status
            "Created At": datetime.now().isoformat(),
        }
    )

    return sheets_data


def prepare_complete_policy_sheets_data_for_update(
    policy_data: Any,
    policy_db_record: Any,
    broker_name: str = "",
    insurer_name: str = "",
) -> Dict[str, Any]:
    """
    Prepare complete policy data for Google Sheets update including all fields from the request.
    This function maps all possible policy fields to the Google Sheets column headers for updates.

    Args:
        policy_data: PolicyUpdateRequest object with the update data
        policy_db_record: Policy database record
        broker_name: Broker name from database lookup
        insurer_name: Insurer name from database lookup

    Returns:
        Dictionary with Google Sheets column headers as keys and updated data as values
    """
    sheets_data = {}

    # Always include the database record information using exact Google Sheets headers
    sheets_data["Child ID/ User ID [Provided by Insure Zeal]"] = (
        policy_db_record.child_id or ""
    )
    sheets_data["Agent Code"] = policy_db_record.agent_code or ""

    # Always include policy number from database record first
    logger.info(
        f"🔍 POLICY DEBUG Helper: Database record policy_number = {repr(policy_db_record.policy_number)}"
    )
    sheets_data["Policy number"] = policy_db_record.policy_number or ""

    # Override with update data if provided
    if hasattr(policy_data, "policy_number") and policy_data.policy_number:
        if policy_data.policy_number.strip():
            logger.info(
                f"🔍 POLICY DEBUG Helper: Overriding with update policy_number = {repr(policy_data.policy_number)}"
            )
            sheets_data["Policy number"] = policy_data.policy_number
        else:
            logger.info(
                f"🔍 POLICY DEBUG Helper: Keeping database policy_number = {repr(sheets_data['Policy number'])}"
            )

    # Update all other fields from the request - using exact Google Sheets headers
    field_mapping = {
        "formatted_policy_number": "Formatted Policy number",
        "major_categorisation": "Major Categorisation( Motor/Life/ Health)",
        "product_insurer_report": "Product (Insurer Report)",
        "product_type": "Product Type",
        "plan_type": "Plan type (Comp/STP/SAOD)",
        "customer_name": "Customer Name",
        "customer_phone_number": "Customer Number",
        "policy_type": "Policy Type",  # This might not have exact match in sheets
        "insurance_type": "Insurance Type",  # This might not have exact match in sheets
        "vehicle_type": "Vehicle Type",  # This might not have exact match in sheets
        "registration_number": "Registration.no",
        "vehicle_class": "Vehicle Class",  # This might not have exact match in sheets
        "vehicle_segment": "Vehicle Segment",  # This might not have exact match in sheets
        "make_model": "Make_Model",
        "model": "Model",
        "vehicle_variant": "Vehicle_Variant",
        "gvw": "GVW",
        "rto": "RTO",
        "state": "State",
        "fuel_type": "Fuel Type",
        "cc": "CC",
        "age_year": "Age(Year)",
        "ncb": "NCB (YES/NO)",
        "discount_percent": "Discount %",
        "business_type": "Business Type",
        "seating_capacity": "Seating Capacity",
        "veh_wheels": "Veh_Wheels",
        "gross_premium": "Gross premium",
        "gst": "GST Amount",  # Map gst to GST Amount
        "gst_amount": "GST Amount",
        "net_premium": "Net premium",
        "od_premium": "OD Preimium",
        "tp_premium": "TP Premium",
        "agent_commission_given_percent": "Actual Agent_PO%",
        "payment_by_office": "Payment By Office",
        "total_agent_payout_amount": "PO Paid To Agent",
        "running_bal": "Running Bal",
        "code_type": "Code Type",  # This might not have exact match in sheets
        "payment_by": "Payment by",
        "payment_method": "Payment Mode",
        "cluster": "Cluster",
        "notes": "Remarks",
        "policy_number": "Policy number",
        "child_id": "Child ID/ User ID [Provided by Insure Zeal]",
        "agent_code": "Agent Code",
    }

    # Apply updates for all fields that are provided
    for policy_field, sheet_column in field_mapping.items():
        if hasattr(policy_data, policy_field):
            value = getattr(policy_data, policy_field)
            if value is not None:
                sheets_data[sheet_column] = value

    # Handle date fields specially with exact Google Sheets headers
    if hasattr(policy_data, "start_date") and policy_data.start_date:
        sheets_data["Policy Start Date"] = (
            policy_data.start_date.isoformat()
            if hasattr(policy_data.start_date, "isoformat")
            else str(policy_data.start_date)
        )

    if hasattr(policy_data, "end_date") and policy_data.end_date:
        sheets_data["Policy End Date"] = (
            policy_data.end_date.isoformat()
            if hasattr(policy_data.end_date, "isoformat")
            else str(policy_data.end_date)
        )

    # Include names from database lookups with exact Google Sheets headers
    if broker_name:
        sheets_data["Broker Name"] = broker_name
    if insurer_name:
        sheets_data["Insurer name"] = insurer_name

    # Update timestamp (may not have exact match in sheets)
    sheets_data["Updated At"] = datetime.now().isoformat()

    return sheets_data


def database_policy_response(policy_obj) -> Dict[str, Any]:
    """
    Convert SQLAlchemy Policy object to dictionary response with only database fields
    This is the clean response for list endpoints showing only stored data
    """
    try:
        # Extract only database fields that exist in the model
        db_data = {}

        # Map database fields directly
        db_field_mapping = {
            "id": "id",
            "policy_number": "policy_number",
            "child_id": "child_id",
            "agent_code": "agent_code",
            "additional_documents": "additional_documents",
            "policy_pdf_url": "policy_pdf_url",
            "booking_date": "booking_date",
            "policy_start_date": "policy_start_date",
            "policy_end_date": "policy_end_date",
            "created_at": "created_at",
            "updated_at": "updated_at",
        }

        for db_field, response_field in db_field_mapping.items():
            if hasattr(policy_obj, db_field):
                value = getattr(policy_obj, db_field)
                # Convert UUID to string for JSON serialization
                if response_field == "id" and value:
                    value = str(value)
                # Convert date objects to ISO format for JSON serialization
                elif (
                    response_field
                    in ["booking_date", "policy_start_date", "policy_end_date"]
                    and value
                ):
                    value = value.isoformat()
                # Convert datetime objects to ISO format for JSON serialization
                elif response_field in ["created_at", "updated_at"] and value:
                    value = value.isoformat()
                db_data[response_field] = value

        return db_data

    except Exception as e:
        logger.error(f"Error converting policy object to response: {str(e)}")
        # Return minimal data in case of error
        return {
            "id": str(getattr(policy_obj, "id", "")),
            "policy_number": getattr(policy_obj, "policy_number", ""),
            "error": "Failed to convert policy data",
        }
