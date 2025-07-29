from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, date
from uuid import UUID

class MasterSheetRecord(BaseModel):
    """Schema for a single record from Master sheet"""
    # Core Transaction Data
    id: Optional[str] = None
    reporting_month: Optional[str] = None
    booking_date: Optional[str] = None
    agent_code: Optional[str] = None
    code_type: Optional[str] = None
    insurer_name: Optional[str] = None
    broker_name: Optional[str] = None
    insurer_broker_code: Optional[str] = None
    
    # Policy Information
    policy_number: Optional[str] = None
    formatted_policy_number: Optional[str] = None
    customer_name: Optional[str] = None
    customer_phone_number: Optional[str] = None
    major_categorisation: Optional[str] = None
    product_insurer_report: Optional[str] = None
    product_type: Optional[str] = None
    plan_type: Optional[str] = None
    
    # Premium Details
    gross_premium: Optional[str] = None
    net_premium: Optional[str] = None
    od_premium: Optional[str] = None
    tp_premium: Optional[str] = None
    gst_amount: Optional[str] = None
    commissionable_premium: Optional[str] = None
    
    # Vehicle Details
    registration_no: Optional[str] = None
    make_model: Optional[str] = None
    model: Optional[str] = None
    vehicle_variant: Optional[str] = None
    gvw: Optional[str] = None
    rto: Optional[str] = None
    state: Optional[str] = None
    cluster: Optional[str] = None
    fuel_type: Optional[str] = None
    cc: Optional[str] = None
    age_year: Optional[str] = None
    ncb: Optional[str] = None
    discount_percent: Optional[str] = None
    business_type: Optional[str] = None
    seating_capacity: Optional[str] = None
    vehicle_wheels: Optional[str] = None
    
    # Commission Structure
    incoming_grid_perc: Optional[str] = None
    agent_commission_perc: Optional[str] = None
    extra_grid_perc: Optional[str] = None
    agent_extra_perc: Optional[str] = None
    
    # Payment Configuration
    payment_by: Optional[str] = None
    payment_method: Optional[str] = None
    payout_on: Optional[str] = None
    payment_by_office: Optional[str] = None
    
    # Calculated Commission Amounts
    receivable_from_broker: Optional[str] = None
    extra_amount_receivable: Optional[str] = None
    total_receivable: Optional[str] = None
    total_receivable_with_gst: Optional[str] = None
    
    # CutPay & Payout Amounts
    cut_pay_amount: Optional[str] = None
    agent_po_amount: Optional[str] = None
    agent_extra_amount: Optional[str] = None
    total_agent_po: Optional[str] = None
    
    # Transaction Tracking
    claimed_by: Optional[str] = None
    running_balance: Optional[str] = None
    cutpay_received: Optional[str] = None
    
    # Post-CutPay Fields
    already_given_to_agent: Optional[str] = None
    iz_total_po_percent: Optional[str] = None
    broker_po_percent: Optional[str] = None
    broker_payout_amount: Optional[str] = None
    invoice_status: Optional[str] = None
    remarks: Optional[str] = None
    company: Optional[str] = None
    
    # Notes
    notes: Optional[str] = None
    
    # Timestamps
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    
    # Row metadata for updates
    row_number: Optional[int] = None  # For tracking sheet row position

class MasterSheetResponse(BaseModel):
    """Response for paginated master sheet data"""
    records: List[MasterSheetRecord]
    total_count: int
    page: int
    page_size: int
    total_pages: int

class BulkUpdateField(BaseModel):
    """Schema for a single field update"""
    record_id: str = Field(..., description="ID of the record to update")
    field_name: str = Field(..., description="Name of the field to update")
    new_value: Optional[str] = Field(None, description="New value for the field")

class BulkUpdateRequest(BaseModel):
    """Schema for bulk update request"""
    updates: List[BulkUpdateField] = Field(..., min_items=1, description="List of field updates to apply")

class BulkUpdateResult(BaseModel):
    """Result of a single update operation"""
    record_id: str
    field_name: str
    old_value: Optional[str]
    new_value: Optional[str]
    success: bool
    error_message: Optional[str] = None

class BulkUpdateResponse(BaseModel):
    """Response for bulk update operation"""
    message: str
    total_updates: int
    successful_updates: int
    failed_updates: int
    results: List[BulkUpdateResult]
    processing_time_seconds: float

class MasterSheetStatsResponse(BaseModel):
    """Statistics about master sheet data"""
    total_records: int
    total_policies: int
    total_cutpay_transactions: int
    total_gross_premium: float
    total_net_premium: float
    total_cutpay_amount: float
    top_agents: List[Dict[str, Any]]
    top_insurers: List[Dict[str, Any]]
    monthly_summary: List[Dict[str, Any]]
