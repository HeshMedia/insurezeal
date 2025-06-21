from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, desc, or_
from sqlalchemy.orm import selectinload
from sqlalchemy.exc import IntegrityError
from models import Policy, UserProfile, ChildIdRequest
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
        date_fields = ['start_date', 'end_date']
        
        for field in date_fields:
            if field in policy_data and policy_data[field]:
                try:
                    if isinstance(policy_data[field], str):
                        policy_data[field] = datetime.strptime(policy_data[field], '%Y-%m-%d').date()
                except (ValueError, TypeError) as e:
                    logger.warning(f"Failed to parse date field {field}: {policy_data[field]}, error: {e}")
                    policy_data[field] = None
        
        return policy_data
    
    @staticmethod
    async def save_uploaded_file(file: UploadFile, user_id: str) -> Tuple[str, str]:
        """Save uploaded PDF file to Supabase storage and return URL and name"""
        try:
            supabase = get_supabase_admin_client()
            
            file_extension = file.filename.split('.')[-1] if '.' in file.filename else 'pdf'
            unique_filename = f"policies/{user_id}/{uuid.uuid4()}.{file_extension}"

            file_content = await file.read()
            try:
                result = supabase.storage.from_(SUPABASE_STORAGE_BUCKET).upload(
                    unique_filename, 
                    file_content,
                    file_options={"content-type": "application/pdf"}
                )
                
                url_result = supabase.storage.from_(SUPABASE_STORAGE_BUCKET).get_public_url(unique_filename)
                
            except Exception as upload_error:
                raise Exception(f"Supabase upload error: {str(upload_error)}")
            
            return url_result, file.filename
            
        except Exception as e:
            logger.error(f"Error saving uploaded file to Supabase: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to save uploaded file"
            )
    
    @staticmethod
    async def save_uploaded_file_from_bytes(file_content: bytes, filename: str, user_id: str) -> Tuple[str, str]:
        """Save uploaded PDF file from bytes to Supabase storage and return URL and name"""
        try:
            supabase = get_supabase_admin_client()           
            file_extension = filename.split('.')[-1] if '.' in filename else 'pdf'
            unique_filename = f"policies/{user_id}/{uuid.uuid4()}.{file_extension}"
            
            try:
                result = supabase.storage.from_(SUPABASE_STORAGE_BUCKET).upload(
                    unique_filename, 
                    file_content,
                    file_options={"content-type": "application/pdf"}
                )
                
                url_result = supabase.storage.from_(SUPABASE_STORAGE_BUCKET).get_public_url(unique_filename)
                
            except Exception as upload_error:
                raise Exception(f"Supabase upload error: {str(upload_error)}")
            
            return url_result, filename
            
        except Exception as e:
            logger.error(f"Error saving uploaded file to Supabase: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to save uploaded file"
            )
    
    @staticmethod
    async def process_policy_pdf(file_content: bytes) -> Optional[Dict[str, Any]]:
        """Extract text from PDF content and process with AI"""
        try:
            pdf_text = PDFProcessor.extract_text_from_bytes(file_content)
            if not pdf_text:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Could not extract text from PDF"
                )
            
            if not gemini_extractor:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="AI service not available"
                )
                
            extracted_data = gemini_extractor.extract_policy_data(pdf_text)
            if not extracted_data:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to extract policy data with AI"
                )
            
            return extracted_data
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error processing policy PDF: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to process PDF"
            )
    
    @staticmethod
    async def get_agent_by_user_id(db: AsyncSession, user_id: str) -> Optional[UserProfile]:
        """Get agent profile by user ID"""
        try:
            # Convert string user_id to UUID for database query
            user_uuid = uuid.UUID(user_id)
            result = await db.execute(
                select(UserProfile).where(
                    and_(
                        UserProfile.user_id == user_uuid,
                        UserProfile.user_role.in_(["agent", "admin"])
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
    async def get_child_id_details(db: AsyncSession, child_id: str) -> Optional[ChildIdRequest]:
        """Get child ID details"""
        try:
            result = await db.execute(
                select(ChildIdRequest).where(ChildIdRequest.child_id == child_id)
            )
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching child ID details: {str(e)}")
            return None
    @staticmethod
    async def get_available_child_ids(db: AsyncSession, agent_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get available child IDs for dropdown, filtered by agent_id if provided"""
        try:
            query = select(ChildIdRequest).where(ChildIdRequest.status == "accepted")

            if agent_id:
                query = query.where(ChildIdRequest.user_id == uuid.UUID(agent_id))
            
            result = await db.execute(query)
            child_requests = result.scalars().all()
            
            return [
                {
                    "child_id": req.child_id,
                    "broker_name": req.broker,
                    "insurance_company": req.insurance_company
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
                        UserProfile.agent_code.isnot(None)
                    )
                )
            )
            agents = result.scalars().all()
            
            return [
                {
                    "agent_id": agent.user_id,
                    "agent_code": agent.agent_code,
                    "full_name": f"{agent.first_name} {agent.last_name}".strip()
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
        uploaded_by: str
    ) -> Policy:
        """Create a new policy record"""
        try: 
            policy_data = PolicyHelpers._convert_date_strings(policy_data)
            policy_data = PolicyHelpers._provide_default_values(policy_data)
            
            policy = Policy(
                uploaded_by=uuid.UUID(uploaded_by),
                pdf_file_path=file_path,
                pdf_file_name=file_name,
                **policy_data
            )
            
            db.add(policy)
            await db.commit()
            await db.refresh(policy)
            
            logger.info(f"Created policy {policy.id} for user {uploaded_by}")
            return policy
            
        except IntegrityError as e:
            await db.rollback()
            logger.error(f"Integrity error creating policy: {str(e)}")
            
            if "duplicate key value violates unique constraint" in str(e) and "policy_number" in str(e):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Policy number already exists"
                )
            
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Data integrity error"
            )
            
        except Exception as e:
            await db.rollback()
            logger.error(f"Error creating policy: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create policy"
            )
    
    @staticmethod
    async def get_policies(
        db: AsyncSession,
        page: int = 1,
        page_size: int = 20,
        user_id: Optional[str] = None,
        agent_id: Optional[str] = None,
        policy_type: Optional[str] = None,
        search: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get policies with pagination and filters"""
        try:
            query = select(Policy)
            count_query = select(func.count(Policy.id))
            
            if user_id:
                query = query.where(Policy.uploaded_by == uuid.UUID(user_id))
                count_query = count_query.where(Policy.uploaded_by == uuid.UUID(user_id))
            
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
                    Policy.agent_code.ilike(f"%{search}%")
                )
                query = query.where(search_filter)
                count_query = count_query.where(search_filter)
            
            total_result = await db.execute(count_query)
            total_count = total_result.scalar()
            
            offset = (page - 1) * page_size
            query = query.order_by(desc(Policy.created_at)).offset(offset).limit(page_size)
            
            result = await db.execute(query)
            policies = result.scalars().all()
            
            return {
                "policies": policies,
                "total_count": total_count or 0,
                "page": page,
                "page_size": page_size,
                "total_pages": (total_count + page_size - 1) // page_size if total_count else 0
            }
            
        except Exception as e:
            logger.error(f"Error fetching policies: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to fetch policies"
            )
    
    @staticmethod
    async def get_policy_by_id(db: AsyncSession, policy_id: str, user_id: Optional[str] = None) -> Optional[Policy]:
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
        user_id: Optional[str] = None
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
            
            if "duplicate key value violates unique constraint" in str(e) and "policy_number" in str(e):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Policy number already exists"
                )
            
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Data integrity error"
            )
            
        except Exception as e:
            await db.rollback()
            logger.error(f"Error updating policy: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,                
                detail="Failed to update policy"
            )
    
    @staticmethod
    async def delete_policy(db: AsyncSession, policy_id: str, user_id: Optional[str] = None) -> bool:
        """Delete policy and associated PDF from Supabase storage"""
        try:
            policy = await PolicyHelpers.get_policy_by_id(db, policy_id, user_id)
            if not policy:
                return False               
                try:
                    supabase = get_supabase_admin_client()
                    if policy.pdf_file_path:
                        url_parts = policy.pdf_file_path.split(f'/{SUPABASE_STORAGE_BUCKET}/')
                        if len(url_parts) > 1:
                            file_path = url_parts[1]
                            result = supabase.storage.from_(SUPABASE_STORAGE_BUCKET).remove([file_path])
                            if result:
                                logger.info(f"Deleted PDF from Supabase: {file_path}")
                except Exception as e:
                    logger.warning(f"Failed to delete PDF file from Supabase: {str(e)}")
            
            await db.delete(policy)
            await db.commit()
            
            return True
            
        except Exception as e:
            await db.rollback()
            logger.error(f"Error deleting policy: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete policy"
            )
    
    @staticmethod
    def _provide_default_values(policy_data: Dict[str, Any]) -> Dict[str, Any]:
        """Provide default values for required fields that cannot be null"""

        if not policy_data.get('insurance_type'):
            policy_type = policy_data.get('policy_type', '').lower()
            vehicle_type = policy_data.get('vehicle_type', '').lower()
            
            if 'motor' in policy_type or 'vehicle' in vehicle_type:
                policy_data['insurance_type'] = 'Comprehensive'
            elif 'health' in policy_type:
                policy_data['insurance_type'] = 'Individual'
            elif 'life' in policy_type:
                policy_data['insurance_type'] = 'Term'
            else:
                policy_data['insurance_type'] = 'Standard'
        
        return policy_data
    
    @staticmethod
    async def export_policies_to_csv(
        db: AsyncSession,
        user_id: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> str:
        """Export policies to CSV format"""
        try:
            import csv
            import io
            
            query = select(Policy)
            
            # Apply user filter if provided (for agents)
            if user_id:
                query = query.where(Policy.uploaded_by == uuid.UUID(user_id))
            
            # Apply date filters
            if start_date and end_date:
                query = query.where(
                    and_(
                        Policy.created_at >= datetime.combine(start_date, datetime.min.time()),
                        Policy.created_at <= datetime.combine(end_date, datetime.max.time())
                    )
                )
            elif start_date:
                query = query.where(Policy.created_at >= datetime.combine(start_date, datetime.min.time()))
            elif end_date:
                query = query.where(Policy.created_at <= datetime.combine(end_date, datetime.max.time()))
            
            query = query.order_by(desc(Policy.created_at))
            
            result = await db.execute(query)
            policies = result.scalars().all()
            
            output = io.StringIO()
            writer = csv.writer(output)
            
            # CSV Headers
            headers = [
                'ID', 'Policy Number', 'Policy Type', 'Insurance Type',
                'Agent ID', 'Agent Code', 'Child ID', 'Broker Name', 'Insurance Company',
                'Vehicle Type', 'Registration Number', 'Vehicle Class', 'Vehicle Segment',
                'Gross Premium', 'GST', 'Net Premium', 'OD Premium', 'TP Premium',
                'Start Date', 'End Date', 'Uploaded By', 'PDF File Name',
                'AI Confidence Score', 'Manual Override', 'Created At', 'Updated At'
            ]
            writer.writerow(headers)
            
            # Write policy data
            for policy in policies:
                row = [
                    str(policy.id),
                    policy.policy_number or '',
                    policy.policy_type or '',
                    policy.insurance_type or '',
                    str(policy.agent_id) if policy.agent_id else '',
                    policy.agent_code or '',
                    policy.child_id or '',
                    policy.broker_name or '',
                    policy.insurance_company or '',
                    policy.vehicle_type or '',
                    policy.registration_number or '',
                    policy.vehicle_class or '',
                    policy.vehicle_segment or '',
                    policy.gross_premium or '',
                    policy.gst or '',
                    policy.net_premium or '',
                    policy.od_premium or '',
                    policy.tp_premium or '',
                    policy.start_date.strftime('%Y-%m-%d') if policy.start_date else '',
                    policy.end_date.strftime('%Y-%m-%d') if policy.end_date else '',
                    str(policy.uploaded_by) if policy.uploaded_by else '',
                    policy.pdf_file_name or '',
                    policy.ai_confidence_score or '',
                    'Yes' if policy.manual_override else 'No',
                    policy.created_at.strftime('%Y-%m-%d %H:%M:%S') if policy.created_at else '',
                    policy.updated_at.strftime('%Y-%m-%d %H:%M:%S') if policy.updated_at else ''
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
                detail="Failed to export policies to CSV"
            )
