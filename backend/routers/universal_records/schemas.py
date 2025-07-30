"""
Universal Records Schemas for Insurer Data Reconciliation

This module contains Pydantic schemas for managing universal record uploads
and processing insurer-specific data mapping for reconciliation.
"""

from typing import Optional, Dict, List, Any, Union
from datetime import datetime, date
from pydantic import BaseModel, Field, validator
from decimal import Decimal


class InsurerMappingConfig(BaseModel):
    """Configuration for mapping insurer-specific headers to master sheet format"""
    
    insurer_name: str = Field(..., description="Name of the insurance company")
    header_mappings: Dict[str, str] = Field(
        ..., 
        description="Mapping from insurer header to master sheet header"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "insurer_name": "ICICI Lombard",
                "header_mappings": {
                    "Policy No": "policy_number",
                    "Product": "policy_type",
                    "Agent Code": "agent_code",
                    "Premium": "gross_premium"
                }
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
    processed_by_user_id: int


class UniversalRecordUploadResponse(BaseModel):
    """Response for universal record upload operations"""
    
    message: str
    report: UniversalRecordProcessingReport
    processing_time_seconds: float
    success: bool = True


class InsurerSelectionRequest(BaseModel):
    """Request to select which insurer mapping to use for CSV processing"""
    
    insurer_name: str = Field(..., description="Name of the insurer from available mappings")
    
    class Config:
        json_schema_extra = {
            "example": {
                "insurer_name": "ICICI Lombard"
            }
        }


class AvailableInsurersResponse(BaseModel):
    """Response listing all available insurer mappings"""
    
    insurers: List[str] = Field(..., description="List of available insurer names")
    total_count: int = Field(..., description="Total number of available insurers")
    
    class Config:
        json_schema_extra = {
            "example": {
                "insurers": ["ICICI Lombard", "Bajaj Allianz", "HDFC ERGO"],
                "total_count": 3
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
    mapped_headers: List[str] = Field(..., description="Headers after applying insurer mapping")
    preview_data: List[Dict[str, Any]] = Field(..., description="Sample rows with mapped data")
    unmapped_headers: List[str] = Field(default_factory=list, description="Headers that couldn't be mapped")
    total_rows: int
    
    class Config:
        json_schema_extra = {
            "example": {
                "insurer_name": "ICICI Lombard",
                "original_headers": ["Policy No", "Product", "Agent Code"],
                "mapped_headers": ["policy_number", "policy_type", "agent_code"],
                "preview_data": [
                    {"policy_number": "POL001", "policy_type": "Motor", "agent_code": "AGT001"}
                ],
                "unmapped_headers": [],
                "total_rows": 100
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
    data_variance_percentage: float = Field(..., description="Percentage of records with data differences")
    coverage_percentage: float = Field(..., description="Percentage of universal records found in system")
    
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
                    {"field_name": "agent_code", "mismatch_count": 15}
                ]
            }
        }
