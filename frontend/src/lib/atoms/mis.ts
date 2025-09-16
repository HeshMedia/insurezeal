/* eslint-disable @typescript-eslint/no-empty-object-type */
import { atom } from 'jotai';
import { MasterSheetRecord, MasterSheetStats, MasterSheetListParams } from '@/types/mis.types';

// Interface for pending changes
// { [record_id]: { [field_name]: new_value } }
export interface PendingUpdates {
  [recordId: string]: {
    [fieldName: string]: string;
  };
}

// Loading states for different MIS operations
export interface MISLoadingState {
  masterSheetData: boolean;
  masterSheetStats: boolean;
  masterSheetFields: boolean;
  exporting: boolean;
  bulkUpdating: boolean;
}

// Error states for different MIS operations
export interface MISErrorState {
  masterSheetData: string | null;
  masterSheetStats: string | null;
  masterSheetFields: string | null;
  exporting: string | null;
  bulkUpdating: string | null;
}

// Main MIS data state
export interface MISDataState {
  masterSheetRecords: MasterSheetRecord[];
  totalRecords: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
  stats: MasterSheetStats | null;
  fields: string[];
  lastUpdated: Date | null;
}

// Current filter/search parameters
export interface MISFiltersState extends MasterSheetListParams {
  // Additional UI-specific filters can go here
}

// Atom to store pending updates for the master sheet
export const masterSheetPendingUpdatesAtom = atom<PendingUpdates>({});

// Atom for loading states
export const misLoadingStateAtom = atom<MISLoadingState>({
  masterSheetData: false,
  masterSheetStats: false,
  masterSheetFields: false,
  exporting: false,
  bulkUpdating: false,
});

// Atom for error states
export const misErrorStateAtom = atom<MISErrorState>({
  masterSheetData: null,
  masterSheetStats: null,
  masterSheetFields: null,
  exporting: null,
  bulkUpdating: null,
});

// Atom for main MIS data
export const misDataStateAtom = atom<MISDataState>({
  masterSheetRecords: [],
  totalRecords: 0,
  totalPages: 0,
  currentPage: 1,
  pageSize: 50,
  stats: null,
  fields: [],
  lastUpdated: null,
});


// Derived atom for checking if there are pending updates
export const hasPendingUpdatesAtom = atom((get) => {
  const pendingUpdates = get(masterSheetPendingUpdatesAtom);
  return Object.keys(pendingUpdates).length > 0;
});

// Derived atom for counting total pending updates
export const pendingUpdatesCountAtom = atom((get) => {
  const pendingUpdates = get(masterSheetPendingUpdatesAtom);
  return Object.values(pendingUpdates).reduce(
    (total, recordUpdates) => total + Object.keys(recordUpdates).length,
    0
  );
});

// Derived atom for checking if any operation is loading
export const isAnyOperationLoadingAtom = atom((get) => {
  const loadingState = get(misLoadingStateAtom);
  return Object.values(loadingState).some(Boolean);
});

// Derived atom for getting the first error (if any)
export const firstErrorAtom = atom((get) => {
  const errorState = get(misErrorStateAtom);
  const errors = Object.values(errorState).filter(Boolean);
  return errors.length > 0 ? errors[0] : null;
});

// Write-only atom for clearing all errors
export const clearAllErrorsAtom = atom(null, (get, set) => {
  set(misErrorStateAtom, {
    masterSheetData: null,
    masterSheetStats: null,
    masterSheetFields: null,
    exporting: null,
    bulkUpdating: null,
  });
});

// Write-only atom for clearing pending updates
export const clearPendingUpdatesAtom = atom(null, (get, set) => {
  set(masterSheetPendingUpdatesAtom, {});
});

// Write-only atom for adding a pending update
export const addPendingUpdateAtom = atom(
  null,
  (get, set, update: { recordId: string; fieldName: string; newValue: string }) => {
    const current = get(masterSheetPendingUpdatesAtom);
    const newState = { ...current };
    
    if (!newState[update.recordId]) {
      newState[update.recordId] = {};
    }
    
    newState[update.recordId][update.fieldName] = update.newValue;
    set(masterSheetPendingUpdatesAtom, newState);
  }
);

// Write-only atom for removing a pending update
export const removePendingUpdateAtom = atom(
  null,
  (get, set, update: { recordId: string; fieldName?: string }) => {
    const current = get(masterSheetPendingUpdatesAtom);
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
    
    set(masterSheetPendingUpdatesAtom, newState);
  }
);