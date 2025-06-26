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
        Create a new child ID request
        
        Args:
            db: Database session
            user_id: User ID making the request
            request_data: Request details
            
        Returns:
            Created ChildIdRequest object
        """
        try:
            from sqlalchemy.orm import selectinload
            
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
            
            query = select(ChildIdRequest).options(
                selectinload(ChildIdRequest.insurer),
                selectinload(ChildIdRequest.broker)
            ).where(ChildIdRequest.user_id == uuid.UUID(user_id))
            
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
            
        except Exception as e:
            logger.error(f"Error fetching user child requests: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to fetch child ID requests"
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
            
            query = select(ChildIdRequest).options(
                selectinload(ChildIdRequest.insurer),
                selectinload(ChildIdRequest.broker)
            ).where(ChildIdRequest.id == uuid.UUID(request_id))
            
            if user_id:
                query = query.where(ChildIdRequest.user_id == uuid.UUID(user_id))
            
            result = await db.execute(query)
            child_request = result.scalar_one_or_none()
            
            if not child_request:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Child ID request not found"
                )
            
            return child_request
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error fetching child request {request_id}: {str(e)}")
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
        user_role = getattr(current_user["profile"], "user_role", "agent")
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
