// Represents a single record from the Master Google Sheet
export interface MasterSheetRecord {
  id: string;
  reporting_month: string;
  booking_date: string;
  agent_code: string;
  code_type: string;
  insurer_name: string;
  broker_name: string;
  insurer_broker_code: string;
  policy_number: string;
  formatted_policy_number: string;
  customer_name: string;
  customer_phone_number: string;
  major_categorisation: string;
  product_insurer_report: string;
  product_type: string;
  plan_type: string;
  gross_premium: string;
  net_premium: string;
  od_premium: string;
  tp_premium: string;
  gst_amount: string;
  commissionable_premium: string;
  registration_number: string;
  make_model: string;
  model: string;
  vehicle_variant: string;
  gvw: string;
  rto: string;
  state: string;
  cluster: string;
  fuel_type: string;
  cc: string;
  age_year: string;
  ncb: string;
  discount_percent: string;
  business_type: string;
  seating_capacity: string;
  vehicle_wheels: string;
  incoming_grid_perc: string;
  agent_commission_perc: string;
  extra_grid_perc: string;
  agent_extra_perc: string;
  payment_by: string;
  payment_method: string;
  payout_on: string;
  payment_by_office: string;
  receivable_from_broker: string;
  extra_amount_receivable: string;
  total_receivable: string;
  total_receivable_with_gst: string;
  cut_pay_amount: string;
  agent_po_amount: string;
  agent_extra_amount: string;
  total_agent_po: string;
  claimed_by: string;
  running_balance: string;
  cutpay_received: string;
  already_given_to_agent: string;
  iz_total_po_percent: string;
  broker_po_percent: string;
  broker_payout_amount: string;
  invoice_status: string;
  remarks: string;
  company: string;
  notes: string;
  created_at: string;
  updated_at: string;
  row_number: number;
}

// Balance Sheet / Summary Stats Types
export interface BalanceSheetRecord {
  'Agent Code': string;
  'Running Balance (True)': string;
  'Net Premium (True)': string;
  'Commissionable Premium (True)': string;
  'Policy Count (True)': string;
  'Running Balance (True&False)': string;
  'Net Premium (True&False)': string;
  'Commissionable Premium (True&False)': string;
  'Policy Count (True&False)': string;
}

// View modes for balance sheet display
export type BalanceSheetViewMode = 'admin' | 'agent-expanded';

// Column configuration for different views
export interface BalanceSheetColumnConfig {
  key: keyof BalanceSheetRecord;
  label: string;
  isAgentColumn: boolean; // true for "True" columns, false for "True&False" columns
  format: 'currency' | 'number' | 'text';
}

// Parameters for fetching the master sheet list
export interface MasterSheetListParams {
  page?: number;
  page_size?: number;
  search?: string;
  agent_code?: string;
  insurer_name?: string;
  policy_number?: string;
  reporting_month?: string;
  code_type?: string;
  booking_date_from?: string;
  booking_date_to?: string;
  product_type?: string;
  payment_by?: string;
  invoice_status?: string;
  major_categorisation?: string;
  state?: string;
  broker_name?: string;
}

// Response for the master sheet list endpoint
export interface MasterSheetListResponse {
  records: MasterSheetRecord[];
  total_count: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// A single update item for the bulk update request
export interface BulkUpdateItem {
  record_id: string;
  field_name: string;
  new_value: string;
}

// Request body for the bulk update endpoint
export interface BulkUpdateRequest {
  updates: BulkUpdateItem[];
}

// A single result item from the bulk update response
export interface BulkUpdateResultItem {
  record_id: string;
  field_name: string;
  old_value: string;
  new_value: string;
  success: boolean;
  error_message: string;
}

// Response from the bulk update endpoint
export interface BulkUpdateResponse {
  message: string;
  total_updates: number;
  successful_updates: number;
  failed_updates: number;
  results: BulkUpdateResultItem[];
  processing_time_seconds: number;
}

// NOTE: The following types are based on reasonable assumptions as the API
// documentation for stats is generic. They provide structure and avoid 'any'.
export interface TopAgentStat {
  agent_code: string;
  total_gross_premium: number;
}

export interface TopInsurerStat {
  insurer_name: string;
  total_gross_premium: number;
}

export interface MonthlySummaryStat {
  month: string;
  total_gross_premium: number;
  total_policies: number;
}

// Statistics from the master sheet (Balance Sheet / Summary Stats)
export interface MasterSheetStats {
  sheet_name: string;
  total_rows: number;
  total_columns: number;
  headers: string[];
  data: BalanceSheetRecord[];
  last_updated: string;
}

// Parameters for exporting master sheet data
export interface MasterSheetExportParams {
  format?: 'csv' | 'json';
  search?: string;
  agent_code?: string;
}