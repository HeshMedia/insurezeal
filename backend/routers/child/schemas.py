from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional
from datetime import datetime
from enum import Enum

class ChildIdStatusEnum(str, Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    SUSPENDED = "suspended"

class ChildIdRequestCreate(BaseModel):
    """Schema for creating a child ID request"""
    insurance_company: str = Field(..., min_length=2, max_length=100)
    broker: str = Field(..., min_length=2, max_length=100)
    location: str = Field(..., min_length=2, max_length=200)
    phone_number: str = Field(..., pattern=r"^[6-9]\d{9}$")
    email: EmailStr = Field(...)
    preferred_rm_name: Optional[str] = Field(None, max_length=100)

class ChildIdResponse(BaseModel):
    """Response schema for child ID requests"""
    id: str
    user_id: str
    
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
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    
    # Timestamps
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class ChildIdRequestList(BaseModel):
    """Response schema for paginated child ID request lists"""
    requests: List[ChildIdResponse]
    total_count: int
    page: int
    page_size: int
    total_pages: int

    class Config:
        from_attributes = True
