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
    Local users table that replicates Supabase auth.users via webhook
    This stores replicated user data to enable proper foreign key relationships
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
        ForeignKey("users.id", ondelete="CASCADE"),
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
        ForeignKey("users.id", ondelete="CASCADE"),
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
        ForeignKey("users.id", ondelete="CASCADE"),
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
        ForeignKey("users.id", ondelete="SET NULL"),
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
    CutPay model simplified to store only essential fields
    Detailed data goes to Google Sheets for calculations
    """
    __tablename__ = "cut_pay"

    id: Mapped[int] = mapped_column(primary_key=True)
    
    # Essential fields only
    policy_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    child_id_request_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("child_id_requests.id"), nullable=True)
    agent_code: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    
    # Relationship fields for linking to insurers, brokers, and admin child IDs
    insurer_id: Mapped[Optional[int]] = mapped_column(ForeignKey("insurers.id"), nullable=True)
    broker_id: Mapped[Optional[int]] = mapped_column(ForeignKey("brokers.id"), nullable=True)
    admin_child_id: Mapped[Optional[str]] = mapped_column(ForeignKey("admin_child_ids.child_id"), nullable=True)
    
    # Document URLs
    customer_documents_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    vehicle_documents_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    policy_documents_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Important dates
    booking_date: Mapped[Optional[Date]] = mapped_column(Date, nullable=True)
    policy_start_date: Mapped[Optional[Date]] = mapped_column(Date, nullable=True)
    policy_end_date: Mapped[Optional[Date]] = mapped_column(Date, nullable=True)
    
    # System fields
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
    child_id_request: Mapped[Optional["ChildIdRequest"]] = relationship("ChildIdRequest", back_populates="cutpay_transactions")
    insurer: Mapped[Optional["Insurer"]] = relationship("Insurer", back_populates="cutpay_transactions")
    broker: Mapped[Optional["Broker"]] = relationship("Broker", back_populates="cutpay_transactions")
    admin_child: Mapped[Optional["AdminChildID"]] = relationship("AdminChildID", foreign_keys=[admin_child_id])


class Policy(Base):
    """
    Policy table for storing insurance policy details
    Simplified to store only essential fields - detailed data goes to Google Sheets
    """
    __tablename__ = "policies"
    
    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    
    # Essential fields only
    policy_number: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    child_id: Mapped[Optional[str]] = mapped_column(String(50), ForeignKey("child_id_requests.child_id"), nullable=True)
    agent_code: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    
    # Document URLs
    customer_documents_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    vehicle_documents_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    policy_documents_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Important dates
    booking_date: Mapped[Optional[Date]] = mapped_column(Date, nullable=True)
    policy_start_date: Mapped[Optional[Date]] = mapped_column(Date, nullable=True)
    policy_end_date: Mapped[Optional[Date]] = mapped_column(Date, nullable=True)
    
    # System fields
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
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
        ForeignKey("users.id", ondelete="SET NULL"),
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
        ForeignKey("users.id", ondelete="SET NULL"),
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


class ReconciliationReport(Base):
    """
    Reconciliation Report Model
    Stores detailed reconciliation reports from universal record processing
    """
    __tablename__ = "reconciliation_reports"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    
    # Report Metadata
    insurer_name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    report_type: Mapped[str] = mapped_column(String(50), nullable=False, default="universal_record")  # Type of reconciliation
    file_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)  # Original file name
    
    # Processing Statistics
    total_records_processed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_records_updated: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_records_added: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_records_skipped: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_errors: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    processing_time_seconds: Mapped[Numeric] = mapped_column(Numeric(10, 3), nullable=False, default=0.0)
    
    # Reconciliation Metrics
    data_variance_percentage: Mapped[Numeric] = mapped_column(Numeric(5, 2), nullable=False, default=0.0)
    coverage_percentage: Mapped[Numeric] = mapped_column(Numeric(5, 2), nullable=False, default=0.0)
    
    # Detailed Data
    field_changes: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)  # Field-level change counts
    error_details: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)  # List of errors
    change_details: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)  # Detailed change log
    file_info: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)  # Original headers, unmapped headers, etc.
    
    # Processing Status
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="completed")  # completed, failed, partial
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Audit fields
    processed_by: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), 
        ForeignKey("users.id", ondelete="SET NULL"),
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
    processed_by_user: Mapped[Optional["Users"]] = relationship("Users", foreign_keys=[processed_by])
    
    # Constraints
    __table_args__ = (
        Index('idx_reconciliation_reports_insurer', 'insurer_name'),
        Index('idx_reconciliation_reports_created_at', 'created_at'),
        Index('idx_reconciliation_reports_processed_by', 'processed_by'),
        Index('idx_reconciliation_reports_status', 'status'),
    )

