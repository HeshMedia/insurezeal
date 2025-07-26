from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import List, Optional, Dict, Any
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

class UserRoleEnum(str, Enum):
    """Valid user roles"""
    SUPERADMIN = "superadmin"
    ADMIN = "admin"
    AGENT = "agent"

class UserRoleUpdateRequest(BaseModel):
    """Schema for updating a user's role"""
    new_role: UserRoleEnum = Field(..., description="New role to assign to the user")

class SuperadminPromotionRequest(BaseModel):
    """Schema for promoting a user to superadmin (open route)"""
    user_id: UUID = Field(..., description="UUID of the user to promote to superadmin")
    email: EmailStr = Field(..., description="Email of the user for verification")

class UserRoleUpdateResponse(BaseModel):
    """Response schema for role update"""
    success: bool
    message: str
    user_id: UUID
    new_role: str
    updated_in_supabase: bool
    updated_in_database: bool

class ChildIdAssignment(BaseModel):
    """Schema for admin to assign child ID details"""
    child_id: str = Field(..., min_length=1, max_length=50, description="Unique child ID to assign")
    branch_code: Optional[str] = Field(None, max_length=20, description="Branch code")
    region: Optional[str] = Field(None, max_length=50, description="Region")
    manager_name: Optional[str] = Field(None, max_length=100, description="Manager name")
    manager_email: Optional[EmailStr] = Field(None, description="Manager email")
    admin_notes: Optional[str] = Field(None, max_length=1000, description="Admin notes")
    password: Optional[str] = Field(None, description="Password for child ID assignment")

class ChildIdResponse(BaseModel):
    """Response schema for child ID requests - Clean new structure"""
    id: UUID
    user_id: UUID
    
    # Request details
    phone_number: str
    email: str
    location: str
    code_type: str
    insurer_id: int
    broker_id: Optional[int] = None
    preferred_rm_name: Optional[str] = None
    
    # Status and assignment
    status: ChildIdStatusEnum
    child_id: Optional[str] = None
    password: Optional[str] = None
    branch_code: Optional[str] = None
    region: Optional[str] = None
    manager_name: Optional[str] = None
    manager_email: Optional[str] = None
    
    # Admin details
    admin_notes: Optional[str] = None
    approved_by: Optional[UUID] = None
    approved_at: Optional[datetime] = None
    
    # Agent information (who requested the child ID)
    agent_name: Optional[str] = None
    agent_code: Optional[str] = None
    
    # Timestamps
    created_at: datetime
    updated_at: datetime
    
    # Nested relationships
    insurer: Optional[dict] = None
    broker_relation: Optional[dict] = None
    
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

# Universal Record Schemas for Data Reconciliation
class UniversalRecordItem(BaseModel):
    """Schema for a single universal record item from CSV"""
    policy_number: str = Field(..., description="Policy number - unique identifier")
    
    # Policy fields
    policy_type: Optional[str] = None
    insurance_type: Optional[str] = None
    agent_code: Optional[str] = None
    broker_name: Optional[str] = None
    insurance_company: Optional[str] = None
    vehicle_type: Optional[str] = None
    registration_number: Optional[str] = None
    vehicle_class: Optional[str] = None
    vehicle_segment: Optional[str] = None
    gross_premium: Optional[float] = None
    gst: Optional[float] = None
    net_premium: Optional[float] = None
    od_premium: Optional[float] = None
    tp_premium: Optional[float] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    
    # Cut pay fields
    cut_pay_amount: Optional[float] = None
    commission_grid: Optional[str] = None
    agent_commission_given_percent: Optional[float] = None
    payment_by: Optional[str] = None
    amount_received: Optional[float] = None
    payment_method: Optional[str] = None
    payment_source: Optional[str] = None
    transaction_date: Optional[date] = None
    payment_date: Optional[date] = None
    notes: Optional[str] = None

class RecordUpdateSummary(BaseModel):
    """Summary of what was updated for a single record"""
    policy_number: str
    record_type: str  # "policy", "cutpay", or "both"
    action: str  # "updated", "added", "no_change"
    updated_fields: List[str] = []
    old_values: Dict[str, Any] = {}
    new_values: Dict[str, Any] = {}

class ReconciliationReport(BaseModel):
    """Report of what was updated/added during reconciliation"""
    total_records_processed: int
    policies_updated: int
    policies_added: int
    cutpay_updated: int
    cutpay_added: int
    no_changes: int
    errors: List[str] = []
    processing_summary: List[RecordUpdateSummary] = []

class UniversalRecordUploadResponse(BaseModel):
    """Response after uploading universal record"""
    message: str
    report: ReconciliationReport
    processing_time_seconds: float
