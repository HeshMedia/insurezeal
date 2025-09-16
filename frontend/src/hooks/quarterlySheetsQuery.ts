import { useQuery } from '@tanstack/react-query'
import { quarterlySheetsApi, QuarterlySheetsListResponse } from '@/lib/api/quarterly-sheets'

export const quarterlySheetsKeys = {
  all: ['quarterly-sheets'] as const,
  lists: () => [...quarterlySheetsKeys.all, 'list'] as const,
  list: () => [...quarterlySheetsKeys.lists()] as const,
  currentQuarter: () => [...quarterlySheetsKeys.all, 'current'] as const,
  summary: (quarter: number, year: number) => [...quarterlySheetsKeys.all, 'summary', quarter, year] as const,
}

// Hook to get list of all quarterly sheets
export const useQuarterlySheetslist = () => {
  return useQuery({
    queryKey: quarterlySheetsKeys.list(),
    queryFn: quarterlySheetsApi.listQuarters,
    staleTime: 5 * 60 * 1000, // 5 minutes
    select: (data: QuarterlySheetsListResponse) => {
      // Sort sheets by year and quarter (most recent first)
      const sortedSheets = [...data.quarterly_sheets].sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year // Newer years first
        return b.quarter - a.quarter // Within same year, higher quarters first
      })
      
      return {
        ...data,
        quarterly_sheets: sortedSheets
      }
    }
  })
}

// Hook to get current quarter info
export const useCurrentQuarter = () => {
  return useQuery({
    queryKey: quarterlySheetsKeys.currentQuarter(),
    queryFn: quarterlySheetsApi.getCurrentQuarter,
    staleTime: 10 * 60 * 1000, // 10 minutes
  })
}

// Hook to get quarter summary
export const useQuarterSummary = (quarter: number, year: number, enabled: boolean = true) => {
  return useQuery({
    queryKey: quarterlySheetsKeys.summary(quarter, year),
    queryFn: () => quarterlySheetsApi.getQuarterSummary(quarter, year),
    enabled,
    staleTime: 2 * 60 * 1000, // 2 minutes
  })
}