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
    customer_phone_number: Optional[str] = Field(None, description="Customer phone number")
    
    # Premium & Financial Details
    gross_premium: Optional[float] = Field(None, description="Total premium amount")
    net_premium: Optional[float] = Field(None, description="Premium excluding taxes")
    od_premium: Optional[float] = Field(None, description="Own Damage premium")
    tp_premium: Optional[float] = Field(None, description="Third Party premium")
    gst_amount: Optional[float] = Field(None, description="GST amount")
    
    # Vehicle Details (for Motor Insurance)
    registration_number: Optional[str] = Field(None, description="Vehicle registration number")
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
    
    # Policy Dates
    start_date: Optional[str] = Field(None, description="Policy start date (YYYY-MM-DD)")
    end_date: Optional[str] = Field(None, description="Policy end date (YYYY-MM-DD)")

# =============================================================================
# ADMIN INPUT SCHEMAS
# =============================================================================

class AdminInputData(BaseModel):
    """Schema for admin manual input fields"""
    
    # Transaction Configuration
    reporting_month: Optional[str] = Field(None, description="Month in MMM'YY format")
    booking_date: Optional[date] = Field(None, description="Transaction date")
    agent_code: Optional[str] = Field(None, description="Agent identifier code")
    code_type: Optional[str] = Field(None, description="Selection (Direct, Broker)")
    
    # Commission Configuration
    incoming_grid_percent: Optional[float] = Field(None, description="Commission rate from insurer")
    agent_commission_given_percent: Optional[float] = Field(None, description="Rate paid to agent")
    extra_grid: Optional[float] = Field(None, description="Additional commission percentage")
    commissionable_premium: Optional[float] = Field(None, description="Base amount for commission calculation")
    
    # Payment Configuration
    payment_by: Optional[str] = Field(None, description="Who handles customer payment")
    payment_method: Optional[str] = Field(None, description="Payment method if InsureZeal pays")
    payout_on: Optional[str] = Field(None, description="Payout calculation basis")
    agent_extra_percent: Optional[float] = Field(None, description="Additional agent commission percentage")
    payment_by_office: Optional[float] = Field(None, description="Who pays agent payout")
    
    # Relationship Selection
    insurer_code: Optional[str] = Field(None, description="Selected insurer code")
    broker_code: Optional[str] = Field(None, description="Selected broker code")
    admin_child_id: Optional[str] = Field(None, description="Selected admin child ID")
    
    @validator('code_type')
    def validate_code_type(cls, v):
        if v and v not in ['Direct', 'Broker']:
            raise ValueError('code_type must be one of: Direct, Broker')
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

    # Frontend Calculated Fields
    iz_total_po_percent: Optional[float] = Field(None, description="InsureZeal total payout percentage")
    already_given_to_agent: Optional[float] = Field(None, ge=0, description="Amount already paid to agent")
    broker_payout_amount: Optional[float] = Field(None, ge=0, description="Payout amount for the broker")

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
    running_bal: Optional[float] = Field(None, description="Remaining balance")
    cutpay_received: Optional[float] = Field(None, description="CutPay amount received")
    cluster: Optional[str] = Field(None, max_length=100, description="Business cluster/region")
    
    # Notes
    notes: Optional[str] = Field(None, description="Additional notes")

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
    customer_phone_number: Optional[str] = Field(None)
    gross_premium: Optional[float] = Field(None)
    net_premium: Optional[float] = Field(None)
    od_premium: Optional[float] = Field(None)
    tp_premium: Optional[float] = Field(None)
    gst_amount: Optional[float] = Field(None)
    
    # Vehicle details
    registration_number: Optional[str] = Field(None)
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
    incoming_grid_percent: Optional[float] = Field(None)
    agent_commission_given_percent: Optional[float] = Field(None)
    extra_grid: Optional[float] = Field(None)
    commissionable_premium: Optional[float] = Field(None)
    payment_by: Optional[str] = Field(None)
    payment_method: Optional[str] = Field(None)
    payout_on: Optional[str] = Field(None)
    agent_extra_percent: Optional[float] = Field(None)
    payment_by_office: Optional[float] = Field(None)
    
    # Foreign keys - now using codes instead of IDs
    insurer_code: Optional[str] = Field(None)
    broker_code: Optional[str] = Field(None)
    admin_child_id: Optional[str] = Field(None)
    cluster: Optional[str] = Field(None)
    
    # Tracking fields
    claimed_by: Optional[str] = Field(None)
    running_bal: Optional[float] = Field(None)
    cutpay_received: Optional[float] = Field(None)
    
    # Post-CutPay details fields
    already_given_to_agent: Optional[float] = Field(None, ge=0)
    iz_total_po_percent: Optional[float] = Field(None)
    broker_po_percent: Optional[float] = Field(None)
    broker_payout_amount: Optional[float] = Field(None, ge=0)
    invoice_status: Optional[str] = Field(None)
    remarks: Optional[str] = Field(None)
    company: Optional[str] = Field(None)
    
    # Notes
    notes: Optional[str] = Field(None)
    
    # Nested update support - allow the same nested structure as create
    extracted_data: Optional[ExtractedPolicyData] = Field(None)
    admin_input: Optional[AdminInputData] = Field(None)
    calculations: Optional[CalculationResult] = Field(None)
    
    @validator('invoice_status')
    def validate_invoice_status_update(cls, v):
        if v is not None:
            allowed_statuses = ["GST pending", "invoicing pending", "paid", "payment pending"]
            if v not in allowed_statuses:
                raise ValueError(f"Invoice status must be one of: {', '.join(allowed_statuses)}")
        return v

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
    customer_phone_number: Optional[str]
    
    # Premium & Financial Details
    gross_premium: Optional[float]
    net_premium: Optional[float]
    od_premium: Optional[float]
    tp_premium: Optional[float]
    gst_amount: Optional[float]
    
    # Vehicle Details
    registration_number: Optional[str]
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
    payment_by_office: Optional[float]
    
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
    running_bal: Optional[float]
    cutpay_received: Optional[float]
    cluster: Optional[str]
    
    # =============================================================================
    # POST-CUTPAY DETAILS FIELDS
    # =============================================================================
    
    already_given_to_agent: Optional[float]
    iz_total_po_percent: Optional[float]
    broker_po_percent: Optional[float]
    broker_payout_amount: Optional[float]
    invoice_status: Optional[str]
    remarks: Optional[str]
    company: Optional[str]
    
    # =============================================================================
    # SYSTEM FIELDS
    # =============================================================================
    
    synced_to_cutpay_sheet: bool
    synced_to_master_sheet: bool
    cutpay_sheet_row_id: Optional[str]
    master_sheet_row_id: Optional[str]
    notes: Optional[str]
    
    # Audit fields
    created_by: Optional[UUID]
    created_at: datetime
    updated_at: datetime
    
    
    class Config:
        from_attributes = True
        arbitrary_types_allowed = True

# =============================================================================
# DATABASE-ONLY RESPONSE SCHEMA
# =============================================================================

class CutPayDatabaseResponse(BaseModel):
    """
    Simplified schema for CutPay responses - contains only fields stored in database
    This schema reflects the selective storage strategy where only essential fields are in DB
    """
    
    # Database primary key
    id: int
    
    # Essential document fields (stored in DB)
    policy_pdf_url: Optional[str] = Field(None, description="Main policy PDF URL")
    additional_documents: Optional[Dict[str, Any]] = Field(None, description="Additional document URLs as JSON")
    
    # Essential policy fields (stored in DB)
    policy_number: Optional[str] = Field(None, description="Policy number")
    
    # Essential admin fields (stored in DB)
    agent_code: Optional[str] = Field(None, description="Agent identifier code")
    booking_date: Optional[date] = Field(None, description="Transaction booking date")
    admin_child_id: Optional[str] = Field(None, description="Selected admin child ID")
    
    # Essential relationship fields (stored in DB)
    insurer_id: Optional[int] = Field(None, description="Insurer foreign key")
    broker_id: Optional[int] = Field(None, description="Broker foreign key") 
    child_id_request_id: Optional[UUID] = Field(None, description="Child ID request foreign key")
    
    # Essential date fields (stored in DB)
    policy_start_date: Optional[date] = Field(None, description="Policy start date")
    policy_end_date: Optional[date] = Field(None, description="Policy end date")
    
    # System audit fields (stored in DB)
    created_at: datetime = Field(..., description="Record creation timestamp")
    updated_at: datetime = Field(..., description="Record last update timestamp")
    
    class Config:
        from_attributes = True
        arbitrary_types_allowed = True

# =============================================================================
# DROPDOWN & UTILITY SCHEMAS  
# =============================================================================

class InsurerOption(BaseModel):
    """Schema for insurer dropdown options"""
    code: str
    name: str
    is_active: bool = True

class BrokerOption(BaseModel):
    """Schema for broker dropdown options"""
    code: str
    name: str
    is_active: bool = True

class AdminChildIdOption(BaseModel):
    """Schema for admin child ID dropdown options"""
    id: int
    child_id: str
    insurer_name: str
    broker_name: Optional[str]
    code_type: str
    is_active: bool

class DropdownOptions(BaseModel):
    """Schema for all dropdown options"""
    insurers: List[InsurerOption]
    brokers: List[BrokerOption]
    admin_child_ids: List[AdminChildIdOption]
    code_types: List[str] = ["Direct", "Broker"]
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
    admin_child_ids: List[AdminChildIdOption]

# =============================================================================
# DOCUMENT UPLOAD SCHEMAS
# =============================================================================

class DocumentUploadResponse(BaseModel):
    """Schema for document upload response"""
    document_url: str
    document_type: str
    upload_status: str
    message: str
    upload_url: Optional[str] = None

class ExtractionRequest(BaseModel):
    """Schema for PDF extraction request"""
    # No additional fields needed - cutpay_id comes from URL path
    pass

class ExtractionResponse(BaseModel):
    """Schema for PDF extraction response"""
    extraction_status: str
    extracted_data: Optional[ExtractedPolicyData]
    confidence_scores: Optional[Dict[str, float]] = None
    errors: Optional[List[str]] = None
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
    created_at: datetime
    
    # Relationship names for display
    insurer_name: Optional[str] = None
    broker_name: Optional[str] = None
    child_id: Optional[str] = None

    class Config:
        from_attributes = True

class CutPayListResponse(BaseModel):
    """Schema for paginated cut pay transactions list"""
    transactions: list[CutPaySummary]
    total_count: int
    page: int
    page_size: int

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

class CutPayStats(BaseModel):
    total_transactions: int
    total_cut_pay_amount: float
    total_amount_received: float
    average_cut_pay_amount: float

# =============================================================================
# CUTPAY AGENT CONFIG SCHEMAS
# =============================================================================

# =============================================================================
# BULK UPDATE SCHEMAS
# =============================================================================

class BulkUpdateItem(BaseModel):
    """Schema for a single item in a bulk update request"""
    cutpay_id: int = Field(..., description="The ID of the CutPay transaction to update")
    update_data: CutPayUpdate = Field(..., description="The data to update for this transaction")

class BulkUpdateRequest(BaseModel):
    """Schema for a bulk update request"""
    updates: List[BulkUpdateItem] = Field(..., description="A list of update operations to perform")

class BulkUpdateResponse(BaseModel):
    """Schema for the response of a bulk update operation"""
    success_count: int
    failed_count: int
    successful_ids: List[int]
    failed_updates: List[Dict[str, Any]]
    updated_records: List[CutPayDatabaseResponse]

# =============================================================================
# CUTPAY AGENT CONFIG SCHEMAS
# =============================================================================

class CutPayAgentConfigCreate(BaseModel):
    """Schema for creating a new CutPay agent configuration"""
    agent_code: str = Field(..., description="Agent code")
    config_date: date = Field(..., description="Configuration date")
    payment_mode: str = Field(..., description="Payment mode (NEFT, Cash, Cheque)")
    payment_mode_detail: Optional[str] = Field(None, description="Additional payment details")
    po_paid_to_agent: float = Field(0.0, ge=0, description="PO amount paid to agent")

class CutPayAgentConfigUpdate(BaseModel):
    """Schema for updating a CutPay agent configuration"""
    payment_mode: Optional[str] = Field(None, description="Payment mode (NEFT, Cash, Cheque)")
    payment_mode_detail: Optional[str] = Field(None, description="Additional payment details")
    po_paid_to_agent: Optional[float] = Field(None, ge=0, description="PO amount paid to agent")

class CutPayAgentConfigResponse(BaseModel):
    """Schema for CutPay agent configuration response"""
    id: int
    agent_code: str
    config_date: date = Field(..., alias="date")
    payment_mode: str
    payment_mode_detail: Optional[str]
    po_paid_to_agent: float
    created_by: Optional[UUID]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
        populate_by_name = True

class AgentPOResponse(BaseModel):
    """Schema for agent PO paid amount response"""
    agent_code: str
    total_po_paid: float
    latest_config_date: Optional[date]
    configurations_count: int




