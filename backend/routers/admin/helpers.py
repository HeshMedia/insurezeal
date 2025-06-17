from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, desc, or_
from sqlalchemy.orm import selectinload
from models import UserProfile, UserDocument, ChildIdRequest
from fastapi import HTTPException, status
from typing import Optional, Dict, Any, List
import logging
from supabase import Client
from config import get_supabase_admin_client

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
        user_role = getattr(current_user["profile"], "user_role", "agent")
        if user_role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin access required. Only administrators can access this resource."
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
        search: Optional[str] = None
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
                    UserProfile.first_name.ilike(search_term) |
                    UserProfile.last_name.ilike(search_term) |
                    UserProfile.agent_code.ilike(search_term)
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
                "page_size": page_size
            }
            
        except Exception as e:
            logger.error(f"Error fetching agents: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to fetch agents"
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
                and_(
                    UserProfile.id == agent_id,
                    UserProfile.user_role == "agent"
                )
            )
            
            result = await db.execute(query)
            agent = result.scalar_one_or_none()
            
            if not agent:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Agent with ID {agent_id} not found"
                )
            
            return agent
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error fetching agent {agent_id}: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to fetch agent details"
            )

    async def get_agent_documents(self, db: AsyncSession, user_id: str) -> Dict[str, str]:
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
            
            return {doc.document_type: doc.file_url for doc in documents if doc.file_url}
            
        except Exception as e:
            logger.error(f"Error fetching documents for user {user_id}: {str(e)}")
            return {}

    async def get_agent_with_documents(
        self,
        db: AsyncSession, 
        agent_id: str
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
            
            agent_data = {column.name: getattr(agent, column.name) for column in agent.__table__.columns}
            agent_data["email"] = email
            agent_data["document_urls"] = document_urls
            
            return agent_data
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error fetching agent with documents {agent_id}: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to fetch agent details with documents"
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
            
            logger.info(f"Successfully deleted agent {agent_id} and {len(documents)} related documents")
            
            return {
                "deleted_agent_id": agent_id,
                "deleted_user_id": str(user_id),
                "message": f"Agent {agent.first_name} {agent.last_name} (ID: {agent_id}) has been successfully deleted along with all related data."
            }
            
        except HTTPException:
            raise
        except Exception as e:
            await db.rollback()
            logger.error(f"Error deleting agent {agent_id}: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete agent. Please try again."
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
            total_agents_query = select(func.count()).where(UserProfile.user_role == "agent")
            total_agents = await db.scalar(total_agents_query) or 0
            
            from datetime import datetime
            this_month = datetime.now().replace(day=1)
            new_agents_query = select(func.count()).where(
                and_(
                    UserProfile.user_role == "agent",
                    UserProfile.created_at >= this_month
                )
            )
            new_agents_this_month = await db.scalar(new_agents_query) or 0
            
            total_docs_query = select(func.count()).select_from(UserDocument)
            total_documents = await db.scalar(total_docs_query) or 0
            
            return {
                "total_agents": total_agents,
                "new_agents_this_month": new_agents_this_month,
                "total_documents": total_documents
            }
            
        except Exception as e:
            logger.error(f"Error getting admin statistics: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to fetch admin statistics"
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
            Dictionary with requests and pagination info        """
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

    async def approve_child_request(
        self,
        db: AsyncSession,
        request_id: str,
        assignment_data: Dict[str, Any],        admin_user_id: str
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
            
            query = select(ChildIdRequest).where(ChildIdRequest.id == uuid.UUID(request_id))
            result = await db.execute(query)
            child_request = result.scalar_one_or_none()
            
            if not child_request:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Child ID request not found"
                )
            
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

    async def reject_child_request(
        self,
        db: AsyncSession,
        request_id: str,
        admin_notes: str,        admin_user_id: str
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
            
            query = select(ChildIdRequest).where(ChildIdRequest.id == uuid.UUID(request_id))
            result = await db.execute(query)
            child_request = result.scalar_one_or_none()
            
            if not child_request:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Child ID request not found"
                )
            
            if child_request.status != "pending":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Only pending requests can be rejected"
                )
            
            child_request.status = "rejected"
            child_request.admin_notes = admin_notes
            child_request.approved_by = uuid.UUID(admin_user_id)
            child_request.approved_at = datetime.utcnow()
            child_request.updated_at = datetime.utcnow()
            
            await db.commit()
            await db.refresh(child_request)
            
            logger.info(f"Rejected child ID request {request_id} by admin {admin_user_id}")
            return child_request
            
        except HTTPException:
            raise
        except Exception as e:
            await db.rollback()
            logger.error(f"Error rejecting child request: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to reject child ID request"
            )

    async def suspend_child_id(
        self,
        db: AsyncSession,
        request_id: str,
        admin_notes: str,        admin_user_id: str
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
            
            query = select(ChildIdRequest).where(ChildIdRequest.id == uuid.UUID(request_id))
            result = await db.execute(query)
            child_request = result.scalar_one_or_none()
            
            if not child_request:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Child ID request not found"
                )
            
            if child_request.status != "accepted":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Only accepted child IDs can be suspended"
                )
            
            child_request.status = "suspended"
            child_request.admin_notes = admin_notes
            child_request.approved_by = uuid.UUID(admin_user_id)
            child_request.approved_at = datetime.utcnow()
            child_request.updated_at = datetime.utcnow()
            
            await db.commit()
            await db.refresh(child_request)
            
            logger.info(f"Suspended child ID request {request_id} by admin {admin_user_id}")
            return child_request
            
        except HTTPException:
            raise
        except Exception as e:
            await db.rollback()
            logger.error(f"Error suspending child request: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to suspend child ID request"
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
                "pending_requests": status_counts.get("pending", 0)
            }
            
        except Exception as e:
            logger.error(f"Error fetching child ID statistics: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to fetch child ID statistics"
            )
