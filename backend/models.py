from sqlalchemy import (
    Boolean, 
    String, 
    Text, 
    DateTime, 
    SmallInteger,
    Integer,
    CheckConstraint,
    PrimaryKeyConstraint,
    UniqueConstraint,
    Index,
    Computed,
    text,
    ForeignKey,
    Column,
    Numeric,
    Date,
    func
)
from sqlalchemy.dialects.postgresql import UUID, JSONB, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.ext.declarative import declarative_base
from typing import Optional
import uuid
from datetime import datetime

Base = declarative_base()


class Users(Base):
    """
    Supabase auth.users table schema
    This mirrors the Supabase authentication table to enable proper foreign key relationships
    """
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint(
            "email_change_confirm_status >= 0 AND email_change_confirm_status <= 2",
            name="users_email_change_confirm_status_check",
        ),
        PrimaryKeyConstraint("id", name="users_pkey"),
        UniqueConstraint("phone", name="users_phone_key"),
        Index("confirmation_token_idx", "confirmation_token", unique=True),
        Index(
            "email_change_token_current_idx", "email_change_token_current", unique=True
        ),
        Index("email_change_token_new_idx", "email_change_token_new", unique=True),
        Index("reauthentication_token_idx", "reauthentication_token", unique=True),
        Index("recovery_token_idx", "recovery_token", unique=True),
        Index("users_email_partial_key", "email", unique=True),
        Index("users_instance_id_email_idx", "instance_id"),
        Index("users_instance_id_idx", "instance_id"),
        Index("users_is_anonymous_idx", "is_anonymous"),
        {
            "comment": "Auth: Stores user login data within a secure schema.",
            "schema": "auth",
        },
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    
    is_sso_user: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text("false"),
        comment="Auth: Set this column to true when the account comes from SSO. These accounts can have duplicate emails.",
    )
    is_anonymous: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    instance_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    aud: Mapped[Optional[str]] = mapped_column(String(255))
    role: Mapped[Optional[str]] = mapped_column(String(255))
    
    email: Mapped[Optional[str]] = mapped_column(String(255))
    phone: Mapped[Optional[str]] = mapped_column(Text, server_default=text("NULL::character varying"))
    
    encrypted_password: Mapped[Optional[str]] = mapped_column(String(255))
    
    email_confirmed_at: Mapped[Optional[DateTime]] = mapped_column(DateTime(True))
    confirmation_token: Mapped[Optional[str]] = mapped_column(String(255))
    confirmation_sent_at: Mapped[Optional[DateTime]] = mapped_column(DateTime(True))
    
    recovery_token: Mapped[Optional[str]] = mapped_column(String(255))
    recovery_sent_at: Mapped[Optional[DateTime]] = mapped_column(DateTime(True))
    
    email_change_token_new: Mapped[Optional[str]] = mapped_column(String(255))
    email_change: Mapped[Optional[str]] = mapped_column(String(255))
    email_change_sent_at: Mapped[Optional[DateTime]] = mapped_column(DateTime(True))
    email_change_token_current: Mapped[Optional[str]] = mapped_column(
        String(255), server_default=text("''::character varying")
    )
    email_change_confirm_status: Mapped[Optional[int]] = mapped_column(SmallInteger, server_default=text("0"))
    
    phone_confirmed_at: Mapped[Optional[DateTime]] = mapped_column(DateTime(True))
    phone_change: Mapped[Optional[str]] = mapped_column(Text, server_default=text("''::character varying"))
    phone_change_token: Mapped[Optional[str]] = mapped_column(
        String(255), server_default=text("''::character varying")
    )
    phone_change_sent_at: Mapped[Optional[DateTime]] = mapped_column(DateTime(True))
    
    last_sign_in_at: Mapped[Optional[DateTime]] = mapped_column(DateTime(True))
    invited_at: Mapped[Optional[DateTime]] = mapped_column(DateTime(True))
    
    raw_app_meta_data: Mapped[Optional[dict]] = mapped_column(JSONB)
    raw_user_meta_data: Mapped[Optional[dict]] = mapped_column(JSONB)
    
    is_super_admin: Mapped[Optional[bool]] = mapped_column(Boolean)
    banned_until: Mapped[Optional[DateTime]] = mapped_column(DateTime(True))
    
    reauthentication_token: Mapped[Optional[str]] = mapped_column(
        String(255), server_default=text("''::character varying")
    )
    reauthentication_sent_at: Mapped[Optional[DateTime]] = mapped_column(DateTime(True))
    
    created_at: Mapped[Optional[DateTime]] = mapped_column(DateTime(True))
    updated_at: Mapped[Optional[DateTime]] = mapped_column(DateTime(True))
    deleted_at: Mapped[Optional[DateTime]] = mapped_column(DateTime(True))
    
    confirmed_at: Mapped[Optional[DateTime]] = mapped_column(
        DateTime(True),
        Computed("LEAST(email_confirmed_at, phone_confirmed_at)", persisted=True),
    )

    user_profile: Mapped[Optional["UserProfile"]] = relationship(
        "UserProfile", 
        back_populates="user", 
        uselist=False,
        cascade="all, delete-orphan"
    )


class UserProfile(Base):
    """
    Custom user profile table for additional user information
    This extends the basic auth.users table with application-specific data
    """
    __tablename__ = "user_profiles"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), 
        ForeignKey("auth.users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False
    )
    
    username: Mapped[Optional[str]] = mapped_column(String(100), unique=True, index=True)
    first_name: Mapped[Optional[str]] = mapped_column(String(100))
    last_name: Mapped[Optional[str]] = mapped_column(String(100))
    display_name: Mapped[Optional[str]] = mapped_column(String(100))
    bio: Mapped[Optional[str]] = mapped_column(Text)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500))
    date_of_birth: Mapped[Optional[DateTime]] = mapped_column(DateTime(True))
    timezone: Mapped[Optional[str]] = mapped_column(String(50))
    language: Mapped[Optional[str]] = mapped_column(String(10), default="en")
    
    # Agent Registration Fields
    middle_name: Mapped[Optional[str]] = mapped_column(String(50))
    father_name: Mapped[Optional[str]] = mapped_column(String(100))
    mother_name: Mapped[Optional[str]] = mapped_column(String(100))
    gender: Mapped[Optional[str]] = mapped_column(String(10))
    
    # Contact Information
    mobile_number: Mapped[Optional[str]] = mapped_column(String(15))
    alternate_mobile: Mapped[Optional[str]] = mapped_column(String(15))
    alternate_email: Mapped[Optional[str]] = mapped_column(String(255))
    
    # Address Information
    permanent_address_line1: Mapped[Optional[str]] = mapped_column(String(200))
    permanent_address_line2: Mapped[Optional[str]] = mapped_column(String(200))
    permanent_city: Mapped[Optional[str]] = mapped_column(String(50))
    permanent_state: Mapped[Optional[str]] = mapped_column(String(50))
    permanent_pincode: Mapped[Optional[str]] = mapped_column(String(6))
    
    communication_same_as_permanent: Mapped[Optional[bool]] = mapped_column(Boolean, default=True)
    communication_address_line1: Mapped[Optional[str]] = mapped_column(String(200))
    communication_address_line2: Mapped[Optional[str]] = mapped_column(String(200))
    communication_city: Mapped[Optional[str]] = mapped_column(String(50))
    communication_state: Mapped[Optional[str]] = mapped_column(String(50))
    communication_pincode: Mapped[Optional[str]] = mapped_column(String(6))
    
    # Professional Information
    education_level: Mapped[Optional[str]] = mapped_column(String(50))
    specialization: Mapped[Optional[str]] = mapped_column(String(100))
    previous_insurance_experience: Mapped[Optional[bool]] = mapped_column(Boolean, default=False)
    years_of_experience: Mapped[Optional[int]] = mapped_column(SmallInteger)
    previous_company_name: Mapped[Optional[str]] = mapped_column(String(100))
    
    # Banking Information
    bank_name: Mapped[Optional[str]] = mapped_column(String(100))
    account_number: Mapped[Optional[str]] = mapped_column(String(18))
    ifsc_code: Mapped[Optional[str]] = mapped_column(String(11))
    branch_name: Mapped[Optional[str]] = mapped_column(String(100))
    
    # Nominee Information
    nominee_name: Mapped[Optional[str]] = mapped_column(String(100))
    nominee_relationship: Mapped[Optional[str]] = mapped_column(String(50))
    nominee_date_of_birth: Mapped[Optional[DateTime]] = mapped_column(DateTime(True))
      # Preferences
    preferred_language: Mapped[Optional[str]] = mapped_column(String(20))
    territory_preference: Mapped[Optional[str]] = mapped_column(String(100))
    
    # Agent System Fields
    agent_code: Mapped[Optional[str]] = mapped_column(String(8), unique=True, index=True)
    user_role: Mapped[str] = mapped_column(String(20), default="agent", nullable=False)
    
    # Agent Financial Tracking
    running_balance: Mapped[Optional[float]] = mapped_column(Numeric(15, 2), nullable=True, default=0.0)
    total_net_premium: Mapped[Optional[float]] = mapped_column(Numeric(15, 2), nullable=True, default=0.0)
    number_of_policies: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, default=0)
    
    preferences: Mapped[Optional[dict]] = mapped_column(JSONB, default=dict)
    
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(True), 
        server_default=text("CURRENT_TIMESTAMP"),
        nullable=False
    )
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(True), 
        server_default=text("CURRENT_TIMESTAMP"),
        onupdate=text("CURRENT_TIMESTAMP"),
        nullable=False
    )
    
    user: Mapped["Users"] = relationship("Users", back_populates="user_profile")


class UserDocument(Base):
    """
    User documents table for storing uploaded documents
    Simplified without verification workflow
    """
    __tablename__ = "user_documents"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), 
        ForeignKey("auth.users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    document_type: Mapped[str] = mapped_column(String(50), nullable=False)
    document_name: Mapped[str] = mapped_column(String(200), nullable=False)
    document_url: Mapped[str] = mapped_column(Text, nullable=False)
    file_size: Mapped[Optional[int]] = mapped_column(nullable=True)
    
    upload_date: Mapped[DateTime] = mapped_column(
        DateTime(True), 
        server_default=text("CURRENT_TIMESTAMP"),
        nullable=False
    )
    
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(True), 
        server_default=text("CURRENT_TIMESTAMP"),
        nullable=False
    )
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(True), 
        server_default=text("CURRENT_TIMESTAMP"),
        onupdate=text("CURRENT_TIMESTAMP"),
        nullable=False
    )


class ChildIdRequest(Base):
    """
    Child ID requests table for insurance broker/agent child ID management
    """
    __tablename__ = "child_id_requests"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), 
        ForeignKey("auth.users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    phone_number: Mapped[str] = mapped_column(String(15), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    location: Mapped[str] = mapped_column(String(200), nullable=False)
    
    code_type: Mapped[str] = mapped_column(String(20), nullable=False)

    insurer_code: Mapped[str] = mapped_column(ForeignKey("insurers.insurer_code"), nullable=False)
    broker_code: Mapped[Optional[str]] = mapped_column(ForeignKey("brokers.broker_code"), nullable=True)

    preferred_rm_name: Mapped[Optional[str]] = mapped_column(String(100))
    
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)

    child_id: Mapped[Optional[str]] = mapped_column(String(50), unique=True, index=True)
    password: Mapped[Optional[str]] = mapped_column(String(255))
    branch_code: Mapped[Optional[str]] = mapped_column(String(20))
    region: Mapped[Optional[str]] = mapped_column(String(50))
    manager_name: Mapped[Optional[str]] = mapped_column(String(100))
    manager_email: Mapped[Optional[str]] = mapped_column(String(255))
    admin_notes: Mapped[Optional[str]] = mapped_column(Text)
    
    approved_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("auth.users.id", ondelete="SET NULL"),
        nullable=True
    )
    approved_at: Mapped[Optional[DateTime]] = mapped_column(DateTime(True))
    
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(True), 
        server_default=text("CURRENT_TIMESTAMP"),
        nullable=False
    )
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(True), 
        server_default=text("CURRENT_TIMESTAMP"),
        onupdate=text("CURRENT_TIMESTAMP"),
        nullable=False
    )
    
    # Relationships
    insurer: Mapped["Insurer"] = relationship("Insurer", foreign_keys=[insurer_code], overlaps="child_id_requests")
    broker: Mapped[Optional["Broker"]] = relationship("Broker", foreign_keys=[broker_code], overlaps="child_id_requests")
    cutpay_transactions: Mapped[list["CutPay"]] = relationship("CutPay", back_populates="child_id_request")


class CutPay(Base):
    """
    Comprehensive CutPay model for Master Sheet integration
    Includes document upload, PDF extraction, manual data entry, calculations, and dual Google Sheets sync
    
    Field Sources:
    - 🤖 PDF Extraction: Automatically extracted from policy documents
    - 👤 Admin Input: Manually entered by admin users
    - 🔄 Auto-Calculated: Computed based on other fields
    - 📊 Database Auto: Auto-fetched from relationships
    """
    __tablename__ = "cut_pay"

    id: Mapped[int] = mapped_column(primary_key=True)
    
    # =============================================================================
    # DOCUMENT & EXTRACTION FIELDS
    # =============================================================================
    
    # Document URLs
    policy_pdf_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    additional_documents: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    
    # 🤖 PDF Extraction - Basic Policy Information
    policy_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    formatted_policy_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    major_categorisation: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # Motor, Life, Health
    product_insurer_report: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    product_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)  # Private Car, etc.
    plan_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # Comp, STP, SAOD
    customer_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    customer_phone_number: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # 🤖 PDF Extraction
    
    # 🤖 PDF Extraction - Premium & Financial Details
    gross_premium: Mapped[Optional[float]] = mapped_column(Numeric(15, 2), nullable=True)
    net_premium: Mapped[Optional[float]] = mapped_column(Numeric(15, 2), nullable=True)
    od_premium: Mapped[Optional[float]] = mapped_column(Numeric(15, 2), nullable=True)  # Own Damage
    tp_premium: Mapped[Optional[float]] = mapped_column(Numeric(15, 2), nullable=True)  # Third Party
    gst_amount: Mapped[Optional[float]] = mapped_column(Numeric(15, 2), nullable=True)
    
    # 🤖 PDF Extraction - Vehicle Details (for Motor Insurance)
    registration_no: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    make_model: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    model: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    vehicle_variant: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    gvw: Mapped[Optional[float]] = mapped_column(Numeric(10, 2), nullable=True)  # Gross Vehicle Weight
    rto: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    state: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    fuel_type: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    cc: Mapped[Optional[int]] = mapped_column(nullable=True)  # Engine capacity
    age_year: Mapped[Optional[int]] = mapped_column(nullable=True)
    ncb: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)  # YES/NO
    discount_percent: Mapped[Optional[float]] = mapped_column(Numeric(5, 2), nullable=True)
    business_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    seating_capacity: Mapped[Optional[int]] = mapped_column(nullable=True)
    veh_wheels: Mapped[Optional[int]] = mapped_column(nullable=True)
    
    # =============================================================================
    # ADMIN MANUAL INPUT FIELDS
    # =============================================================================
    
    # 👤 Transaction Configuration
    reporting_month: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)  # MMM'YY format
    booking_date: Mapped[Optional[Date]] = mapped_column(Date, nullable=True)
    agent_code: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    code_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # Direct, Broker, Child ID
    
    # 👤 Commission Configuration
    incoming_grid_percent: Mapped[Optional[float]] = mapped_column(Numeric(5, 2), nullable=True)
    agent_commission_given_percent: Mapped[Optional[float]] = mapped_column(Numeric(5, 2), nullable=True)
    extra_grid: Mapped[Optional[float]] = mapped_column(Numeric(5, 2), nullable=True)
    commissionable_premium: Mapped[Optional[float]] = mapped_column(Numeric(15, 2), nullable=True)
    
    # 👤 Payment Configuration
    payment_by: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # Agent, InsureZeal
    payment_method: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    payout_on: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # OD, NP, OD+TP
    agent_extra_percent: Mapped[Optional[float]] = mapped_column(Numeric(5, 2), nullable=True)
    payment_by_office: Mapped[Optional[float]] = mapped_column(Numeric(15, 2), nullable=True)

    # 👤 Relationship Selection (Foreign Keys)
    insurer_id: Mapped[Optional[int]] = mapped_column(ForeignKey("insurers.id"), nullable=True)
    broker_id: Mapped[Optional[int]] = mapped_column(ForeignKey("brokers.id"), nullable=True)
    child_id_request_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("child_id_requests.id"), nullable=True)
    admin_child_id: Mapped[Optional[str]] = mapped_column(ForeignKey("admin_child_ids.child_id"), nullable=True)
    
    # =============================================================================
    # AUTO-CALCULATED FIELDS
    # =============================================================================
    
    # 📊 Database Auto-Population
    insurer_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    broker_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    insurer_broker_code: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    cluster: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # 👤 Admin Input
    
    # 🔄 Commission Calculations
    receivable_from_broker: Mapped[Optional[float]] = mapped_column(Numeric(15, 2), nullable=True)
    extra_amount_receivable_from_broker: Mapped[Optional[float]] = mapped_column(Numeric(15, 2), nullable=True)
    total_receivable_from_broker: Mapped[Optional[float]] = mapped_column(Numeric(15, 2), nullable=True)
    total_receivable_from_broker_with_gst: Mapped[Optional[float]] = mapped_column(Numeric(15, 2), nullable=True)
    
    # 🔄 CutPay & Payout Calculations
    cut_pay_amount: Mapped[Optional[float]] = mapped_column(Numeric(15, 2), nullable=True)
    agent_po_amt: Mapped[Optional[float]] = mapped_column(Numeric(15, 2), nullable=True)
    agent_extra_amount: Mapped[Optional[float]] = mapped_column(Numeric(15, 2), nullable=True)
    total_agent_po_amt: Mapped[Optional[float]] = mapped_column(Numeric(15, 2), nullable=True)
    
    # =============================================================================
    # ADMIN TRACKING FIELDS
    # =============================================================================
    
    # Transaction Progress Tracking
    claimed_by: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    running_bal: Mapped[Optional[float]] = mapped_column(Numeric(15, 2), nullable=True)
    cutpay_received: Mapped[Optional[float]] = mapped_column(Numeric(15, 2), nullable=True)  # 👤 Admin Input: cutpay amount received
    
    # =============================================================================
    # POST-CUTPAY DETAILS FIELDS
    # =============================================================================
    
    # 👤 Post-CutPay Admin Input Fields
    already_given_to_agent: Mapped[Optional[float]] = mapped_column(Numeric(15, 2), nullable=True)
    iz_total_po_percent: Mapped[Optional[float]] = mapped_column(Numeric(5, 2), nullable=True)  # Auto-calculated: incoming_grid_percent + extra_grid
    broker_po_percent: Mapped[Optional[float]] = mapped_column(Numeric(5, 2), nullable=True)
    broker_payout_amount: Mapped[Optional[float]] = mapped_column(Numeric(15, 2), nullable=True)
    invoice_status: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # GST pending, invoicing pending, paid, payment pending
    remarks: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    company: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    
    # =============================================================================
    # SYSTEM FIELDS
    # =============================================================================
    

    
    # Google Sheets sync tracking
    synced_to_cutpay_sheet: Mapped[bool] = mapped_column(Boolean, default=False)
    synced_to_master_sheet: Mapped[bool] = mapped_column(Boolean, default=False)
    cutpay_sheet_row_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    master_sheet_row_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    
    # Additional info
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Audit fields
    created_by: Mapped[Optional[UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("auth.users.id", ondelete="SET NULL"),
        nullable=True
    )
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(True), 
        server_default=text("CURRENT_TIMESTAMP"),
        nullable=False
    )
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(True), 
        server_default=text("CURRENT_TIMESTAMP"),
        onupdate=text("CURRENT_TIMESTAMP"),
        nullable=False
    )
    
    
    # Relationships
    insurer: Mapped[Optional["Insurer"]] = relationship("Insurer", back_populates="cutpay_transactions")
    broker: Mapped[Optional["Broker"]] = relationship("Broker", back_populates="cutpay_transactions")
    child_id_request: Mapped[Optional["ChildIdRequest"]] = relationship("ChildIdRequest", back_populates="cutpay_transactions")
    admin_child: Mapped[Optional["AdminChildID"]] = relationship("AdminChildID", foreign_keys=[admin_child_id])


class Policy(Base):
    """
    Policy table for storing insurance policy details
    """
    __tablename__ = "policies"
    
    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    
    # User & Agent Info
    uploaded_by: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("user_profiles.user_id"), nullable=False)
    agent_id: Mapped[Optional[UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("user_profiles.user_id"), nullable=True)
    agent_code: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    child_id: Mapped[Optional[str]] = mapped_column(String(50), ForeignKey("child_id_requests.child_id"), nullable=True)
    
    # Auto-populated from Child ID
    broker_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    insurance_company: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    
    # =============================================================================
    # POLICY DETAILS (from CutPay fields)
    # =============================================================================
    
    # Basic Policy Information (from PDF extraction)
    policy_number: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    formatted_policy_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    major_categorisation: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # Motor, Life, Health
    product_insurer_report: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    product_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)  # Private Car, etc.
    plan_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # Comp, STP, SAOD
    customer_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    customer_phone_number: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    
    # Legacy field names for backward compatibility
    policy_type: Mapped[str] = mapped_column(String(50), nullable=False)  # Motor, Health, etc.
    insurance_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # Comprehensive, Third Party
    
    # Vehicle Details (from PDF extraction)
    vehicle_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    registration_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    registration_no: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # Alternative field name
    vehicle_class: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    vehicle_segment: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    make_model: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    model: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    vehicle_variant: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    gvw: Mapped[Optional[float]] = mapped_column(Numeric(10, 2), nullable=True)  # Gross Vehicle Weight
    rto: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    state: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    fuel_type: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    cc: Mapped[Optional[int]] = mapped_column(nullable=True)  # Engine capacity
    age_year: Mapped[Optional[int]] = mapped_column(nullable=True)
    ncb: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)  # YES/NO
    discount_percent: Mapped[Optional[float]] = mapped_column(Numeric(5, 2), nullable=True)
    business_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    seating_capacity: Mapped[Optional[int]] = mapped_column(nullable=True)
    veh_wheels: Mapped[Optional[int]] = mapped_column(nullable=True)
    
    # Premium Details (from PDF extraction)
    gross_premium: Mapped[Optional[float]] = mapped_column(Numeric(15, 2), nullable=True)
    gst: Mapped[Optional[float]] = mapped_column(Numeric(15, 2), nullable=True)
    gst_amount: Mapped[Optional[float]] = mapped_column(Numeric(15, 2), nullable=True)  # Alternative field name
    net_premium: Mapped[Optional[float]] = mapped_column(Numeric(15, 2), nullable=True)
    od_premium: Mapped[Optional[float]] = mapped_column(Numeric(15, 2), nullable=True)  # Own Damage
    tp_premium: Mapped[Optional[float]] = mapped_column(Numeric(15, 2), nullable=True)  # Third Party
    
    # Agent Commission Fields (only these two for policies)
    agent_commission_given_percent: Mapped[Optional[float]] = mapped_column(Numeric(5, 2), nullable=True)
    agent_extra_percent: Mapped[Optional[float]] = mapped_column(Numeric(5, 2), nullable=True)
    
    # Agent Financial Tracking
    payment_by_office: Mapped[Optional[float]] = mapped_column(Numeric(15, 2), nullable=True, default=0.0)
    total_agent_payout_amount: Mapped[Optional[float]] = mapped_column(Numeric(15, 2), nullable=True, default=0.0)
    
    # Additional Policy Configuration
    code_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # Direct, Broker, Child ID
    payment_by: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # Agent, InsureZeal
    payment_method: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    cluster: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    
    # Private Car Detection
    is_private_car: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True, default=False)
    
    # Dates
    start_date: Mapped[Optional[Date]] = mapped_column(Date, nullable=True)
    end_date: Mapped[Optional[Date]] = mapped_column(Date, nullable=True)
    
    # File Storage
    pdf_file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    pdf_file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    
    # AI Extraction
    ai_extracted_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)  # Store raw AI response
    ai_confidence_score: Mapped[Optional[float]] = mapped_column(Numeric(3, 2), nullable=True)
    manual_override: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    
    # Additional fields
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    uploader: Mapped["UserProfile"] = relationship("UserProfile", foreign_keys=[uploaded_by])
    agent: Mapped[Optional["UserProfile"]] = relationship("UserProfile", foreign_keys=[agent_id])
    child_request: Mapped[Optional["ChildIdRequest"]] = relationship("ChildIdRequest", foreign_keys=[child_id])


class Broker(Base):
    """
    Brokers table for storing insurance broker information
    """
    __tablename__ = "brokers"
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    broker_code: Mapped[str] = mapped_column(String(10), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    address: Mapped[str] = mapped_column(Text, nullable=False)
    rm: Mapped[str] = mapped_column(String(100), nullable=False)
    gst: Mapped[str] = mapped_column(String(15), nullable=False)
    
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(True), 
        server_default=text("CURRENT_TIMESTAMP"),
        nullable=False
    )
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(True), 
        server_default=text("CURRENT_TIMESTAMP"),
        onupdate=text("CURRENT_TIMESTAMP"),
        nullable=False
    )
    
    # Relationships
    cutpay_transactions: Mapped[list["CutPay"]] = relationship("CutPay", back_populates="broker")
    child_id_requests: Mapped[list["ChildIdRequest"]] = relationship("ChildIdRequest", foreign_keys="ChildIdRequest.broker_code", overlaps="broker")
    admin_child_ids: Mapped[list["AdminChildID"]] = relationship("AdminChildID", foreign_keys="AdminChildID.broker_id", overlaps="broker")


class Insurer(Base):
    """
    Insurers table for storing insurance company information
    """
    __tablename__ = "insurers"
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    insurer_code: Mapped[str] = mapped_column(String(10), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(True), 
        server_default=text("CURRENT_TIMESTAMP"),
        nullable=False
    )
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(True), 
        server_default=text("CURRENT_TIMESTAMP"),
        onupdate=text("CURRENT_TIMESTAMP"),
        nullable=False
    )
    
    # Relationships
    cutpay_transactions: Mapped[list["CutPay"]] = relationship("CutPay", back_populates="insurer")
    child_id_requests: Mapped[list["ChildIdRequest"]] = relationship("ChildIdRequest", foreign_keys="ChildIdRequest.insurer_code", overlaps="insurer")
    admin_child_ids: Mapped[list["AdminChildID"]] = relationship("AdminChildID", foreign_keys="AdminChildID.insurer_id", overlaps="insurer")


class AdminChildID(Base):
    """
    Admin Child IDs table for storing child IDs created directly by admins
    These are not linked to any specific user and can be used by all admins
    """
    __tablename__ = "admin_child_ids"
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    child_id: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    password: Mapped[Optional[str]] = mapped_column(String(255))
    branch_code: Mapped[str] = mapped_column(String(20), nullable=False)
    region: Mapped[str] = mapped_column(String(50), nullable=False)
    manager_name: Mapped[str] = mapped_column(String(100), nullable=False)
    manager_email: Mapped[str] = mapped_column(String(255), nullable=False)
    admin_notes: Mapped[Optional[str]] = mapped_column(Text)
    
    # Code type: "Direct Code" or "Broker Code"
    code_type: Mapped[str] = mapped_column(String(20), nullable=False)
    insurer_id: Mapped[int] = mapped_column(ForeignKey("insurers.id"), nullable=False)
    broker_id: Mapped[Optional[int]] = mapped_column(ForeignKey("brokers.id"), nullable=True)
    
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_suspended: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    
    created_by: Mapped[Optional[UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("auth.users.id", ondelete="SET NULL"),
        nullable=True
    )
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(True), 
        server_default=text("CURRENT_TIMESTAMP"),
        nullable=False
    )
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(True), 
        server_default=text("CURRENT_TIMESTAMP"),
        onupdate=text("CURRENT_TIMESTAMP"),
        nullable=False
    )
    
    # Relationships
    insurer: Mapped["Insurer"] = relationship("Insurer", foreign_keys=[insurer_id], overlaps="admin_child_ids")
    broker: Mapped[Optional["Broker"]] = relationship("Broker", foreign_keys=[broker_id], overlaps="admin_child_ids")


class CutPayAgentConfig(Base):
    """
    CutPay Agent Configuration Model
    Stores payment configuration and PO details for agents in CutPay workflow
    """
    __tablename__ = "cutpay_agent_configs"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    
    # Agent Information
    agent_code: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    
    # Configuration Details
    date: Mapped[Date] = mapped_column(Date, nullable=False)
    payment_mode: Mapped[str] = mapped_column(String(100), nullable=False)  # e.g., "NEFT", "Cash", "Cheque"
    payment_mode_detail: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # Additional details
    po_paid_to_agent: Mapped[Numeric] = mapped_column(Numeric(15, 2), nullable=False, default=0.0)
    
    # Audit fields
    created_by: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), 
        ForeignKey("auth.users.id", ondelete="SET NULL"),
        nullable=True
    )
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(True), 
        server_default=text("CURRENT_TIMESTAMP"),
        nullable=False
    )
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(True), 
        server_default=text("CURRENT_TIMESTAMP"),
        onupdate=text("CURRENT_TIMESTAMP"),
        nullable=False
    )
    
    # Relationships
    created_by_user: Mapped[Optional["Users"]] = relationship("Users", foreign_keys=[created_by])
    
    # Constraints
    __table_args__ = (
        UniqueConstraint('agent_code', 'date', name='unique_cutpay_agent_config_per_date'),
        Index('idx_cutpay_agent_config_agent_code', 'agent_code'),
        Index('idx_cutpay_agent_config_date', 'date'),
    )

