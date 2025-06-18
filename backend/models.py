from sqlalchemy import (
    Boolean, 
    String, 
    Text, 
    DateTime, 
    SmallInteger,
    CheckConstraint,
    PrimaryKeyConstraint,
    UniqueConstraint,
    Index,
    Computed,
    text,
    ForeignKey,
    Column,
    Numeric,
    Date
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.ext.declarative import declarative_base
from typing import Optional
import uuid

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
    
    # Request Details
    insurance_company: Mapped[str] = mapped_column(String(100), nullable=False)
    broker: Mapped[str] = mapped_column(String(100), nullable=False)
    location: Mapped[str] = mapped_column(String(200), nullable=False)
    phone_number: Mapped[str] = mapped_column(String(15), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    preferred_rm_name: Mapped[Optional[str]] = mapped_column(String(100))
    
    # Status: pending, accepted, rejected, suspended
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)
    
    # Assigned Details (filled by admin during approval)
    child_id: Mapped[Optional[str]] = mapped_column(String(50), unique=True, index=True)
    broker_code: Mapped[Optional[str]] = mapped_column(String(20))
    branch_code: Mapped[Optional[str]] = mapped_column(String(20))
    region: Mapped[Optional[str]] = mapped_column(String(50))
    manager_name: Mapped[Optional[str]] = mapped_column(String(100))
    manager_email: Mapped[Optional[str]] = mapped_column(String(255))
    commission_percentage: Mapped[Optional[float]] = mapped_column()
    policy_limit: Mapped[Optional[int]] = mapped_column()
    
    # Admin notes
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


class CutPay(Base):
    """
    Cut Pay Transactions - Admin only feature for managing cut pay transactions
    """
    __tablename__ = "cut_pay"

    id: Mapped[int] = mapped_column(primary_key=True)
    policy_number: Mapped[str] = mapped_column(String(100), nullable=False)
    agent_code: Mapped[str] = mapped_column(String(50), nullable=False)
    insurance_company: Mapped[str] = mapped_column(String(200), nullable=False)
    broker: Mapped[str] = mapped_column(String(200), nullable=False)
    
    # Financial details
    gross_amount: Mapped[float] = mapped_column(Numeric(15, 2), nullable=False)
    net_premium: Mapped[float] = mapped_column(Numeric(15, 2), nullable=False)
    commission_grid: Mapped[str] = mapped_column(String(100), nullable=False)
    agent_commission_given_percent: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    cut_pay_amount: Mapped[float] = mapped_column(Numeric(15, 2), nullable=False)
      # Payment details
    payment_by: Mapped[str] = mapped_column(String(200), nullable=False)
    amount_received: Mapped[float] = mapped_column(Numeric(15, 2), nullable=False)
    payment_method: Mapped[str] = mapped_column(String(100), nullable=False)
    payment_source: Mapped[str] = mapped_column(String(200), nullable=False)
    
    # Dates
    transaction_date: Mapped[Date] = mapped_column(Date, nullable=False)
    payment_date: Mapped[Optional[Date]] = mapped_column(Date, nullable=True)
    
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

