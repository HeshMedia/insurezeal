from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import date, datetime
from uuid import UUID
import json

class PolicyBase(BaseModel):
    # Agent & Child Info
    agent_id: Optional[UUID] = None
    agent_code: Optional[str] = None
    child_id: Optional[str] = None
    broker_name: Optional[str] = None
    insurance_company: Optional[str] = None
    
    # Basic Policy Information
    policy_number: str
    formatted_policy_number: Optional[str] = None
    major_categorisation: Optional[str] = None  # Motor, Life, Health
    product_insurer_report: Optional[str] = None
    product_type: Optional[str] = None  # Private Car, etc.
    plan_type: Optional[str] = None  # Comp, STP, SAOD
    customer_name: Optional[str] = None
    customer_phone_number: Optional[str] = None
    
    # Legacy field names for backward compatibility
    policy_type: str
    insurance_type: Optional[str] = None
    
    # Vehicle Details
    vehicle_type: Optional[str] = None
    registration_number: Optional[str] = None
    vehicle_class: Optional[str] = None
    vehicle_segment: Optional[str] = None
    make_model: Optional[str] = None
    model: Optional[str] = None
    vehicle_variant: Optional[str] = None
    gvw: Optional[float] = None  # Gross Vehicle Weight
    rto: Optional[str] = None
    state: Optional[str] = None
    fuel_type: Optional[str] = None
    cc: Optional[int] = None  # Engine capacity
    age_year: Optional[int] = None
    ncb: Optional[str] = None  # YES/NO
    discount_percent: Optional[float] = None
    business_type: Optional[str] = None
    seating_capacity: Optional[int] = None
    veh_wheels: Optional[int] = None
    is_private_car: Optional[bool] = Field(None, description="Whether this is a private car")
    
    # Premium Details
    gross_premium: Optional[float] = None
    gst: Optional[float] = None
    gst_amount: Optional[float] = None  # Alternative field name
    net_premium: Optional[float] = None
    od_premium: Optional[float] = None
    tp_premium: Optional[float] = None
    
    # Agent Commission Fields (only one for policies now)
    agent_commission_given_percent: Optional[float] = None
    
    # Agent Financial Tracking Fields
    payment_by_office: Optional[float] = Field(None, description="Amount paid by office")
    total_agent_payout_amount: Optional[float] = Field(None, description="Total amount to be paid out to agent")
    running_bal: Optional[float] = Field(None, description="Running balance for agent financial tracking (calculated by frontend)")
    
    # Additional Policy Configuration
    code_type: Optional[str] = None  # Direct, Broker, Child ID
    payment_by: Optional[str] = None  # Agent, InsureZeal
    payment_method: Optional[str] = None
    cluster: Optional[str] = None
    
    # Additional fields
    notes: Optional[str] = None
    
    # Dates
    start_date: Optional[date] = None
    end_date: Optional[date] = None

class PolicyCreate(PolicyBase):
    """Schema for creating a new policy with all possible fields"""
    pdf_file_path: str = Field(..., description="Supabase URL of the uploaded PDF")
    pdf_file_name: str = Field(..., description="Original filename of the PDF")
    
    ai_confidence_score: Optional[float] = None
    manual_override: Optional[bool] = False
    
    class Config:
        json_schema_extra = {            "example": {
                # Agent & Child Info (optional - auto-filled for agents, validated for admins)
                "agent_id": "123e4567-e89b-12d3-a456-426614174000",  # Will be auto-filled for agents or validated for admins
                "agent_code": "AGT001",  # Auto-filled based on agent_id
                "child_id": "CHILD123",  # Must be a valid child_id from /policies/helpers/child-ids
                "broker_name": "Sample Broker",  # Auto-filled based on child_id
                "insurance_company": "Sample Insurance Co",  # Auto-filled based on child_id
                
                # Policy Details (required)
                "policy_number": "POL123456789",
                "policy_type": "Motor",
                "insurance_type": "Comprehensive",
                
                # Vehicle Details (optional)
                "vehicle_type": "Car",
                "registration_number": "MH01AB1234",
                "vehicle_class": "M1",
                "vehicle_segment": "Hatchback",

                # Premium Details (optional)
                "gross_premium": 15000.00,
                "gst": 2700.00,
                "net_premium": 12300.00,
                "od_premium": 8500.00,
                "tp_premium": 3800.00,
                
                # Dates (optional)
                "start_date": "2025-01-01",
                "end_date": "2026-01-01",

                # File Info (required)
                "pdf_file_path": "https://supabase.url/path/to/file.pdf",
                "pdf_file_name": "policy.pdf",
                
                # AI Metadata (optional)
                "ai_confidence_score": 0.85,
                "manual_override": False
            }
        }

class PolicyUpdate(BaseModel):
    agent_id: Optional[UUID] = None
    agent_code: Optional[str] = None
    child_id: Optional[str] = None
    broker_name: Optional[str] = None
    insurance_company: Optional[str] = None
    policy_number: Optional[str] = None
    policy_type: Optional[str] = None
    insurance_type: Optional[str] = None
    vehicle_type: Optional[str] = None
    registration_number: Optional[str] = None
    vehicle_class: Optional[str] = None
    vehicle_segment: Optional[str] = None
    gross_premium: Optional[float] = None
    gst: Optional[float] = None
    net_premium: Optional[float] = None
    od_premium: Optional[float] = None
    tp_premium: Optional[float] = None
    payment_by_office: Optional[float] = None
    total_agent_payout_amount: Optional[float] = None
    running_bal: Optional[float] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    manual_override: Optional[bool] = None

class PolicyResponse(PolicyBase):
    id: UUID
    uploaded_by: UUID
    pdf_file_name: str
    ai_confidence_score: Optional[float] = None
    manual_override: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class PolicySummary(BaseModel):
    """Summary for list view"""
    id: UUID
    policy_number: str
    policy_type: str
    insurance_type: str
    agent_code: Optional[str] = None
    vehicle_type: Optional[str] = None
    registration_number: Optional[str] = None
    net_premium: Optional[float] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    created_at: datetime

    class Config:
        from_attributes = True

class PolicyListResponse(BaseModel):
    policies: List[PolicySummary]
    total_count: int
    page: int
    page_size: int
    total_pages: int

class PolicyUploadResponse(BaseModel):
    """Response after PDF upload and AI extraction"""
    policy_id: Optional[UUID] = None  
    extracted_data: dict
    confidence_score: float
    pdf_file_path: str 
    pdf_file_name: str  
    message: str

class AIExtractionResponse(BaseModel):
    """Response from AI extraction"""
    extracted_data: dict
    confidence_score: float
    success: bool
    message: str

class ChildIdOption(BaseModel):
    """Child ID options for dropdown"""
    child_id: str
    broker_name: str
    insurance_company: str

class AgentOption(BaseModel):
    """Agent options for admin dropdown"""
    agent_id: UUID
    agent_code: str
    full_name: str
