// Enums
export type GenderEnum = 'male' | 'female' | 'other' | null

export type EducationLevelEnum = 
  | 'high_school' 
  | 'diploma' 
  | 'bachelors' 
  | 'masters' 
  | 'doctorate' 
  | 'professional' 
  | null

export type DocumentType = 
  | 'aadhaar'
  | 'pan'
  | 'educational_certificate'
  | 'experience_certificate'
  | 'passport_photo'
  | 'bank_passbook'
  | 'cancelled_cheque'
  | 'irdai_license'
  | 'training_certificate'
  | 'residence_proof'
  | 'income_proof'

// Base Profile Interface
export interface UserProfile {
  id: string
  user_id: string
  email: string
  first_name?: string
  middle_name?: string
  last_name?: string
  father_name?: string
  mother_name?: string
  date_of_birth?: string
  gender?: GenderEnum
  mobile_number?: string
  alternate_mobile?: string
  alternate_email?: string
  permanent_address_line1?: string
  permanent_address_line2?: string
  permanent_city?: string
  permanent_state?: string
  permanent_pincode?: string
  communication_same_as_permanent?: boolean
  communication_address_line1?: string
  communication_address_line2?: string
  communication_city?: string
  communication_state?: string
  communication_pincode?: string
  education_level?: EducationLevelEnum
  specialization?: string
  previous_insurance_experience?: boolean
  years_of_experience?: number
  previous_company_name?: string
  bank_name?: string
  account_number?: string
  ifsc_code?: string
  branch_name?: string
  nominee_name?: string
  nominee_relationship?: string
  nominee_date_of_birth?: string
  preferred_language?: string
  territory_preference?: string
  avatar_url?: string
  preferences?: Record<string, unknown>
  created_at: string
  updated_at: string
  agent_code?: string
  user_role?: string
  document_urls?: Record<string, string>
  username?: string
  display_name?: string
  bio?: string
  timezone?: string
  language?: string
}

// Update Profile Request
export interface UpdateProfileRequest {
  first_name?: string
  middle_name?: string
  last_name?: string
  father_name?: string
  mother_name?: string
  date_of_birth?: string
  gender?: GenderEnum
  mobile_number?: string
  alternate_mobile?: string
  alternate_email?: string
  permanent_address_line1?: string
  permanent_address_line2?: string
  permanent_city?: string
  permanent_state?: string
  permanent_pincode?: string
  communication_same_as_permanent?: boolean
  communication_address_line1?: string
  communication_address_line2?: string
  communication_city?: string
  communication_state?: string
  communication_pincode?: string
  education_level?: EducationLevelEnum
  specialization?: string
  previous_insurance_experience?: boolean
  years_of_experience?: number | null
  previous_company_name?: string
  bank_name?: string
  account_number?: string
  ifsc_code?: string
  branch_name?: string
  nominee_name?: string
  nominee_relationship?: string
  nominee_date_of_birth?: string
  preferred_language?: string
  territory_preference?: string
  username?: string
  display_name?: string
  bio?: string
  timezone?: string
  language?: string
}

// Profile Image Response
export interface ProfileImageUploadResponse {
  avatar_url: string
  message: string
}

// Document Upload Response
export interface DocumentUploadResponse {
  document_id: string
  document_type: DocumentType
  document_name: string
  document_url: string
  upload_date: string
  message: string
}

// Document List Response
export interface DocumentListResponse {
  documents: DocumentUploadResponse[]
  total_count: number
}

// Document Upload Request
export interface DocumentUploadRequest {
  file: File
  document_type: DocumentType
  document_name: string
}