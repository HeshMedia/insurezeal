"""
Universal Records Schemas for Insurer Data Reconciliation

This module contains Pydantic schemas for managing universal record uploads
and processing insurer-specific data mapping for reconciliation.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class InsurerMappingConfig(BaseModel):
    """Configuration for mapping insurer-specific headers to master sheet format"""

    insurer_name: str = Field(..., description="Name of the insurance company")
    header_mappings: Dict[str, str] = Field(
        ..., description="Mapping from insurer header to master sheet header"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "insurer_name": "ICICI Lombard",
                "header_mappings": {
                    "Policy No": "policy_number",
                    "Product": "policy_type",
                    "Agent Code": "agent_code",
                    "Premium": "gross_premium",
                },
            }
        }


class UniversalRecordProcessingStats(BaseModel):
    """Statistics from universal record processing"""

    total_records_processed: int = 0
    total_records_updated: int = 0
    total_records_added: int = 0
    total_records_skipped: int = 0
    total_errors: int = 0
    processing_time_seconds: float = 0.0

    # Detailed breakdown
    policy_records_updated: int = 0
    policy_records_added: int = 0
    cutpay_records_updated: int = 0
    cutpay_records_added: int = 0

    # Field-level changes
    field_changes: Dict[str, int] = Field(default_factory=dict)
    error_details: List[str] = Field(default_factory=list)


class RecordChangeDetail(BaseModel):
    """Details of what changed in a specific record"""

    policy_number: str
    record_type: str = Field(..., description="policy or cutpay")
    action: str = Field(..., description="updated, added, or error")

    # Fields that were changed
    changed_fields: Dict[str, Any] = Field(default_factory=dict)
    previous_values: Dict[str, Any] = Field(default_factory=dict)
    new_values: Dict[str, Any] = Field(default_factory=dict)

    # Error information if applicable
    error_message: Optional[str] = None


class UniversalRecordProcessingReport(BaseModel):
    """Detailed report of universal record processing results"""

    stats: UniversalRecordProcessingStats
    change_details: List[RecordChangeDetail] = Field(default_factory=list)

    # Summary by insurer if applicable
    insurer_name: Optional[str] = None
    file_info: Dict[str, Any] = Field(default_factory=dict)

    # Processing metadata
    processed_at: datetime = Field(default_factory=datetime.now)
    processed_by_user_id: str  # Accept user ID as UUID string


class UniversalRecordUploadResponse(BaseModel):
    """Response for universal record upload operations"""

    message: str
    report: UniversalRecordProcessingReport
    processing_time_seconds: float
    success: bool = True


class InsurerSelectionRequest(BaseModel):
    """Request to select which insurer mapping to use for CSV processing"""

    insurer_name: str = Field(
        ..., description="Name of the insurer from available mappings"
    )

    class Config:
        json_schema_extra = {"example": {"insurer_name": "ICICI Lombard"}}


class AvailableInsurersResponse(BaseModel):
    """Response listing all available insurer mappings"""

    insurers: List[str] = Field(..., description="List of available insurer names")
    total_count: int = Field(..., description="Total number of available insurers")

    class Config:
        json_schema_extra = {
            "example": {
                "insurers": ["ICICI Lombard", "Bajaj Allianz", "HDFC ERGO"],
                "total_count": 3,
            }
        }


class CSVPreviewRequest(BaseModel):
    """Request to preview CSV with selected insurer mapping"""

    insurer_name: str = Field(..., description="Selected insurer name")
    preview_rows: int = Field(default=5, description="Number of rows to preview")


class CSVPreviewResponse(BaseModel):
    """Response showing CSV preview with mapped headers"""

    insurer_name: str
    original_headers: List[str]
    mapped_headers: List[str] = Field(
        ..., description="Headers after applying insurer mapping"
    )
    preview_data: List[Dict[str, Any]] = Field(
        ..., description="Sample rows with mapped data"
    )
    unmapped_headers: List[str] = Field(
        default_factory=list, description="Headers that couldn't be mapped"
    )
    total_rows: int

    class Config:
        json_schema_extra = {
            "example": {
                "insurer_name": "ICICI Lombard",
                "original_headers": ["Policy No", "Product", "Agent Code"],
                "mapped_headers": ["policy_number", "policy_type", "agent_code"],
                "preview_data": [
                    {
                        "policy_number": "POL001",
                        "policy_type": "Motor",
                        "agent_code": "AGT001",
                    }
                ],
                "unmapped_headers": [],
                "total_rows": 100,
            }
        }


class ReconciliationSummaryResponse(BaseModel):
    """Summary of reconciliation results for reporting"""

    total_policies_in_system: int
    total_policies_in_universal_record: int
    total_matches: int
    total_mismatches: int
    total_missing_in_system: int
    total_missing_in_universal: int

    # Variance percentages
    data_variance_percentage: float = Field(
        ..., description="Percentage of records with data differences"
    )
    coverage_percentage: float = Field(
        ..., description="Percentage of universal records found in system"
    )

    # Top mismatched fields
    top_mismatched_fields: List[Dict[str, int]] = Field(default_factory=list)

    class Config:
        json_schema_extra = {
            "example": {
                "total_policies_in_system": 1000,
                "total_policies_in_universal_record": 950,
                "total_matches": 900,
                "total_mismatches": 50,
                "total_missing_in_system": 50,
                "total_missing_in_universal": 50,
                "data_variance_percentage": 5.26,
                "coverage_percentage": 94.74,
                "top_mismatched_fields": [
                    {"field_name": "gross_premium", "mismatch_count": 25},
                    {"field_name": "agent_code", "mismatch_count": 15},
                ],
            }
        }


class ComprehensiveReconciliationResponse(BaseModel):
    """Comprehensive reconciliation response with field-specific variation tracking"""

    # Primary identification fields
    id: str = Field(..., description="Unique UUID of the reconciliation record")
    insurer_name: str = Field(..., description="Name of the insurer")
    insurer_code: Optional[str] = Field(None, description="Insurer code")
    created_at: datetime = Field(..., description="Upload/processing date")
    
    # Summary fields
    total_records_processed: int = Field(..., description="Total records processed")
    total_records_updated: int = Field(..., description="Total records updated")
    new_records_added: int = Field(..., description="Number of new records added")
    data_variance_percentage: float = Field(..., description="Data variance percentage")
    
    # 72 Field-specific variation columns (based on master sheet headers)
    reporting_month_variations: Optional[int] = Field(None, description="Variations in Reporting Month")
    child_id_variations: Optional[int] = Field(None, description="Variations in Child ID/User ID")
    insurer_broker_code_variations: Optional[int] = Field(None, description="Variations in Insurer/broker code")
    policy_start_date_variations: Optional[int] = Field(None, description="Variations in Policy Start Date")
    policy_end_date_variations: Optional[int] = Field(None, description="Variations in Policy End Date")
    booking_date_variations: Optional[int] = Field(None, description="Variations in Booking Date")
    broker_name_variations: Optional[int] = Field(None, description="Variations in Broker Name")
    insurer_name_variations: Optional[int] = Field(None, description="Variations in Insurer name")
    major_categorisation_variations: Optional[int] = Field(None, description="Variations in Major Categorisation")
    product_variations: Optional[int] = Field(None, description="Variations in Product")
    product_type_variations: Optional[int] = Field(None, description="Variations in Product Type")
    plan_type_variations: Optional[int] = Field(None, description="Variations in Plan type")
    gross_premium_variations: Optional[int] = Field(None, description="Variations in Gross premium")
    gst_amount_variations: Optional[int] = Field(None, description="Variations in GST Amount")
    net_premium_variations: Optional[int] = Field(None, description="Variations in Net premium")
    od_premium_variations: Optional[int] = Field(None, description="Variations in OD Premium")
    tp_premium_variations: Optional[int] = Field(None, description="Variations in TP Premium")
    policy_number_variations: Optional[int] = Field(None, description="Variations in Policy number")
    formatted_policy_number_variations: Optional[int] = Field(None, description="Variations in Formatted Policy number")
    registration_no_variations: Optional[int] = Field(None, description="Variations in Registration.no")
    make_model_variations: Optional[int] = Field(None, description="Variations in Make_Model")
    model_variations: Optional[int] = Field(None, description="Variations in Model")
    vehicle_variant_variations: Optional[int] = Field(None, description="Variations in Vehicle_Variant")
    gvw_variations: Optional[int] = Field(None, description="Variations in GVW")
    rto_variations: Optional[int] = Field(None, description="Variations in RTO")
    state_variations: Optional[int] = Field(None, description="Variations in State")
    cluster_variations: Optional[int] = Field(None, description="Variations in Cluster")
    fuel_type_variations: Optional[int] = Field(None, description="Variations in Fuel Type")
    cc_variations: Optional[int] = Field(None, description="Variations in CC")
    age_year_variations: Optional[int] = Field(None, description="Variations in Age(Year)")
    ncb_variations: Optional[int] = Field(None, description="Variations in NCB")
    discount_percentage_variations: Optional[int] = Field(None, description="Variations in Discount %")
    business_type_variations: Optional[int] = Field(None, description="Variations in Business Type")
    seating_capacity_variations: Optional[int] = Field(None, description="Variations in Seating Capacity")
    veh_wheels_variations: Optional[int] = Field(None, description="Variations in Veh_Wheels")
    customer_name_variations: Optional[int] = Field(None, description="Variations in Customer Name")
    customer_number_variations: Optional[int] = Field(None, description="Variations in Customer Number")
    commissionable_premium_variations: Optional[int] = Field(None, description="Variations in Commissionable Premium")
    incoming_grid_percentage_variations: Optional[int] = Field(None, description="Variations in Incoming Grid %")
    receivable_from_broker_variations: Optional[int] = Field(None, description="Variations in Receivable from Broker")
    extra_grid_variations: Optional[int] = Field(None, description="Variations in Extra Grid")
    extra_amount_receivable_variations: Optional[int] = Field(None, description="Variations in Extra Amount Receivable")
    total_receivable_from_broker_variations: Optional[int] = Field(None, description="Variations in Total Receivable from Broker")
    claimed_by_variations: Optional[int] = Field(None, description="Variations in Claimed By")
    payment_by_variations: Optional[int] = Field(None, description="Variations in Payment by")
    payment_mode_variations: Optional[int] = Field(None, description="Variations in Payment Mode")
    cut_pay_amount_received_variations: Optional[int] = Field(None, description="Variations in Cut Pay Amount Received")
    already_given_to_agent_variations: Optional[int] = Field(None, description="Variations in Already Given to agent")
    actual_agent_po_percentage_variations: Optional[int] = Field(None, description="Variations in Actual Agent_PO%")
    agent_po_amt_variations: Optional[int] = Field(None, description="Variations in Agent_PO_AMT")
    agent_extra_percentage_variations: Optional[int] = Field(None, description="Variations in Agent_Extra%")
    agent_extra_amount_variations: Optional[int] = Field(None, description="Variations in Agent Extra Amount")
    agent_total_po_amount_variations: Optional[int] = Field(None, description="Variations in Agent Total PO Amount")
    payment_by_office_variations: Optional[int] = Field(None, description="Variations in Payment By Office")
    po_paid_to_agent_variations: Optional[int] = Field(None, description="Variations in PO Paid To Agent")
    running_bal_variations: Optional[int] = Field(None, description="Variations in Running Bal")
    total_receivable_gst_variations: Optional[int] = Field(None, description="Variations in Total Receivable GST")
    iz_total_po_percentage_variations: Optional[int] = Field(None, description="Variations in IZ Total PO%")
    as_per_broker_po_percentage_variations: Optional[int] = Field(None, description="Variations in As per Broker PO%")
    as_per_broker_po_amt_variations: Optional[int] = Field(None, description="Variations in As per Broker PO AMT")
    po_percentage_diff_broker_variations: Optional[int] = Field(None, description="Variations in PO% Diff Broker")
    po_amt_diff_broker_variations: Optional[int] = Field(None, description="Variations in PO AMT Diff Broker")
    actual_agent_po_percentage_2_variations: Optional[int] = Field(None, description="Variations in Actual Agent PO% (Alternative)")
    as_per_agent_payout_percentage_variations: Optional[int] = Field(None, description="Variations in As per Agent Payout%")
    as_per_agent_payout_amount_variations: Optional[int] = Field(None, description="Variations in As per Agent Payout Amount")
    po_percentage_diff_agent_variations: Optional[int] = Field(None, description="Variations in PO% Diff Agent")
    po_amt_diff_agent_variations: Optional[int] = Field(None, description="Variations in PO AMT Diff Agent")
    invoice_status_variations: Optional[int] = Field(None, description="Variations in Invoice Status")
    invoice_number_variations: Optional[int] = Field(None, description="Variations in Invoice Number")
    remarks_variations: Optional[int] = Field(None, description="Variations in Remarks")
    match_variations: Optional[int] = Field(None, description="Variations in Match")
    agent_code_variations: Optional[int] = Field(None, description="Variations in Agent Code")

    class Config:
        json_schema_extra = {
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "insurer_name": "ICICI Lombard",
                "insurer_code": "ICICIL",
                "created_at": "2023-10-01T10:00:00",
                "total_records_processed": 1000,
                "total_records_updated": 850,
                "new_records_added": 50,
                "data_variance_percentage": 15.2,
                "policy_number_variations": 25,
                "gross_premium_variations": 10,
                "agent_code_variations": 5
            }
        }
