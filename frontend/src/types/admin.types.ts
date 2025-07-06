// =========================================================================
// CUTPAY FLOW - COMPREHENSIVE TYPE DEFINITIONS
// Aligned with new backend API (uses flat structure for full compatibility)
// =========================================================================

// 🔽 Dropdown Option Interface
export interface DropdownOption {
  id: number
  name: string
  code?: string
}

// 🤖 PDF Extraction API Response
export interface ExtractedPolicyData {
  // Basic Policy Information
  policy_number?: string | null
  formatted_policy_number?: string | null
  major_categorisation?: string | null
  product_insurer_report?: string | null
  product_type?: string | null
  plan_type?: string | null
  customer_name?: string | null
  
  // Premium & Financial Details
  gross_premium?: number | null
  net_premium?: number | null
  od_premium?: number | null
  tp_premium?: number | null
  gst_amount?: number | null
  
  // Vehicle Details (for Motor Insurance)
  registration_no?: string | null
  make_model?: string | null
  model?: string | null
  vehicle_variant?: string | null
  gvw?: number | null
  rto?: string | null
  state?: string | null
  fuel_type?: string | null
  cc?: number | null
  age_year?: number | null
  ncb?: string | null
  discount_percent?: number | null
  business_type?: string | null
  seating_capacity?: number | null
  veh_wheels?: number | null
}

// 🤖 PDF Extraction API Full Response
export interface ExtractPdfResponse {
  extraction_status: string
  extracted_data: ExtractedPolicyData
  confidence_scores?: Record<string, number> | null
  errors?: string[] | null
  extraction_time: string
}

// 👤 Admin Manual Input Fields
export interface AdminInputData {
  // Transaction Configuration
  reporting_month?: string | null
  booking_date?: string | null
  agent_code?: string | null
  code_type?: string | null
  
  // Commission Configuration
  incoming_grid_percent?: number | null
  agent_commission_given_percent?: number | null
  extra_grid?: number | null
  commissionable_premium?: number | null
  
  // Payment Configuration
  payment_by?: string | null
  payment_method?: string | null
  payout_on?: string | null
  agent_extra_percent?: number | null
  payment_by_office?: string | null
  
  // Relationship Selection (using codes for compatibility)
  insurer_code?: string | null
  broker_code?: string | null
  admin_child_id?: number | null
}

// 🔄 Real-time Calculation Results
export interface CalculationResult {
  // Commission Calculations
  receivable_from_broker?: number | null
  extra_amount_receivable_from_broker?: number | null
  total_receivable_from_broker?: number | null
  total_receivable_from_broker_with_gst?: number | null
  
  // CutPay & Payout Calculations
  cut_pay_amount?: number | null
  agent_po_amt?: number | null
  agent_extra_amount?: number | null
  total_agent_po_amt?: number | null
}

// 📋 Main Transaction Type (Flat Structure - matches backend exactly)
export interface CutPayTransaction {
  // System Fields
  id: number
  status: string
  created_by?: string | null
  created_at: string
  updated_at: string
  
  // Document Fields
  policy_pdf_url?: string | null
  additional_documents?: Record<string, unknown> | null
  
  // 🤖 PDF Extracted Fields (flattened)
  policy_number?: string | null
  formatted_policy_number?: string | null
  major_categorisation?: string | null
  product_insurer_report?: string | null
  product_type?: string | null
  plan_type?: string | null
  customer_name?: string | null
  gross_premium?: number | null
  net_premium?: number | null
  od_premium?: number | null
  tp_premium?: number | null
  gst_amount?: number | null
  registration_no?: string | null
  make_model?: string | null
  model?: string | null
  vehicle_variant?: string | null
  gvw?: number | null
  rto?: string | null
  state?: string | null
  fuel_type?: string | null
  cc?: number | null
  age_year?: number | null
  ncb?: string | null
  discount_percent?: number | null
  business_type?: string | null
  seating_capacity?: number | null
  veh_wheels?: number | null
  
  // 👤 Admin Manual Input Fields (flattened)
  reporting_month?: string | null
  booking_date?: string | null
  agent_code?: string | null
  code_type?: string | null
  incoming_grid_percent?: number | null
  agent_commission_given_percent?: number | null
  extra_grid?: number | null
  commissionable_premium?: number | null
  payment_by?: string | null
  payment_method?: string | null
  payout_on?: string | null
  agent_extra_percent?: number | null
  payment_by_office?: string | null
  
  // 🔗 Relationship IDs (auto-populated from codes)
  insurer_id?: number | null
  broker_id?: number | null
  child_id_request_id?: string | null
  
  // 🔄 Auto-calculated Relationship Data
  insurer_name?: string | null
  broker_name?: string | null
  insurer_broker_code?: string | null
  cluster?: string | null
  
  // 🔄 Auto-calculated Commission Fields
  receivable_from_broker?: number | null
  extra_amount_receivable_from_broker?: number | null
  total_receivable_from_broker?: number | null
  total_receivable_from_broker_with_gst?: number | null
  cut_pay_amount?: number | null
  agent_po_amt?: number | null
  agent_extra_amount?: number | null
  total_agent_po_amt?: number | null
  
  // 📊 Progress Tracking Fields
  claimed_by?: string | null
  already_given_to_agent?: number | null
  po_paid_to_agent?: number | null
  running_bal?: number | null
  match_status?: string | null
  invoice_number?: string | null
  
  // 📝 Google Sheets Sync Status
  synced_to_cutpay_sheet?: boolean
  synced_to_master_sheet?: boolean
  cutpay_sheet_row_id?: string | null
  master_sheet_row_id?: string | null
  
  // Additional Notes
  notes?: string | null
  
  // 🆕 Missing Legacy/Additional Fields from API
  policy_holder_name?: string | null
  policy_start_date?: string | null
  policy_end_date?: string | null
  premium_amount?: number | null
  sum_insured?: number | null
  insurance_type?: string | null
  gross_amount?: number | null
  commission_grid?: string | null
  payment_mode?: string | null
  payout_percent?: number | null
  payout_amount?: number | null
  amount_received?: number | null
  payment_source?: string | null
  payment_date?: string | null
  transaction_date?: string | null
}

// 📝 Request Types
export interface CreateCutPayRequest {
  policy_pdf_url?: string | null
  additional_documents?: Record<string, unknown> | null
  extracted_data?: ExtractedPolicyData | null
  admin_input?: AdminInputData | null
  calculations?: CalculationResult | null
  claimed_by?: string | null
  already_given_to_agent?: number | null
  po_paid_to_agent?: number | null
  running_bal?: number | null
  match_status?: string | null
  invoice_number?: string | null
  status?: string | null
  notes?: string | null
}

// 📝 Calculation Request (for real-time calculations)
export interface CalculationRequest {
  gross_premium?: number | null
  net_premium?: number | null
  od_premium?: number | null
  tp_premium?: number | null
  incoming_grid_percent?: number | null
  extra_grid?: number | null
  commissionable_premium?: number | null
  agent_commission_given_percent?: number | null
  agent_extra_percent?: number | null
  payment_by?: string | null
  payout_on?: string | null
}

export type UpdateCutPayRequest = Partial<CreateCutPayRequest> & {
  // Allow updating any flattened fields directly
  policy_number?: string | null
  customer_name?: string | null
  gross_premium?: number | null
  reporting_month?: string | null
  agent_code?: string | null
  insurer_code?: string | null
  broker_code?: string | null
  // Add other fields that can be updated directly
}

// 📋 Dropdown Option Types
export interface InsurerOption {
  code: string
  name: string
  is_active: boolean
}

export interface BrokerOption {
  code: string
  name: string
  is_active: boolean
}

export interface AdminChildIdOption {
  id: number
  child_id: string
  insurer_name: string
  broker_name?: string | null
  code_type: string
  is_active: boolean
}

// 📋 Dropdown Response Types
export interface DropdownOptions {
  insurers: InsurerOption[]
  brokers: BrokerOption[]
  admin_child_ids: AdminChildIdOption[]
  code_types: string[]
  payment_by_options: string[]
  payout_on_options: string[]
  payment_by_office_options: string[]
  major_categorisation_options: string[]
  plan_type_options: string[]
  fuel_type_options: string[]
  business_type_options: string[]
}

export interface FilteredDropdownOptions {
  brokers: BrokerOption[]
  admin_child_ids: AdminChildIdOption[]
}

// 📋 List Response Types
export interface CutPayListResponse {
  transactions: CutPayTransaction[]
  total_count: number
  page: number
  page_size: number
}

export interface CutPayListParams {
  skip?: number
  limit?: number
  search?: string
  insurer_code?: string
  broker_code?: string
  date_from?: string
  date_to?: string
}

// 📊 Statistics Types
// 📊 Legacy Dashboard Statistics (backward compatibility)
export interface CutPayStats {
  total_transactions: number
  completed_transactions: number
  draft_transactions: number
  total_cut_pay_amount: number
  total_agent_payouts: number
  total_commission_receivable: number
  pending_sync_count: number
  monthly_stats: Record<string, { total_amount: number; transaction_count: number }>
  top_agents: { agent_code: string; total_cut_pay_amount: number; transaction_count: number }[]
  top_insurers: { insurer_name: string; total_cut_pay_amount: number; transaction_count: number }[]
}

// Use the comprehensive stats response as the main type
export type CutPayStatsResponse = {
  total_transactions: number
  completed_transactions: number
  draft_transactions: number
  total_cut_pay_amount: number
  total_agent_payouts: number
  total_commission_receivable: number
  pending_sync_count: number
  monthly_stats: Record<string, Record<string, number>>
  top_agents: Array<Record<string, unknown>>
  top_insurers: Array<Record<string, unknown>>
}

// 📄 Document Upload Types
export interface DocumentUploadResponse {
  document_url: string
  document_type: string
  upload_status: string
  message: string
}

// 🔍 PDF Extraction Types
export interface ExtractionResponse {
  cutpay_id: number
  extraction_status: string
  extracted_data?: ExtractedPolicyData | null
  confidence_scores?: Record<string, number>
  errors?: string[]
  extraction_time: string
}

// 📋 Transaction Summary for list views
export interface CutPaySummary {
  id: number
  policy_number?: string | null
  agent_code?: string | null
  code_type?: string | null
  payment_mode?: string | null
  cut_pay_amount?: number | null
  amount_received?: number | null
  transaction_date?: string | null
  status: string
  created_at: string
  insurer_name?: string | null
  broker_name?: string | null
  child_id?: string | null
}

// =========================================================================
// AGENT MANAGEMENT TYPES (Unchanged)
// ========================================================================= Agent Types
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

export interface ChildRequest {
  id: string
  user_id: string
  insurance_company: string | null
  broker: string | null
  location: string | null
  phone_number: string | null
  email: string | null
  preferred_rm_name: string | null
  status: ChildRequestStatus
  child_id: string | null
  broker_code: string | null
  branch_code: string | null
  region: string | null
  manager_name: string | null
  manager_email: string | null
  commission_percentage: number | null
  policy_limit: number | null
  admin_notes: string | null
  approved_by: string | null
  approved_at: string | null
  created_at: string
  updated_at: string
}

export interface AssignChildIdRequest {
  child_id: string
  broker_code: string
  branch_code?: string
  region?: string
  manager_name?: string
  manager_email?: string
  commission_percentage?: number
  policy_limit?: number
  admin_notes?: string
}

export interface ChildRequestListResponse {
  requests: ChildRequest[]
  total_count: number
  page: number
  page_size: number
}

export interface ChildRequestListParams {
  page?: number
  page_size?: number
  status?: ChildRequestStatus
  search?: string
}

export interface ChildRequestStatusUpdate {
  status: 'rejected' | 'suspended'
  reason?: string
  admin_notes?: string
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