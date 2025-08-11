from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional, List, Literal, Dict
from datetime import datetime, date
from enum import Enum

class GenderEnum(str, Enum):
    MALE = "male"
    FEMALE = "female"
    OTHER = "other"

class EducationLevelEnum(str, Enum):
    HIGH_SCHOOL = "high_school"
    UNDERGRADUATE = "undergraduate"
    POSTGRADUATE = "postgraduate"
    PROFESSIONAL = "professional"
    DOCTORATE = "doctorate"

class DocumentTypeEnum(str, Enum):
    AADHAAR = "aadhaar"
    PAN = "pan"
    EDUCATIONAL_CERTIFICATE = "educational_certificate"
    EXPERIENCE_CERTIFICATE = "experience_certificate"
    PASSPORT_PHOTO = "passport_photo"
    BANK_PASSBOOK = "bank_passbook"
    CANCELLED_CHEQUE = "cancelled_cheque"
    IRDAI_LICENSE = "irdai_license"
    TRAINING_CERTIFICATE = "training_certificate"
    RESIDENCE_PROOF = "residence_proof"
    INCOME_PROOF = "income_proof"

class AgentRegistrationCreate(BaseModel):
    # Basic Information
    first_name: str = Field(..., min_length=2, max_length=50)
    middle_name: Optional[str] = Field(None, max_length=50)
    last_name: str = Field(..., min_length=2, max_length=50)
    father_name: str = Field(..., min_length=2, max_length=100)
    mother_name: str = Field(..., min_length=2, max_length=100)
    date_of_birth: date = Field(...)
    gender: GenderEnum = Field(...)
      # Contact Information
    mobile_number: str = Field(..., pattern=r"^[6-9]\d{9}$")
    alternate_mobile: Optional[str] = Field(None, pattern=r"^[6-9]\d{9}$")
    email: EmailStr = Field(...)
    alternate_email: Optional[EmailStr] = None
    
    # Address Information
    permanent_address_line1: str = Field(..., min_length=5, max_length=200)
    permanent_address_line2: Optional[str] = Field(None, max_length=200)
    permanent_city: str = Field(..., min_length=2, max_length=50)
    permanent_state: str = Field(..., min_length=2, max_length=50)
    permanent_pincode: str = Field(..., pattern=r"^\d{6}$")
      # Communication Address (same as permanent if not provided)
    communication_same_as_permanent: bool = Field(default=True)
    communication_address_line1: Optional[str] = Field(None, max_length=200)
    communication_address_line2: Optional[str] = Field(None, max_length=200)
    communication_city: Optional[str] = Field(None, max_length=50)
    communication_state: Optional[str] = Field(None, max_length=50)
    communication_pincode: Optional[str] = Field(None, pattern=r"^\d{6}$")
    
      # Professional Information
    education_level: EducationLevelEnum = Field(...)
    specialization: Optional[str] = Field(None, max_length=100)
    previous_insurance_experience: bool = Field(default=False)
    years_of_experience: Optional[int] = Field(None, ge=0, le=50)
    previous_company_name: Optional[str] = Field(None, max_length=100)
    
    # Bank Information
    bank_name: str = Field(..., min_length=2, max_length=100)
    account_number: str = Field(..., min_length=9, max_length=18)
    ifsc_code: str = Field(..., pattern=r"^[A-Z]{4}0[A-Z0-9]{6}$")
    branch_name: str = Field(..., min_length=2, max_length=100)
    
    # Nominee Information
    nominee_name: str = Field(..., min_length=2, max_length=100)
    nominee_relationship: str = Field(..., min_length=2, max_length=50)
    nominee_date_of_birth: date = Field(...)
    
    # Preferences
    preferred_language: Optional[str] = Field("english", max_length=20)
    territory_preference: Optional[str] = Field(None, max_length=100)
    
    @validator('date_of_birth')
    def validate_age(cls, v):
        today = date.today()
        age = today.year - v.year - ((today.month, today.day) < (v.month, v.day))
        if age < 18:
            raise ValueError('Agent must be at least 18 years old')
        if age > 70:
            raise ValueError('Agent cannot be more than 70 years old')
        return v

class UserProfileUpdate(BaseModel):
    # Basic Information
    first_name: Optional[str] = Field(None, min_length=2, max_length=50)
    middle_name: Optional[str] = Field(None, max_length=50)
    last_name: Optional[str] = Field(None, min_length=2, max_length=50)
    father_name: Optional[str] = Field(None, min_length=2, max_length=100)
    mother_name: Optional[str] = Field(None, min_length=2, max_length=100)
    date_of_birth: Optional[date] = None
    gender: Optional[GenderEnum] = None
    
    # Contact Information
    mobile_number: Optional[str] = Field(None, pattern=r"^[6-9]\d{9}$")
    alternate_mobile: Optional[str] = Field(None, pattern=r"^[6-9]\d{9}$")
    alternate_email: Optional[EmailStr] = None
    
    # Address Information
    permanent_address_line1: Optional[str] = Field(None, max_length=200)
    permanent_address_line2: Optional[str] = Field(None, max_length=200)
    permanent_city: Optional[str] = Field(None, max_length=50)
    permanent_state: Optional[str] = Field(None, max_length=50)
    permanent_pincode: Optional[str] = Field(None, pattern=r"^\d{6}$")
    
    communication_same_as_permanent: Optional[bool] = None
    communication_address_line1: Optional[str] = Field(None, max_length=200)
    communication_address_line2: Optional[str] = Field(None, max_length=200)
    communication_city: Optional[str] = Field(None, max_length=50)
    communication_state: Optional[str] = Field(None, max_length=50)
    communication_pincode: Optional[str] = Field(None, pattern=r"^\d{6}$")
    
    # Professional Information
    education_level: Optional[EducationLevelEnum] = None
    specialization: Optional[str] = Field(None, max_length=100)
    previous_insurance_experience: Optional[bool] = None
    years_of_experience: Optional[int] = Field(None, ge=0, le=50)
    previous_company_name: Optional[str] = Field(None, max_length=100)
    
    # Bank Information
    bank_name: Optional[str] = Field(None, max_length=100)
    account_number: Optional[str] = Field(None, min_length=9, max_length=18)
    ifsc_code: Optional[str] = Field(None, pattern=r"^[A-Z]{4}0[A-Z0-9]{6}$")
    branch_name: Optional[str] = Field(None, max_length=100)
    
    # Nominee Information
    nominee_name: Optional[str] = Field(None, max_length=100)
    nominee_relationship: Optional[str] = Field(None, max_length=50)
    nominee_date_of_birth: Optional[date] = None
      # Preferences
    preferred_language: Optional[str] = Field(None, max_length=20)
    territory_preference: Optional[str] = Field(None, max_length=100)
    
    username: Optional[str] = None
    display_name: Optional[str] = None
    bio: Optional[str] = None
    timezone: Optional[str] = None
    language: Optional[str] = None

class DocumentUpload(BaseModel):
    """Schema for document upload"""
    document_type: DocumentTypeEnum = Field(...)
    document_name: str = Field(..., min_length=1, max_length=200)
    file_size: Optional[int] = None
    
class DocumentUploadResponse(BaseModel):
    """Response schema for document upload"""
    document_id: str
    document_type: DocumentTypeEnum
    document_name: str
    document_url: str
    upload_date: datetime
    message: str
    upload_url: Optional[str] = None  # For presigned URLs

    class Config:
        from_attributes = True

class DocumentListResponse(BaseModel):
    """Response schema for listing user documents"""
    documents: List[DocumentUploadResponse]
    total_count: int

class ProfileImageUpload(BaseModel):
    """Response schema for profile image upload"""
    avatar_url: str
    message: str
    upload_url: Optional[str] = None  # For presigned URLs

class UserProfileResponse(BaseModel):
    id: str
    user_id: str
    email: str
    
    # Basic Information
    first_name: Optional[str] = None
    middle_name: Optional[str] = None
    last_name: Optional[str] = None
    father_name: Optional[str] = None
    mother_name: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[GenderEnum] = None
    
    # Contact Information
    mobile_number: Optional[str] = None
    alternate_mobile: Optional[str] = None
    alternate_email: Optional[str] = None
    
    # Address Information
    permanent_address_line1: Optional[str] = None
    permanent_address_line2: Optional[str] = None
    permanent_city: Optional[str] = None
    permanent_state: Optional[str] = None
    permanent_pincode: Optional[str] = None
    
    communication_same_as_permanent: Optional[bool] = None
    communication_address_line1: Optional[str] = None
    communication_address_line2: Optional[str] = None
    communication_city: Optional[str] = None
    communication_state: Optional[str] = None
    communication_pincode: Optional[str] = None

    # Professional Information
    education_level: Optional[EducationLevelEnum] = None
    specialization: Optional[str] = None
    previous_insurance_experience: Optional[bool] = None
    years_of_experience: Optional[int] = None
    previous_company_name: Optional[str] = None
    
    # Bank Information
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    ifsc_code: Optional[str] = None
    branch_name: Optional[str] = None
    
    # Nominee Information
    nominee_name: Optional[str] = None
    nominee_relationship: Optional[str] = None
    nominee_date_of_birth: Optional[date] = None
    
    # Preferences
    preferred_language: Optional[str] = None
    territory_preference: Optional[str] = None
    
    # System fields
    avatar_url: Optional[str] = None
    preferences: Optional[dict] = None
    created_at: datetime
    updated_at: datetime
    
    # Agent specific fields
    agent_code: Optional[str] = None
    user_role: Optional[str] = None
    
    # Agent financial fields
    running_balance: Optional[float] = None
    total_net_premium: Optional[float] = None
    number_of_policies: Optional[int] = None
    
    # Document URLs
    document_urls: Optional[Dict[str, str]] = None
    
    username: Optional[str] = None
    display_name: Optional[str] = None
    bio: Optional[str] = None
    timezone: Optional[str] = None
    language: Optional[str] = None

    class Config:        
        from_attributes = True


