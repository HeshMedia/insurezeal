// Base interfaces for cutpay transaction data

// Extracted data from policy document
export interface ExtractedPolicyData {
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
}

// PDF extraction response
export interface ExtractPdfResponse {
  extraction_status: string
  extracted_data: ExtractedPolicyData | null
  confidence_scores?: Record<string, number>
  errors?: string[]
  extraction_time: string
}

// Admin input data
export interface AdminInputData {
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
  insurer_code?: string | null
  broker_code?: string | null
  admin_child_id?: string | null
}

// Calculation results
export interface CalculationData {
  receivable_from_broker?: number | null
  extra_amount_receivable_from_broker?: number | null
  total_receivable_from_broker?: number | null
  total_receivable_from_broker_with_gst?: number | null
  cut_pay_amount?: number | null
  agent_po_amt?: number | null
  agent_extra_amount?: number | null
  total_agent_po_amt?: number | null
}

// Create cutpay transaction request (structured as per API schema)
export interface CreateCutPayRequest {
  policy_pdf_url: string
  additional_documents?: Record<string, unknown>
  extracted_data?: ExtractedPolicyData
  admin_input?: AdminInputData
  calculations?: CalculationData
  // Additional fields (flattened at root level)
  claimed_by?: string | null
  already_given_to_agent?: number | null
  po_paid_to_agent?: number | null
  running_bal?: number | null
  match_status?: string | null
  invoice_number?: string | null
  notes?: string | null
}

// Update cutpay transaction request
export interface UpdateCutPayRequest {
  policy_pdf_url?: string | null
  additional_documents?: Record<string, unknown> | null
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
  insurer_code?: string | null
  broker_code?: string | null
  admin_child_id?: string | null
  claimed_by?: string | null
  already_given_to_agent?: number | null
  po_paid_to_agent?: number | null
  running_bal?: number | null
  match_status?: string | null
  invoice_number?: string | null
  notes?: string | null
}

// Complete cutpay transaction response
export interface CutPayTransaction {
  id: number
  policy_pdf_url: string | null
  additional_documents: Record<string, unknown> | null
  policy_number: string | null
  formatted_policy_number: string | null
  major_categorisation: string | null
  product_insurer_report: string | null
  product_type: string | null
  plan_type: string | null
  customer_name: string | null
  gross_premium: number | null
  net_premium: number | null
  od_premium: number | null
  tp_premium: number | null
  gst_amount: number | null
  registration_no: string | null
  make_model: string | null
  model: string | null
  vehicle_variant: string | null
  gvw: number | null
  rto: string | null
  state: string | null
  fuel_type: string | null
  cc: number | null
  age_year: number | null
  ncb: string | null
  discount_percent: number | null
  business_type: string | null
  seating_capacity: number | null
  veh_wheels: number | null
  reporting_month: string | null
  booking_date: string | null
  agent_code: string | null
  code_type: string | null
  incoming_grid_percent: number | null
  agent_commission_given_percent: number | null
  extra_grid: number | null
  commissionable_premium: number | null
  payment_by: string | null
  payment_method: string | null
  payout_on: string | null
  agent_extra_percent: number | null
  payment_by_office: string | null
  insurer_id: number | null
  broker_id: number | null
  child_id_request_id: string | null
  insurer_name: string | null
  broker_name: string | null
  insurer_broker_code: string | null
  cluster: string | null
  receivable_from_broker: number | null
  extra_amount_receivable_from_broker: number | null
  total_receivable_from_broker: number | null
  total_receivable_from_broker_with_gst: number | null
  cut_pay_amount: number | null
  agent_po_amt: number | null
  agent_extra_amount: number | null
  total_agent_po_amt: number | null
  claimed_by: string | null
  already_given_to_agent: number | null
  po_paid_to_agent: number | null
  running_bal: number | null
  match_status: string | null
  invoice_number: string | null
  synced_to_cutpay_sheet: boolean
  synced_to_master_sheet: boolean
  cutpay_sheet_row_id: string | null
  master_sheet_row_id: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

// List cutpay transactions parameters
export interface CutPayListParams {
  broker_code?: string | null
  date_from?: string | null
  date_to?: string | null
  insurer_code?: string | null
  limit?: number
  search?: string | null
  skip?: number
}

// Document upload response
export interface CutPayDocumentUploadResponse {
  document_url: string
  document_type: string
  upload_status: string
  message: string
}

// Cutpay calculation request
export interface CutPayCalculationRequest {
  gross_premium: number
  net_premium: number
  od_premium: number
  tp_premium: number
  incoming_grid_percent: number
  extra_grid: number
  commissionable_premium: number
  agent_commission_given_percent: number
  agent_extra_percent: number
  payment_by: string
  payout_on: string
}

// Cutpay calculation response
export interface CutPayCalculationResponse {
  receivable_from_broker: number
  extra_amount_receivable_from_broker: number
  total_receivable_from_broker: number
  total_receivable_from_broker_with_gst: number
  cut_pay_amount: number
  agent_po_amt: number
  agent_extra_amount: number
  total_agent_po_amt: number
}

export interface CutPayDeleteResponse {
  message?: string
  success?: boolean
}

// Document types for upload
export type DocumentType = 
  | 'policy_pdf'
  | 'kyc_documents'
  | 'rc_document'
  | 'previous_policy'

// Match status options
export type MatchStatus = 
  | 'MATCHED'
  | 'UNMATCHED'
  | 'PARTIAL_MATCH'
  | 'PENDING'

// Payment methods
export type PaymentMethod = 
  | 'CASH'
  | 'CHEQUE'
  | 'ONLINE'
  | 'UPI'
  | 'NEFT'
  | 'RTGS'

// Code types
export type CodeType = 
  | 'DIRECT'
  | 'INDIRECT'
  | 'BROKER'
  | 'AGENT'

// Major categorisation types
export type MajorCategorisation = 
  | 'MOTOR'
  | 'HEALTH'
  | 'LIFE'
  | 'FIRE'
  | 'MARINE'
  | 'OTHER'

// Plan types
export type PlanType = 
  | 'COMPREHENSIVE'
  | 'THIRD_PARTY'
  | 'STANDALONE_OD'
  | 'SAOD'
  | 'STP'
  | 'COMP'