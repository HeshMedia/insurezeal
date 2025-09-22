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

// GET /universal-records/mappings/{insurer_name}
export interface InsurerMappingResponse {
  [key: string]: string;
}