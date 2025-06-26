from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any
from datetime import date, datetime
from decimal import Decimal

class CutPayCreate(BaseModel):
    """Schema for creating a new cut pay transaction with document upload and extraction"""
    
    # Document upload fields (optional - can be added later)
    policy_pdf_url: Optional[str] = Field(None, max_length=500, description="Policy PDF URL")
    additional_documents: Optional[List[str]] = Field(None, description="Additional document URLs")
    
    # Manual/Admin data entry fields
    code_type: Optional[str] = Field(None, description="Code type: agent, broker, or child_id")
    agent_code: Optional[str] = Field(None, max_length=50, description="Agent code")
    
    # Foreign key relationships for dropdowns
    insurer_id: Optional[int] = Field(None, description="Insurer ID")
    broker_id: Optional[int] = Field(None, description="Broker ID") 
    child_id_request_id: Optional[int] = Field(None, description="Child ID request ID")
    
    # Financial details (manual entry)
    gross_amount: Optional[float] = Field(None, gt=0, description="Gross amount")
    net_premium: Optional[float] = Field(None, gt=0, description="Net premium amount")
    commission_grid: Optional[str] = Field(None, max_length=100, description="Commission grid")
    agent_commission_given_percent: Optional[float] = Field(None, ge=0, le=100, description="Agent commission percentage")
    
    # Payment mode logic
    payment_mode: Optional[str] = Field(None, description="Payment mode: agent or insurezeal")
    
    # Payout configuration (when payment_mode = "agent")
    payout_percent: Optional[float] = Field(None, ge=0, le=100, description="Payout percentage")
    payout_amount: Optional[float] = Field(None, ge=0, description="Payout amount")
    
    # Payment tracking
    payment_by: Optional[str] = Field(None, max_length=200, description="Payment by")
    amount_received: Optional[float] = Field(None, ge=0, description="Amount received")
    payment_method: Optional[str] = Field(None, max_length=100, description="Payment method")
    payment_source: Optional[str] = Field(None, max_length=200, description="Payment source")
    payment_date: Optional[date] = Field(None, description="Payment date")
    
    # Dates
    transaction_date: Optional[date] = Field(None, description="Transaction date")
    
    # Status
    status: Optional[str] = Field("draft", description="Transaction status")
    
    # Additional info
    notes: Optional[str] = Field(None, max_length=1000, description="Additional notes")
    
    @validator('payment_mode')
    def validate_payment_mode(cls, v):
        if v and v not in ['agent', 'insurezeal']:
            raise ValueError('payment_mode must be either "agent" or "insurezeal"')
        return v
    
    @validator('status')
    def validate_status(cls, v):
        if v and v not in ['draft', 'completed', 'cancelled']:
            raise ValueError('status must be one of: draft, completed, cancelled')
        return v

class CutPayResponse(BaseModel):
    """Schema for cut pay transaction response"""
    id: int
    
    # Document upload fields
    policy_pdf_url: Optional[str]
    additional_documents: Optional[Dict[str, Any]]
    
    # Extracted fields from PDF
    policy_number: Optional[str]
    policy_holder_name: Optional[str]
    policy_start_date: Optional[date]
    policy_end_date: Optional[date]
    premium_amount: Optional[float]
    sum_insured: Optional[float]
    insurance_type: Optional[str]
    
    # Manual/Admin data entry fields
    code_type: Optional[str]
    agent_code: Optional[str]
    
    # Foreign key relationships
    insurer_id: Optional[int]
    broker_id: Optional[int]
    child_id_request_id: Optional[int]
    
    # Financial details
    gross_amount: Optional[float]
    net_premium: Optional[float]
    commission_grid: Optional[str]
    agent_commission_given_percent: Optional[float]
    
    # Payment mode logic
    payment_mode: Optional[str]
    
    # Payout configuration
    payout_percent: Optional[float]
    payout_amount: Optional[float]
    
    # Calculated fields
    cut_pay_amount: Optional[float]
    
    # Payment tracking
    payment_by: Optional[str]
    amount_received: Optional[float]
    payment_method: Optional[str]
    payment_source: Optional[str]
    payment_date: Optional[date]
    
    # Dates
    transaction_date: Optional[date]
    
    # Status tracking
    status: str
    
    # Google Sheets sync tracking
    synced_to_cutpay_sheet: bool
    synced_to_master_sheet: bool
    cutpay_sheet_row_id: Optional[str]
    master_sheet_row_id: Optional[str]
    
    # Additional info
    notes: Optional[str]
    
    # Audit fields
    created_at: datetime
    updated_at: datetime
    
    # Relationship data (loaded when needed)
    insurer: Optional[Dict[str, Any]] = None
    broker: Optional[Dict[str, Any]] = None
    child_id_request: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True

class CutPaySummary(BaseModel):
    """Schema for cut pay transaction summary (for card view in lists)"""
    id: int
    policy_number: Optional[str]
    agent_code: Optional[str]
    code_type: Optional[str]
    payment_mode: Optional[str]
    cut_pay_amount: Optional[float]
    amount_received: Optional[float]
    transaction_date: Optional[date]
    status: str
    created_at: datetime
    
    # Relationship names for display
    insurer_name: Optional[str] = None
    broker_name: Optional[str] = None
    child_id: Optional[str] = None

    class Config:
        from_attributes = True

class CutPayUpdate(BaseModel):
    """Schema for updating a cut pay transaction"""
    
    # Document upload fields
    policy_pdf_url: Optional[str] = Field(None, max_length=500)
    additional_documents: Optional[List[str]] = Field(None)
    
    # Extracted fields can be manually corrected
    policy_number: Optional[str] = Field(None, max_length=100)
    policy_holder_name: Optional[str] = Field(None, max_length=200)
    policy_start_date: Optional[date] = Field(None)
    policy_end_date: Optional[date] = Field(None)
    premium_amount: Optional[float] = Field(None, gt=0)
    sum_insured: Optional[float] = Field(None, gt=0)
    insurance_type: Optional[str] = Field(None, max_length=100)
    
    # Manual/Admin data entry fields
    code_type: Optional[str] = Field(None)
    agent_code: Optional[str] = Field(None, max_length=50)
    
    # Foreign key relationships
    insurer_id: Optional[int] = Field(None)
    broker_id: Optional[int] = Field(None)
    child_id_request_id: Optional[int] = Field(None)
    
    # Financial details
    gross_amount: Optional[float] = Field(None, gt=0)
    net_premium: Optional[float] = Field(None, gt=0)
    commission_grid: Optional[str] = Field(None, max_length=100)
    agent_commission_given_percent: Optional[float] = Field(None, ge=0, le=100)
    
    # Payment mode logic
    payment_mode: Optional[str] = Field(None)
    
    # Payout configuration
    payout_percent: Optional[float] = Field(None, ge=0, le=100)
    payout_amount: Optional[float] = Field(None, ge=0)
    
    # Payment tracking
    payment_by: Optional[str] = Field(None, max_length=200)
    amount_received: Optional[float] = Field(None, ge=0)
    payment_method: Optional[str] = Field(None, max_length=100)
    payment_source: Optional[str] = Field(None, max_length=200)
    payment_date: Optional[date] = Field(None)
    
    # Dates
    transaction_date: Optional[date] = Field(None)
    
    # Status
    status: Optional[str] = Field(None)
    
    # Additional info
    notes: Optional[str] = Field(None, max_length=1000)
    
    @validator('payment_mode')
    def validate_payment_mode(cls, v):
        if v and v not in ['agent', 'insurezeal']:
            raise ValueError('payment_mode must be either "agent" or "insurezeal"')
        return v
    
    @validator('status')
    def validate_status(cls, v):
        if v and v not in ['draft', 'completed', 'cancelled']:
            raise ValueError('status must be one of: draft, completed, cancelled')
        return v
    transaction_date: Optional[date] = Field(None)
    payment_date: Optional[date] = Field(None)
    
    # Additional info
    notes: Optional[str] = Field(None, max_length=1000)

class CutPayListResponse(BaseModel):
    """Schema for paginated cut pay transactions list"""
    transactions: list[CutPaySummary]
    total_count: int
    page: int
    page_size: int

class CutPayStats(BaseModel):
    """Schema for cut pay statistics"""
    total_transactions: int
    total_cut_pay_amount: float
    total_amount_received: float
    average_cut_pay_amount: float
    
class CutPayStatsResponse(BaseModel):
    """Schema for cut pay statistics response"""
    stats: CutPayStats
    monthly_breakdown: list[dict]  # Monthly statistics breakdown
    top_agents: list[dict]  # Top agents by cut pay amount

# New schemas for document upload and PDF extraction
class CutPayDocumentUpload(BaseModel):
    """Schema for document upload to CutPay transaction"""
    cutpay_id: int = Field(..., description="CutPay transaction ID")
    document_type: str = Field(..., description="Document type: policy_pdf, additional")
    
class CutPayDocumentUploadResponse(BaseModel):
    """Schema for document upload response"""
    success: bool
    message: str
    document_url: Optional[str] = None
    extracted_data: Optional[Dict[str, Any]] = None

class CutPayPDFExtraction(BaseModel):
    """Schema for PDF extraction data"""
    policy_number: Optional[str] = None
    policy_holder_name: Optional[str] = None
    policy_start_date: Optional[date] = None
    policy_end_date: Optional[date] = None
    premium_amount: Optional[float] = None
    sum_insured: Optional[float] = None
    insurance_type: Optional[str] = None
    confidence_score: Optional[float] = None

class CutPayCalculationRequest(BaseModel):
    """Schema for CutPay amount calculation"""
    gross_amount: Optional[float] = Field(None, gt=0)
    net_premium: Optional[float] = Field(None, gt=0)
    agent_commission_given_percent: Optional[float] = Field(None, ge=0, le=100)
    payment_mode: Optional[str] = Field(None)
    payout_percent: Optional[float] = Field(None, ge=0, le=100)

class CutPayCalculationResponse(BaseModel):
    """Schema for CutPay calculation response"""
    cut_pay_amount: Optional[float] = None
    payout_amount: Optional[float] = None
    calculation_details: Dict[str, Any] = {}

# Dropdown schemas
class InsurerDropdown(BaseModel):
    """Schema for insurer dropdown options"""
    id: int
    name: str
    insurer_code: str
    is_active: bool

class BrokerDropdown(BaseModel):
    """Schema for broker dropdown options"""
    id: int
    name: str
    broker_code: str
    is_active: bool

class ChildIdDropdown(BaseModel):
    """Schema for child ID dropdown options"""
    id: int
    child_id: str
    insurer_name: str
    broker_name: Optional[str] = None
    code_type: str
    status: str

class CutPayDropdownsResponse(BaseModel):
    """Schema for all CutPay dropdown options"""
    insurers: List[InsurerDropdown]
    brokers: List[BrokerDropdown]
    child_ids: List[ChildIdDropdown]
