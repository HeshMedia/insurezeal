import { atom } from 'jotai';

// Interface for pending changes
// { [record_id]: { [field_name]: new_value } }
export interface PendingUpdates {
  [recordId: string]: {
    [fieldName: string]: string;
  };
}

// Atom to store pending updates for the master sheet
export const masterSheetPendingUpdatesAtom = atom<PendingUpdates>({});