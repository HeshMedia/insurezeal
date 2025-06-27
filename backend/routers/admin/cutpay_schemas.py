from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

# =============================================================================
# EXTRACTED DATA SCHEMAS
# =============================================================================

class ExtractedPolicyData(BaseModel):
    """Schema for data extracted from PDF documents"""
    
    # Basic Policy Information
    policy_number: Optional[str] = Field(None, description="Policy number")
    formatted_policy_number: Optional[str] = Field(None, description="Formatted policy number")
    major_categorisation: Optional[str] = Field(None, description="Insurance type (Motor, Life, Health)")
    product_insurer_report: Optional[str] = Field(None, description="Product name from insurer")
    product_type: Optional[str] = Field(None, description="Specific product type")
    plan_type: Optional[str] = Field(None, description="Coverage type (Comp, STP, SAOD)")
    customer_name: Optional[str] = Field(None, description="Policy holder name")
    
    # Premium & Financial Details
    gross_premium: Optional[float] = Field(None, description="Total premium amount")
    net_premium: Optional[float] = Field(None, description="Premium excluding taxes")
    od_premium: Optional[float] = Field(None, description="Own Damage premium")
    tp_premium: Optional[float] = Field(None, description="Third Party premium")
    gst_amount: Optional[float] = Field(None, description="GST amount")
    
    # Vehicle Details (for Motor Insurance)
    registration_no: Optional[str] = Field(None, description="Vehicle registration number")
    make_model: Optional[str] = Field(None, description="Vehicle make and model")
    model: Optional[str] = Field(None, description="Specific model name")
    vehicle_variant: Optional[str] = Field(None, description="Vehicle variant")
    gvw: Optional[float] = Field(None, description="Gross Vehicle Weight")
    rto: Optional[str] = Field(None, description="Regional Transport Office code")
    state: Optional[str] = Field(None, description="State of registration")
    fuel_type: Optional[str] = Field(None, description="Fuel type")
    cc: Optional[int] = Field(None, description="Engine capacity")
    age_year: Optional[int] = Field(None, description="Vehicle age in years")
    ncb: Optional[str] = Field(None, description="No Claim Bonus (YES/NO)")
    discount_percent: Optional[float] = Field(None, description="Discount percentage")
    business_type: Optional[str] = Field(None, description="Usage type")
    seating_capacity: Optional[int] = Field(None, description="Number of seats")
    veh_wheels: Optional[int] = Field(None, description="Number of wheels")

# =============================================================================
# ADMIN INPUT SCHEMAS
# =============================================================================

class AdminInputData(BaseModel):
    """Schema for admin manual input fields"""
    
    # Transaction Configuration
    reporting_month: Optional[str] = Field(None, description="Month in MMM'YY format")
    booking_date: Optional[date] = Field(None, description="Transaction date")
    agent_code: Optional[str] = Field(None, description="Agent identifier code")
    code_type: Optional[str] = Field(None, description="Selection (Direct, Broker, Child ID)")
    
    # Commission Configuration
    incoming_grid_percent: Optional[float] = Field(None, ge=0, le=100, description="Commission rate from insurer")
    agent_commission_given_percent: Optional[float] = Field(None, ge=0, le=100, description="Rate paid to agent")
    extra_grid: Optional[float] = Field(None, ge=0, le=100, description="Additional commission percentage")
    commissionable_premium: Optional[float] = Field(None, description="Base amount for commission calculation")
    
    # Payment Configuration
    payment_by: Optional[str] = Field(None, description="Who handles customer payment")
    payment_method: Optional[str] = Field(None, description="Payment method if InsureZeal pays")
    payout_on: Optional[str] = Field(None, description="Payout calculation basis")
    agent_extra_percent: Optional[float] = Field(None, ge=0, le=100, description="Additional agent commission percentage")
    payment_by_office: Optional[str] = Field(None, description="Who pays agent payout")
    
    # Relationship Selection
    insurer_id: Optional[int] = Field(None, description="Selected insurer")
    broker_id: Optional[int] = Field(None, description="Selected broker")
    child_id_request_id: Optional[UUID] = Field(None, description="Selected child ID")
    
    @validator('code_type')
    def validate_code_type(cls, v):
        if v and v not in ['Direct', 'Broker', 'Child ID']:
            raise ValueError('code_type must be one of: Direct, Broker, Child ID')
        return v
    
    @validator('payment_by')
    def validate_payment_by(cls, v):
        if v and v not in ['Agent', 'InsureZeal']:
            raise ValueError('payment_by must be either "Agent" or "InsureZeal"')
        return v
    
    @validator('payout_on')
    def validate_payout_on(cls, v):
        if v and v not in ['OD', 'NP', 'OD+TP']:
            raise ValueError('payout_on must be one of: OD, NP, OD+TP')
        return v
    
    @validator('payment_by_office')
    def validate_payment_by_office(cls, v):
        if v and v not in ['InsureZeal', 'Agent']:
            raise ValueError('payment_by_office must be either "InsureZeal" or "Agent"')
        return v

# =============================================================================
# CALCULATION SCHEMAS
# =============================================================================

class CalculationResult(BaseModel):
    """Schema for calculated amounts"""
    
    # Commission Calculations
    receivable_from_broker: Optional[float] = Field(None, description="Commission from broker")
    extra_amount_receivable_from_broker: Optional[float] = Field(None, description="Extra commission")
    total_receivable_from_broker: Optional[float] = Field(None, description="Total commission")
    total_receivable_from_broker_with_gst: Optional[float] = Field(None, description="Total with GST")
    
    # CutPay & Payout Calculations
    cut_pay_amount: Optional[float] = Field(None, description="CutPay amount")
    agent_po_amt: Optional[float] = Field(None, description="Agent payout amount")
    agent_extra_amount: Optional[float] = Field(None, description="Additional payout")
    total_agent_po_amt: Optional[float] = Field(None, description="Total agent payout")

class CalculationRequest(BaseModel):
    """Schema for calculation API requests"""
    
    # Required for calculations
    gross_premium: Optional[float] = Field(None, description="Gross premium for calculations")
    net_premium: Optional[float] = Field(None, description="Net premium for calculations")
    od_premium: Optional[float] = Field(None, description="OD premium for calculations")
    tp_premium: Optional[float] = Field(None, description="TP premium for calculations")
    
    # Commission configuration
    incoming_grid_percent: Optional[float] = Field(None, description="Incoming grid percentage")
    extra_grid: Optional[float] = Field(None, description="Extra grid percentage")
    commissionable_premium: Optional[float] = Field(None, description="Commissionable premium")
    agent_commission_given_percent: Optional[float] = Field(None, description="Agent commission percentage")
    agent_extra_percent: Optional[float] = Field(None, description="Agent extra percentage")
    
    # Payment configuration
    payment_by: Optional[str] = Field(None, description="Payment by configuration")
    payout_on: Optional[str] = Field(None, description="Payout calculation basis")

# =============================================================================
# MAIN CUTPAY SCHEMAS
# =============================================================================

class CutPayCreate(BaseModel):
    """Schema for creating a new cut pay transaction"""
    
    # Document upload fields
    policy_pdf_url: Optional[str] = Field(None, max_length=500, description="Policy PDF URL")
    additional_documents: Optional[Dict[str, Any]] = Field(None, description="Additional documents")
    
    # Extracted data (populated by AI extraction)
    extracted_data: Optional[ExtractedPolicyData] = Field(None, description="PDF extracted data")
    
    # Admin input data
    admin_input: Optional[AdminInputData] = Field(None, description="Admin manual input")
    
    # Calculated data (auto-computed)
    calculations: Optional[CalculationResult] = Field(None, description="Calculated amounts")
    
    # Admin tracking fields
    claimed_by: Optional[str] = Field(None, description="Who claimed the commission")
    already_given_to_agent: Optional[float] = Field(None, description="Advance amount given")
    po_paid_to_agent: Optional[float] = Field(None, description="Actual payout made")
    running_bal: Optional[float] = Field(None, description="Remaining balance")
    match_status: Optional[str] = Field(None, description="Reconciliation status")
    invoice_number: Optional[str] = Field(None, description="Invoice reference")
    
    # Status and notes
    status: Optional[str] = Field("draft", description="Transaction status")
    notes: Optional[str] = Field(None, description="Additional notes")
    
    @validator('status')
    def validate_status(cls, v):
        if v and v not in ['draft', 'completed', 'cancelled']:
            raise ValueError('status must be one of: draft, completed, cancelled')
        return v

class CutPayUpdate(BaseModel):
    """Schema for updating cut pay transactions"""
    
    # Allow partial updates of any field
    policy_pdf_url: Optional[str] = Field(None, max_length=500)
    additional_documents: Optional[Dict[str, Any]] = Field(None)
    
    # Extracted fields can be updated/corrected
    policy_number: Optional[str] = Field(None)
    formatted_policy_number: Optional[str] = Field(None)
    major_categorisation: Optional[str] = Field(None)
    product_insurer_report: Optional[str] = Field(None)
    product_type: Optional[str] = Field(None)
    plan_type: Optional[str] = Field(None)
    customer_name: Optional[str] = Field(None)
    gross_premium: Optional[float] = Field(None)
    net_premium: Optional[float] = Field(None)
    od_premium: Optional[float] = Field(None)
    tp_premium: Optional[float] = Field(None)
    gst_amount: Optional[float] = Field(None)
    
    # Vehicle details
    registration_no: Optional[str] = Field(None)
    make_model: Optional[str] = Field(None)
    model: Optional[str] = Field(None)
    vehicle_variant: Optional[str] = Field(None)
    gvw: Optional[float] = Field(None)
    rto: Optional[str] = Field(None)
    state: Optional[str] = Field(None)
    fuel_type: Optional[str] = Field(None)
    cc: Optional[int] = Field(None)
    age_year: Optional[int] = Field(None)
    ncb: Optional[str] = Field(None)
    discount_percent: Optional[float] = Field(None)
    business_type: Optional[str] = Field(None)
    seating_capacity: Optional[int] = Field(None)
    veh_wheels: Optional[int] = Field(None)
    
    # Admin input fields
    reporting_month: Optional[str] = Field(None)
    booking_date: Optional[date] = Field(None)
    agent_code: Optional[str] = Field(None)
    code_type: Optional[str] = Field(None)
    incoming_grid_percent: Optional[float] = Field(None, ge=0, le=100)
    agent_commission_given_percent: Optional[float] = Field(None, ge=0, le=100)
    extra_grid: Optional[float] = Field(None, ge=0, le=100)
    commissionable_premium: Optional[float] = Field(None)
    payment_by: Optional[str] = Field(None)
    payment_method: Optional[str] = Field(None)
    payout_on: Optional[str] = Field(None)
    agent_extra_percent: Optional[float] = Field(None, ge=0, le=100)
    payment_by_office: Optional[str] = Field(None)
    
    # Foreign keys
    insurer_id: Optional[int] = Field(None)
    broker_id: Optional[int] = Field(None)
    child_id_request_id: Optional[UUID] = Field(None)
    
    # Tracking fields
    claimed_by: Optional[str] = Field(None)
    already_given_to_agent: Optional[float] = Field(None)
    po_paid_to_agent: Optional[float] = Field(None)
    running_bal: Optional[float] = Field(None)
    match_status: Optional[str] = Field(None)
    invoice_number: Optional[str] = Field(None)
    
    status: Optional[str] = Field(None)
    notes: Optional[str] = Field(None)

class CutPayResponse(BaseModel):
    """Comprehensive schema for cut pay transaction response"""
    
    id: int
    
    # Document upload fields
    policy_pdf_url: Optional[str]
    additional_documents: Optional[Dict[str, Any]]
    
    # =============================================================================
    # EXTRACTED FIELDS FROM PDF
    # =============================================================================
    
    # Basic Policy Information
    policy_number: Optional[str]
    formatted_policy_number: Optional[str]
    major_categorisation: Optional[str]
    product_insurer_report: Optional[str]
    product_type: Optional[str]
    plan_type: Optional[str]
    customer_name: Optional[str]
    
    # Premium & Financial Details
    gross_premium: Optional[float]
    net_premium: Optional[float]
    od_premium: Optional[float]
    tp_premium: Optional[float]
    gst_amount: Optional[float]
    
    # Vehicle Details
    registration_no: Optional[str]
    make_model: Optional[str]
    model: Optional[str]
    vehicle_variant: Optional[str]
    gvw: Optional[float]
    rto: Optional[str]
    state: Optional[str]
    fuel_type: Optional[str]
    cc: Optional[int]
    age_year: Optional[int]
    ncb: Optional[str]
    discount_percent: Optional[float]
    business_type: Optional[str]
    seating_capacity: Optional[int]
    veh_wheels: Optional[int]
    
    # =============================================================================
    # ADMIN INPUT FIELDS
    # =============================================================================
    
    # Transaction Configuration
    reporting_month: Optional[str]
    booking_date: Optional[date]
    agent_code: Optional[str]
    code_type: Optional[str]
    
    # Commission Configuration
    incoming_grid_percent: Optional[float]
    agent_commission_given_percent: Optional[float]
    extra_grid: Optional[float]
    commissionable_premium: Optional[float]
    
    # Payment Configuration
    payment_by: Optional[str]
    payment_method: Optional[str]
    payout_on: Optional[str]
    agent_extra_percent: Optional[float]
    payment_by_office: Optional[str]
    
    # Relationships
    insurer_id: Optional[int]
    broker_id: Optional[int]
    child_id_request_id: Optional[UUID]
    
    # =============================================================================
    # AUTO-CALCULATED FIELDS
    # =============================================================================
    
    # Database Auto-Population
    insurer_name: Optional[str]
    broker_name: Optional[str]
    insurer_broker_code: Optional[str]
    cluster: Optional[str]
    
    # Commission Calculations
    receivable_from_broker: Optional[float]
    extra_amount_receivable_from_broker: Optional[float]
    total_receivable_from_broker: Optional[float]
    total_receivable_from_broker_with_gst: Optional[float]
    
    # CutPay & Payout Calculations
    cut_pay_amount: Optional[float]
    agent_po_amt: Optional[float]
    agent_extra_amount: Optional[float]
    total_agent_po_amt: Optional[float]
    
    # =============================================================================
    # ADMIN TRACKING FIELDS
    # =============================================================================
    
    claimed_by: Optional[str]
    already_given_to_agent: Optional[float]
    po_paid_to_agent: Optional[float]
    running_bal: Optional[float]
    match_status: Optional[str]
    invoice_number: Optional[str]
    
    # =============================================================================
    # SYSTEM FIELDS
    # =============================================================================
    
    status: str
    synced_to_cutpay_sheet: bool
    synced_to_master_sheet: bool
    cutpay_sheet_row_id: Optional[str]
    master_sheet_row_id: Optional[str]
    notes: Optional[str]
    
    # Audit fields
    created_by: Optional[UUID]
    created_at: datetime
    updated_at: datetime
    
    # Legacy fields (kept for backward compatibility)
    policy_holder_name: Optional[str]
    policy_start_date: Optional[date]
    policy_end_date: Optional[date]
    premium_amount: Optional[float]
    sum_insured: Optional[float]
    insurance_type: Optional[str]
    gross_amount: Optional[float]
    commission_grid: Optional[str]
    payment_mode: Optional[str]
    payout_percent: Optional[float]
    payout_amount: Optional[float]
    amount_received: Optional[float]
    payment_source: Optional[str]
    payment_date: Optional[date]
    transaction_date: Optional[date]
    
    class Config:
        from_attributes = True

# =============================================================================
# DROPDOWN & UTILITY SCHEMAS
# =============================================================================

class InsurerOption(BaseModel):
    """Schema for insurer dropdown options"""
    id: int
    name: str
    code: Optional[str]
    is_active: bool = True

class BrokerOption(BaseModel):
    """Schema for broker dropdown options"""
    id: int
    name: str
    code: Optional[str]
    insurer_id: Optional[int]
    is_active: bool = True

class ChildIdOption(BaseModel):
    """Schema for child ID dropdown options"""
    id: UUID
    child_id: str
    insurer_id: Optional[int]
    broker_id: Optional[int]
    status: str

class DropdownOptions(BaseModel):
    """Schema for all dropdown options"""
    insurers: List[InsurerOption]
    brokers: List[BrokerOption]
    child_ids: List[ChildIdOption]
    code_types: List[str] = ["Direct", "Broker", "Child ID"]
    payment_by_options: List[str] = ["Agent", "InsureZeal"]
    payout_on_options: List[str] = ["OD", "NP", "OD+TP"]
    payment_by_office_options: List[str] = ["InsureZeal", "Agent"]
    major_categorisation_options: List[str] = ["Motor", "Life", "Health"]
    plan_type_options: List[str] = ["Comp", "STP", "SAOD"]
    fuel_type_options: List[str] = ["Petrol", "Diesel", "CNG", "Electric"]
    business_type_options: List[str] = ["Private", "Commercial"]

class FilteredDropdowns(BaseModel):
    """Schema for filtered dropdown options based on selections"""
    brokers: List[BrokerOption]
    child_ids: List[ChildIdOption]

# =============================================================================
# DOCUMENT UPLOAD SCHEMAS
# =============================================================================

class DocumentUploadResponse(BaseModel):
    """Schema for document upload response"""
    document_url: str
    document_type: str
    upload_status: str
    message: str

class ExtractionRequest(BaseModel):
    """Schema for PDF extraction request"""
    cutpay_id: int
    force_reextract: bool = False
    extraction_confidence_threshold: float = 0.7

class ExtractionResponse(BaseModel):
    """Schema for PDF extraction response"""
    cutpay_id: int
    extraction_status: str
    extracted_data: Optional[ExtractedPolicyData]
    confidence_scores: Optional[Dict[str, float]]
    errors: Optional[List[str]]
    extraction_time: Optional[datetime]

# =============================================================================
# SYNC & EXPORT SCHEMAS
# =============================================================================

class SyncRequest(BaseModel):
    """Schema for Google Sheets sync request"""
    cutpay_id: int
    sync_to_cutpay_sheet: bool = True
    sync_to_master_sheet: bool = False  # Only for completed transactions
    force_sync: bool = False

class SyncResponse(BaseModel):
    """Schema for Google Sheets sync response"""
    cutpay_id: int
    cutpay_sheet_synced: bool
    master_sheet_synced: bool
    cutpay_sheet_row_id: Optional[str]
    master_sheet_row_id: Optional[str]
    sync_errors: Optional[List[str]]
    sync_timestamp: datetime

class ExportRequest(BaseModel):
    """Schema for export request"""
    format: str = Field("csv", description="Export format: csv, excel")
    date_from: Optional[date] = Field(None, description="Start date filter")
    date_to: Optional[date] = Field(None, description="End date filter")
    status_filter: Optional[List[str]] = Field(None, description="Status filters")
    insurer_ids: Optional[List[int]] = Field(None, description="Insurer filters")
    
    @validator('format')
    def validate_format(cls, v):
        if v not in ['csv', 'excel']:
            raise ValueError('format must be either "csv" or "excel"')
        return v

class DashboardStats(BaseModel):
    """Schema for dashboard statistics"""
    total_transactions: int
    completed_transactions: int
    draft_transactions: int
    total_cut_pay_amount: float
    total_agent_payouts: float
    total_commission_receivable: float
    pending_sync_count: int
    
    # Monthly statistics
    monthly_stats: Dict[str, Dict[str, float]]
    
    # Top performers
    top_agents: List[Dict[str, Any]]
    top_insurers: List[Dict[str, Any]]
    
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

class CutPayPDFExtraction(BaseModel):
    """Schema for PDF extraction results"""
    policy_number: Optional[str] = Field(None, description="Policy number")
    policy_holder_name: Optional[str] = Field(None, description="Policy holder name")
    policy_start_date: Optional[date] = Field(None, description="Policy start date")
    policy_end_date: Optional[date] = Field(None, description="Policy end date")
    premium_amount: Optional[float] = Field(None, description="Premium amount")
    sum_insured: Optional[float] = Field(None, description="Sum insured")
    insurance_type: Optional[str] = Field(None, description="Type of insurance")
    policy_pdf_url: Optional[str] = Field(None, description="URL of the policy PDF")
    confidence_score: Optional[float] = Field(None, description="Confidence score of extraction")

class BrokerDropdown(BaseModel):
    id: int
    broker_code: str
    name: str

class InsurerDropdown(BaseModel):
    id: int
    insurer_code: str
    name: str

class ChildIdDropdown(BaseModel):
    id: int
    child_id: str
    insurer_name: Optional[str]
    broker_name: Optional[str]
    code_type: Optional[str]
    status: Optional[str]

class CutPayStats(BaseModel):
    total_transactions: int
    total_cut_pay_amount: float
    total_amount_received: float
    average_cut_pay_amount: float


