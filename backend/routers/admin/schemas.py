from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Dict
from datetime import datetime, date
from routers.users.schemas import GenderEnum, EducationLevelEnum
from enum import Enum
from uuid import UUID

# Child ID related schemas for admin management
class ChildIdStatusEnum(str, Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    SUSPENDED = "suspended"

class ChildIdAssignment(BaseModel):
    """Schema for admin to assign child ID details"""
    child_id: str = Field(..., min_length=1, max_length=50)
    broker_code: str = Field(..., min_length=1, max_length=20)
    branch_code: Optional[str] = Field(None, max_length=20)
    region: Optional[str] = Field(None, max_length=50)
    manager_name: Optional[str] = Field(None, max_length=100)
    manager_email: Optional[EmailStr] = None
    commission_percentage: Optional[float] = Field(None, ge=0, le=100)
    policy_limit: Optional[int] = Field(None, ge=0)
    admin_notes: Optional[str] = Field(None, max_length=1000)

class ChildIdResponse(BaseModel):
    """Response schema for child ID requests"""
    id: UUID
    user_id: UUID
    
    # Request details
    insurance_company: str
    broker: str
    location: str
    phone_number: str
    email: str
    preferred_rm_name: Optional[str] = None
    
    # Status and assignment
    status: ChildIdStatusEnum
    child_id: Optional[str] = None
    broker_code: Optional[str] = None
    branch_code: Optional[str] = None
    region: Optional[str] = None
    manager_name: Optional[str] = None
    manager_email: Optional[str] = None
    commission_percentage: Optional[float] = None
    policy_limit: Optional[int] = None
      # Admin details
    admin_notes: Optional[str] = None
    approved_by: Optional[UUID] = None
    approved_at: Optional[datetime] = None
    
    # Timestamps
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class ChildIdStatusUpdate(BaseModel):
    """Schema for updating child ID status (reject/suspend)"""
    admin_notes: str = Field(..., min_length=1, max_length=1000, description="Required reason for status change")

class ChildIdRequestList(BaseModel):
    """Response schema for paginated child ID request lists"""
    requests: List[ChildIdResponse]
    total_count: int
    page: int
    page_size: int
    total_pages: int

    class Config:
        from_attributes = True

class AgentSummary(BaseModel):
    """Summary view of an agent for admin listing"""
    id: str
    user_id: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: str
    mobile_number: Optional[str] = None
    agent_code: Optional[str] = None
    user_role: str = "agent"
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class AgentListResponse(BaseModel):
    """Response for listing all agents"""
    agents: List[AgentSummary]
    total_count: int
    page: int
    page_size: int

class AgentDetailResponse(BaseModel):
    """Detailed agent profile for admin view with document URLs"""
    # Basic Profile Information
    id: str
    user_id: str
    email: str
    username: Optional[str] = None
    
    # Personal Information
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    middle_name: Optional[str] = None
    father_name: Optional[str] = None
    mother_name: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[GenderEnum] = None
    
    # Contact Information
    mobile_number: Optional[str] = None
    alternate_mobile: Optional[str] = None
    alternate_email: Optional[EmailStr] = None
    
    # Address Information
    permanent_address_line1: Optional[str] = None
    permanent_address_line2: Optional[str] = None
    permanent_city: Optional[str] = None
    permanent_state: Optional[str] = None
    permanent_pincode: Optional[str] = None
    
    communication_same_as_permanent: Optional[bool] = None
    communication_address_line1: Optional[str] = None
    communication_address_line2: Optional[str] = None
    communication_city: Optional[str] = None
    communication_state: Optional[str] = None
    communication_pincode: Optional[str] = None
    
    # Identity Information
    aadhaar_number: Optional[str] = None
    pan_number: Optional[str] = None
    
    # Professional Information
    education_level: Optional[EducationLevelEnum] = None
    specialization: Optional[str] = None
    previous_insurance_experience: Optional[bool] = None
    years_of_experience: Optional[int] = None
    previous_company_name: Optional[str] = None
    
    # Bank Information
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    ifsc_code: Optional[str] = None
    branch_name: Optional[str] = None
    
    # Nominee Information
    nominee_name: Optional[str] = None
    nominee_relationship: Optional[str] = None
    nominee_date_of_birth: Optional[date] = None
    
    # Preferences
    preferred_language: Optional[str] = None
    territory_preference: Optional[str] = None
      # Agent Specific
    agent_code: Optional[str] = None
    user_role: str
    
    # System fields
    avatar_url: Optional[str] = None
    preferences: Optional[dict] = None
    created_at: datetime
    updated_at: datetime
    
    # Document URLs - This is the key addition
    document_urls: Dict[str, str] = {}
    
    # Legacy fields for compatibility
    display_name: Optional[str] = None
    bio: Optional[str] = None
    timezone: Optional[str] = None
    language: Optional[str] = None
    
    class Config:
        from_attributes = True

class DeleteAgentResponse(BaseModel):
    """Response after deleting an agent"""
    message: str
    deleted_agent_id: str
    deleted_user_id: str

class AdminStatsResponse(BaseModel):
    """Admin dashboard statistics"""
    total_agents: int
    new_agents_this_month: int
    total_documents: int
