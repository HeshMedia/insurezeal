
// Agent Types
export type GenderEnum = 'male' | 'female' | 'other' | null
export type EducationLevelEnum = 
  | 'high_school' 
  | 'diploma' 
  | 'bachelors' 
  | 'masters' 
  | 'doctorate' 
  | 'professional' 
  | null

export interface AgentSummary {
  id: string
  user_id: string
  first_name: string | null
  last_name: string | null
  email: string
  mobile_number: string | null
  agent_code: string | null
  user_role: string
  created_at: string | null
  updated_at: string | null
}

export interface AgentListResponse {
  agents: AgentSummary[]
  total_count: number
  page: number
  page_size: number
}

export interface AgentListParams {
  page?: number
  page_size?: number
  search?: string
}

export interface AgentDetails {
  id: string
  user_id: string
  email: string
  username: string | null
  first_name: string | null
  last_name: string | null
  middle_name: string | null
  father_name: string | null
  mother_name: string | null
  date_of_birth: string | null
  gender: GenderEnum
  mobile_number: string | null
  alternate_mobile: string | null
  alternate_email: string | null
  permanent_address_line1: string | null
  permanent_address_line2: string | null
  permanent_city: string | null
  permanent_state: string | null
  permanent_pincode: string | null
  communication_same_as_permanent: boolean | null
  communication_address_line1: string | null
  communication_address_line2: string | null
  communication_city: string | null
  communication_state: string | null
  communication_pincode: string | null
  aadhaar_number: string | null
  pan_number: string | null
  education_level: EducationLevelEnum
  specialization: string | null
  previous_insurance_experience: boolean | null
  years_of_experience: number | null
  previous_company_name: string | null
  bank_name: string | null
  account_number: string | null
  ifsc_code: string | null
  branch_name: string | null
  nominee_name: string | null
  nominee_relationship: string | null
  nominee_date_of_birth: string | null
  preferred_language: string | null
  territory_preference: string | null
  agent_code: string | null
  user_role: string
  avatar_url: string | null
  preferences: Record<string, unknown> | null
  created_at: string
  updated_at: string
  document_urls: Record<string, string>
  display_name: string | null
  bio: string | null
  timezone: string | null
  language: string | null
}

export interface AdminStats {
  total_agents: number
  new_agents_this_month: number
  total_documents: number
}

// Child Request Types
export type ChildRequestStatus = 'pending' | 'accepted' | 'rejected' | 'suspended'

export interface InsurerInfo {
  id: string
  insurer_code: string
  name: string
}

export interface BrokerInfo {
  id: string
  broker_code: string
  name: string
}

export interface ChildRequest {
  id: string
  user_id: string
  phone_number: string | null
  email: string | null
  location: string | null
  code_type: string | null
  insurer_id: number | null
  broker_id: number | null
  preferred_rm_name: string | null
  status: ChildRequestStatus
  child_id: string | null
  branch_code: string | null
  region: string | null
  manager_name: string | null
  manager_email: string | null
  admin_notes: string | null
  approved_by: string | null
  approved_at: string | null
  agent_name: string | null
  agent_code: string | null
  created_at: string
  updated_at: string
  insurer?: InsurerInfo | null
  broker_relation?: BrokerInfo | null
}

export interface AssignChildIdRequest {
  child_id: string
  branch_code?: string
  region?: string
  manager_name?: string
  manager_email?: string
  admin_notes?: string
}

export interface ChildRequestListResponse {
  requests: ChildRequest[]
  total_count: number
  page: number
  page_size: number
  total_pages: number
}

export interface ChildRequestListParams {
  page?: number
  page_size?: number
  status?: ChildRequestStatus
  search?: string
}

export interface ChildRequestStatusUpdate {
  admin_notes: string
}

export type UpdateChildRequestStatusRequest = ChildRequestStatusUpdate

// Universal Record Management Types
export interface UniversalRecordUploadResponse {
  message: string
  report: ReconciliationReport
  processing_time_seconds: number
}

export interface ReconciliationReport {
  total_records_processed: number
  policies_updated: number
  policies_added: number
  cutpay_updated: number
  cutpay_added: number
  no_changes: number
  errors: string[]
  processing_summary: RecordUpdateSummary[]
}

export interface RecordUpdateSummary {
  policy_number: string
  record_type: string // "policy", "cutpay", or "policy+cutpay"
  action: string // "updated", "added", "no_change"
  updated_fields: string[]
  old_values: Record<string, string | number | boolean | null>
  new_values: Record<string, string | number | boolean | null>
}

// Child Request Statistics
export interface ChildRequestStats {
  total_requests: number
  pending_requests: number
  approved_requests: number
  rejected_requests: number
  suspended_requests: number
  monthly_breakdown?: Array<{
    month: string
    year: number
    total_requests: number
    approved: number
    rejected: number
    suspended: number
  }>
}

// Agent Document Types (for enhanced agent details)
export interface AgentDocument {
  id: string
  document_type: string
  document_name: string
  document_url: string
  upload_date: string
}

export interface EnhancedAgentDetails extends AgentDetails {
  documents: AgentDocument[]
  document_urls: Record<string, string> // document_type -> url mapping
}