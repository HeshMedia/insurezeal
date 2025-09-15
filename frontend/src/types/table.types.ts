import { QuarterlySheetRecord } from './admin-mis.types';
// types/datatable.types.ts

export interface ColumnConfig {
  id: string;                    // Field identifier - must match exact API field name
  header: string;                // Display header
  kind: 'text' | 'number' | 'date' | 'select' | 'badge' | 'readonly' | 'currency';
  
  // Field mapping (for complex data extraction)
  accessor?: (row: any) => any;  // Custom data extraction function
  
  // Behavior settings
  editable?: boolean;            // Can users edit this cell?
  enableSorting?: boolean;       // Can users sort by this column?
  width?: number;                // Column width
  
  // For select dropdowns
  options?: { value: string; label: string }[];
  
  // Custom display logic
  formatter?: (value: any, row: any) => string; // Returns HTML string
  
  // Validation and conditional display
  required?: boolean;
  hidden?: (row: any, allData: any[]) => boolean;  // Dynamic hiding
}

export interface DataSourceAdapter<T> {
  useList: (queryParams: Record<string, any>) => {
    data?: { pages: { records: T[] }[] };
    error?: any;
    fetchNextPage: () => void;
    hasNextPage?: boolean;
    isFetchingNextPage?: boolean;
    isLoading?: boolean;
  };
}

export interface SaveAdapter {
  toUpdates: (
    pendingUpdates: Record<string, Record<string, unknown>>,
    columns: ColumnConfig[]
  ) => { updates: any[] };
  mutate: () => (payload: any) => Promise<any>;
}

export interface TableConfig<T> {
  columns: ColumnConfig[];           // Like formFields array
  dataSource: DataSourceAdapter<T>;  // Where to get data from  
  saveAdapter: SaveAdapter;          // How to save changes
  idAccessor: (row: T) => string;    // How to get unique ID
  
  // Optional settings (like InputForm props)
  title?: string;                    
  pageSize?: number;                 
  enableBulkEdit?: boolean;          
  enableSearch?: boolean;            
  searchPlaceholder?: string;        
  defaultSort?: { id: string; desc?: boolean }[];
  className?: string;
  
  // Role-based permissions
  userRole?: 'admin' | 'agent' | 'superadmin';
}

export interface DataTableProps<T> {
  config: TableConfig<T>;
  onPendingChangesCount?: (count: number) => void;
}


// types/table.types.ts - Clean table configuration types
export interface ColumnDefinition {
  id: string;
  header: string;
  field: string;
  type: 'text' | 'number' | 'date' | 'currency' | 'select' | 'boolean';
  editable?: boolean;
  sortable?: boolean;
  filterable?: boolean;
  width?: number;
  formatter?: (value: any) => string;
  options?: Array<{ value: string; label: string }>;
}

export interface TableConfiguration {
  id: string;
  title: string;
  columns: ColumnDefinition[];
  pageSize?: number;
  enableBulkEdit?: boolean;
  enableExport?: boolean;
}

export interface SortConfiguration {
  field: string;
  direction: 'asc' | 'desc';
}

export interface FilterConfiguration {
  field: string;
  type: 'text' | 'select' | 'date_range' | 'number_range';
  value: any;
  operator?: 'equals' | 'contains' | 'starts_with' | 'greater_than' | 'less_than';
}

export interface PaginationConfiguration {
  page: number;
  pageSize: number;
  totalRecords: number;
  totalPages: number;
}


// types/filter.types.ts - Centralized filtering types
export interface BaseFilter {
  field: string;
  isActive: boolean;
}

export interface TextFilter extends BaseFilter {
  type: 'text';
  value: string;
  operator: 'contains' | 'equals' | 'starts_with' | 'ends_with';
}

export interface SelectFilter extends BaseFilter {
  type: 'select';
  selectedValues: Set<string>;
}

export interface DateRangeFilter extends BaseFilter {
  type: 'date_range';
  startDate?: string;
  endDate?: string;
}

export interface NumberRangeFilter extends BaseFilter {
  type: 'number_range';
  minValue?: number;
  maxValue?: number;
}

export type FilterType = TextFilter | SelectFilter | DateRangeFilter | NumberRangeFilter;

export interface FilterState {
  globalSearch: string;
  columnFilters: Map<string, FilterType>;
  quickFilters: Record<string, any>;
}

export interface FilterOperations {
  setGlobalSearch: (search: string) => void;
  setColumnFilter: (field: string, filter: FilterType | null) => void;
  clearAllFilters: () => void;
  applyQuickFilter: (key: string, value: any) => void;
}

export interface SortOptions {
  field: keyof QuarterlySheetRecord;
  direction: 'asc' | 'desc';
}

export interface PaginationOptions {
  page: number;
  limit: number;
}
