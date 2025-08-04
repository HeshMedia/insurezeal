from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, desc, or_
from models import ChildIdRequest, UserProfile, Broker, Insurer
from fastapi import HTTPException, status
from typing import Optional, Dict, Any, List
import logging
from datetime import datetime
import uuid

logger = logging.getLogger(__name__)

class ChildHelpers:
    """
    Helper functions for child ID management operations
    
    FUNCTIONS:
    - create_child_id_request() - Create new child ID request
    - get_user_child_requests() - Get user's child ID requests
    - get_child_request_by_id() - Get specific child ID request
    - get_all_child_requests() - Get all child ID requests (admin)
    - approve_child_request() - Approve child ID request
    - reject_child_request() - Reject child ID request
    - suspend_child_id() - Suspend active child ID
    - generate_child_id() - Generate unique child ID
    - get_active_brokers() - Get active brokers for dropdown
    - get_active_insurers() - Get active insurers for dropdown
    """
    
    def __init__(self):
        pass

    async def create_child_id_request(
        self,
        db: AsyncSession,
        user_id: str,
        request_data: Dict[str, Any]
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
                    detail="Insurer code is required"
                )
            
            await self.validate_insurer_code(db, insurer_code)
            broker_code = request_data.get("broker_code")
            if broker_code:
                await self.validate_broker_code(db, broker_code)
            
            child_request = ChildIdRequest(
                user_id=uuid.UUID(user_id),
                **request_data
            )
            
            db.add(child_request)
            await db.commit()
            await db.refresh(child_request)

            query = select(ChildIdRequest).options(
                selectinload(ChildIdRequest.insurer),
                selectinload(ChildIdRequest.broker)
            ).where(ChildIdRequest.id == child_request.id)
            result = await db.execute(query)
            child_request = result.scalar_one()
            
            logger.info(f"Created child ID request {child_request.id} for user {user_id}")
            return child_request
            
        except HTTPException:
            await db.rollback()
            raise
        except Exception as e:
            await db.rollback()
            logger.error(f"Error creating child ID request: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create child ID request"
            )

    async def get_user_child_requests(
        self,
        db: AsyncSession,
        user_id: str,
        page: int = 1,
        page_size: int = 20
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
            
            # Validate UUID format before attempting conversion
            try:
                user_uuid = uuid.UUID(user_id)
                logger.info(f"Successfully parsed user_id UUID: {user_id}")
            except ValueError as uuid_error:
                logger.error(f"Invalid UUID format for user_id: '{user_id}' - Length: {len(user_id)} - Error: {str(uuid_error)}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid user ID format. Expected valid UUID, got: '{user_id}'"
                )
            
            query = select(ChildIdRequest).options(
                selectinload(ChildIdRequest.insurer),
                selectinload(ChildIdRequest.broker)
            ).where(ChildIdRequest.user_id == user_uuid)
            
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
                "total_pages": (total_count + page_size - 1) // page_size if total_count else 0
            }
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error fetching user child requests: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to fetch user child requests"
            )

    async def get_child_request_by_id(
        self,
        db: AsyncSession,
        request_id: str,
        user_id: Optional[str] = None
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
                logger.error(f"Invalid UUID format for request_id: '{request_id}' - Length: {len(request_id)} - Error: {str(uuid_error)}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid request ID format. Expected valid UUID, got: '{request_id}'"
                )
            
            query = select(ChildIdRequest).options(
                selectinload(ChildIdRequest.insurer),
                selectinload(ChildIdRequest.broker)
            ).where(ChildIdRequest.id == request_uuid)
            
            if user_id:
                try:
                    user_uuid = uuid.UUID(user_id)
                    query = query.where(ChildIdRequest.user_id == user_uuid)
                except ValueError as uuid_error:
                    logger.error(f"Invalid UUID format for user_id: '{user_id}' - Error: {str(uuid_error)}")
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Invalid user ID format. Expected valid UUID, got: '{user_id}'"
                    )
            
            result = await db.execute(query)
            child_request = result.scalar_one_or_none()
            
            if not child_request:
                logger.warning(f"Child ID request not found for UUID: {request_id}")
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Child ID request not found"
                )
            
            return child_request
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Unexpected error fetching child request {request_id}: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to fetch child ID request"
            )

    async def get_all_child_requests(
        self,
        db: AsyncSession,
        page: int = 1,
        page_size: int = 20,
        status_filter: Optional[str] = None,
        search: Optional[str] = None
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
                        ChildIdRequest.location.ilike(search_term)
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
                "page_size": page_size
            }
            
        except Exception as e:
            logger.error(f"Error fetching all child requests: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to fetch child ID requests"
            )

    async def approve_child_request(
        self,
        db: AsyncSession,
        request_id: str,
        assignment_data: Dict[str, Any],
        admin_user_id: str
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
                    detail="Only pending requests can be approved"
                )
            
            for field, value in assignment_data.items():
                setattr(child_request, field, value)
            
            child_request.status = "accepted"
            child_request.approved_by = uuid.UUID(admin_user_id)
            child_request.approved_at = datetime.utcnow()
            child_request.updated_at = datetime.utcnow()
            
            await db.commit()
            await db.refresh(child_request)
            
            logger.info(f"Approved child ID request {request_id} by admin {admin_user_id}")
            return child_request
            
        except HTTPException:
            raise
        except Exception as e:
            await db.rollback()
            logger.error(f"Error approving child request: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to approve child ID request"
            )

    async def update_child_status(
        self,
        db: AsyncSession,
        request_id: str,
        new_status: str,
        admin_notes: Optional[str] = None,
        admin_user_id: Optional[str] = None
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
                detail="Failed to update child ID request status"
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
        if user_role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin access required"
            )

    async def get_user_active_child_ids(
        self,
        db: AsyncSession,
        user_id: str
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
            
            query = select(ChildIdRequest).options(
                selectinload(ChildIdRequest.insurer),
                selectinload(ChildIdRequest.broker)
            ).where(
                and_(
                    ChildIdRequest.user_id == uuid.UUID(user_id),
                    ChildIdRequest.status == "accepted"
                )
            ).order_by(desc(ChildIdRequest.approved_at))
            
            result = await db.execute(query)
            return result.scalars().all()
            
        except Exception as e:
            logger.error(f"Error fetching active child IDs: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to fetch active child IDs"
            )

    async def get_filtered_child_ids(
        self,
        db: AsyncSession,
        insurer_code: str,
        broker_code: Optional[str] = None,
        agent_id: Optional[str] = None
    ) -> List[ChildIdRequest]:
        """
        Get active child IDs filtered by parameters
        
        Args:
            db: Database session
            insurer_code: Required insurer code to filter by
            broker_code: Optional broker code to filter by
            agent_id: Optional agent ID to filter by
            
        Returns:
            List of filtered ChildIdRequest objects
        """
        try:
            from sqlalchemy.orm import selectinload
            
            # Build query conditions
            conditions = [
                ChildIdRequest.status == "accepted",
                Insurer.code == insurer_code
            ]
            
            if broker_code:
                conditions.append(Broker.code == broker_code)
                
            if agent_id:
                conditions.append(ChildIdRequest.user_id == uuid.UUID(agent_id))
            
            query = select(ChildIdRequest).options(
                selectinload(ChildIdRequest.insurer),
                selectinload(ChildIdRequest.broker)
            ).join(Insurer).join(Broker).where(
                and_(*conditions)
            ).order_by(desc(ChildIdRequest.approved_at))
            
            result = await db.execute(query)
            return result.scalars().all()
            
        except Exception as e:
            logger.error(f"Error fetching filtered child IDs: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to fetch filtered child IDs"
            )

    async def get_all_child_requests(
        self,
        db: AsyncSession,
        page: int = 1,
        page_size: int = 20,
        status_filter: Optional[str] = None,
        search: Optional[str] = None
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
                        func.lower(ChildIdRequest.email).like(search_term)
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
                "total_pages": total_pages
            }
            
        except Exception as e:
            logger.error(f"Error fetching all child requests: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to fetch child ID requests"
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
                "pending_requests": status_counts.get("pending", 0)
            }
            
        except Exception as e:
            logger.error(f"Error fetching child ID statistics: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to fetch child ID statistics"
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
                    and_(
                        Broker.broker_code == broker_code,
                        Broker.is_active == True
                    )
                )
            )
            broker = result.scalar_one_or_none()
            
            if not broker:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid or inactive broker code: {broker_code}"
                )
            
            return broker
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error validating broker code {broker_code}: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to validate broker code"
            )

    async def validate_insurer_code(self, db: AsyncSession, insurer_code: str) -> Insurer:
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
                        Insurer.insurer_code == insurer_code,
                        Insurer.is_active == True
                    )
                )
            )
            insurer = result.scalar_one_or_none()
            
            if not insurer:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid or inactive insurer code: {insurer_code}"
                )
            
            return insurer
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error validating insurer code {insurer_code}: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to validate insurer code"
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
                detail="Failed to fetch brokers"
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
                detail="Failed to fetch insurers"
            )
