from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, desc, or_
from sqlalchemy.orm import selectinload
from sqlalchemy.exc import IntegrityError
from models import UserProfile, UserDocument, ChildIdRequest
from fastapi import HTTPException, status
from typing import Optional, Dict, Any, List
import logging
from datetime import datetime
from supabase import Client
from config import get_supabase_admin_client
from utils.google_sheets import google_sheets_sync
import uuid

logger = logging.getLogger(__name__)


class AdminHelpers:
    """
    Helper functions for admin operations

    FUNCTIONS:
    - require_admin() - Check admin access
    - get_all_agents() - Get paginated agent list
    - get_agent_by_id() - Get specific agent
    - get_agent_documents() - Get agent's documents
    - get_agent_with_documents() - Get agent profile with documents
    - delete_agent() - Delete agent and all data
    - get_admin_statistics() - Get dashboard statistics
    - get_user_email_from_supabase() - Get email from Supabase
    """

    def __init__(self):
        self._admin_client = None

    @property
    def admin_client(self) -> Client:
        if self._admin_client is None:
            self._admin_client = get_supabase_admin_client()
        return self._admin_client

    def require_admin(self, current_user: Dict[str, Any]) -> None:
        """
        Check if the current user is an admin

        Args:
            current_user: Dictionary containing user profile and supabase user data

        Raises:
            HTTPException: If user is not an admin
        """
        user_role = current_user.get("role", "agent")
        if user_role not in ["admin", "superadmin"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin access required. Only administrators can access this resource.",
            )

    async def get_user_email_from_supabase(self, user_id: str) -> str:
        """
        Get user email from Supabase auth

        Args:
            user_id: Supabase user ID

        Returns:
            Email address or empty string if not found
        """
        try:
            response = self.admin_client.auth.admin.get_user_by_id(user_id)
            if response and response.user:
                return response.user.email or ""
            return ""
        except Exception as e:
            logger.warning(f"Failed to get email for user {user_id}: {str(e)}")
            return ""

    async def get_all_agents(
        self,
        db: AsyncSession,
        page: int = 1,
        page_size: int = 20,
        search: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Get all agents with pagination and optional search

        Args:
            db: Database session
            page: Page number (starting from 1)
            page_size: Number of items per page
            search: Optional search term for name, email, or agent code

        Returns:
            Dictionary containing agents list and pagination info
        """
        try:
            query = select(UserProfile).where(UserProfile.user_role == "agent")

            if search:
                search_term = f"%{search.lower()}%"
                query = query.where(
                    UserProfile.first_name.ilike(search_term)
                    | UserProfile.last_name.ilike(search_term)
                    | UserProfile.agent_code.ilike(search_term)
                )

            count_query = select(func.count()).select_from(query.subquery())
            total_count = await db.scalar(count_query)

            query = query.order_by(desc(UserProfile.created_at))
            query = query.offset((page - 1) * page_size).limit(page_size)

            result = await db.execute(query)
            agents = result.scalars().all()

            return {
                "agents": agents,
                "total_count": total_count or 0,
                "page": page,
                "page_size": page_size,
            }

        except Exception as e:
            logger.error(f"Error fetching agents: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to fetch agents",
            )

    async def get_agent_by_id(self, db: AsyncSession, agent_id: str) -> UserProfile:
        """
        Get a specific agent by ID

        Args:
            db: Database session
            agent_id: Agent's profile ID

        Returns:
            UserProfile object

        Raises:
            HTTPException: If agent not found or is not an agent
        """
        try:
            query = select(UserProfile).where(
                and_(UserProfile.id == agent_id, UserProfile.user_role == "agent")
            )

            result = await db.execute(query)
            agent = result.scalar_one_or_none()

            if not agent:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Agent with ID {agent_id} not found",
                )

            return agent

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error fetching agent {agent_id}: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to fetch agent details",
            )

    async def get_agent_documents(
        self, db: AsyncSession, user_id: str
    ) -> Dict[str, str]:
        """
        Get all documents for a specific agent by user_id

        Args:
            db: Database session
            user_id: Agent's user ID from supabase

        Returns:
            Dictionary mapping document types to URLs
        """
        try:
            doc_query = select(UserDocument).where(UserDocument.user_id == user_id)
            doc_result = await db.execute(doc_query)
            documents = doc_result.scalars().all()

            return {
                doc.document_type: doc.file_url for doc in documents if doc.file_url
            }

        except Exception as e:
            logger.error(f"Error fetching documents for user {user_id}: {str(e)}")
            return {}

    async def get_agent_with_documents(
        self, db: AsyncSession, agent_id: str
    ) -> Dict[str, Any]:
        """
        Get agent profile with document URLs and email

        Args:
            db: Database session
            agent_id: Agent's profile ID

        Returns:
            Dictionary containing agent data and document URLs
        """
        try:
            agent = await self.get_agent_by_id(db, agent_id)
            document_urls = await self.get_agent_documents(db, agent.user_id)
            email = await self.get_user_email_from_supabase(str(agent.user_id))

            agent_data = {
                column.name: getattr(agent, column.name)
                for column in agent.__table__.columns
            }
            agent_data["email"] = email
            agent_data["document_urls"] = document_urls

            return agent_data

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error fetching agent with documents {agent_id}: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to fetch agent details with documents",
            )

    async def delete_agent(self, db: AsyncSession, agent_id: str) -> Dict[str, str]:
        """
        Delete an agent and all related data

        Args:
            db: Database session
            agent_id: Agent's profile ID

        Returns:
            Dictionary with deletion confirmation

        Raises:
            HTTPException: If agent not found or deletion fails
        """
        try:
            agent = await self.get_agent_by_id(db, agent_id)
            user_id = agent.user_id

            doc_query = select(UserDocument).where(UserDocument.user_id == user_id)
            doc_result = await db.execute(doc_query)
            documents = doc_result.scalars().all()

            for doc in documents:
                await db.delete(doc)

            await db.delete(agent)
            await db.commit()

            logger.info(
                f"Successfully deleted agent {agent_id} and {len(documents)} related documents"
            )

            return {
                "deleted_agent_id": agent_id,
                "deleted_user_id": str(user_id),
                "message": f"Agent {agent.first_name} {agent.last_name} (ID: {agent_id}) has been successfully deleted along with all related data.",
            }

        except HTTPException:
            raise
        except Exception as e:
            await db.rollback()
            logger.error(f"Error deleting agent {agent_id}: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete agent. Please try again.",
            )

    async def get_admin_statistics(self, db: AsyncSession) -> Dict[str, int]:
        """
        Get admin dashboard statistics
          Args:
            db: Database session

        Returns:
            Dictionary with various statistics
        """
        try:
            total_agents_query = select(func.count()).where(
                UserProfile.user_role == "agent"
            )
            total_agents = await db.scalar(total_agents_query) or 0

            from datetime import datetime

            this_month = datetime.now().replace(day=1)
            new_agents_query = select(func.count()).where(
                and_(
                    UserProfile.user_role == "agent",
                    UserProfile.created_at >= this_month,
                )
            )
            new_agents_this_month = await db.scalar(new_agents_query) or 0

            return {
                "total_agents": total_agents,
                "new_agents_this_month": new_agents_this_month,
            }

        except Exception as e:
            logger.error(f"Error getting admin statistics: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to fetch admin statistics",
            )

    async def get_all_child_requests(
        self,
        db: AsyncSession,
        page: int = 1,
        page_size: int = 20,
        status_filter: Optional[str] = None,
        search: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Get all child ID requests for admin with filtering

        Args:
            db: Database session
            page: Page number
            page_size: Items per page
            status_filter: Filter by status
            search: Search term

        Returns:
            Dictionary with requests and pagination info
        """
        try:
            query = (
                select(ChildIdRequest)
                .options(
                    selectinload(ChildIdRequest.insurer),
                    selectinload(ChildIdRequest.broker),
                )
                .join(
                    UserProfile,
                    ChildIdRequest.user_id == UserProfile.user_id,
                    isouter=True,
                )
            )

            conditions = []
            if status_filter:
                conditions.append(ChildIdRequest.status == status_filter)
            if search:
                search_term = f"%{search.lower()}%"
                conditions.append(
                    or_(
                        func.lower(ChildIdRequest.email).like(search_term),
                        func.lower(ChildIdRequest.location).like(search_term),
                        func.lower(ChildIdRequest.child_id).like(search_term),
                        func.lower(ChildIdRequest.phone_number).like(search_term),
                    )
                )

            if conditions:
                query = query.where(and_(*conditions))

            count_query = select(func.count()).select_from(query.subquery())
            total_count = await db.scalar(count_query)

            total_pages = (total_count + page_size - 1) // page_size

            query = query.order_by(desc(ChildIdRequest.created_at))
            query = query.offset((page - 1) * page_size).limit(page_size)

            result = await db.execute(query)
            requests = result.scalars().all()

            # Fetch agent information for each request
            enriched_requests = []
            for request in requests:
                # Get the UserProfile for this request
                user_query = select(UserProfile).where(
                    UserProfile.user_id == request.user_id
                )
                user_result = await db.execute(user_query)
                user_profile = user_result.scalar_one_or_none()

                # Add agent information to the request object
                if user_profile:
                    # Create agent name from first_name and last_name
                    agent_name = None
                    if user_profile.first_name or user_profile.last_name:
                        agent_name = f"{user_profile.first_name or ''} {user_profile.last_name or ''}".strip()

                    # Debug logging for agent information
                    logger.info(
                        f"Agent info for request {request.id}: agent_name={agent_name}, agent_code={user_profile.agent_code}"
                    )

                    # Add agent attributes to the request object
                    request.agent_name = agent_name
                    request.agent_code = user_profile.agent_code
                else:
                    logger.warning(
                        f"No user profile found for user_id {request.user_id}"
                    )
                    request.agent_name = None
                    request.agent_code = None

                enriched_requests.append(request)

            return {
                "requests": enriched_requests,
                "total_count": total_count,
                "total_pages": total_pages,
            }

        except Exception as e:
            logger.error(f"Error fetching all child requests: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to fetch child ID requests",
            )

    async def get_child_request_by_id(
        self, db: AsyncSession, request_id: str
    ) -> ChildIdRequest:
        """Get a specific child ID request by ID
        Args:
            db: Database session
            request_id: Child ID request ID
        Returns:
            ChildIdRequest object
        Raises:
            HTTPException: If request not found
        """
        query = select(ChildIdRequest).where(ChildIdRequest.id == uuid.UUID(request_id))
        result = await db.execute(query)
        child_request = result.scalar_one_or_none()

        if not child_request:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Child ID request not found",
            )
        return child_request

    async def approve_child_request(
        self,
        db: AsyncSession,
        request_id: str,
        assignment_data: Dict[str, Any],
        admin_user_id: str,
    ) -> ChildIdRequest:
        """
        Approve a child ID request and assign details

        Args:
            db: Database session
            request_id: Child ID request ID
            assignment_data: Assignment details from admin
            admin_user_id: Admin user ID

        Returns:
            Updated ChildIdRequest object
        """
        try:
            from models import ChildIdRequest
            from datetime import datetime
            import uuid

            query = (
                select(ChildIdRequest)
                .options(
                    selectinload(ChildIdRequest.insurer),
                    selectinload(ChildIdRequest.broker),
                )
                .where(ChildIdRequest.id == uuid.UUID(request_id))
            )
            result = await db.execute(query)
            child_request = result.scalar_one_or_none()

            if not child_request:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Child ID request not found",
                )
            if child_request.status != "pending":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Only pending requests can be approved",
                )

            if "child_id" in assignment_data and assignment_data["child_id"]:
                child_id_exists = await self.check_child_id_exists(
                    db, assignment_data["child_id"]
                )
                if child_id_exists:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Child ID already exists. Please choose a different child ID.",
                    )

            # Log the assignment data for debugging
            logger.info(f"Assignment data being processed: {assignment_data}")

            # Set all fields from assignment data
            for field, value in assignment_data.items():
                if hasattr(child_request, field):
                    logger.info(f"Setting field '{field}' to value: {value}")
                    setattr(child_request, field, value)
                else:
                    logger.warning(f"Field '{field}' not found in ChildIdRequest model")

            # Explicitly log password field handling
            if "password" in assignment_data:
                logger.info(
                    f"Password field found in assignment data: {assignment_data['password']}"
                )
            else:
                logger.warning("Password field not found in assignment data")

            child_request.status = "accepted"
            # Convert admin_user_id to UUID if it's a string, otherwise use as-is
            if isinstance(admin_user_id, str):
                child_request.approved_by = uuid.UUID(admin_user_id)
            else:
                child_request.approved_by = admin_user_id
            child_request.approved_at = datetime.utcnow()
            child_request.updated_at = datetime.utcnow()

            await db.commit()
            await db.refresh(child_request)

            logger.info(
                f"Approved child ID request {request_id} by admin {admin_user_id}"
            )
            return child_request

        except HTTPException:
            raise
        except IntegrityError as e:
            await db.rollback()
            logger.error(f"Integrity error approving child request: {str(e)}")

            if "duplicate key value violates unique constraint" in str(
                e
            ) and "child_id" in str(e):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Child ID already exists. Please choose a different child ID.",
                )

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Data integrity error. Please check your input.",
            )
        except Exception as e:
            await db.rollback()
            logger.error(f"Error approving child request: {str(e)}")

            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to approve child ID request",
            )

    async def reject_child_request(
        self, db: AsyncSession, request_id: str, admin_notes: str, admin_user_id: str
    ) -> ChildIdRequest:
        """
        Reject a child ID request

        Args:
            db: Database session
            request_id: Child ID request ID
            admin_notes: Rejection reason
            admin_user_id: Admin user ID

        Returns:
            Updated ChildIdRequest object
        """
        try:
            from models import ChildIdRequest
            from datetime import datetime
            import uuid

            query = (
                select(ChildIdRequest)
                .options(
                    selectinload(ChildIdRequest.insurer),
                    selectinload(ChildIdRequest.broker),
                )
                .where(ChildIdRequest.id == uuid.UUID(request_id))
            )
            result = await db.execute(query)
            child_request = result.scalar_one_or_none()

            if not child_request:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Child ID request not found",
                )

            if child_request.status != "pending":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Only pending requests can be rejected",
                )

            child_request.status = "rejected"
            child_request.admin_notes = admin_notes
            # Convert admin_user_id to UUID if it's a string, otherwise use as-is
            if isinstance(admin_user_id, str):
                child_request.approved_by = uuid.UUID(admin_user_id)
            else:
                child_request.approved_by = admin_user_id
            child_request.approved_at = datetime.utcnow()
            child_request.updated_at = datetime.utcnow()

            await db.commit()
            await db.refresh(child_request)

            logger.info(
                f"Rejected child ID request {request_id} by admin {admin_user_id}"
            )
            return child_request

        except HTTPException:
            raise
        except Exception as e:
            await db.rollback()
            logger.error(f"Error rejecting child request: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to reject child ID request",
            )

    async def suspend_child_id(
        self, db: AsyncSession, request_id: str, admin_notes: str, admin_user_id: str
    ) -> ChildIdRequest:
        """
        Suspend an active child ID

        Args:
            db: Database session
            request_id: Child ID request ID
            admin_notes: Suspension reason
            admin_user_id: Admin user ID

        Returns:
            Updated ChildIdRequest object
        """
        try:
            from models import ChildIdRequest
            from datetime import datetime
            import uuid

            query = (
                select(ChildIdRequest)
                .options(
                    selectinload(ChildIdRequest.insurer),
                    selectinload(ChildIdRequest.broker),
                )
                .where(ChildIdRequest.id == uuid.UUID(request_id))
            )
            result = await db.execute(query)
            child_request = result.scalar_one_or_none()

            if not child_request:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Child ID request not found",
                )

            if child_request.status != "accepted":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Only accepted child IDs can be suspended",
                )

            child_request.status = "suspended"
            child_request.admin_notes = admin_notes
            # Convert admin_user_id to UUID if it's a string, otherwise use as-is
            if isinstance(admin_user_id, str):
                child_request.approved_by = uuid.UUID(admin_user_id)
            else:
                child_request.approved_by = admin_user_id
            child_request.approved_at = datetime.utcnow()
            child_request.updated_at = datetime.utcnow()

            await db.commit()
            await db.refresh(child_request)

            logger.info(
                f"Suspended child ID request {request_id} by admin {admin_user_id}"
            )
            return child_request

        except HTTPException:
            raise
        except Exception as e:
            await db.rollback()
            logger.error(f"Error suspending child request: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to suspend child ID request",
            )

    async def get_child_id_statistics(self, db: AsyncSession) -> Dict[str, Any]:
        """
        Get child ID management statistics for admin dashboard

        Args:
            db: Database session

        Returns:
            Dictionary with various statistics
        """
        try:
            from models import ChildIdRequest
            from datetime import datetime, timedelta

            status_counts = {}
            for status_val in ["pending", "accepted", "rejected", "suspended"]:
                count = await db.scalar(
                    select(func.count()).where(ChildIdRequest.status == status_val)
                )
                status_counts[status_val] = count or 0

            thirty_days_ago = datetime.utcnow() - timedelta(days=30)
            recent_count = await db.scalar(
                select(func.count()).where(ChildIdRequest.created_at >= thirty_days_ago)
            )

            total_requests = await db.scalar(select(func.count(ChildIdRequest.id)))

            return {
                "total_requests": total_requests or 0,
                "recent_requests": recent_count or 0,
                "status_counts": status_counts,
                "active_child_ids": status_counts.get("accepted", 0),
                "pending_requests": status_counts.get("pending", 0),
            }

        except Exception as e:
            logger.error(f"Error fetching child ID statistics: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to fetch child ID statistics",
            )

    async def check_child_id_exists(self, db: AsyncSession, child_id: str) -> bool:
        """
        Check if a child ID already exists

        Args:
            db: Database session
            child_id: Child ID to check

        Returns:
            True if child ID exists, False otherwise
        """
        try:
            from models import ChildIdRequest

            query = select(ChildIdRequest).where(ChildIdRequest.child_id == child_id)
            result = await db.execute(query)
            existing_request = result.scalar_one_or_none()

            return existing_request is not None

        except Exception as e:
            logger.error(f"Error checking child ID existence: {str(e)}")
            return False

    async def process_universal_record_csv(
        self, db: AsyncSession, csv_content: str, admin_user_id: str
    ) -> Dict[str, Any]:
        """
        Process universal record CSV and reconcile with existing data

        Args:
            db: Database session
            csv_content: Raw CSV content
            admin_user_id: ID of admin user performing the operation

        Returns:
            Dictionary containing reconciliation report
        """
        import csv
        import io
        from datetime import datetime
        from models import Policy, CutPay
        from routers.policies.helpers import PolicyHelpers

        start_time = datetime.now()

        try:
            universal_records = await self._parse_universal_csv(csv_content)

            report = {
                "total_records_processed": len(universal_records),
                "policies_updated": 0,
                "policies_added": 0,
                "cutpay_updated": 0,
                "cutpay_added": 0,
                "no_changes": 0,
                "errors": [],
                "processing_summary": [],
            }

            policy_helpers = PolicyHelpers()

            for record in universal_records:
                try:
                    summary = await self._reconcile_single_record(
                        db, record, policy_helpers, admin_user_id
                    )

                    if summary["action"] == "updated":
                        if "policy" in summary["record_type"]:
                            report["policies_updated"] += 1
                        if "cutpay" in summary["record_type"]:
                            report["cutpay_updated"] += 1
                    elif summary["action"] == "added":
                        if "policy" in summary["record_type"]:
                            report["policies_added"] += 1
                        if "cutpay" in summary["record_type"]:
                            report["cutpay_added"] += 1
                    else:
                        report["no_changes"] += 1

                    report["processing_summary"].append(summary)

                except Exception as e:
                    error_msg = f"Error processing record {record.get('policy_number', 'unknown')}: {str(e)}"
                    logger.error(error_msg)
                    report["errors"].append(error_msg)

            await db.commit()

            processing_time = (datetime.now() - start_time).total_seconds()

            logger.info(
                f"Universal record processing completed in {processing_time:.2f}s"
            )
            logger.info(f"Processed {report['total_records_processed']} records")
            logger.info(
                f"Policies: {report['policies_updated']} updated, {report['policies_added']} added"
            )
            logger.info(
                f"Cut Pay: {report['cutpay_updated']} updated, {report['cutpay_added']} added"
            )

            return {**report, "processing_time_seconds": processing_time}

        except Exception as e:
            await db.rollback()
            logger.error(f"Error processing universal record: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to process universal record: {str(e)}",
            )

    async def _parse_universal_csv(self, csv_content: str) -> List[Dict[str, Any]]:
        """Parse CSV content into list of dictionaries"""
        import csv
        import io
        from datetime import datetime

        try:
            csv_file = io.StringIO(csv_content)
            reader = csv.DictReader(csv_file)

            records = []
            for row in reader:
                clean_row = {}
                for key, value in row.items():
                    if value is None or value.strip() == "":
                        clean_row[key.lower().replace(" ", "_")] = None
                    else:
                        if "date" in key.lower():
                            try:
                                clean_row[key.lower().replace(" ", "_")] = (
                                    datetime.strptime(value.strip(), "%Y-%m-%d").date()
                                )
                            except:
                                clean_row[key.lower().replace(" ", "_")] = None
                        elif any(
                            field in key.lower()
                            for field in ["premium", "amount", "gst", "percent"]
                        ):
                            try:
                                clean_row[key.lower().replace(" ", "_")] = float(
                                    value.strip()
                                )
                            except:
                                clean_row[key.lower().replace(" ", "_")] = None
                        else:
                            clean_row[key.lower().replace(" ", "_")] = value.strip()

                if clean_row.get("policy_number"):
                    records.append(clean_row)

            return records

        except Exception as e:
            logger.error(f"Error parsing CSV: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid CSV format: {str(e)}",
            )

    async def _reconcile_single_record(
        self,
        db: AsyncSession,
        universal_record: Dict[str, Any],
        policy_helpers,
        admin_user_id: str,
    ) -> Dict[str, Any]:
        """Reconcile a single universal record with existing data"""
        from models import Policy, CutPay
        from sqlalchemy import select

        policy_number = universal_record["policy_number"]
        summary = {
            "policy_number": policy_number,
            "record_type": "",
            "action": "no_change",
            "updated_fields": [],
            "old_values": {},
            "new_values": {},
        }

        try:
            policy_query = select(Policy).where(Policy.policy_number == policy_number)
            policy_result = await db.execute(policy_query)
            existing_policy = policy_result.scalar_one_or_none()

            cutpay_query = select(CutPay).where(CutPay.policy_number == policy_number)
            cutpay_result = await db.execute(cutpay_query)
            existing_cutpay = cutpay_result.scalar_one_or_none()

            policy_updated = False
            if self._has_policy_data(universal_record):
                if existing_policy:
                    policy_updated = await self._update_policy_from_universal(
                        db, existing_policy, universal_record, summary
                    )
                else:
                    await self._create_policy_from_universal(
                        db, universal_record, admin_user_id, summary
                    )
                    policy_updated = True

            cutpay_updated = False
            if self._has_cutpay_data(universal_record):
                if existing_cutpay:
                    cutpay_updated = await self._update_cutpay_from_universal(
                        db, existing_cutpay, universal_record, summary
                    )
                else:
                    await self._create_cutpay_from_universal(
                        db, universal_record, admin_user_id, summary
                    )
                    cutpay_updated = True

            record_types = []
            if self._has_policy_data(universal_record):
                record_types.append("policy")
            if self._has_cutpay_data(universal_record):
                record_types.append("cutpay")

            summary["record_type"] = "+".join(record_types)

            if policy_updated or cutpay_updated:
                if existing_policy or existing_cutpay:
                    summary["action"] = "updated"
                else:
                    summary["action"] = "added"

            return summary

        except Exception as e:
            logger.error(f"Error reconciling record {policy_number}: {str(e)}")
            raise

    def _has_policy_data(self, record: Dict[str, Any]) -> bool:
        """Check if record contains policy-specific data"""
        policy_fields = [
            "policy_type",
            "insurance_type",
            "vehicle_type",
            "registration_number",
            "start_date",
            "end_date",
        ]
        return any(record.get(field) is not None for field in policy_fields)

    def _has_cutpay_data(self, record: Dict[str, Any]) -> bool:
        """Check if record contains cut pay-specific data"""
        cutpay_fields = [
            "cut_pay_amount",
            "commission_grid",
            "payment_by",
            "amount_received",
            "payment_method",
        ]
        return any(record.get(field) is not None for field in cutpay_fields)

    async def _update_policy_from_universal(
        self,
        db: AsyncSession,
        existing_policy,
        universal_record: Dict[str, Any],
        summary: Dict[str, Any],
    ) -> bool:
        """Update existing policy with universal record data"""
        updated = False

        field_mappings = {
            "policy_type": "policy_type",
            "insurance_type": "insurance_type",
            "agent_code": "agent_code",
            "broker_name": "broker_name",
            "insurance_company": "insurance_company",
            "vehicle_type": "vehicle_type",
            "registration_number": "registration_number",
            "vehicle_class": "vehicle_class",
            "vehicle_segment": "vehicle_segment",
            "gross_premium": "gross_premium",
            "gst": "gst",
            "net_premium": "net_premium",
            "od_premium": "od_premium",
            "tp_premium": "tp_premium",
            "start_date": "start_date",
            "end_date": "end_date",
        }

        for universal_field, policy_field in field_mappings.items():
            if universal_record.get(universal_field) is not None:
                current_value = getattr(existing_policy, policy_field)
                new_value = universal_record[universal_field]
                if current_value != new_value:
                    summary["old_values"][policy_field] = current_value
                    summary["new_values"][policy_field] = new_value
                    summary["updated_fields"].append(policy_field)
                    setattr(existing_policy, policy_field, new_value)
                    updated = True

        if updated:
            existing_policy.updated_at = datetime.now()

            try:
                policy_dict_for_sheets = {
                    "id": existing_policy.id,
                    "policy_number": existing_policy.policy_number,
                    "policy_type": existing_policy.policy_type,
                    "insurance_type": existing_policy.insurance_type,
                    "agent_id": existing_policy.agent_id,
                    "agent_code": existing_policy.agent_code,
                    "child_id": existing_policy.child_id,
                    "broker_name": existing_policy.broker_name,
                    "insurance_company": existing_policy.insurance_company,
                    "vehicle_type": existing_policy.vehicle_type,
                    "registration_number": existing_policy.registration_number,
                    "vehicle_class": existing_policy.vehicle_class,
                    "vehicle_segment": existing_policy.vehicle_segment,
                    "gross_premium": existing_policy.gross_premium,
                    "gst": existing_policy.gst,
                    "net_premium": existing_policy.net_premium,
                    "od_premium": existing_policy.od_premium,
                    "tp_premium": existing_policy.tp_premium,
                    "start_date": existing_policy.start_date,
                    "end_date": existing_policy.end_date,
                    "uploaded_by": existing_policy.uploaded_by,
                    "pdf_file_name": existing_policy.pdf_file_name,
                    "ai_confidence_score": existing_policy.ai_confidence_score,
                    "manual_override": existing_policy.manual_override,
                    "created_at": existing_policy.created_at,
                    "updated_at": existing_policy.updated_at,
                }
                google_sheets_sync.sync_policy(policy_dict_for_sheets, "UPDATE")
                logger.info(
                    f"Universal record updated policy {existing_policy.id} synced to Google Sheets"
                )
            except Exception as sync_error:
                logger.error(
                    f"Failed to sync universal record updated policy {existing_policy.id} to Google Sheets: {str(sync_error)}"
                )
        return updated

    async def _create_policy_from_universal(
        self,
        db: AsyncSession,
        universal_record: Dict[str, Any],
        admin_user_id: str,
        summary: Dict[str, Any],
    ):
        """Create new policy from universal record"""
        from models import Policy

        policy_data = {
            "policy_number": universal_record["policy_number"],
            "policy_type": universal_record.get(
                "policy_type", "Universal Import"
            ),  # Required field
            "insurance_type": universal_record.get("insurance_type"),
            "agent_code": universal_record.get("agent_code"),
            "broker_name": universal_record.get("broker_name"),
            "insurance_company": universal_record.get("insurance_company"),
            "vehicle_type": universal_record.get("vehicle_type"),
            "registration_number": universal_record.get("registration_number"),
            "vehicle_class": universal_record.get("vehicle_class"),
            "vehicle_segment": universal_record.get("vehicle_segment"),
            "gross_premium": universal_record.get("gross_premium"),
            "gst": universal_record.get("gst"),
            "net_premium": universal_record.get("net_premium"),
            "od_premium": universal_record.get("od_premium"),
            "tp_premium": universal_record.get("tp_premium"),
            "start_date": universal_record.get("start_date"),
            "end_date": universal_record.get("end_date"),
            "uploaded_by": admin_user_id,
            "pdf_file_path": "universal_record_import",
            "pdf_file_name": "universal_record_import.csv",
        }

        policy_data = {k: v for k, v in policy_data.items() if v is not None}
        new_policy = Policy(**policy_data)
        db.add(new_policy)
        await db.flush()

        summary["new_values"].update(policy_data)

        try:
            policy_dict_for_sheets = {
                "id": new_policy.id,
                "policy_number": new_policy.policy_number,
                "policy_type": new_policy.policy_type,
                "insurance_type": new_policy.insurance_type,
                "agent_id": new_policy.agent_id,
                "agent_code": new_policy.agent_code,
                "child_id": new_policy.child_id,
                "broker_name": new_policy.broker_name,
                "insurance_company": new_policy.insurance_company,
                "vehicle_type": new_policy.vehicle_type,
                "registration_number": new_policy.registration_number,
                "vehicle_class": new_policy.vehicle_class,
                "vehicle_segment": new_policy.vehicle_segment,
                "gross_premium": new_policy.gross_premium,
                "gst": new_policy.gst,
                "net_premium": new_policy.net_premium,
                "od_premium": new_policy.od_premium,
                "tp_premium": new_policy.tp_premium,
                "start_date": new_policy.start_date,
                "end_date": new_policy.end_date,
                "uploaded_by": new_policy.uploaded_by,
                "pdf_file_name": new_policy.pdf_file_name,
                "ai_confidence_score": new_policy.ai_confidence_score,
                "manual_override": new_policy.manual_override,
                "created_at": new_policy.created_at,
                "updated_at": new_policy.updated_at,
            }
            google_sheets_sync.sync_policy(policy_dict_for_sheets, "CREATE")
            logger.info(
                f"Universal record policy {new_policy.id} synced to Google Sheets"
            )
        except Exception as sync_error:
            logger.error(
                f"Failed to sync universal record policy {new_policy.id} to Google Sheets: {str(sync_error)}"
            )

    async def _update_cutpay_from_universal(
        self,
        db: AsyncSession,
        existing_cutpay,
        universal_record: Dict[str, Any],
        summary: Dict[str, Any],
    ) -> bool:
        """Update existing cut pay with universal record data"""
        updated = False

        field_mappings = {
            "agent_code": "agent_code",
            "insurance_company": "insurance_company",
            "broker_name": "broker",
            "gross_premium": "gross_amount",
            "net_premium": "net_premium",
            "commission_grid": "commission_grid",
            "agent_commission_given_percent": "agent_commission_given_percent",
            "cut_pay_amount": "cut_pay_amount",
            "payment_by": "payment_by",
            "amount_received": "amount_received",
            "payment_method": "payment_method",
            "payment_source": "payment_source",
            "transaction_date": "transaction_date",
            "payment_date": "payment_date",
            "notes": "notes",
        }

        for universal_field, cutpay_field in field_mappings.items():
            if universal_record.get(universal_field) is not None:
                current_value = getattr(existing_cutpay, cutpay_field)
                new_value = universal_record[universal_field]

                if current_value != new_value:
                    summary["old_values"][cutpay_field] = current_value
                    summary["new_values"][cutpay_field] = new_value
                    summary["updated_fields"].append(cutpay_field)
                    setattr(existing_cutpay, cutpay_field, new_value)
                    updated = True
        if updated:
            existing_cutpay.updated_at = datetime.now()

            try:
                cutpay_dict_for_sheets = {
                    "id": existing_cutpay.id,
                    "policy_number": existing_cutpay.policy_number,
                    "agent_code": existing_cutpay.agent_code,
                    "insurance_company": existing_cutpay.insurance_company,
                    "broker": existing_cutpay.broker,
                    "gross_amount": existing_cutpay.gross_amount,
                    "net_premium": existing_cutpay.net_premium,
                    "commission_grid": existing_cutpay.commission_grid,
                    "agent_commission_given_percent": existing_cutpay.agent_commission_given_percent,
                    "cut_pay_amount": existing_cutpay.cut_pay_amount,
                    "payment_by": existing_cutpay.payment_by,
                    "amount_received": existing_cutpay.amount_received,
                    "payment_method": existing_cutpay.payment_method,
                    "payment_source": existing_cutpay.payment_source,
                    "transaction_date": existing_cutpay.transaction_date,
                    "payment_date": existing_cutpay.payment_date,
                    "notes": existing_cutpay.notes,
                    "created_at": existing_cutpay.created_at,
                    "updated_at": existing_cutpay.updated_at,
                }
                google_sheets_sync.sync_cutpay_transaction(
                    cutpay_dict_for_sheets, "UPDATE"
                )
                logger.info(
                    f"Universal record updated cut pay {existing_cutpay.id} synced to Google Sheets"
                )
            except Exception as sync_error:
                logger.error(
                    f"Failed to sync universal record updated cut pay {existing_cutpay.id} to Google Sheets: {str(sync_error)}"
                )

        return updated

    async def _create_cutpay_from_universal(
        self,
        db: AsyncSession,
        universal_record: Dict[str, Any],
        admin_user_id: str,
        summary: Dict[str, Any],
    ):
        """Create new cut pay from universal record"""
        from models import CutPay

        cutpay_data = {
            "policy_number": universal_record["policy_number"],
            "agent_code": universal_record.get("agent_code", ""),
            "insurance_company": universal_record.get("insurance_company", ""),
            "broker": universal_record.get("broker_name", ""),
            "gross_amount": universal_record.get("gross_premium", 0.0),
            "net_premium": universal_record.get("net_premium", 0.0),
            "commission_grid": universal_record.get("commission_grid", ""),
            "agent_commission_given_percent": universal_record.get(
                "agent_commission_given_percent", 0.0
            ),
            "cut_pay_amount": universal_record.get("cut_pay_amount", 0.0),
            "payment_by": universal_record.get("payment_by", ""),
            "amount_received": universal_record.get("amount_received", 0.0),
            "payment_method": universal_record.get("payment_method", ""),
            "payment_source": universal_record.get("payment_source", ""),
            "transaction_date": universal_record.get("transaction_date"),
            "payment_date": universal_record.get("payment_date"),
            "notes": universal_record.get("notes"),
            "created_by": admin_user_id,
        }
        cutpay_data = {k: v for k, v in cutpay_data.items() if v is not None}

        new_cutpay = CutPay(**cutpay_data)
        db.add(new_cutpay)
        await db.flush()

        summary["new_values"].update(cutpay_data)

        try:
            cutpay_dict_for_sheets = {
                "id": new_cutpay.id,
                "policy_number": new_cutpay.policy_number,
                "agent_code": new_cutpay.agent_code,
                "insurance_company": new_cutpay.insurance_company,
                "broker": new_cutpay.broker,
                "gross_amount": new_cutpay.gross_amount,
                "net_premium": new_cutpay.net_premium,
                "commission_grid": new_cutpay.commission_grid,
                "agent_commission_given_percent": new_cutpay.agent_commission_given_percent,
                "cut_pay_amount": new_cutpay.cut_pay_amount,
                "payment_by": new_cutpay.payment_by,
                "amount_received": new_cutpay.amount_received,
                "payment_method": new_cutpay.payment_method,
                "payment_source": new_cutpay.payment_source,
                "transaction_date": new_cutpay.transaction_date,
                "payment_date": new_cutpay.payment_date,
                "notes": new_cutpay.notes,
                "created_at": new_cutpay.created_at,
                "updated_at": new_cutpay.updated_at,
            }
            google_sheets_sync.sync_cutpay_transaction(cutpay_dict_for_sheets, "CREATE")
            logger.info(
                f"Universal record cut pay {new_cutpay.id} synced to Google Sheets"
            )
        except Exception as sync_error:
            logger.error(
                f"Failed to sync universal record cut pay {new_cutpay.id} to Google Sheets: {str(sync_error)}"
            )
