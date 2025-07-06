import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/lib/api/admin'
import { 
  UpdateCutPayRequest, 
  CutPayListParams,
  CreateCutPayRequest,
  AgentListParams,
  ChildRequestListParams,
  AssignChildIdRequest,
  ChildRequestStatusUpdate
} from '@/types/admin.types'
import { useBrokersInsurersList, useAvailableAdminChildIds } from './superadminQuery'

// Query keys
const ADMIN_QUERY_KEYS = {
  cutpay: {
    all: ['admin', 'cutpay'] as const,
    lists: () => [...ADMIN_QUERY_KEYS.cutpay.all, 'list'] as const,
    list: (params?: CutPayListParams) => [...ADMIN_QUERY_KEYS.cutpay.lists(), params] as const,
    details: () => [...ADMIN_QUERY_KEYS.cutpay.all, 'detail'] as const,
    detail: (id: number) => [...ADMIN_QUERY_KEYS.cutpay.details(), id] as const,
    stats: () => [...ADMIN_QUERY_KEYS.cutpay.all, 'stats'] as const,
    dropdowns: () => [...ADMIN_QUERY_KEYS.cutpay.all, 'dropdowns'] as const,
  },
  agents: {
    all: ['admin', 'agents'] as const,
    lists: () => [...ADMIN_QUERY_KEYS.agents.all, 'list'] as const,
    list: (params?: AgentListParams) => [...ADMIN_QUERY_KEYS.agents.lists(), params] as const,
    details: () => [...ADMIN_QUERY_KEYS.agents.all, 'detail'] as const,
    detail: (id: string) => [...ADMIN_QUERY_KEYS.agents.details(), id] as const,
  },
  stats: ['admin', 'stats'] as const,
  childRequests: {
    all: ['admin', 'childRequests'] as const,
    lists: () => [...ADMIN_QUERY_KEYS.childRequests.all, 'list'] as const,
    list: (params?: ChildRequestListParams) => [...ADMIN_QUERY_KEYS.childRequests.lists(), params] as const,
    details: () => [...ADMIN_QUERY_KEYS.childRequests.all, 'detail'] as const,
    detail: (id: string) => [...ADMIN_QUERY_KEYS.childRequests.details(), id] as const,
    stats: () => [...ADMIN_QUERY_KEYS.childRequests.all, 'stats'] as const,
  }
}

// =========================================================================
// CUTPAY QUERIES
// =========================================================================

export const useCutPayList = (params?: CutPayListParams) => {
  return useQuery({
    queryKey: ADMIN_QUERY_KEYS.cutpay.list(params),
    queryFn: () => adminApi.cutpay.list(params),
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  })
}

export const useCutPayById = (cutpayId: number) => {
  return useQuery({
    queryKey: ADMIN_QUERY_KEYS.cutpay.detail(cutpayId),
    queryFn: () => adminApi.cutpay.getById(cutpayId),
    enabled: !!cutpayId,
  })
}

// COMMENTED OUT: Stats query - API endpoint returning 500 error
// export const useCutPayStats = () => {
//   return useQuery({
//     queryKey: ADMIN_QUERY_KEYS.cutpay.stats(),
//     queryFn: adminApi.cutpay.getStats,
//     retry: 3,
//     retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
//     staleTime: 5 * 60 * 1000, // 5 minutes
//     gcTime: 10 * 60 * 1000, // 10 minutes
//   })
// }

// COMMENTED OUT: Dropdown queries - not needed per requirements
// export const useCutPayDropdowns = () => {
//   return useQuery({
//     queryKey: ADMIN_QUERY_KEYS.cutpay.dropdowns(),
//     queryFn: adminApi.cutpay.getDropdowns,
//     staleTime: 10 * 60 * 1000, // 10 minutes - dropdowns change infrequently
//     gcTime: 30 * 60 * 1000, // 30 minutes
//   })
// }

// export const useCutPayFilteredDropdowns = (params: { insurer_code?: string; broker_code?: string }) => {
//   return useQuery({
//     queryKey: [...ADMIN_QUERY_KEYS.cutpay.dropdowns(), 'filtered', params],
//     queryFn: () => adminApi.cutpay.getFilteredDropdowns(params),
//     enabled: !!(params.insurer_code || params.broker_code),
//     staleTime: 5 * 60 * 1000, // 5 minutes
//   })
// }

// =========================================================================
// CUTPAY MUTATIONS
// =========================================================================

export const useCreateCutPay = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (data: CreateCutPayRequest) => adminApi.cutpay.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.cutpay.lists() })
      // queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.cutpay.stats() }) // Commented out - API returning 500
    },
  })
}

export const useUpdateCutPay = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ cutpayId, data }: { cutpayId: number; data: UpdateCutPayRequest }) => 
      adminApi.cutpay.update(cutpayId, data),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.cutpay.lists() })
      queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.cutpay.detail(variables.cutpayId) })
      // queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.cutpay.stats() }) // Commented out - API returning 500
    },
  })
}

export const useDeleteCutPay = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (cutpayId: number) => adminApi.cutpay.delete(cutpayId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.cutpay.lists() })
      // queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.cutpay.stats() }) // Commented out - API returning 500
    },
  })
}

// COMMENTED OUT: Real-time calculation hook - not needed per requirements
// export const useCutPayCalculation = () => {
//   return useMutation({
//     mutationFn: (data: CalculationRequest) => adminApi.cutpay.calculate(data),
//   })
// }

// ========================================================================
// NEW FLOW: PDF Extraction for creation (step 1)
// ========================================================================

// Extract PDF without cutpay ID (for creation flow - step 1)
// NOTE: This is now handled in useCutPayFlow.ts - this is kept for backward compatibility
export const useExtractPdfForCreation = () => {
  return useMutation({
    mutationFn: (file: File) => adminApi.cutpay.extractPdfForCreation(file),
  })
}

// ========================================================================
// Legacy document upload mutations (for edit mode - existing transactions)
// ========================================================================
export const useUploadDocument = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ cutpayId, file, document_type }: { cutpayId: number; file: File; document_type: string }) => 
      adminApi.cutpay.uploadDocument(cutpayId, file, document_type),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.cutpay.detail(variables.cutpayId) })
    },
  })
}



// =========================================================================
// AGENT QUERIES (Unchanged)
// ========================================================================= Agent Queries
export const useAgentList = (params?: AgentListParams) => {
  return useQuery({
    queryKey: ADMIN_QUERY_KEYS.agents.list(params),
    queryFn: () => adminApi.agents.list(params),
  })
}

export const useAgentById = (agentId: string) => {
  return useQuery({
    queryKey: ADMIN_QUERY_KEYS.agents.detail(agentId),
    queryFn: () => adminApi.agents.getById(agentId),
    enabled: !!agentId,
  })
}

// Admin Stats Query
export const useAdminStats = () => {
  return useQuery({
    queryKey: ADMIN_QUERY_KEYS.stats,
    queryFn: adminApi.getStats,
  })
}

// Child Request Queries
export const useChildRequestList = (params?: ChildRequestListParams) => {
  return useQuery({
    queryKey: ADMIN_QUERY_KEYS.childRequests.list(params),
    queryFn: () => adminApi.childRequests.list(params),
  })
}

export const useChildRequestById = (requestId: string) => {
  return useQuery({
    queryKey: ADMIN_QUERY_KEYS.childRequests.detail(requestId),
    queryFn: () => adminApi.childRequests.getById(requestId),
    enabled: !!requestId,
  })
}

// Child Request Mutations
export const useAssignChildId = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ requestId, data }: { requestId: string; data: AssignChildIdRequest }) => 
      adminApi.childRequests.assign(requestId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.childRequests.all })
      queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.stats })
    },
  })
}

export const useRejectChildRequest = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ requestId, data }: { requestId: string; data: ChildRequestStatusUpdate }) => 
      adminApi.childRequests.reject(requestId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.childRequests.all })
    },
  })
}

export const useSuspendChildId = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ requestId, data }: { requestId: string; data: ChildRequestStatusUpdate }) => 
      adminApi.childRequests.suspend(requestId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.childRequests.all })
    },
  })
}

export const useChildRequestStats = () => {
  return useQuery({
    queryKey: ADMIN_QUERY_KEYS.childRequests.stats(),
    queryFn: adminApi.childRequests.getStats,
  })
}

// Agent Deletion
export const useDeleteAgent = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: adminApi.agents.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.agents.lists() })
      queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.stats })
    },
  })
}

// CutPay Export
export const useExportCutPayCsv = () => {
  return useMutation({
    mutationFn: ({ startDate, endDate }: { startDate?: string; endDate?: string }) => 
      adminApi.cutpay.exportCsv({ date_from: startDate, date_to: endDate }),
  })
}

// Universal Record Management
export const useUploadUniversalRecord = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: adminApi.universalRecords.upload,
    onSuccess: () => {
      // Invalidate all data that might have been updated
      queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.cutpay.all })
      queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.stats })
    },
  })
}

export const useDownloadUniversalRecordTemplate = () => {
  return useMutation({
    mutationFn: adminApi.universalRecords.downloadTemplate,
  })
}

// Convenience re-exports for admin use
export const useAdminBrokersInsurers = useBrokersInsurersList
export const useAdminAvailableChildIds = useAvailableAdminChildIds