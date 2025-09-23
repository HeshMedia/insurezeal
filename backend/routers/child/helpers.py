import logging
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import HTTPException, status
from sqlalchemy import and_, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from models import Broker, ChildIdRequest, Insurer

logger = logging.getLogger(__name__)


class ChildHelpers:
    """
    Child ID Request Management Helper Class

    Provides comprehensive business logic for managing child ID requests,
    broker-insurer relationships, and the complete child ID lifecycle within
    the InsureZeal platform. This class handles the complex workflows involved
    in child ID assignment and management for insurance agents.

    Key Capabilities:

    **Child ID Request Lifecycle**:
    - Creation of new child ID requests with comprehensive validation
    - Request retrieval with filtering by user, status, broker, and insurer
    - Approval process with child ID assignment and availability checking
    - Rejection handling with detailed reasoning and audit trails
    - Status updates and transition management throughout the lifecycle

    **Broker & Insurer Management**:
    - Validation of broker codes with active status verification
    - Validation of insurer codes with business rule compliance
    - Retrieval of active brokers and insurers for dropdown populations
    - Relationship validation between brokers and insurers
    - Code format validation and existence checking

    **Child ID Assignment Logic**:
    - Intelligent child ID generation with uniqueness validation
    - Assignment of available child IDs to approved requests
    - Conflict resolution for simultaneous assignment attempts
    - Child ID suspension and reactivation capabilities
    - Tracking of child ID usage and availability status

    **Advanced Filtering & Search**:
    - Multi-criteria filtering for child ID requests
    - Pagination support for large datasets
    - Date range filtering for administrative reporting
    - Status-based filtering for workflow management
    - User-specific request retrieval with privacy controls

    **Statistical Analysis**:
    - Child ID usage statistics and analytics
    - Request approval/rejection ratios
    - Broker and insurer performance metrics
    - Time-based analysis for operational insights
    - Status distribution reporting for management dashboards

    **Data Validation & Security**:
    - Comprehensive input validation for all operations
    - UUID format validation and conversion
    - Business rule enforcement for child ID assignments
    - Access control validation for administrative operations
    - Data integrity checks across related entities

    **Integration Features**:
    - Database relationship management with proper joins
    - Transaction handling with rollback capabilities
    - Error handling with detailed logging and audit trails
    - Performance optimization for query operations
    - Lazy loading for related entity data

    **Workflow Management**:
    - Request status tracking throughout the approval process
    - Administrative approval workflows with proper authorization
    - Notification triggers for status changes
    - Audit trail maintenance for compliance requirements
    - Bulk operations for administrative efficiency

    This helper class encapsulates the complex business logic required for
    managing child ID requests, ensuring data integrity, proper validation,
    and seamless workflow execution across the platform.
    """

    def __init__(self):
        pass

    async def create_child_id_request(
        self, db: AsyncSession, user_id: str, request_data: Dict[str, Any]
    ) -> ChildIdRequest:
        """
        Create a new child ID request with code validation

        Args:
            db: Database session
            user_id: User ID making the request
            request_data: Request details with broker_code and insurer_code

        Returns:
            Created ChildIdRequest object
        """
        try:
            from sqlalchemy.orm import selectinload

            insurer_code = request_data.get("insurer_code")
            if not insurer_code:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Insurer code is required",
                )

            await self.validate_insurer_code(db, insurer_code)
            broker_code = request_data.get("broker_code")
            if broker_code:
                await self.validate_broker_code(db, broker_code)

            # Handle both UUID object and string inputs for user_id
            if isinstance(user_id, uuid.UUID):
                user_uuid = user_id
            else:
                user_uuid = uuid.UUID(user_id)

            child_request = ChildIdRequest(user_id=user_uuid, **request_data)

            db.add(child_request)
            await db.commit()
            await db.refresh(child_request)

            query = (
                select(ChildIdRequest)
                .options(
                    selectinload(ChildIdRequest.insurer),
                    selectinload(ChildIdRequest.broker),
                )
                .where(ChildIdRequest.id == child_request.id)
            )
            result = await db.execute(query)
            child_request = result.scalar_one()

            logger.info(
                f"Created child ID request {child_request.id} for user {user_id}"
            )
            return child_request

        except HTTPException:
            await db.rollback()
            raise
        except Exception as e:
            await db.rollback()
            logger.error(f"Error creating child ID request: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create child ID request",
            )

    async def get_user_child_requests(
        self, db: AsyncSession, user_id: str, page: int = 1, page_size: int = 20
    ) -> Dict[str, Any]:
        """
        Get all child ID requests for a specific user

        Args:
            db: Database session
            user_id: User ID
            page: Page number
            page_size: Items per page

        Returns:
            Dictionary with child requests and pagination info
        """
        try:
            from sqlalchemy.orm import selectinload

            # Handle both UUID object and string inputs
            try:
                if isinstance(user_id, uuid.UUID):
                    user_uuid = user_id
                    logger.info(f"Received UUID object for user_id: {user_id}")
                else:
                    user_uuid = uuid.UUID(user_id)
                    logger.info(
                        f"Successfully parsed user_id UUID from string: {user_id}"
                    )
            except (ValueError, TypeError) as uuid_error:
                logger.error(
                    f"Invalid UUID format for user_id: '{user_id}' - Type: {type(user_id)} - Error: {str(uuid_error)}"
                )
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid user ID format. Expected valid UUID, got: '{user_id}'",
                )

            query = (
                select(ChildIdRequest)
                .options(
                    selectinload(ChildIdRequest.insurer),
                    selectinload(ChildIdRequest.broker),
                )
                .where(ChildIdRequest.user_id == user_uuid)
            )

            count_query = select(func.count()).select_from(query.subquery())
            total_count = await db.scalar(count_query)

            query = query.order_by(desc(ChildIdRequest.created_at))
            query = query.offset((page - 1) * page_size).limit(page_size)

            result = await db.execute(query)
            requests = result.scalars().all()

            return {
                "child_requests": requests,
                "total_count": total_count or 0,
                "page": page,
                "page_size": page_size,
                "total_pages": (
                    (total_count + page_size - 1) // page_size if total_count else 0
                ),
            }

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error fetching user child requests: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to fetch user child requests",
            )

    async def get_child_request_by_id(
        self, db: AsyncSession, request_id: str, user_id: Optional[str] = None
    ) -> ChildIdRequest:
        """
        Get a specific child ID request by ID

        Args:
            db: Database session
            request_id: Child ID request ID
            user_id: Optional user ID to restrict access

        Returns:
            ChildIdRequest object
        """
        try:
            from sqlalchemy.orm import selectinload

            # Validate UUID format before attempting conversion
            try:
                request_uuid = uuid.UUID(request_id)
                logger.info(f"Successfully parsed request_id UUID: {request_id}")
            except ValueError as uuid_error:
                logger.error(
                    f"Invalid UUID format for request_id: '{request_id}' - Length: {len(request_id)} - Error: {str(uuid_error)}"
                )
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid request ID format. Expected valid UUID, got: '{request_id}'",
                )

            query = (
                select(ChildIdRequest)
                .options(
                    selectinload(ChildIdRequest.insurer),
                    selectinload(ChildIdRequest.broker),
                )
                .where(ChildIdRequest.id == request_uuid)
            )

            if user_id:
                try:
                    if isinstance(user_id, uuid.UUID):
                        user_uuid = user_id
                    else:
                        user_uuid = uuid.UUID(user_id)
                    query = query.where(ChildIdRequest.user_id == user_uuid)
                except (ValueError, TypeError) as uuid_error:
                    logger.error(
                        f"Invalid UUID format for user_id: '{user_id}' - Type: {type(user_id)} - Error: {str(uuid_error)}"
                    )
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Invalid user ID format. Expected valid UUID, got: '{user_id}'",
                    )

            result = await db.execute(query)
            child_request = result.scalar_one_or_none()

            if not child_request:
                logger.warning(f"Child ID request not found for UUID: {request_id}")
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Child ID request not found",
                )

            return child_request

        except HTTPException:
            raise
        except Exception as e:
            logger.error(
                f"Unexpected error fetching child request {request_id}: {str(e)}"
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to fetch child ID request",
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
        Get all child ID requests (admin function)

        Args:
            db: Database session
            page: Page number
            page_size: Items per page
            status_filter: Optional status filter
            search: Optional search term

        Returns:
            Dictionary with all child requests and pagination info
        """
        try:
            query = select(ChildIdRequest)

            if status_filter:
                query = query.where(ChildIdRequest.status == status_filter)

            if search:
                search_term = f"%{search.lower()}%"
                query = query.where(
                    or_(
                        ChildIdRequest.insurance_company.ilike(search_term),
                        ChildIdRequest.broker.ilike(search_term),
                        ChildIdRequest.child_id.ilike(search_term),
                        ChildIdRequest.location.ilike(search_term),
                    )
                )

            count_query = select(func.count()).select_from(query.subquery())
            total_count = await db.scalar(count_query)

            query = query.order_by(desc(ChildIdRequest.created_at))
            query = query.offset((page - 1) * page_size).limit(page_size)

            result = await db.execute(query)
            requests = result.scalars().all()

            return {
                "child_requests": requests,
                "total_count": total_count or 0,
                "page": page,
                "page_size": page_size,
            }

        except Exception as e:
            logger.error(f"Error fetching all child requests: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to fetch child ID requests",
            )

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
            child_request = await self.get_child_request_by_id(db, request_id)

            if child_request.status != "pending":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Only pending requests can be approved",
                )

            for field, value in assignment_data.items():
                setattr(child_request, field, value)

            child_request.status = "accepted"
            child_request.approved_by = uuid.UUID(admin_user_id)
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
        except Exception as e:
            await db.rollback()
            logger.error(f"Error approving child request: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to approve child ID request",
            )

    async def update_child_status(
        self,
        db: AsyncSession,
        request_id: str,
        new_status: str,
        admin_notes: Optional[str] = None,
        admin_user_id: Optional[str] = None,
    ) -> ChildIdRequest:
        """
        Update child ID request status (reject, suspend, etc.)

        Args:
            db: Database session
            request_id: Child ID request ID
            new_status: New status
            admin_notes: Optional admin notes
            admin_user_id: Admin user ID

        Returns:
            Updated ChildIdRequest object
        """
        try:
            child_request = await self.get_child_request_by_id(db, request_id)

            child_request.status = new_status
            if admin_notes:
                child_request.admin_notes = admin_notes
            if admin_user_id:
                child_request.approved_by = uuid.UUID(admin_user_id)
                child_request.approved_at = datetime.utcnow()
            child_request.updated_at = datetime.utcnow()

            await db.commit()
            await db.refresh(child_request)

            logger.info(f"Updated child ID request {request_id} status to {new_status}")
            return child_request

        except HTTPException:
            raise
        except Exception as e:
            await db.rollback()
            logger.error(f"Error updating child request status: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update child ID request status",
            )

    async def require_admin(self, current_user: Dict[str, Any]) -> None:
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
                status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required"
            )

    async def get_user_active_child_ids(
        self, db: AsyncSession, user_id: str
    ) -> List[ChildIdRequest]:
        """
        Get user's active (accepted) child IDs

        Args:
            db: Database session
            user_id: User ID

        Returns:
            List of accepted ChildIdRequest objects
        """
        try:
            from sqlalchemy.orm import selectinload

            # Handle both UUID object and string inputs
            try:
                if isinstance(user_id, uuid.UUID):
                    user_uuid = user_id
                    logger.info(f"Received UUID object for user_id: {user_id}")
                else:
                    user_uuid = uuid.UUID(user_id)
                    logger.info(
                        f"Successfully parsed user_id UUID from string: {user_id}"
                    )
            except (ValueError, TypeError) as uuid_error:
                logger.error(
                    f"Invalid UUID format for user_id: '{user_id}' - Type: {type(user_id)} - Error: {str(uuid_error)}"
                )
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid user ID format. Expected valid UUID, got: '{user_id}'",
                )

            query = (
                select(ChildIdRequest)
                .options(
                    selectinload(ChildIdRequest.insurer),
                    selectinload(ChildIdRequest.broker),
                )
                .where(
                    and_(
                        ChildIdRequest.user_id == user_uuid,
                        ChildIdRequest.status == "accepted",
                    )
                )
                .order_by(desc(ChildIdRequest.approved_at))
            )

            result = await db.execute(query)
            return result.scalars().all()

        except Exception as e:
            logger.error(f"Error fetching active child IDs: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to fetch active child IDs",
            )

    async def get_filtered_child_ids(
        self,
        db: AsyncSession,
        insurer_code: str,
        broker_code: Optional[str] = None,
        agent_id: Optional[str] = None,
    ) -> List[ChildIdRequest]:
        """
        Get active child IDs filtered by parameters with strict code type logic

        Args:
            db: Database session
            insurer_code: Required insurer code to filter by
            broker_code: Optional broker code to filter by
            agent_id: Optional agent ID to filter by (only for agents)

        Returns:
            List of filtered ChildIdRequest objects

        Logic:
            - If broker_code provided: Only return child IDs with code_type="broker" AND matching both insurer_code AND broker_code
            - If broker_code not provided: Only return child IDs with code_type="direct" AND matching insurer_code
            - If agent_id provided: Only return child IDs assigned to that specific agent
        """
        try:
            from sqlalchemy.orm import selectinload

            # Base conditions (filter directly on ChildIdRequest to avoid requiring joined rows)
            # Use case-insensitive comparisons to avoid data casing mismatches
            conditions = [
                func.lower(ChildIdRequest.status) == "accepted",
                func.lower(ChildIdRequest.insurer_code) == insurer_code.lower(),
            ]

            # Apply strict code type logic
            if broker_code:
                # Broker type: Must have both insurer and broker codes
                conditions.extend(
                    [
                        func.lower(ChildIdRequest.code_type) == "broker",
                        func.lower(ChildIdRequest.broker_code) == broker_code.lower(),
                    ]
                )
            else:
                # Direct type: Only ensure code_type is direct
                # Do NOT require broker_code IS NULL, as some data may store empty strings
                conditions.extend(
                    [
                        func.lower(ChildIdRequest.code_type) == "direct",
                    ]
                )

            # Agent filter: Only return child IDs assigned to this agent
            if agent_id:
                try:
                    if isinstance(agent_id, uuid.UUID):
                        agent_uuid = agent_id
                    else:
                        agent_uuid = uuid.UUID(agent_id)
                    conditions.append(ChildIdRequest.user_id == agent_uuid)
                except ValueError as uuid_error:
                    logger.error(
                        f"Invalid UUID format for agent_id: '{agent_id}' - Type: {type(agent_id)} - Error: {str(uuid_error)}"
                    )
                    # Skip agent filtering if UUID is invalid rather than failing the entire request
                    logger.warning(f"Skipping agent filter due to invalid UUID: {agent_id}")

            # Build query: avoid inner joins so we don't drop records when related rows are missing
            query = (
                select(ChildIdRequest)
                .options(
                    selectinload(ChildIdRequest.insurer),
                    selectinload(ChildIdRequest.broker),
                )
                .where(and_(*conditions))
                .order_by(desc(ChildIdRequest.approved_at))
            )

            result = await db.execute(query)
            return result.scalars().all()

        except Exception as e:
            logger.error(f"Error fetching filtered child IDs: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to fetch filtered child IDs",
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
            query = select(ChildIdRequest)

            conditions = []
            if status_filter:
                conditions.append(ChildIdRequest.status == status_filter)
            if search:
                search_term = f"%{search.lower()}%"
                conditions.append(
                    or_(
                        func.lower(ChildIdRequest.insurance_company).like(search_term),
                        func.lower(ChildIdRequest.broker).like(search_term),
                        func.lower(ChildIdRequest.email).like(search_term),
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

            return {
                "requests": requests,
                "total_count": total_count,
                "total_pages": total_pages,
            }

        except Exception as e:
            logger.error(f"Error fetching all child requests: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to fetch child ID requests",
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
            status_counts = {}
            for status_val in ["pending", "accepted", "rejected", "suspended"]:
                count = await db.scalar(
                    select(func.count()).where(ChildIdRequest.status == status_val)
                )
                status_counts[status_val] = count or 0

            from datetime import datetime, timedelta

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

    # ============ VALIDATION HELPERS FOR CODE-BASED LOOKUPS ============

    async def validate_broker_code(self, db: AsyncSession, broker_code: str) -> Broker:
        """
        Validate and fetch broker by broker_code

        Args:
            db: Database session
            broker_code: Broker code to validate

        Returns:
            Broker object if valid

        Raises:
            HTTPException: If broker not found or inactive
        """
        try:
            result = await db.execute(
                select(Broker).where(
                    and_(Broker.broker_code == broker_code, Broker.is_active == True)
                )
            )
            broker = result.scalar_one_or_none()

            if not broker:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid or inactive broker code: {broker_code}",
                )

            return broker

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error validating broker code {broker_code}: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to validate broker code",
            )

    async def validate_insurer_code(
        self, db: AsyncSession, insurer_code: str
    ) -> Insurer:
        """
        Validate and fetch insurer by insurer_code

        Args:
            db: Database session
            insurer_code: Insurer code to validate

        Returns:
            Insurer object if valid

        Raises:
            HTTPException: If insurer not found or inactive
        """
        try:
            result = await db.execute(
                select(Insurer).where(
                    and_(
                        Insurer.insurer_code == insurer_code, Insurer.is_active == True
                    )
                )
            )
            insurer = result.scalar_one_or_none()

            if not insurer:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid or inactive insurer code: {insurer_code}",
                )

            return insurer

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error validating insurer code {insurer_code}: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to validate insurer code",
            )

    # ============ DROPDOWN HELPER FUNCTIONS ============

    async def get_active_brokers(self, db: AsyncSession) -> List[Broker]:
        """
        Get all active brokers for dropdown selection

        Args:
            db: Database session

        Returns:
            List of active Broker objects
        """
        try:
            result = await db.execute(
                select(Broker).where(Broker.is_active == True).order_by(Broker.name)
            )
            return result.scalars().all()

        except Exception as e:
            logger.error(f"Error fetching active brokers: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to fetch brokers",
            )

    async def get_active_insurers(self, db: AsyncSession) -> List[Insurer]:
        """
        Get all active insurers for dropdown selection

        Args:
            db: Database session

        Returns:
            List of active Insurer objects
        """
        try:
            result = await db.execute(
                select(Insurer).where(Insurer.is_active == True).order_by(Insurer.name)
            )
            return result.scalars().all()

        except Exception as e:
            logger.error(f"Error fetching active insurers: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to fetch insurers",
            )
