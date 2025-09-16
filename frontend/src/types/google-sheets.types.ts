import { QuarterlySheetRecord } from "./admin-mis.types";
import { MasterSheetListParams, MasterSheetRecord, MasterSheetStats } from "./mis.types";

export interface SheetData {
  values?: string[][];
}

export interface AccessTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

export interface SheetProperties {
  title: string;
  sheetId: number;
  index: number;
}

export interface Sheet {
  properties: SheetProperties;
}



// Column-based filter state for each column
export interface ColumnFilter {
  column?: keyof QuarterlySheetRecord;
  selectedValues?: Set<string>;
  searchTerm?: string;
  isActive?: boolean;
}

// Client-side filter and sort state
export interface ClientSideFilters {
  globalSearch: string;
  columnFilters: Map<keyof QuarterlySheetRecord, ColumnFilter>;
  sortBy: keyof QuarterlySheetRecord | null;
  sortDirection: 'asc' | 'desc';
  dateRangeFilters: {
    [key: string]: {
      from?: string;
      to?: string;
    };
  };
  numberRangeFilters: {
    [key: string]: {
      min?: number;
      max?: number;
    };
  };
}


// Interface for pending changes for Google Sheets MIS
// { [record_id]: { [field_name]: new_value } }
export interface GoogleSheetsPendingUpdates {
  [recordId: string]: {
    [fieldName: string]: string;
  };
}

// Loading states for different Google Sheets MIS operations
export interface GoogleSheetsMISLoadingState {
  masterSheetData: boolean;
  masterSheetStats: boolean;
  masterSheetFields: boolean;
  exporting: boolean;
  bulkUpdating: boolean;
  sheetInfo: boolean;
}

// Error states for different Google Sheets MIS operations
export interface GoogleSheetsMISErrorState {
  masterSheetData: string | null;
  masterSheetStats: string | null;
  masterSheetFields: string | null;
  exporting: string | null;
  bulkUpdating: string | null;
  sheetInfo: string | null;
}

// Main Google Sheets MIS data state
export interface GoogleSheetsMISDataState {
  masterSheetRecords: MasterSheetRecord[];
  totalRecords: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
  stats: MasterSheetStats | null;
  fields: string[];
  lastUpdated: Date | null;
  sheetName: string | null;
  sheetId: string | null;
}

// Current filter/search parameters for Google Sheets MIS
export interface GoogleSheetsMISFiltersState extends MasterSheetListParams {
  // Additional UI-specific filters can go here
  sheetName?: string;
  refreshInterval?: number; // in milliseconds
}

// Google Sheets connection state
export interface GoogleSheetsConnectionState {
  isConnected: boolean;
  lastConnectionAttempt: Date | null;
  connectionError: string | null;
  authStatus: 'idle' | 'authenticating' | 'authenticated' | 'failed';
}

// Column-based filter state for each column
export interface ColumnFilter {
  column?: keyof QuarterlySheetRecord;
  selectedValues?: Set<string>;
  searchTerm?: string;
  isActive?: boolean;
}
