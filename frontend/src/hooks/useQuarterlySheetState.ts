import { useAtom } from 'jotai'
import { useCallback } from 'react'
import { 
  selectedQuarterAtom, 
  selectedQuarterDisplayAtom,
  updateSelectedQuarterAtom,
  clearSelectedQuarterAtom,
  quarterDataLoadingAtom,
  quarterDataErrorAtom,
  quarterRecordsAtom,
  updateQuarterRecordsAtom,
  SelectedQuarter
} from '@/lib/atoms/quarterly-sheets'

/**
 * Custom hook for managing quarterly sheets state
 * Provides centralized state management for quarterly sheet selection and data
 */
export const useQuarterlySheetState = () => {
  const [selectedQuarter] = useAtom(selectedQuarterAtom)
  const [selectedQuarterDisplay] = useAtom(selectedQuarterDisplayAtom)
  const [quarterDataLoading, setQuarterDataLoading] = useAtom(quarterDataLoadingAtom)
  const [quarterDataError, setQuarterDataError] = useAtom(quarterDataErrorAtom)
  const [quarterRecords] = useAtom(quarterRecordsAtom)
  const [, updateSelectedQuarter] = useAtom(updateSelectedQuarterAtom)
  const [, clearSelectedQuarter] = useAtom(clearSelectedQuarterAtom)
  const [, updateQuarterRecords] = useAtom(updateQuarterRecordsAtom)

  // Function to select a quarter
  const selectQuarter = useCallback((quarter: number, year: number, sheetName: string) => {
    updateSelectedQuarter({ quarter, year, sheetName })
  }, [updateSelectedQuarter])

  // Function to clear selection
  const clearSelection = useCallback(() => {
    clearSelectedQuarter()
  }, [clearSelectedQuarter])

  // Function to update records
  const updateRecords = useCallback((records: any[]) => {
    updateQuarterRecords(records)
  }, [updateQuarterRecords])

  // Function to set loading state
  const setLoading = useCallback((loading: boolean) => {
    setQuarterDataLoading(loading)
  }, [setQuarterDataLoading])

  // Function to set error state
  const setError = useCallback((error: string | null) => {
    setQuarterDataError(error)
  }, [setQuarterDataError])

  return {
    // State
    selectedQuarter,
    selectedQuarterDisplay,
    quarterDataLoading,
    quarterDataError,
    quarterRecords,
    
    // Actions
    selectQuarter,
    clearSelection,
    updateRecords,
    setLoading,
    setError,
    
    // Computed state
    hasSelectedQuarter: !!selectedQuarter,
    isValidSelection: selectedQuarter && selectedQuarter.quarter >= 1 && selectedQuarter.quarter <= 4,
  }
}