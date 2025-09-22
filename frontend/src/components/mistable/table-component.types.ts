// table-component.types.ts - Shared types for MIS table components

// ===== COLUMN FILTER TYPES =====

export interface DateRange {
  start?: string;
  end?: string;
}

export interface NumberRange {
  min?: number;
  max?: number;
}

export interface ColumnFilter {
  type: 'values' | 'search' | 'date_range' | 'number_range';
  values?: string[];
  search?: string;
  dateRange?: DateRange;
  numberRange?: NumberRange;
}

export interface ColumnFilterDropdownProps {
  columnId: string;
  onFilter: (columnId: string, filter: ColumnFilter | null) => void;
  getUniqueValues: () => string[];
  currentFilter?: ColumnFilter;
  children: React.ReactNode;
}

// ===== COLUMN CONFIGURATION TYPES =====

export interface SelectOption {
  value: string;
  label: string;
}

export interface ColumnConfig<T = Record<string, string | number | boolean | null>> {
  id: string;
  header: string;
  kind: 'text' | 'number' | 'date' | 'select' | 'badge' | 'readonly' | 'currency';
  accessor?: (row: T) => string | number | boolean | null | undefined;
  editable?: boolean;
  enableSorting?: boolean;
  width?: number;
  options?: SelectOption[];
  formatter?: (value: string | number | boolean | null | undefined, row?: T) => string;
  required?: boolean;
  hidden?: (row: T, allData: T[]) => boolean;
}

export interface DataSourceResult<T> {
  data: { pages: { records: T[] }[] };
  error: Error | null;
  fetchNextPage: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isLoading: boolean;
}

export interface DataSource<T = Record<string, string | number | boolean | null>> {
  useList: () => DataSourceResult<T>;
}

export interface UpdatePayload {
  updates: Array<{ 
    id: string; 
    record_id?: string;
    field_name?: string;
    new_value?: string | number | boolean | null;
    old_value?: string | number | boolean | null;
  }>;
}

export interface UpdateResponse {
  successful_updates: number;
  total_updates?: number;
  failed_updates?: number;
  message?: string;
  results?: Array<{
    id: string;
    success: boolean;
    error?: string;
  }>;
  processing_time_seconds?: number;
}

export interface SaveAdapter {
  toUpdates: (pendingUpdates: Record<string, Record<string, string | number | boolean | null>>) => UpdatePayload;
  mutate: () => (payload: UpdatePayload) => Promise<UpdateResponse>;
}

export interface SortConfig {
  id: string;
  desc: boolean;
}

export interface TableConfig<T = Record<string, string | number | boolean | null>> {
  title?: string;
  className?: string;
  columns: ColumnConfig<T>[];
  pageSize?: number;
  enableSearch?: boolean;
  enableBulkEdit?: boolean;
  searchPlaceholder?: string;
  idAccessor: (row: T) => string;
  dataSource: DataSource<T>;
  saveAdapter: SaveAdapter;
  defaultSort?: SortConfig[];
}

export interface ClientFilteringResult<T = Record<string, string | number | boolean | null>> {
  rawData: T[];
  filteredData: T[];
  paginatedData: {
    data: T[];
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
  filters: Record<string, ColumnFilter>;
  pagination: {
    page: number;
    pageSize: number;
  };
  // Methods
  loadData: (data: T[]) => void;
  handleGlobalSearch: (searchTerm: string) => void;
  handleSort: (column: keyof T) => void;
  handleColumnFilter: (column: keyof T, selectedValues: Set<string>, isActive?: boolean) => void;
  handleColumnSearch: (column: keyof T, searchTerm: string) => void;
  handleDateRangeFilter: (column: string, from?: string, to?: string) => void;
  handleNumberRangeFilter: (column: string, min?: number, max?: number) => void;
  handleClearAllFilters: () => void;
  goToPage: (page: number) => void;
  changePageSize: (pageSize: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  getColumnUniqueValues: (column: string) => string[];
  getColumnFilter: (column: string) => ColumnFilter | undefined;
  hasActiveFilters: () => boolean;
  getFilterSummary: () => string;
  // Computed properties
  isFiltered: boolean;
  totalRecords: number;
  filteredRecords: number;
  visibleRecords: number;
}

export interface DataTableProps<T = Record<string, string | number | boolean | null>> {
  config: TableConfig<T>;
  onPendingChangesCount?: (count: number) => void;
  clientFiltering?: ClientFilteringResult<T>;
  availableSheets?: string[];
  selectedSheet?: string;
  onSheetChange?: (sheetName: string) => void;
}