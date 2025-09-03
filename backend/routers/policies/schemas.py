from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import date, datetime
from uuid import UUID
import json

# =============================================================================
# SIMPLIFIED SCHEMAS FOR DATABASE STORAGE
# =============================================================================

class PolicySummaryResponse(BaseModel):
    """Simplified response for policy summaries from database"""
    id: UUID
    policy_number: str
    child_id: Optional[str] = None
    agent_code: Optional[str] = None
    additional_documents: Optional[str] = None
    policy_pdf_url: Optional[str] = None
    booking_date: Optional[date] = None
    policy_start_date: Optional[date] = None
    policy_end_date: Optional[date] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class CutPaySummaryResponse(BaseModel):
    """Simplified response for cutpay summaries from database"""
    id: int
    policy_number: Optional[str] = None
    child_id_request_id: Optional[UUID] = None
    agent_code: Optional[str] = None
    insurer_id: Optional[int] = None
    broker_id: Optional[int] = None
    admin_child_id: Optional[str] = None
    additional_documents: Optional[str] = None
    policy_pdf_url: Optional[str] = None
    booking_date: Optional[date] = None
    policy_start_date: Optional[date] = None
    policy_end_date: Optional[date] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class PolicyCreateResponse(BaseModel):
    """Response after creating a policy"""
    id: UUID
    policy_number: str
    message: str

class CutPayCreateResponse(BaseModel):
    """Response after creating a cutpay"""
    id: int
    policy_number: Optional[str] = None
    message: str

# =============================================================================
# FRONTEND SCHEMAS (UNCHANGED FOR NOW)
# =============================================================================

class PolicyBase(BaseModel):
    # Agent & Child Info
    agent_id: Optional[UUID] = None
    agent_code: Optional[str] = None
    child_id: Optional[str] = None
    broker_code: Optional[str] = None  # Used to lookup broker_name from database
    broker_name: Optional[str] = None
    insurer_code: Optional[str] = None  # Used to lookup insurance_company from database
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
    booking_date: Optional[date] = None  # Added missing booking date field
    
    # Commission and Financial Calculation Fields (for Google Sheets)
    commissionable_premium: Optional[float] = None
    incoming_grid_percent: Optional[float] = None
    receivable_from_broker: Optional[float] = None
    extra_grid: Optional[float] = None
    extra_amount_receivable_from_broker: Optional[float] = None
    total_receivable_from_broker: Optional[float] = None
    claimed_by: Optional[str] = None
    cut_pay_amount_received_from_agent: Optional[float] = None
    already_given_to_agent: Optional[float] = None
    actual_agent_po_percent: Optional[float] = None
    agent_po_amt: Optional[float] = None
    agent_extra_percent: Optional[float] = None
    agent_extra_amount: Optional[float] = None
    po_paid_to_agent: Optional[float] = None
    total_receivable_from_broker_include_18_gst: Optional[float] = None
    iz_total_po_percent: Optional[float] = None
    as_per_broker_po_percent: Optional[float] = None
    as_per_broker_po_amt: Optional[float] = None
    po_percent_diff_broker: Optional[float] = None
    po_amt_diff_broker: Optional[float] = None
    as_per_agent_payout_percent: Optional[float] = None
    as_per_agent_payout_amount: Optional[float] = None
    po_percent_diff_agent: Optional[float] = None
    po_amt_diff_agent: Optional[float] = None
    invoice_status: Optional[str] = None
    invoice_number: Optional[str] = None
    remarks: Optional[str] = None
    match: Optional[str] = None
    
    # Reporting fields
    reporting_month: Optional[str] = None  # mmm'yy format
    payout_on: Optional[str] = None

class PolicyCreateRequest(PolicyBase):
    """Schema for creating a new policy with all possible fields from frontend"""
    pdf_file_path: str = Field(..., description="Supabase URL of the uploaded PDF")
    pdf_file_name: str = Field(..., description="Original filename of the PDF")
    
    ai_confidence_score: Optional[float] = None
    manual_override: Optional[bool] = False
    
    class Config:
        json_schema_extra = {
            "example": {
                # Agent & Child Info (optional - auto-filled for agents, validated for admins)
                "agent_id": "123e4567-e89b-12d3-a456-426614174000",
                "agent_code": "AGT001",
                "child_id": "CHILD123",
                "broker_code": "BRK001",  # Used to lookup broker_name from database
                "broker_name": "Sample Broker",
                "insurer_code": "INS001",  # Used to lookup insurance_company from database
                "insurance_company": "Sample Insurance Co",
                
                # Basic Policy Information (required)
                "policy_number": "POL123456789",
                "formatted_policy_number": "POL-123456789",
                "major_categorisation": "Motor",
                "product_insurer_report": "Private Car Package",
                "product_type": "Private Car",
                "plan_type": "Comprehensive",
                "customer_name": "John Doe",
                "customer_phone_number": "9876543210",
                
                # Legacy field names for backward compatibility (required)
                "policy_type": "Motor",
                "insurance_type": "Comprehensive",
                
                # Vehicle Details (optional)
                "vehicle_type": "Car",
                "registration_number": "MH01AB1234",
                "vehicle_class": "M1",
                "vehicle_segment": "Hatchback",
                "make_model": "Maruti Suzuki Swift",
                "model": "Swift",
                "vehicle_variant": "VDI",
                "gvw": 1200.5,
                "rto": "MH01",
                "state": "Maharashtra",
                "fuel_type": "Diesel",
                "cc": 1248,
                "age_year": 3,
                "ncb": "YES",
                "discount_percent": 20.0,
                "business_type": "Private",
                "seating_capacity": 5,
                "veh_wheels": 4,
                
                # Premium Details (optional)
                "gross_premium": 15000.00,
                "gst": 2700.00,
                "gst_amount": 2700.00,
                "net_premium": 12300.00,
                "od_premium": 8500.00,
                "tp_premium": 3800.00,
                
                # Agent Commission Fields
                "agent_commission_given_percent": 15.0,
                
                # Agent Financial Tracking Fields
                "payment_by_office": 5000.00,
                "total_agent_payout_amount": 2000.00,
                "running_bal": 1500.00,
                
                # Additional Policy Configuration
                "code_type": "Child ID",
                "payment_by": "Agent",
                "payment_method": "Cash",
                "cluster": "West",
                
                # Additional fields
                "notes": "Customer preferred comprehensive coverage",
                
                # Dates (optional)
                "start_date": "2025-01-01",
                "end_date": "2026-01-01",
                "booking_date": "2025-01-01",
                
                # Commission and Financial Fields (optional - for advanced users)
                "commissionable_premium": 12300.00,
                "incoming_grid_percent": 15.0,
                "receivable_from_broker": 1845.00,
                "extra_grid": 2.0,
                "extra_amount_receivable_from_broker": 246.00,
                "total_receivable_from_broker": 2091.00,
                "claimed_by": "Agent",
                "reporting_month": "Jan'25",
                "payout_on": "Monthly",

                # File Info (required)
                "pdf_file_path": "https://supabase.url/path/to/file.pdf",
                "pdf_file_name": "policy.pdf",
                
                # AI Metadata (optional)
                "ai_confidence_score": 0.85,
                "manual_override": False
            }
        }

# =============================================================================
# CUTPAY SCHEMAS (FOR FRONTEND COMPATIBILITY)
# =============================================================================

class CutPayBase(BaseModel):
    """Base CutPay schema with all frontend fields"""
    # Document URLs
    policy_pdf_url: Optional[str] = None
    additional_documents: Optional[dict] = None
    
    # Basic Policy Information
    policy_number: Optional[str] = None
    formatted_policy_number: Optional[str] = None
    major_categorisation: Optional[str] = None
    product_insurer_report: Optional[str] = None
    product_type: Optional[str] = None
    plan_type: Optional[str] = None
    customer_name: Optional[str] = None
    customer_phone_number: Optional[str] = None
    
    # Premium & Financial Details
    gross_premium: Optional[float] = None
    net_premium: Optional[float] = None
    od_premium: Optional[float] = None
    tp_premium: Optional[float] = None
    gst_amount: Optional[float] = None
    
    # Vehicle Details
    registration_number: Optional[str] = None
    make_model: Optional[str] = None
    model: Optional[str] = None
    vehicle_variant: Optional[str] = None
    gvw: Optional[float] = None
    rto: Optional[str] = None
    state: Optional[str] = None
    fuel_type: Optional[str] = None
    cc: Optional[int] = None
    age_year: Optional[int] = None
    ncb: Optional[str] = None
    discount_percent: Optional[float] = None
    business_type: Optional[str] = None
    seating_capacity: Optional[int] = None
    veh_wheels: Optional[int] = None
    
    # Transaction Configuration
    reporting_month: Optional[str] = None
    booking_date: Optional[date] = None
    agent_code: Optional[str] = None
    code_type: Optional[str] = None
    
    # Commission Configuration
    incoming_grid_percent: Optional[float] = None
    agent_commission_given_percent: Optional[float] = None
    extra_grid: Optional[float] = None
    commissionable_premium: Optional[float] = None
    
    # Payment Configuration
    payment_by: Optional[str] = None
    payment_method: Optional[str] = None
    payout_on: Optional[str] = None
    agent_extra_percent: Optional[float] = None
    payment_by_office: Optional[float] = None
    
    # All other fields...
    notes: Optional[str] = None

class CutPayCreateRequest(CutPayBase):
    """Schema for creating CutPay from frontend"""
    pass

# =============================================================================
# LEGACY COMPATIBILITY SCHEMAS
# =============================================================================

class PolicyUpdate(BaseModel):
    agent_id: Optional[UUID] = None
    agent_code: Optional[str] = None
    child_id: Optional[str] = None
    broker_code: Optional[str] = None
    broker_name: Optional[str] = None
    insurer_code: Optional[str] = None
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
    """Full response for detailed view (will be changed to use Google Sheets later)"""
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
    """Legacy summary for list view"""
    id: UUID
    policy_number: str
    policy_type: str
    insurance_type: Optional[str] = None
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
    confidence_score: Optional[float] = None
    pdf_file_path: str  # Keep for backward compatibility in API response
    pdf_file_name: str  # Keep for backward compatibility in API response
    message: str
    upload_url: Optional[str] = None

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

class PolicyUpdate(BaseModel):
    """Schema for updating an existing policy with selective fields"""
    # Agent & Child Info
    agent_id: Optional[UUID] = None
    agent_code: Optional[str] = None
    child_id: Optional[str] = None
    broker_code: Optional[str] = None  # Used to lookup broker_name from database
    broker_name: Optional[str] = None
    insurer_code: Optional[str] = None  # Used to lookup insurance_company from database
    insurance_company: Optional[str] = None
    
    # Basic Policy Information
    policy_number: Optional[str] = None
    formatted_policy_number: Optional[str] = None
    major_categorisation: Optional[str] = None  # Motor, Life, Health
    product_insurer_report: Optional[str] = None
    product_type: Optional[str] = None  # Private Car, etc.
    plan_type: Optional[str] = None  # Comp, STP, SAOD
    customer_name: Optional[str] = None
    customer_phone_number: Optional[str] = None
    
    # Legacy field names for backward compatibility
    policy_type: Optional[str] = None
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
    booking_date: Optional[date] = None  # Added missing booking date field
    
    # Commission and Financial Calculation Fields (for Google Sheets)
    commissionable_premium: Optional[float] = None
    incoming_grid_percent: Optional[float] = None
    receivable_from_broker: Optional[float] = None
    extra_grid: Optional[float] = None
    extra_amount_receivable_from_broker: Optional[float] = None
    total_receivable_from_broker: Optional[float] = None
    claimed_by: Optional[str] = None
    cut_pay_amount_received_from_agent: Optional[float] = None
    already_given_to_agent: Optional[float] = None
    actual_agent_po_percent: Optional[float] = None
    agent_po_amt: Optional[float] = None
    agent_extra_percent: Optional[float] = None
    agent_extra_amount: Optional[float] = None
    po_paid_to_agent: Optional[float] = None
    total_receivable_from_broker_include_18_gst: Optional[float] = None
    iz_total_po_percent: Optional[float] = None
    as_per_broker_po_percent: Optional[float] = None
    as_per_broker_po_amt: Optional[float] = None
    po_percent_diff_broker: Optional[float] = None
    po_amt_diff_broker: Optional[float] = None
    as_per_agent_payout_percent: Optional[float] = None
    as_per_agent_payout_amount: Optional[float] = None
    po_percent_diff_agent: Optional[float] = None
    po_amt_diff_agent: Optional[float] = None
    invoice_status: Optional[str] = None
    invoice_number: Optional[str] = None
    remarks: Optional[str] = None
    match: Optional[str] = None
    
    # Reporting fields
    reporting_month: Optional[str] = None  # mmm'yy format
    payout_on: Optional[str] = None
    
    # Document URLs
    policy_pdf_url: Optional[str] = None
    additional_documents: Optional[str] = None
    
    # AI Metadata
    ai_confidence_score: Optional[float] = None
    manual_override: Optional[bool] = None

class PolicyDatabaseResponse(BaseModel):
    """Response model showing only database-stored fields for policies"""
    id: str  # UUID converted to string
    policy_number: str
    child_id: Optional[str] = None
    agent_code: Optional[str] = None
    additional_documents: Optional[str] = None
    policy_pdf_url: Optional[str] = None
    booking_date: Optional[str] = None  # ISO date string
    policy_start_date: Optional[str] = None  # ISO date string
    policy_end_date: Optional[str] = None  # ISO date string
    created_at: str  # ISO datetime string
    updated_at: Optional[str] = None  # ISO datetime string
    
    class Config:
        from_attributes = True

class PolicyNumberCheckResponse(BaseModel):
    """Response for policy number duplicate check"""
    policy_number: str
    is_duplicate: bool
    message: str
    existing_policy_id: Optional[UUID] = None
