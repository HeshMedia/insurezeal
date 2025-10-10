import { useMutation, useQuery, useQueryClient, useInfiniteQuery, keepPreviousData } from '@tanstack/react-query'
import { cutpayApi } from '@/lib/api/cutpay'
import {
  CutPayTransaction,
  CreateCutpayTransactionCutpayPostRequest,
  UpdateCutPayRequest,
  CutPayListParams,
  CutPayCalculationRequest,
  AgentConfig,
  CreateAgentConfigRequest,
  ListAgentConfigsParams,
  UpdateAgentConfigRequest,
  BulkPostCutpayRequest,
  BulkPostCutpayResponse,
} from '@/types/cutpay.types'

// Query keys
const cutpayAllKey = ['cutpay'] as const
const agentConfigsAllKey = [...cutpayAllKey, 'agent-configs'] as const

export const cutpayKeys = {
  all: cutpayAllKey,
  lists: () => [...cutpayAllKey, 'list'] as const,
  list: (params?: CutPayListParams) => [...cutpayAllKey, 'list', params] as const,
  details: () => [...cutpayAllKey, 'detail'] as const,
  detail: (id: number) => [...cutpayAllKey, 'detail', id] as const,
  policyDetail: (policy_number: string, quarter: number, year: number) =>
    [...cutpayAllKey, 'policy-detail', { policy_number, quarter, year }] as const,
  agentPoPaid: (agentCode: string) => [...cutpayAllKey, 'agent-po-paid', agentCode] as const,
  agentConfigs: {
    all: agentConfigsAllKey,
    lists: () => [...agentConfigsAllKey, 'list'] as const,
    list: (params?: ListAgentConfigsParams) => [...agentConfigsAllKey, 'list', params] as const,
    details: () => [...agentConfigsAllKey, 'detail'] as const,
    detail: (id: number) => [...agentConfigsAllKey, 'detail', id] as const,
  },
}

// Get list of cutpay transactions
export const useCutPayList = (params?: CutPayListParams) => {
  return useQuery({
    queryKey: cutpayKeys.list(params),
    queryFn: () => cutpayApi.list(params),
    placeholderData: keepPreviousData,
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

// Get PO Paid to Agent data
export const useAgentPoPaid = (agentCode: string, enabled = true) => {
  return useQuery({
    queryKey: cutpayKeys.agentPoPaid(agentCode),
    queryFn: () => cutpayApi.agentConfig.getPoPaid(agentCode),
    enabled: enabled && !!agentCode,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

// Create cutpay transaction
export const useCreateCutPay = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateCutpayTransactionCutpayPostRequest) => cutpayApi.create(data),
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

// Get cutpay details by policy number and quarter/year
export const useCutPayByPolicy = (
  policy_number: string | undefined,
  quarter: number | undefined,
  year: number | undefined,
  enabled = true
) => {
  return useQuery({
    queryKey: policy_number && quarter && year ? cutpayKeys.policyDetail(policy_number, quarter, year) : ['cutpay', 'policy-detail', 'disabled'],
    queryFn: () => cutpayApi.getByPolicy({ policy_number: policy_number as string, quarter: quarter as number, year: year as number }),
    enabled: enabled && !!policy_number && !!quarter && !!year,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

// Update cutpay transaction by policy
export const useUpdateCutPayByPolicy = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ params, data }: { params: { policy_number: string; quarter: number; year: number }; data: CreateCutpayTransactionCutpayPostRequest }) =>
      cutpayApi.updateByPolicy(params, data),
    onSuccess: (data, variables) => {
      // Invalidate lists and the specific policy detail
      queryClient.invalidateQueries({ queryKey: cutpayKeys.lists() })
      queryClient.invalidateQueries({ queryKey: cutpayKeys.policyDetail(variables.params.policy_number, variables.params.quarter, variables.params.year) })
    },
    onError: (error) => {
      console.error('Failed to update cutpay transaction by policy:', error)
    },
  })
}

// Delete cutpay transaction by policy
export const useDeleteCutPayByPolicy = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: { policy_number: string; quarter: number; year: number }) => cutpayApi.deleteByPolicy(params),
    onSuccess: (_, params) => {
      queryClient.invalidateQueries({ queryKey: cutpayKeys.lists() })
      queryClient.removeQueries({ queryKey: cutpayKeys.policyDetail(params.policy_number, params.quarter, params.year) })
    },
    onError: (error) => {
      console.error('Failed to delete cutpay transaction by policy:', error)
    },
  })
}

// Common mutation logic for bulk post-details operations
const useBulkPostDetailsMutation = (
  mutationFn: (data: BulkPostCutpayRequest) => Promise<BulkPostCutpayResponse>,
  errorContext: string
) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn,
    onSuccess: (data) => {
      // Invalidate all list queries to refetch updated data
      queryClient.invalidateQueries({ queryKey: cutpayKeys.lists() })

      // Update the cache for each individual transaction that was modified
      data.updated_records.forEach(transaction => {
        queryClient.setQueryData(cutpayKeys.detail(transaction.id), transaction)
      })
    },
    onError: (error) => {
      console.error(`Failed to ${errorContext}:`, error)
    },
  })
}

// Add bulk post-cutpay details
export const useAddBulkPostDetails = () => {
  return useBulkPostDetailsMutation(
    cutpayApi.addBulkPostDetails,
    'add bulk post-cutpay details'
  )
}

// Update bulk post-cutpay details
export const useUpdateBulkPostDetails = () => {
  return useBulkPostDetailsMutation(
    cutpayApi.updateBulkPostDetails,
    'update bulk post-cutpay details'
  )
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
        ...result,
        nextCursor:
          result.transactions.length === (params?.limit || 20)
            ? skip + (params?.limit || 20)
            : undefined
      }
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

// Agent Config Queries & Mutations

// Get list of agent configs
export const useAgentConfigList = (params?: ListAgentConfigsParams) => {
  return useQuery({
    queryKey: cutpayKeys.agentConfigs.list(params),
    queryFn: () => cutpayApi.agentConfig.list(params),
    staleTime: 5 * 60 * 1000,
  })
}

// Get single agent config
export const useAgentConfigById = (configId: number, enabled = true) => {
  return useQuery({
    queryKey: cutpayKeys.agentConfigs.detail(configId),
    queryFn: () => cutpayApi.agentConfig.getById(configId),
    enabled: enabled && !!configId,
    staleTime: 5 * 60 * 1000,
  })
}

// Create agent config
export const useCreateAgentConfig = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateAgentConfigRequest) => cutpayApi.agentConfig.create(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: cutpayKeys.agentConfigs.lists() })
      queryClient.invalidateQueries({ queryKey: cutpayKeys.agentPoPaid(data.agent_code) })
      queryClient.setQueryData(cutpayKeys.agentConfigs.detail(data.id), data)
    },
    onError: (error) => {
      console.error('Failed to create agent config:', error)
    },
  })
}

// Update agent config
export const useUpdateAgentConfig = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ configId, data }: { configId: number; data: UpdateAgentConfigRequest }) =>
      cutpayApi.agentConfig.update(configId, data),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: cutpayKeys.agentConfigs.lists() })
      queryClient.invalidateQueries({ queryKey: cutpayKeys.agentPoPaid(data.agent_code) })
      queryClient.setQueryData(cutpayKeys.agentConfigs.detail(variables.configId), data)
    },
    onError: (error) => {
      console.error('Failed to update agent config:', error)
    },
  })
}

// Delete agent config
export const useDeleteAgentConfig = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (configId: number) => cutpayApi.agentConfig.delete(configId),
    onSuccess: (_, configId) => {
      const cachedConfig = queryClient.getQueryData<AgentConfig>(
        cutpayKeys.agentConfigs.detail(configId)
      )

      queryClient.invalidateQueries({ queryKey: cutpayKeys.agentConfigs.lists() })
      queryClient.removeQueries({ queryKey: cutpayKeys.agentConfigs.detail(configId) })

      if (cachedConfig?.agent_code) {
        queryClient.invalidateQueries({ queryKey: cutpayKeys.agentPoPaid(cachedConfig.agent_code) })
      }
    },
    onError: (error) => {
      console.error('Failed to delete agent config:', error)
    },
  })
}