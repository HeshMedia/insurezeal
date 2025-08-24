from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, date
from uuid import UUID

class MasterSheetRecord(BaseModel):
    """Schema for a single record from Master sheet with updated headers"""
    # Updated fields to match new master sheet headers
    reporting_month: Optional[str] = Field(None, alias="Reporting Month (mmm'yy)")
    child_id: Optional[str] = Field(None, alias="Child ID/ User ID [Provided by Insure Zeal]")
    insurer_broker_code: Optional[str] = Field(None, alias="Insurer /broker code")
    policy_start_date: Optional[str] = Field(None, alias="Policy Start Date")
    policy_end_date: Optional[str] = Field(None, alias="Policy End Date")
    booking_date: Optional[str] = Field(None, alias="Booking Date(Click to select Date)")
    broker_name: Optional[str] = Field(None, alias="Broker Name")
    insurer_name: Optional[str] = Field(None, alias="Insurer name")
    major_categorisation: Optional[str] = Field(None, alias="Major Categorisation( Motor/Life/ Health)")
    product_insurer_report: Optional[str] = Field(None, alias="Product (Insurer Report)")
    product_type: Optional[str] = Field(None, alias="Product Type")
    plan_type: Optional[str] = Field(None, alias="Plan type (Comp/STP/SAOD)")
    gross_premium: Optional[str] = Field(None, alias="Gross premium")
    gst_amount: Optional[str] = Field(None, alias="GST Amount")
    net_premium: Optional[str] = Field(None, alias="Net premium")
    od_premium: Optional[str] = Field(None, alias="OD Preimium")
    tp_premium: Optional[str] = Field(None, alias="TP Premium")
    policy_number: Optional[str] = Field(None, alias="Policy number")
    formatted_policy_number: Optional[str] = Field(None, alias="Formatted Policy number")
    registration_number: Optional[str] = Field(None, alias="Registration.no")
    make_model: Optional[str] = Field(None, alias="Make_Model")
    model: Optional[str] = Field(None, alias="Model")
    vehicle_variant: Optional[str] = Field(None, alias="Vehicle_Variant")
    gvw: Optional[str] = Field(None, alias="GVW")
    rto: Optional[str] = Field(None, alias="RTO")
    state: Optional[str] = Field(None, alias="State")
    cluster: Optional[str] = Field(None, alias="Cluster")
    fuel_type: Optional[str] = Field(None, alias="Fuel Type")
    cc: Optional[str] = Field(None, alias="CC")
    age_year: Optional[str] = Field(None, alias="Age(Year)")
    ncb: Optional[str] = Field(None, alias="NCB (YES/NO)")
    discount_percent: Optional[str] = Field(None, alias="Discount %")
    business_type: Optional[str] = Field(None, alias="Business Type")
    seating_capacity: Optional[str] = Field(None, alias="Seating Capacity")
    veh_wheels: Optional[str] = Field(None, alias="Veh_Wheels")
    customer_name: Optional[str] = Field(None, alias="Customer Name")
    customer_number: Optional[str] = Field(None, alias="Customer Number")
    commissionable_premium: Optional[str] = Field(None, alias="Commissionable Premium")
    incoming_grid_percent: Optional[str] = Field(None, alias="Incoming Grid %")
    receivable_from_broker: Optional[str] = Field(None, alias="Receivable from Broker")
    extra_grid: Optional[str] = Field(None, alias="Extra Grid")
    extra_amount_receivable_from_broker: Optional[str] = Field(None, alias="Extra Amount Receivable from Broker")
    total_receivable_from_broker: Optional[str] = Field(None, alias=" Total Receivable from Broker ")
    claimed_by: Optional[str] = Field(None, alias=" Claimed By ")
    payment_by: Optional[str] = Field(None, alias="Payment by")
    payment_mode: Optional[str] = Field(None, alias="Payment Mode")
    cut_pay_amount_received: Optional[str] = Field(None, alias="Cut Pay Amount Received From Agent")
    already_given_to_agent: Optional[str] = Field(None, alias="Already Given to agent")
    actual_agent_po_percent: Optional[str] = Field(None, alias=" Actual Agent_PO%")
    agent_po_amt: Optional[str] = Field(None, alias="Agent_PO_AMT")
    agent_extra_percent: Optional[str] = Field(None, alias="Agent_Extra%")
    agent_extra_amount: Optional[str] = Field(None, alias="Agent_Extr_Amount")
    payment_by_office: Optional[str] = Field(None, alias="Payment By Office")
    po_paid_to_agent: Optional[str] = Field(None, alias="PO Paid To Agent")
    running_bal: Optional[str] = Field(None, alias="Running Bal")
    total_receivable_with_gst: Optional[str] = Field(None, alias=" Total Receivable from Broker Include 18% GST ")
    iz_total_po_percent: Optional[str] = Field(None, alias=" IZ Total PO%  ")
    broker_po_percent: Optional[str] = Field(None, alias=" As per Broker PO%  ")
    broker_po_amt: Optional[str] = Field(None, alias=" As per Broker PO AMT  ")
    po_diff_broker_percent: Optional[str] = Field(None, alias=" PO% Diff Broker ")
    po_diff_broker_amt: Optional[str] = Field(None, alias=" PO AMT Diff Broker ")
    agent_payout_percent: Optional[str] = Field(None, alias=" As per Agent Payout% ")
    agent_payout_amount: Optional[str] = Field(None, alias=" As per Agent Payout Amount ")
    po_diff_agent_percent: Optional[str] = Field(None, alias=" PO% Diff Agent ")
    po_diff_agent_amt: Optional[str] = Field(None, alias=" PO AMT Diff Agent ")
    invoice_status: Optional[str] = Field(None, alias="  Invoice Status  ")
    invoice_number: Optional[str] = Field(None, alias="  Invoice Number  ")
    remarks: Optional[str] = Field(None, alias=" Remarks ")
    match: Optional[str] = Field(None, alias="Match")
    
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

class AgentMISRecord(BaseModel):
    """Filtered master sheet record for agent MIS with specific fields removed"""
    # Core Transaction Data  
    id: Optional[str] = None
    reporting_month: Optional[str] = None
    booking_date: Optional[str] = None
    agent_code: Optional[str] = None
    insurer_name: Optional[str] = None
    broker_name: Optional[str] = None
    
    # Policy Information
    policy_number: Optional[str] = None
    formatted_policy_number: Optional[str] = None
    customer_name: Optional[str] = None
    customer_phone_number: Optional[str] = None
    major_categorisation: Optional[str] = None
    product_insurer_report: Optional[str] = None
    product_type: Optional[str] = None
    plan_type: Optional[str] = None
    
    # Premium Details (excluding sensitive broker commission data)
    gross_premium: Optional[str] = None
    net_premium: Optional[str] = None
    
    # Vehicle Details
    registration_number: Optional[str] = None
    make_model: Optional[str] = None
    model: Optional[str] = None
    
    # Agent relevant commission data only
    agent_commission_perc: Optional[str] = None
    agent_po_amount: Optional[str] = None
    total_agent_po: Optional[str] = None
    running_balance: Optional[str] = None
    already_given_to_agent: Optional[str] = None
    
    # Timestamps
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

class AgentMISStats(BaseModel):
    """Statistics for agent MIS data"""
    number_of_policies: int
    running_balance: float
    total_net_premium: float

class AgentMISResponse(BaseModel):
    """Response for agent MIS data with filtered fields and statistics"""
    records: List[AgentMISRecord]
    stats: AgentMISStats
    total_count: int
    page: int
    page_size: int
    total_pages: int
