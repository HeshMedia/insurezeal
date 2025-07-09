import { useMutation, useQuery, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import { cutpayApi } from '@/lib/api/cutpay'
import {
  CutPayTransaction,
  CreateCutPayRequest,
  UpdateCutPayRequest,
  CutPayListParams,
  CutPayCalculationRequest
} from '@/types/cutpay.types'

// Query keys
export const cutpayKeys = {
  all: ['cutpay'] as const,
  lists: () => [...cutpayKeys.all, 'list'] as const,
  list: (params?: CutPayListParams) => [...cutpayKeys.lists(), params] as const,
  details: () => [...cutpayKeys.all, 'detail'] as const,
  detail: (id: number) => [...cutpayKeys.details(), id] as const,
}

// Get list of cutpay transactions
export const useCutPayList = (params?: CutPayListParams) => {
  return useQuery({
    queryKey: cutpayKeys.list(params),
    queryFn: () => cutpayApi.list(params),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

// Get single cutpay transaction
export const useCutPayById = (cutpayId: number, enabled = true) => {
  return useQuery({
    queryKey: cutpayKeys.detail(cutpayId),
    queryFn: () => cutpayApi.getById(cutpayId),
    enabled: enabled && !!cutpayId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

// Create cutpay transaction
export const useCreateCutPay = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateCutPayRequest) => cutpayApi.create(data),
    onSuccess: (data) => {
      // Invalidate and refetch cutpay lists
      queryClient.invalidateQueries({ queryKey: cutpayKeys.lists() })
      
      // Add the new transaction to the cache
      queryClient.setQueryData(cutpayKeys.detail(data.id), data)
    },
    onError: (error) => {
      console.error('Failed to create cutpay transaction:', error)
    },
  })
}

// Update cutpay transaction
export const useUpdateCutPay = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ cutpayId, data }: { cutpayId: number; data: UpdateCutPayRequest }) =>
      cutpayApi.update(cutpayId, data),
    onSuccess: (data, variables) => {
      // Invalidate and refetch cutpay lists
      queryClient.invalidateQueries({ queryKey: cutpayKeys.lists() })
      
      // Update the specific transaction in cache
      queryClient.setQueryData(cutpayKeys.detail(variables.cutpayId), data)
    },
    onError: (error) => {
      console.error('Failed to update cutpay transaction:', error)
    },
  })
}

// Delete cutpay transaction
export const useDeleteCutPay = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (cutpayId: number) => cutpayApi.delete(cutpayId),
    onSuccess: (_, cutpayId) => {
      // Invalidate and refetch cutpay lists
      queryClient.invalidateQueries({ queryKey: cutpayKeys.lists() })
      
      // Remove the deleted transaction from cache
      queryClient.removeQueries({ queryKey: cutpayKeys.detail(cutpayId) })
    },
    onError: (error) => {
      console.error('Failed to delete cutpay transaction:', error)
    },
  })
}

// Upload document
export const useUploadCutPayDocument = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ 
      cutpayId, 
      file, 
      documentType 
    }: { 
      cutpayId: number
      file: File
      documentType?: string 
    }) => cutpayApi.uploadDocument(cutpayId, file, documentType),
    onSuccess: (_, variables) => {
      // Invalidate the specific transaction to refetch updated document info
      queryClient.invalidateQueries({ queryKey: cutpayKeys.detail(variables.cutpayId) })
      
      // Also invalidate the list to show updated document status
      queryClient.invalidateQueries({ queryKey: cutpayKeys.lists() })
    },
    onError: (error) => {
      console.error('Failed to upload document:', error)
    },
  })
}

// Extract PDF data
export const useExtractPdf = () => {
  return useMutation({
    mutationFn: (file: File) => cutpayApi.extractPdf(file),
    onError: (error) => {
      console.error('Failed to extract PDF data:', error)
    },
  })
}

// Cutpay calculation mutation
export const useCutPayCalculation = () => {
  return useMutation({
    mutationFn: (data: CutPayCalculationRequest) => cutpayApi.calculate(data),
    onError: (error) => {
      console.error('Cutpay calculation error:', error)
    },
  })
}

// Optimistic update helper for cutpay transactions
export const useOptimisticCutPayUpdate = () => {
  const queryClient = useQueryClient()

  const updateOptimistically = (cutpayId: number, updates: Partial<CutPayTransaction>) => {
    queryClient.setQueryData<CutPayTransaction>(
      cutpayKeys.detail(cutpayId),
      (old) => {
        if (!old) return undefined
        return { ...old, ...updates, updated_at: new Date().toISOString() }
      }
    )
  }

  return { updateOptimistically }
}

// Prefetch cutpay transaction
export const usePrefetchCutPay = () => {
  const queryClient = useQueryClient()

  const prefetchCutPay = (cutpayId: number) => {
    queryClient.prefetchQuery({
      queryKey: cutpayKeys.detail(cutpayId),
      queryFn: () => cutpayApi.getById(cutpayId),
      staleTime: 5 * 60 * 1000, // 5 minutes
    })
  }

  return { prefetchCutPay }
}

// Search cutpay transactions
export const useSearchCutPay = (searchTerm: string, enabled = true) => {
  return useQuery({
    queryKey: cutpayKeys.list({ search: searchTerm, limit: 50 }),
    queryFn: () => cutpayApi.list({ search: searchTerm, limit: 50 }),
    enabled: enabled && searchTerm.length > 2, // Only search if term is longer than 2 chars
    staleTime: 2 * 60 * 1000, // 2 minutes for search results
  })
}

// Get cutpay transactions by date range
export const useCutPayByDateRange = (
  dateFrom?: string, 
  dateTo?: string, 
  enabled = true
) => {
  return useQuery({
    queryKey: cutpayKeys.list({ date_from: dateFrom, date_to: dateTo }),
    queryFn: () => cutpayApi.list({ date_from: dateFrom, date_to: dateTo }),
    enabled: enabled && !!(dateFrom && dateTo),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

// Get cutpay transactions by broker
export const useCutPayByBroker = (brokerCode: string, enabled = true) => {
  return useQuery({
    queryKey: cutpayKeys.list({ broker_code: brokerCode }),
    queryFn: () => cutpayApi.list({ broker_code: brokerCode }),
    enabled: enabled && !!brokerCode,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

// Get cutpay transactions by insurer
export const useCutPayByInsurer = (insurerCode: string, enabled = true) => {
  return useQuery({
    queryKey: cutpayKeys.list({ insurer_code: insurerCode }),
    queryFn: () => cutpayApi.list({ insurer_code: insurerCode }),
    enabled: enabled && !!insurerCode,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

// Infinite query for paginated cutpay transactions
export const useInfiniteCutPay = (params?: Omit<CutPayListParams, 'skip'>) => {
  return useInfiniteQuery({
    queryKey: cutpayKeys.list(params),
    queryFn: async ({ pageParam = 0 }) => {
      const skip = typeof pageParam === 'number' ? pageParam : 0
      const result = await cutpayApi.list({ 
        ...params, 
        skip,
        limit: params?.limit || 20 
      })
      return {
        data: result,
        nextCursor: result.length === (params?.limit || 20) ? skip + (params?.limit || 20) : undefined
      }
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}
