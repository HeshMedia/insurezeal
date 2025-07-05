from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional
from datetime import datetime
from enum import Enum
from uuid import UUID

class ChildIdStatusEnum(str, Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    SUSPENDED = "suspended"

class CodeTypeEnum(str, Enum):
    DIRECT_CODE = "Direct Code"
    BROKER_CODE = "Broker Code"

class ChildIdRequestCreate(BaseModel):
    """Schema for creating a child ID request - Updated flow"""
    phone_number: str = Field(..., pattern=r"^[6-9]\d{9}$")
    email: EmailStr = Field(...)
    location: str = Field(..., min_length=2, max_length=200)
    code_type: CodeTypeEnum = Field(...)
    insurer_code: str = Field(..., description="Selected insurer code")
    broker_code: Optional[str] = Field(None, description="Selected broker code (required for Broker Code type)")
    preferred_rm_name: Optional[str] = Field(None, max_length=100)

class BrokerDropdownResponse(BaseModel):
    """Response schema for broker dropdown"""
    id: int
    broker_code: str
    name: str
    
    class Config:
        from_attributes = True

class InsurerDropdownResponse(BaseModel):
    """Response schema for insurer dropdown"""
    id: int
    insurer_code: str
    name: str
    
    class Config:
        from_attributes = True

class BrokerInsurerDropdownResponse(BaseModel):
    """Response for dropdown lists"""
    brokers: List[BrokerDropdownResponse]
    insurers: List[InsurerDropdownResponse]

class ChildIdResponse(BaseModel):
    """Response schema for child ID requests - Clean new structure"""
    id: UUID
    user_id: UUID
    phone_number: str
    email: str
    location: str
    code_type: str
    insurer_id: int  # Keep for internal use
    broker_id: Optional[int] = None  # Keep for internal use
    preferred_rm_name: Optional[str] = None
    status: ChildIdStatusEnum
    child_id: Optional[str] = None
    branch_code: Optional[str] = None
    region: Optional[str] = None
    manager_name: Optional[str] = None
    manager_email: Optional[str] = None
    admin_notes: Optional[str] = None

    # Admin approval details
    approved_by: Optional[UUID] = None
    approved_at: Optional[datetime] = None
    
    # Timestamps
    created_at: datetime
    updated_at: datetime
    
    # Nested relationships with codes
    insurer: Optional[InsurerDropdownResponse] = None
    broker_relation: Optional[BrokerDropdownResponse] = None
    
    class Config:
        from_attributes = True

class ChildIdSummary(BaseModel):
    """Summary schema for child ID requests (list/card view) - Clean new structure"""
    id: UUID
    phone_number: str
    location: str
    code_type: str
    status: ChildIdStatusEnum
    child_id: Optional[str] = None
    created_at: datetime
    
    # Include nested insurer/broker info
    insurer: Optional[InsurerDropdownResponse] = None
    broker_relation: Optional[BrokerDropdownResponse] = None
    
    class Config:
        from_attributes = True

class ChildIdRequestList(BaseModel):
    """Response schema for paginated child ID request lists"""
    requests: List[ChildIdSummary]
    total_count: int
    page: int
    page_size: int
    total_pages: int

    class Config:
        from_attributes = True
