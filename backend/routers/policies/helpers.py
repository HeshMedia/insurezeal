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
    async def get_available_child_ids(db: AsyncSession, agent_id: Optional[str] = None) -> List[Dict[str, Any]]:
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
            if user_id:
                query = query.where(Policy.uploaded_by == uuid.UUID(user_id))
            
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
            
            headers = [
                'ID', 'Policy Number', 'Policy Type', 'Insurance Type',
                'Agent ID', 'Agent Code', 'Child ID', 'Broker Name', 'Insurance Company',
                'Vehicle Type', 'Registration Number', 'Vehicle Class', 'Vehicle Segment',
                'Gross Premium', 'GST', 'Net Premium', 'OD Premium', 'TP Premium',
                'Start Date', 'End Date', 'Uploaded By', 'PDF File Name',
                'AI Confidence Score', 'Manual Override', 'Created At', 'Updated At'
            ]
            writer.writerow(headers)
            
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

    @staticmethod
    async def update_agent_financials(db: AsyncSession, agent_code: str, net_premium: float, running_balance: float):
        """Update agent's running balance, total net premium, and number of policies when a policy is created/updated"""
        if not agent_code:
            return
        
        try:
            # Get agent profile by agent_code
            result = await db.execute(
                select(UserProfile).where(UserProfile.agent_code == agent_code)
            )
            agent_profile = result.scalar_one_or_none()
            
            if not agent_profile:
                logger.warning(f"Agent profile not found for agent_code: {agent_code}")
                return
            
            # Update running totals (same pattern as cutpay)
            current_running_balance = agent_profile.running_balance or 0.0
            current_total_net_premium = agent_profile.total_net_premium or 0.0
            current_number_of_policies = agent_profile.number_of_policies or 0
            
            agent_profile.running_balance = current_running_balance + (running_balance or 0.0)
            agent_profile.total_net_premium = current_total_net_premium + (net_premium or 0.0)
            agent_profile.number_of_policies = current_number_of_policies + 1
            
            logger.info(f"Updated agent {agent_code} financials - Running Balance: {agent_profile.running_balance}, Total Net Premium: {agent_profile.total_net_premium}, Number of Policies: {agent_profile.number_of_policies}")
            
        except Exception as e:
            logger.error(f"Error updating agent financials for {agent_code}: {str(e)}")
            # Don't raise the exception to prevent policy creation failure
    
    @staticmethod
    async def get_agent_financial_summary(db: AsyncSession, agent_code: str) -> Dict[str, Any]:
        """Get agent's financial summary"""
        try:
            result = await db.execute(
                select(UserProfile).where(UserProfile.agent_code == agent_code)
            )
            agent_profile = result.scalar_one_or_none()
            
            if not agent_profile:
                return {
                    "agent_code": agent_code,
                    "running_balance": 0.0,
                    "total_net_premium": 0.0,
                    "number_of_policies": 0,
                    "agent_found": False
                }
            
            return {
                "agent_code": agent_code,
                "agent_name": f"{agent_profile.first_name or ''} {agent_profile.last_name or ''}".strip(),
                "running_balance": float(agent_profile.running_balance or 0.0),
                "total_net_premium": float(agent_profile.total_net_premium or 0.0),
                "number_of_policies": int(agent_profile.number_of_policies or 0),
                "agent_found": True
            }
            
        except Exception as e:
            logger.error(f"Error getting agent financial summary for {agent_code}: {str(e)}")
            return {
                "agent_code": agent_code,
                "running_balance": 0.0,
                "total_net_premium": 0.0,
                "number_of_policies": 0,
                "agent_found": False,
                "error": str(e)
            }

    @staticmethod
    async def get_agent_policies(
        db: AsyncSession,
        agent_code: str,
        page: int = 1,
        page_size: int = 20,
        search: Optional[str] = None
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
                    Policy.registration_no.ilike(f"%{search}%")
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
                    "formatted_policy_number": policy_data.get("formatted_policy_number"),
                    
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
                    "registration_no": policy_data.get("registration_no"),
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
                    "is_private_car": policy_data.get("is_private_car"),
                    
                    # Premium Details
                    "gross_premium": policy_data.get("gross_premium"),
                    "gst": policy_data.get("gst"),
                    "gst_amount": policy_data.get("gst_amount"),
                    "net_premium": policy_data.get("net_premium"),
                    "od_premium": policy_data.get("od_premium"),
                    "tp_premium": policy_data.get("tp_premium"),
                    
                    # Agent Commission Fields (only these two for policies)
                    "agent_commission_given_percent": policy_data.get("agent_commission_given_percent"),
                    "agent_extra_percent": policy_data.get("agent_extra_percent"),
                    
                    # Agent Financial Tracking
                    "payment_by_office": policy_data.get("payment_by_office"),
                    "total_agent_payout_amount": policy_data.get("total_agent_payout_amount"),
                    
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
                    "updated_at": policy_data.get("updated_at")
                }
                
                policy_list.append(filtered_policy_data)
            
            # Calculate pagination
            total_pages = (total_count + page_size - 1) // page_size
            
            return {
                "policies": policy_list,
                "total_count": total_count,
                "total_pages": total_pages,
                "current_page": page,
                "page_size": page_size
            }
            
        except Exception as e:
            logger.error(f"Error getting agent policies for {agent_code}: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to fetch policies for agent {agent_code}"
            )
