/**
 * Admin MIS Table Types
 * Comprehensive type definitions for Google Sheets integration and table management
 */

import { ColumnConfig, DataSource } from '@/components/mistable/table-component.types';
import { QuarterlySheetRecord } from './admin-mis.types';

// ===== SHEET MANAGEMENT TYPES =====

/**
 * Google Sheets API response structure for sheet information
 */
export interface SheetInfo {
  sheets: Array<{
    properties: {
      title: string;
      sheetId?: number;
      index?: number;
    };
  }>;
}

/**
 * Sheet selection and management state
 */
export interface SheetSelectionState {
  hasLoadedData: boolean;
  sheetInfo: SheetInfo | null;
  selectedSheet: string;
  availableSheets: string[];
}

/**
 * Quarter sheet detection patterns for auto-selection
 */
export interface QuarterSheetPatterns {
  quarterly: RegExp[];
  financial: RegExp[];
  monthly: RegExp[];
}

// ===== COLUMN CONFIGURATION TYPES =====

/**
 * Table sections for organizing columns logically
 */
export type TableSection = 
  | 'basic' 
  | 'customer' 
  | 'vehicle' 
  | 'financial' 
  | 'payment' 
  | 'tracking' 
  | 'administrative';

/**
 * Column tags for categorizing functionality
 */
export type ColumnTag = 
  | 'readonly' 
  | 'editable' 
  | 'calculated' 
  | 'status';

/**
 * Column input types for form rendering
 */
export type ColumnKind = 
  | 'text' 
  | 'date' 
  | 'select' 
  | 'currency' 
  | 'readonly' 
  | 'number' 
  | 'badge';

/**
 * Select option structure for dropdown columns
 */
export interface SelectOption {
  value: string;
  label: string;
  color?: string;
  disabled?: boolean;
}

/**
 * Status formatting configuration
 */
export interface StatusFormat {
  value: string;
  className: string;
  icon?: string;
}

/**
 * Extended column configuration for Master Sheet
 */
export interface MasterSheetColumnConfig extends ColumnConfig {
  key: string;
  id: string;
  header: string;
  kind: ColumnKind;
  section: TableSection;
  tag?: ColumnTag;
  editable: boolean;
  enableSorting: boolean;
  width?: number;
  options?: SelectOption[];
  formatter?: (value: unknown) => string;
  validator?: (value: unknown) => string | null;
  placeholder?: string;
  helpText?: string;
}

/**
 * Dynamic column generation options
 */
export interface DynamicColumnOptions {
  excludeKeys?: string[];
  defaultSection?: TableSection;
  defaultKind?: ColumnKind;
  customFormatters?: Record<string, (value: unknown) => string>;
  columnWidths?: Record<string, number>;
  readonlyColumns?: string[];
}

// ===== BULK UPDATE TYPES =====

/**
 * Individual field update request
 */
export interface FieldUpdateRequest {
  id: string;
  record_id: string;
  field_name: string;
  new_value: string;
  old_value?: string;
  [key: string]: unknown; // Index signature to satisfy SaveAdapter requirements
}

/**
 * Bulk update payload structure
 */
export interface BulkUpdatePayload {
  updates: FieldUpdateRequest[];
  sheet_name: string;
  validate_before_update?: boolean;
  backup_before_update?: boolean;
}

/**
 * Bulk update response structure
 */
export interface BulkUpdateResponse {
  successful_updates: number;
  total_updates: number;
  failed_updates: number;
  message: string;
  results: Array<{
    id: string;
    success: boolean;
    error?: string;
  }>;
  processing_time_seconds: number;
}

/**
 * Save adapter configuration for the table
 */
export interface MasterSheetSaveAdapter {
  toUpdates: (pendingUpdates: Record<string, Record<string, unknown>>) => BulkUpdatePayload;
  mutate: () => (payload: BulkUpdatePayload) => Promise<BulkUpdateResponse>;
}

// ===== CLIENT FILTERING TYPES =====

/**
 * Client-side filtering result structure
 */
export interface ClientFilteringResult {
  // Data states
  rawData: QuarterlySheetRecord[];
  filteredData: QuarterlySheetRecord[];
  paginatedData: {
    data: QuarterlySheetRecord[];
    page: number;
    pageSize: number;
    totalPages: number;
  };
  filteredStats: {
    totalRecords: number;
    filteredRecords: number;
    visibleRecords: number;
  };
  columnValues: Record<string, string[]>;
  filters: Record<string, unknown>;
  pagination: {
    page: number;
    pageSize: number;
  };

  // Methods
  loadData: (data: QuarterlySheetRecord[]) => void;
  handleGlobalSearch: (searchTerm: string) => void;
  handleSort: (column: keyof QuarterlySheetRecord) => void;
  handleColumnFilter: (column: keyof QuarterlySheetRecord, selectedValues: Set<string>, isActive?: boolean) => void;
  handleColumnSearch: (column: keyof QuarterlySheetRecord, searchTerm: string) => void;
  handleDateRangeFilter: (column: string, from?: string, to?: string) => void;
  handleNumberRangeFilter: (column: string, min?: number, max?: number) => void;
  handleClearAllFilters: () => void;
  goToPage: (page: number) => void;
  changePageSize: (pageSize: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  getColumnUniqueValues: (column: string) => string[];
  getColumnFilter: (column: string) => unknown;
  hasActiveFilters: () => boolean;
  getFilterSummary: () => string;

  // Computed properties
  isFiltered: boolean;
  totalRecords: number;
  filteredRecords: number;
  visibleRecords: number;
}

/**
 * Props for the main MIS table component
 */
export interface MISTableProps {
  onPendingChangesCount: (count: number) => void;
  clientFiltering: ClientFilteringResult;
  availableSheets: string[];
  selectedSheet: string;
  onSheetChange: (sheetName: string) => void;
  loading: boolean;
}

/**
 * Props for the wrapper component
 */
export interface MasterSheetTableWrapperProps {
  className?: string;
  autoSelectQuarterSheet?: boolean;
  defaultPageSize?: number;
  enableBulkEdit?: boolean;
  onSheetChange?: (sheetName: string) => void;
  onDataLoad?: (data: QuarterlySheetRecord[]) => void;
  onError?: (error: Error) => void;
}

/**
 * Table configuration specifically for Master Sheet
 */
export interface MasterSheetTableConfig {
  title: string;
  className: string;
  columns: Array<MasterSheetColumnConfig & {
    accessor: (row: QuarterlySheetRecord) => unknown;
  }>;
  pageSize: number;
  enableSearch: boolean;
  enableBulkEdit: boolean;
  searchPlaceholder: string;
  idAccessor: (row: QuarterlySheetRecord) => string;
  dataSource: DataSource;
  saveAdapter: MasterSheetSaveAdapter;
  defaultSort: Array<{ id: string; desc: boolean }>;
}

// ===== HOOK RETURN TYPES =====

/**
 * Return type for useGoogleSheetsMIS hook
 */
export interface UseGoogleSheetsMISReturn {
  clientFiltering: ClientFilteringResult;
  fetchSheetData: (sheetName: string) => Promise<void>;
  bulkUpdateSheetData: (sheetName: string, payload: BulkUpdatePayload) => Promise<BulkUpdateResponse>;
  getSheetInfo: () => Promise<SheetInfo>;
  isReady: boolean;
  loading: {
    masterSheetData: boolean;
    sheetInfo: boolean;
    bulkUpdate: boolean;
  };
  errors: {
    masterSheetData: string | null;
    sheetInfo: string | null;
    bulkUpdate: string | null;
  };
}

// ===== UTILITY TYPES =====

/**
 * Field path type for type-safe column key access
 */
export type MasterSheetFieldPath = keyof QuarterlySheetRecord;

/**
 * Error handling types
 */
export interface TableError {
  type: 'FETCH_ERROR' | 'UPDATE_ERROR' | 'VALIDATION_ERROR' | 'NETWORK_ERROR';
  message: string;
  details?: unknown;
  timestamp: Date;
}

/**
 * Loading states for different operations
 */
export interface LoadingStates {
  initialLoad: boolean;
  sheetSwitch: boolean;
  dataRefresh: boolean;
  bulkUpdate: boolean;
}

/**
 * Sheet metadata for better organization
 */
export interface SheetMetadata {
  name: string;
  type: 'quarterly' | 'monthly' | 'annual' | 'summary' | 'archive';
  recordCount?: number;
  lastModified?: Date;
  isQuarterSheet: boolean;
}

// ===== CONSTANTS TYPES =====

/**
 * Predefined column configurations
 */
export interface PredefinedColumns {
  basic: MasterSheetColumnConfig[];
  financial: MasterSheetColumnConfig[];
  customer: MasterSheetColumnConfig[];
  vehicle: MasterSheetColumnConfig[];
  administrative: MasterSheetColumnConfig[];
}

/**
 * Status options for various status fields
 */
export interface StatusOptions {
  invoiceStatus: SelectOption[];
  policyStatus: SelectOption[];
  paymentStatus: SelectOption[];
}

// ===== EXPORT ALL TYPES =====
export type {
  QuarterlySheetRecord
} from '@/types/admin-mis.types';