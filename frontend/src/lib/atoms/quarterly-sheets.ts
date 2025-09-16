/* eslint-disable @typescript-eslint/no-explicit-any */
import { atom } from 'jotai'

// Types for quarterly sheets state
export interface SelectedQuarter {
  quarter: number
  year: number
  sheetName: string
}

// Main state atom for selected quarter
export const selectedQuarterAtom = atom<SelectedQuarter | null>(null)

// Derived atom for quarter display name
export const selectedQuarterDisplayAtom = atom((get) => {
  const selectedQuarter = get(selectedQuarterAtom)
  if (!selectedQuarter) return null
  return `Q${selectedQuarter.quarter} - ${selectedQuarter.year}`
})

// Atom for tracking if quarter data is loading
export const quarterDataLoadingAtom = atom(false)

// Atom for quarter data error state
export const quarterDataErrorAtom = atom<string | null>(null)

// Action atom for updating selected quarter
export const updateSelectedQuarterAtom = atom(
  null,
  (get, set, quarter: SelectedQuarter) => {
    set(selectedQuarterAtom, quarter)
    set(quarterDataErrorAtom, null) // Clear any previous errors
  }
)

// Action atom for clearing selected quarter
export const clearSelectedQuarterAtom = atom(
  null,
  (get, set) => {
    set(selectedQuarterAtom, null)
    set(quarterDataErrorAtom, null)
    set(quarterDataLoadingAtom, false)
  }
)

// Atom for storing quarter records data (if needed by other components)
export const quarterRecordsAtom = atom<any[]>([])

// Action atom for updating quarter records
export const updateQuarterRecordsAtom = atom(
  null,
  (get, set, records: any[]) => {
    set(quarterRecordsAtom, records)
    set(quarterDataLoadingAtom, false)
  }
)