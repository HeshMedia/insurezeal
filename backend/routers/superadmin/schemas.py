"""
Schemas for SuperAdmin routes
"""
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime


class BrokerCreate(BaseModel):
    name: str
    address: str
    rm: str
    gst: str


class BrokerResponse(BaseModel):
    id: int
    broker_code: str
    name: str
    address: str
    rm: str
    gst: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class BrokerUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    rm: Optional[str] = None
    gst: Optional[str] = None
    is_active: Optional[bool] = None


class InsurerCreate(BaseModel):
    name: str


class InsurerResponse(BaseModel):
    id: int
    insurer_code: str
    name: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class InsurerUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None


class AdminChildIDCreate(BaseModel):
    child_id: str
    branch_code: str
    region: str
    manager_name: str
    manager_email: EmailStr
    admin_notes: Optional[str] = None
    code_type: str  # "Direct Code" or "Broker Code"
    insurer_id: int
    broker_id: Optional[int] = None


class AdminChildIDResponse(BaseModel):
    id: int
    child_id: str
    branch_code: str
    region: str
    manager_name: str
    manager_email: str
    admin_notes: Optional[str]
    code_type: str
    insurer_id: int
    broker_id: Optional[int]
    is_active: bool
    is_suspended: bool
    created_at: datetime
    updated_at: datetime
    
    # Nested relationships
    insurer: InsurerResponse
    broker: Optional[BrokerResponse] = None
    
    class Config:
        from_attributes = True


class AdminChildIDUpdate(BaseModel):
    child_id: Optional[str] = None
    branch_code: Optional[str] = None
    region: Optional[str] = None
    manager_name: Optional[str] = None
    manager_email: Optional[EmailStr] = None
    admin_notes: Optional[str] = None
    code_type: Optional[str] = None
    insurer_id: Optional[int] = None
    broker_id: Optional[int] = None
    is_active: Optional[bool] = None
    is_suspended: Optional[bool] = None


class BrokerInsurerListResponse(BaseModel):
    """Response for dropdown lists"""
    brokers: List[BrokerResponse]
    insurers: List[InsurerResponse]
