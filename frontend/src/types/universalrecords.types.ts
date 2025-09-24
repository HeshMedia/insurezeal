// GET /universal-records/insurers
export interface UniversalInsurersResponse {
  insurers: string[];
  total_count: number;
}

// POST /universal-records/preview
export interface UniversalPreviewParams {
  file: File;
  insurer_name: string;
  preview_rows?: number;
}

export interface UniversalPreviewResponse {
  insurer_name: string;
  mapped_headers: string[];
  original_headers: string[];
  preview_data: Record<string, string | number | null>[];
  total_rows: number;
  unmapped_headers: string[];
}

// POST /universal-records/upload
export interface UniversalUploadParams {
  file: File;
  insurer_name: string;
  quarters?: string;
  years?: string;
}

// A type for values within a record, to avoid using 'any'
type RecordValue = string | number | boolean | null;

export interface ReportStats {
  total_records_processed: number;
  total_records_updated: number;
  total_records_added: number;
  total_records_skipped: number;
  total_errors: number;
  processing_time_seconds: number;
  policy_records_updated: number;
  policy_records_added: number;
  cutpay_records_updated: number;
  cutpay_records_added: number;
  field_changes: Record<string, number>;
  error_details: string[];
}

export interface ChangeDetail {
  policy_number: string;
  record_type: string;
  action: 'updated' | 'added' | 'skipped' | 'error';
  changed_fields: Record<string, { old: RecordValue; new: RecordValue }>;
  previous_values: Record<string, RecordValue>;
  new_values: Record<string, RecordValue>;
  error_message: string | null;
}

export interface ReconciliationReport {
  stats: ReportStats;
  change_details: ChangeDetail[];
  insurer_name: string;
  file_info: Record<string, RecordValue>;
  processed_at: string;
  processed_by_user_id: string;
}

export interface UniversalUploadResponse {
  message: string;
  report: ReconciliationReport;
  processing_time_seconds: number;
  success: boolean;
}

// GET /universal-records/template
export interface UniversalTemplateParams {
  insurer_name?: string;
}

// GET /universal-records/reconciliation/summary
export interface ReconciliationSummaryParams {
  insurer_name?: string;
}

export interface MismatchedField {
  field_name: string;
  mismatch_count: number;
}

export interface ReconciliationSummaryResponse {
  coverage_percentage: number;
  data_variance_percentage: number;
  top_mismatched_fields: MismatchedField[];
  total_matches: number;
  total_mismatches: number;
  total_missing_in_system: number;
  total_missing_in_universal: number;
  total_policies_in_system: number;
  total_policies_in_universal_record: number;
}

// GET /universal-records/reconciliation
export interface ReconciliationReportsParams {
  insurer_name?: string;
  limit?: number;
  offset?: number;
}

export interface ReconciliationReportItem {
  id: string;
  insurer_name: string;
  insurer_code: string | null;
  created_at: string;
  total_records_processed: number;
  total_records_updated: number;
  new_records_added: number;
  data_variance_percentage: number;
  
  // All field variations from the API
  reporting_month_variations: number;
  child_id_variations: number;
  insurer_broker_code_variations: number;
  policy_start_date_variations: number;
  policy_end_date_variations: number;
  booking_date_variations: number;
  broker_name_variations: number;
  insurer_name_variations: number;
  major_categorisation_variations: number;
  product_variations: number;
  product_type_variations: number;
  plan_type_variations: number;
  gross_premium_variations: number;
  gst_amount_variations: number;
  net_premium_variations: number;
  od_premium_variations: number;
  tp_premium_variations: number;
  policy_number_variations: number;
  formatted_policy_number_variations: number;
  registration_no_variations: number;
  make_model_variations: number;
  model_variations: number;
  vehicle_variant_variations: number;
  gvw_variations: number;
  rto_variations: number;
  state_variations: number;
  cluster_variations: number;
  fuel_type_variations: number;
  cc_variations: number;
  age_year_variations: number;
  ncb_variations: number;
  discount_percentage_variations: number;
  business_type_variations: number;
  seating_capacity_variations: number;
  veh_wheels_variations: number;
  customer_name_variations: number;
  customer_number_variations: number;
  commissionable_premium_variations: number;
  incoming_grid_percentage_variations: number;
  receivable_from_broker_variations: number;
  extra_grid_variations: number;
  extra_amount_receivable_variations: number;
  total_receivable_from_broker_variations: number;
  claimed_by_variations: number;
  payment_by_variations: number;
  payment_mode_variations: number;
  cut_pay_amount_received_variations: number;
  already_given_to_agent_variations: number;
  actual_agent_po_percentage_variations: number;
  agent_po_amt_variations: number;
  agent_extra_percentage_variations: number;
  agent_extra_amount_variations: number;
  agent_total_po_amount_variations: number;
  payment_by_office_variations: number;
  po_paid_to_agent_variations: number;
  running_bal_variations: number;
  total_receivable_gst_variations: number;
  iz_total_po_percentage_variations: number;
  as_per_broker_po_percentage_variations: number;
  as_per_broker_po_amt_variations: number;
  po_percentage_diff_broker_variations: number;
  po_amt_diff_broker_variations: number;
  actual_agent_po_percentage_2_variations: number;
  as_per_agent_payout_percentage_variations: number;
  as_per_agent_payout_amount_variations: number;
  po_percentage_diff_agent_variations: number;
  po_amt_diff_agent_variations: number;
  invoice_status_variations: number;
  invoice_number_variations: number;
  remarks_variations: number;
  match_variations: number;
  agent_code_variations: number;
}

export interface ReconciliationReportsResponse {
  reports: ReconciliationReportItem[];
  total_count: number;
}

// GET /universal-records/mappings/{insurer_name}
export interface InsurerMappingResponse {
  [key: string]: string;
}