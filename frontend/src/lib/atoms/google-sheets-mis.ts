import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import { MasterSheetStats, MasterSheetListParams } from '@/types/mis.types';
import { QuarterlySheetRecord } from '@/types/admin-mis.types';

// Interface for pending changes for Google Sheets MIS
// { [record_id]: { [field_name]: new_value } }
export interface GoogleSheetsPendingUpdates {
  [recordId: string]: {
    [fieldName: string]: string;
  };
}

// Interface for multi-select functionality
export interface SelectedCell {
  recordId: string;
  fieldName: string;
  rowIndex: number;
  columnIndex: number;
  currentValue: string;
}

export interface MultiSelectState {
  selectedCells: SelectedCell[];
  isSelecting: boolean;
  selectionStart: SelectedCell | null;
  dragFillSource: SelectedCell | null;
  isDragFilling: boolean;
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
  masterSheetRecords: QuarterlySheetRecord[];
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

// =============================================================================
// ATOMS
// =============================================================================

// Atom to store pending updates for the Google Sheets master sheet
export const googleSheetsPendingUpdatesAtom = atom<GoogleSheetsPendingUpdates>({});

// Atom for loading states
export const googleSheetsMISLoadingStateAtom = atom<GoogleSheetsMISLoadingState>({
  masterSheetData: false,
  masterSheetStats: false,
  masterSheetFields: false,
  exporting: false,
  bulkUpdating: false,
  sheetInfo: false,
});

// Atom for error states
export const googleSheetsMISErrorStateAtom = atom<GoogleSheetsMISErrorState>({
  masterSheetData: null,
  masterSheetStats: null,
  masterSheetFields: null,
  exporting: null,
  bulkUpdating: null,
  sheetInfo: null,
});

// Atom for main Google Sheets MIS data
export const googleSheetsMISDataStateAtom = atom<GoogleSheetsMISDataState>({
  masterSheetRecords: [],
  totalRecords: 0,
  totalPages: 0,
  currentPage: 1,
  pageSize: 50,
  stats: null,
  fields: [],
  lastUpdated: null,
  sheetName: null,
  sheetId: process.env.NEXT_PUBLIC_GOOGLE_SHEETS_ID || null,
});

// Atom for multi-select functionality
export const multiSelectStateAtom = atom<MultiSelectState>({
  selectedCells: [],
  isSelecting: false,
  selectionStart: null,
  dragFillSource: null,
  isDragFilling: false,
});

// Atom for current filters/search parameters
export const googleSheetsMISFiltersStateAtom = atom<GoogleSheetsMISFiltersState>({
  page: 1,
  page_size: 50,
  refreshInterval: 0, // Disabled by default to prevent infinite loops
});

// Atom for Google Sheets connection state
export const googleSheetsConnectionStateAtom = atom<GoogleSheetsConnectionState>({
  isConnected: false,
  lastConnectionAttempt: null,
  connectionError: null,
  authStatus: 'idle',
});

// =============================================================================
// DERIVED ATOMS
// =============================================================================

// Derived atom for checking if there are pending updates
export const googleSheetsHasPendingUpdatesAtom = atom((get) => {
  const pendingUpdates = get(googleSheetsPendingUpdatesAtom);
  return Object.keys(pendingUpdates).length > 0;
});

// Derived atom for counting total pending updates
export const googleSheetsPendingUpdatesCountAtom = atom((get) => {
  const pendingUpdates = get(googleSheetsPendingUpdatesAtom);
  return Object.values(pendingUpdates).reduce(
    (total, recordUpdates) => total + Object.keys(recordUpdates).length,
    0
  );
});

// Derived atom for checking if any operation is loading
export const googleSheetsIsAnyOperationLoadingAtom = atom((get) => {
  const loadingState = get(googleSheetsMISLoadingStateAtom);
  return Object.values(loadingState).some(Boolean);
});

// Derived atom for getting the first error (if any)
export const googleSheetsFirstErrorAtom = atom((get) => {
  const errorState = get(googleSheetsMISErrorStateAtom);
  const errors = Object.values(errorState).filter(Boolean);
  return errors.length > 0 ? errors[0] : null;
});

// Derived atom for checking if ready to fetch data
export const googleSheetsIsReadyToFetchAtom = atom((get) => {
  const connectionState = get(googleSheetsConnectionStateAtom);
  const loadingState = get(googleSheetsMISLoadingStateAtom);
  
  return (
    connectionState.isConnected &&
    connectionState.authStatus === 'authenticated' &&
    !loadingState.masterSheetData
  );
});

// =============================================================================
// WRITE-ONLY ATOMS (ACTIONS)
// =============================================================================

// Write-only atom for clearing all errors
export const googleSheetsClearAllErrorsAtom = atom(null, (get, set) => {
  set(googleSheetsMISErrorStateAtom, {
    masterSheetData: null,
    masterSheetStats: null,
    masterSheetFields: null,
    exporting: null,
    bulkUpdating: null,
    sheetInfo: null,
  });
});

// Write-only atom for clearing pending updates
export const googleSheetsClearPendingUpdatesAtom = atom(null, (get, set) => {
  set(googleSheetsPendingUpdatesAtom, {});
});

// Write-only atom for adding a pending update
export const googleSheetsAddPendingUpdateAtom = atom(
  null,
  (get, set, update: { recordId: string; fieldName: string; newValue: string }) => {
    const current = get(googleSheetsPendingUpdatesAtom);
    const newState = { ...current };
    
    if (!newState[update.recordId]) {
      newState[update.recordId] = {};
    }
    
    newState[update.recordId][update.fieldName] = update.newValue;
    set(googleSheetsPendingUpdatesAtom, newState);
  }
);

// Write-only atom for removing a pending update
export const googleSheetsRemovePendingUpdateAtom = atom(
  null,
  (get, set, update: { recordId: string; fieldName?: string }) => {
    const current = get(googleSheetsPendingUpdatesAtom);
    const newState = { ...current };
    
    if (update.fieldName) {
      // Remove specific field update
      if (newState[update.recordId]) {
        delete newState[update.recordId][update.fieldName];
        if (Object.keys(newState[update.recordId]).length === 0) {
          delete newState[update.recordId];
        }
      }
    } else {
      // Remove all updates for this record
      delete newState[update.recordId];
    }
    
    set(googleSheetsPendingUpdatesAtom, newState);
  }
);

// Write-only atom for setting loading state
export const googleSheetsSetLoadingStateAtom = atom(
  null,
  (get, set, update: Partial<GoogleSheetsMISLoadingState>) => {
    const current = get(googleSheetsMISLoadingStateAtom);
    set(googleSheetsMISLoadingStateAtom, { ...current, ...update });
  }
);

// Write-only atom for setting error state
export const googleSheetsSetErrorStateAtom = atom(
  null,
  (get, set, update: Partial<GoogleSheetsMISErrorState>) => {
    const current = get(googleSheetsMISErrorStateAtom);
    set(googleSheetsMISErrorStateAtom, { ...current, ...update });
  }
);

// Write-only atom for setting data state
export const googleSheetsSetDataStateAtom = atom(
  null,
  (get, set, update: Partial<GoogleSheetsMISDataState>) => {
    const current = get(googleSheetsMISDataStateAtom);
    set(googleSheetsMISDataStateAtom, { 
      ...current, 
      ...update,
      lastUpdated: new Date()
    });
  }
);

// Write-only atom for setting filters state
export const googleSheetsSetFiltersStateAtom = atom(
  null,
  (get, set, update: Partial<GoogleSheetsMISFiltersState>) => {
    const current = get(googleSheetsMISFiltersStateAtom);
    set(googleSheetsMISFiltersStateAtom, { ...current, ...update });
  }
);

// Write-only atom for setting connection state
export const googleSheetsSetConnectionStateAtom = atom(
  null,
  (get, set, update: Partial<GoogleSheetsConnectionState>) => {
    const current = get(googleSheetsConnectionStateAtom);
    set(googleSheetsConnectionStateAtom, { 
      ...current, 
      ...update,
      lastConnectionAttempt: update.authStatus ? new Date() : current.lastConnectionAttempt
    });
  }
);

// Write-only atom for refreshing data (triggers a data fetch)
export const googleSheetsRefreshDataAtom = atom(
  null,
  async (get, set) => {
    // This will be implemented in the service layer
    // For now, just reset the lastUpdated to trigger a refetch
    const current = get(googleSheetsMISDataStateAtom);
    set(googleSheetsMISDataStateAtom, { 
      ...current, 
      lastUpdated: null 
    });
  }
);

// =============================================================================
// SHEET DATA STATE MANAGEMENT - For storing fetched data to avoid refetching
// =============================================================================

// Interface for sheet data state
export interface SheetDataState {
  data: QuarterlySheetRecord[];
  lastFetched: Date;
  sheetName: string;
}

// Interface for the sheet data map
export interface GoogleSheetsDataMap {
  [sheetName: string]: SheetDataState;
}

// Atom to store sheet data in memory (no persistence)
export const googleSheetsDataMapAtom = atom<GoogleSheetsDataMap>({});

// Atom to get data for a specific sheet
export const getSheetDataAtom = atom(
  (get) => (sheetName: string): SheetDataState | null => {
    const dataMap = get(googleSheetsDataMapAtom);
    return dataMap[sheetName] || null;
  }
);

// Write-only atom to set data for a specific sheet
export const setSheetDataAtom = atom(
  null,
  (get, set, { sheetName, data }: { sheetName: string; data: QuarterlySheetRecord[] }) => {
    const current = get(googleSheetsDataMapAtom);
    const newSheetData: SheetDataState = {
      data,
      lastFetched: new Date(),
      sheetName
    };
    
    set(googleSheetsDataMapAtom, {
      ...current,
      [sheetName]: newSheetData
    });
  }
);

// Write-only atom to clear data for a specific sheet or all sheets
export const clearSheetDataAtom = atom(
  null,
  (get, set, sheetName?: string) => {
    const current = get(googleSheetsDataMapAtom);
    
    if (sheetName) {
      // Clear specific sheet
      const { ...rest } = current;
      set(googleSheetsDataMapAtom, rest);
    } else {
      // Clear all sheet data
      set(googleSheetsDataMapAtom, {});
    }
  }
);

// Unified view mode for all three components (MIS table, balance sheet, broker sheet)
export type ViewMode = 'mis-table' | 'balance-sheet' | 'broker-sheet' | 'super-admin-reports';

export const unifiedViewModeAtom = atom<ViewMode>('mis-table');

// Persisting atoms for stats data to prevent refetching
export const balanceSheetStatsAtom = atomWithStorage<MasterSheetStats | null>('balance_sheet_stats_cache', null);
export const brokerSheetStatsAtom = atomWithStorage<MasterSheetStats | null>('broker_sheet_stats_cache', null);