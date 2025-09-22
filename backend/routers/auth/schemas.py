from pydantic import BaseModel, EmailStr
from typing import Optional, Dict, Any
from datetime import datetime
import uuid

# Request schemas
class UserRegister(BaseModel):
    email: EmailStr
    password: str
    username: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

# Response schemas
class UserResponse(BaseModel):
    id: str  
    user_id: str 
    email: Optional[str] = None 
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    display_name: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    date_of_birth: Optional[datetime] = None
    timezone: Optional[str] = None
    language: Optional[str] = None
    preferences: Optional[dict] = None
    created_at: datetime
    updated_at: datetime
    user_role: str

    class Config:
        from_attributes = True

class AuthResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse
    message: Optional[str] = None 

class RegistrationResponse(BaseModel):
    message: str
    user_id: str
    email: str
    status: str = "pending_verification"
    
class TokenResponse(BaseModel):
    access_token: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class VerifyResetTokenRequest(BaseModel):
    access_token: str
    refresh_token: str

class ResetPasswordRequest(BaseModel):
    new_password: str
    access_token: str
    refresh_token: str  


# Webhook schemas for Supabase Auth replication
class SupabaseUserRecord(BaseModel):
    """Schema for Supabase auth.users record in webhook payload"""
    id: str  # UUID as string from Supabase
    email: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None
    email_confirmed_at: Optional[datetime] = None
    phone_confirmed_at: Optional[datetime] = None
    last_sign_in_at: Optional[datetime] = None
    raw_app_meta_data: Optional[Dict[str, Any]] = None
    raw_user_meta_data: Optional[Dict[str, Any]] = None
    is_super_admin: Optional[bool] = None
    banned_until: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class SupabaseWebhookEvent(BaseModel):
    """Schema for Supabase webhook event payload"""
    type: str  # INSERT, UPDATE, DELETE
    table: str  # auth.users
    record: SupabaseUserRecord
    schema: str = "auth"
    old_record: Optional[SupabaseUserRecord] = None