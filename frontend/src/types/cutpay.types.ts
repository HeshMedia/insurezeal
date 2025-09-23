// Base interfaces for cutpay transaction data

// Extracted data from policy document
export interface ExtractedPolicyData {
  insurance_company: string | null | undefined
  policy_number?: string | null
  formatted_policy_number?: string | null
  major_categorisation?: string | null
  product_insurer_report?: string | null
  product_type?: string | null
  plan_type?: string | null
  customer_name?: string | null
  customer_phone_number?: string | null
  // Policy type and insurance details
  insurance_type?: string | null
  vehicle_type?: string | null
  // Premium details
  gross_premium?: number | null
  net_premium?: number | null
  od_premium?: number | null
  tp_premium?: number | null
  gst_amount?: number | null
  registration_number?: string | null 
  make_model?: string | null
  model?: string | null
  vehicle_variant?: string | null
  vehicle_class?: string | null
  vehicle_segment?: string | null
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
  is_private_car?: boolean | null
  start_date?: string | null
  end_date?: string | null
  // AI-detected insurer and broker names for validation
  ai_detected_insurer_name?: string | null
  ai_detected_broker_name?: string | null
}

// PDF extraction response
export interface ExtractPdfResponse {
  extraction_status: string
  extracted_data: ExtractedPolicyData | null
  confidence_scores?: Record<string, number>
  errors?: string[]
  extraction_time: string
}

export interface AdminInputData {
  reporting_month?: string | null;
  booking_date?: string | null;
  agent_code?: string | null;
  code_type?: string | null;
  incoming_grid_percent?: number | null;
  agent_commission_given_percent?: number | null;
  extra_grid?: number | null;
  commissionable_premium?: number | null;
  payment_by?: string | null;
  payment_method?: string | null;
  payment_detail?: string | null; // New field for payment detail
  payout_on?: string | null;
  agent_extra_percent?: number | null;
  payment_by_office?: string | null;
  insurer_code?: string | null;
  broker_code?: string | null;
  admin_child_id?: string | null;
  
  // Date fields for policy periods
  start_date?: string | null;
  end_date?: string | null;
  
  // Additional administrative fields
  cluster?: string | null;
  
  // OD+TP specific percentage fields
  od_agent_payout_percent?: number | null;
  tp_agent_payout_percent?: number | null;
  od_incoming_grid_percent?: number | null;
  tp_incoming_grid_percent?: number | null;
  od_incoming_extra_grid?: number | null;
  tp_incoming_extra_grid?: number | null;
}


export interface CreateCutpayTransactionCutpayPostRequest {
  policy_pdf_url?: null | string;
  additional_documents?: { [key: string]: unknown } | null;
  extracted_data?: null | ExtractedPolicyData;
  admin_input?: null | AdminInputData;
  calculations?: null | CalculationResult;
  claimed_by?: null | string;
  running_bal?: number | 0;
  cutpay_received?: number | 0;
  notes?: null | string;


}

export interface CalculationResult {
  receivable_from_broker?: number | null;
  extra_amount_receivable_from_broker?: number | null;
  total_receivable_from_broker?: number | null;
  total_receivable_from_broker_with_gst?: number | null;
  cut_pay_amount?: number | null;
  agent_po_amt?: number | null;
  agent_extra_amount?: number | null;
  total_agent_po_amt?: number | null;
  iz_total_po_percent?: number | null;
  already_given_to_agent?: number | null;
  broker_payout_amount?: number | null;
}

// Update cutpay transaction request
// Form Field Configuration Types
export interface FormFieldOption {
  value: string
  label: string
}

export interface FormFieldConditional {
  field: string
  value: string | number | null
}

export interface FormFieldConfig {
  key: string
  label: string
  type: 'text' | 'number' | 'select' | 'date' | 'month'
  section: 'extracted' | 'admin' | 'calculation'
  options?: FormFieldOption[]
  conditional?: FormFieldConditional
  disabled?: boolean
}

// Update cutpay transaction request
export interface UpdateCutPayRequest {
  policypdfurl?: null | string;
  additionalDocuments?: { [key: string]: unknown } | null;
  extractedData?: null | ExtractedPolicyData;
  adminInput?: null | AdminInputData;
  calculations?: null | CalculationResult;
  claimedBy?: null | string;
  runningbal?: number | 0;
  cutpay_recieved?: string | "0";
  notes?: null | string;

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
  registration_number: string | null
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
  iz_total_po_percent: number | null
  broker_po_percent: number | null
  broker_payout_amount: number | null
  invoice_status: string | null
  remarks: string | null
  company: string | null
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
  upload_url?: string
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

// Bulk Post-Cutpay Details
export interface PostCutpayDetails {
  already_given_to_agent?: number;
  iz_total_po_percent?: number;
  broker_po_percent?: number;
  broker_payout_amount?: number;
  invoice_status?: string;
  remarks?: string;
  company?: string;
}

export interface BulkPostCutpayRequest {
  cutpay_ids: number[];
  details: PostCutpayDetails;
}

export interface BulkPostCutpayResponse {
  success_count: number;
  failed_count: number;
  successful_ids: number[];
  failed_updates: Array<Record<string, unknown>>;
  updated_records: CutPayTransaction[];
}

// Agent Configuration Types
export interface AgentConfig {
  id: number;
  agent_code: string;
  date: string;
  payment_mode: string;
  payment_mode_detail: string;
  po_paid_to_agent: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateAgentConfigRequest {
  agent_code: string;
  config_date: string;
  payment_mode: string;
  payment_mode_detail: string;
  po_paid_to_agent: number;
}

export interface UpdateAgentConfigRequest {
  payment_mode?: string;
  payment_mode_detail?: string;
  po_paid_to_agent?: number;
}

export interface ListAgentConfigsParams {
  agent_code?: string;
  date_from?: string;
  date_to?: string;
  skip?: number;
  limit?: number;
}

// Policy-based API response types
export interface CutPayDatabaseResponse {
  id: number;
  policy_pdf_url?: string | null;
  additional_documents?: Record<string, unknown> | null;
  policy_number?: string | null;
  agent_code?: string | null;
  booking_date?: string | null;
  admin_child_id?: string | null;
  insurer_id?: number | null;
  broker_id?: number | null;
  child_id_request_id?: string | null;
  policy_start_date?: string | null;
  policy_end_date?: string | null;
  created_at: string;
  updated_at: string;
  quarter?: number | null;
  year?: number | null;
  quarter_sheet_name?: string | null;
}

export interface PolicyDetailsResponse {
  policy_number: string;
  quarter: number;
  year: number;
  quarter_sheet_name: string;
  database_record: CutPayDatabaseResponse | Record<string, unknown> | null;
  google_sheets_data: Record<string, string> | { error?: string };
  broker_name?: string;
  insurer_name?: string;
  found_in_database: boolean;
  found_in_sheets: boolean;
  quarter_sheet_exists: boolean;
  metadata?: Record<string, unknown>;
}

