from pydantic import BaseModel, Field
from typing import Optional
from datetime import date, datetime
from decimal import Decimal

class CutPayCreate(BaseModel):
    """Schema for creating a new cut pay transaction"""
    policy_number: str = Field(..., min_length=1, max_length=100, description="Policy number")
    agent_code: str = Field(..., min_length=1, max_length=50, description="Agent code")
    insurance_company: str = Field(..., min_length=1, max_length=200, description="Insurance company name")
    broker: str = Field(..., min_length=1, max_length=200, description="Broker name")
    
    # Financial details
    gross_amount: float = Field(..., gt=0, description="Gross amount")
    net_premium: float = Field(..., gt=0, description="Net premium amount")
    commission_grid: str = Field(..., min_length=1, max_length=100, description="Commission grid")
    agent_commission_given_percent: float = Field(..., ge=0, le=100, description="Agent commission percentage")
    cut_pay_amount: float = Field(..., gt=0, description="Cut pay amount")
      # Payment details
    payment_by: str = Field(..., min_length=1, max_length=200, description="Payment by")
    amount_received: float = Field(..., ge=0, description="Amount received")
    payment_method: str = Field(..., min_length=1, max_length=100, description="Payment method")
    payment_source: str = Field(..., min_length=1, max_length=200, description="Payment source")
    
    # Dates
    transaction_date: date = Field(..., description="Transaction date")
    payment_date: Optional[date] = Field(None, description="Payment date")
    
    # Additional info
    notes: Optional[str] = Field(None, max_length=1000, description="Additional notes")

class CutPayResponse(BaseModel):
    """Schema for cut pay transaction response"""
    id: int
    policy_number: str
    agent_code: str
    insurance_company: str
    broker: str
    
    # Financial details
    gross_amount: float
    net_premium: float
    commission_grid: str
    agent_commission_given_percent: float
    cut_pay_amount: float
      # Payment details
    payment_by: str
    amount_received: float
    payment_method: str
    payment_source: str
    
    # Dates
    transaction_date: date
    payment_date: Optional[date]
    
    # Additional info
    notes: Optional[str]
    
    # Audit fields
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class CutPaySummary(BaseModel):
    """Schema for cut pay transaction summary (for card view in lists)"""
    id: int
    policy_number: str
    agent_code: str
    insurance_company: str
    broker: str
    cut_pay_amount: float
    amount_received: float
    transaction_date: date
    created_at: datetime

    class Config:
        from_attributes = True

class CutPayUpdate(BaseModel):
    """Schema for updating a cut pay transaction"""
    policy_number: Optional[str] = Field(None, min_length=1, max_length=100)
    agent_code: Optional[str] = Field(None, min_length=1, max_length=50)
    insurance_company: Optional[str] = Field(None, min_length=1, max_length=200)
    broker: Optional[str] = Field(None, min_length=1, max_length=200)
    
    # Financial details
    gross_amount: Optional[float] = Field(None, gt=0)
    net_premium: Optional[float] = Field(None, gt=0)
    commission_grid: Optional[str] = Field(None, min_length=1, max_length=100)
    agent_commission_given_percent: Optional[float] = Field(None, ge=0, le=100)
    cut_pay_amount: Optional[float] = Field(None, gt=0)
      # Payment details
    payment_by: Optional[str] = Field(None, min_length=1, max_length=200)
    amount_received: Optional[float] = Field(None, ge=0)
    payment_method: Optional[str] = Field(None, min_length=1, max_length=100)
    payment_source: Optional[str] = Field(None, min_length=1, max_length=200)
    
    # Dates
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
