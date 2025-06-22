import { atom } from 'jotai'

// Profile editing state
export const isEditingProfileAtom = atom(false)

// Active tab state
export const activeProfileTabAtom = atom<'details' | 'documents'>('details')

// Profile form state
export const profileFormStateAtom = atom({
  isSubmitting: false,
  hasChanges: false,
})
