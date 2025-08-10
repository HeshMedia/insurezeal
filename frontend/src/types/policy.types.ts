/* eslint-disable @typescript-eslint/no-explicit-any */
export interface Policy {
  id: string;
  agent_id: string;
  agent_code: string;
  child_id: string;
  broker_name: string;
  insurance_company: string;
  policy_number: string;
  formatted_policy_number: string;
  major_categorisation: string;
  product_insurer_report: string;
  product_type: string;
  plan_type: string;
  customer_name: string;
  customer_phone_number: string;
  policy_type: string;
  insurance_type: string;
  vehicle_type: string;
  registration_number: string;
  vehicle_class: string;
  vehicle_segment: string;
  make_model: string;
  model: string;
  vehicle_variant: string;
  gvw: number;
  rto: string;
  state: string;
  fuel_type: string;
  cc: number;
  age_year: number;
  ncb: string;
  discount_percent: number;
  business_type: string;
  seating_capacity: number;
  veh_wheels: number;
  is_private_car: boolean;
  gross_premium: number;
  gst: number;
  gst_amount: number;
  net_premium: number;
  od_premium: number;
  tp_premium: number;
  agent_commission_given_percent: number;
  agent_extra_percent: number;
  payment_by_office: number;
  total_agent_payout_amount: number;
  code_type: string;
  payment_by: string;
  payment_method: string;
  cluster: string;
  notes: string;
  start_date: string;
  end_date: string;
  uploaded_by: string;
  pdf_file_name: string;
  ai_confidence_score: number;
  manual_override: boolean;
  created_at: string;
  updated_at: string;
}

export interface PolicyListItem {
  id: string;
  policy_number: string;
  policy_type: string;
  insurance_type: string;
  agent_code: string;
  vehicle_type: string;
  registration_number: string;
  net_premium: number;
  start_date: string;
  end_date: string;
  created_at: string;
}

export interface ListPoliciesParams {
  page?: number;
  page_size?: number;
  policy_type?: string;
  agent_id?: string;
  search?: string;
}

export interface ListPoliciesResponse {
  policies: PolicyListItem[];
  total_count: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface ExtractPdfDataResponse {
  extracted_data: Record<string, any>;
  confidence_score: number;
  success: boolean;
  message: string;
}

export interface UploadPolicyPdfResponse {
  policy_id: string;
  extracted_data: Record<string, any>;
  confidence_score: number;
  pdf_file_path: string;
  pdf_file_name: string;
  message: string;
}

export interface SubmitPolicyPayload {
  // Required fields according to API
  policy_number: string;
  policy_type: string;
  pdf_file_path: string;
  pdf_file_name: string;
  
  // Agent and Child ID information
  agent_id?: string;
  agent_code?: string;
  child_id?: string;
  broker_name?: string;
  insurance_company?: string;
  
  // Complete policy details from PDF extraction (all fields from API spec)
  formatted_policy_number?: string;
  major_categorisation?: string;
  product_insurer_report?: string;
  product_type?: string;
  plan_type?: string;
  customer_name?: string;
  customer_phone_number?: string;
  insurance_type?: string;
  vehicle_type?: string;
  registration_number?: string;
  vehicle_class?: string;
  vehicle_segment?: string;
  make_model?: string;
  model?: string;
  vehicle_variant?: string;
  gvw?: number;
  rto?: string;
  state?: string;
  fuel_type?: string;
  cc?: number;
  age_year?: number;
  ncb?: string;
  discount_percent?: number;
  business_type?: string;
  seating_capacity?: number;
  veh_wheels?: number;
  is_private_car?: boolean;
  
  // Premium and financial details
  gross_premium?: number;
  gst?: number;
  gst_amount?: number;
  net_premium?: number;
  od_premium?: number;
  tp_premium?: number;
  
  // Agent commission and payout details
  agent_commission_given_percent?: number;
  agent_extra_percent?: number;
  payment_by_office?: number;
  total_agent_payout_amount?: number;
  
  // Administrative details
  code_type?: string;
  payment_by?: string;
  payment_method?: string;
  cluster?: string;
  notes?: string;
  
  // Date fields
  start_date?: string;
  end_date?: string;
  
  // AI and manual override
  ai_confidence_score?: number;
  manual_override?: boolean;
}

export interface UpdatePolicyPayload {
  agent_id?: string;
  agent_code?: string;
  child_id?: string;
  broker_name?: string;
  insurance_company?: string;
  policy_number?: string;
  policy_type?: string;
  insurance_type?: string;
  vehicle_type?: string;
  registration_number?: string;
  vehicle_class?: string;
  vehicle_segment?: string;
  gross_premium?: number;
  gst?: number;
  net_premium?: number;
  od_premium?: number;
  tp_premium?: number;
  payment_by_office?: number;
  total_agent_payout_amount?: number;
  start_date?: string;
  end_date?: string;
  manual_override?: boolean;
}

export interface ChildIdOption {
  child_id: string;
  broker_name: string;
  insurance_company: string;
}

export interface AgentOption {
  agent_id: string;
  agent_code: string;
  full_name: string;
}

export interface ExportCsvParams {
  start_date?: string;
  end_date?: string;
}

export interface ListAgentPoliciesParams {
  page?: number;
  page_size?: number;
  search?: string | null;
}