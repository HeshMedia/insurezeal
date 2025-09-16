import { createAuthenticatedClient } from './client'

// Create axios instance with Supabase authentication
const apiClient = createAuthenticatedClient()

export interface QuarterlySheet {
  sheet_name: string
  quarter: number
  year: number
  row_count: number
  col_count: number
}

export interface QuarterlySheetsListResponse {
  success: boolean
  quarterly_sheets: QuarterlySheet[]
  total_count: number
}

export interface QuarterSummaryResponse {
  success: boolean
  data: {
    exists: boolean
    sheet_name: string
    total_records?: number
    true_match_count?: number
    false_match_count?: number
    last_updated?: string
  }
}

export const quarterlySheetsApi = {
  // List all quarterly sheets
  listQuarters: async (): Promise<QuarterlySheetsListResponse> => {
    const response = await apiClient.get('/admin/quarterly-sheets/list-quarters')
    return response.data
  },

  // Get current quarter info
  getCurrentQuarter: async (): Promise<{
    success: boolean
    quarter_name: string
    quarter: number
    year: number
    sheet_exists: boolean
  }> => {
    const response = await apiClient.get('/admin/quarterly-sheets/current-quarter')
    return response.data
  },

  // Get quarter summary
  getQuarterSummary: async (quarter: number, year: number): Promise<QuarterSummaryResponse> => {
    const response = await apiClient.get(`/admin/quarterly-sheets/quarter-summary/${quarter}/${year}`)
    return response.data
  }
}