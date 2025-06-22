import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/lib/api/admin'
import { 
  CreateCutPayRequest, 
  UpdateCutPayRequest, 
  CutPayListParams,
  AgentListParams,
  AssignChildIdRequest,
  UpdateChildRequestStatusRequest
} from '@/types/admin.types'

// Query keys
const ADMIN_QUERY_KEYS = {
  cutpay: {
    all: ['admin', 'cutpay'] as const,
    lists: () => [...ADMIN_QUERY_KEYS.cutpay.all, 'list'] as const,
    list: (params?: CutPayListParams) => [...ADMIN_QUERY_KEYS.cutpay.lists(), params] as const,
    details: () => [...ADMIN_QUERY_KEYS.cutpay.all, 'detail'] as const,
    detail: (id: number) => [...ADMIN_QUERY_KEYS.cutpay.details(), id] as const,
    stats: () => [...ADMIN_QUERY_KEYS.cutpay.all, 'stats'] as const,
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
  }
}

// Cutpay Queries
export const useCutPayList = (params?: CutPayListParams) => {
  return useQuery({
    queryKey: ADMIN_QUERY_KEYS.cutpay.list(params),
    queryFn: () => adminApi.cutpay.list(params),
  })
}

export const useCutPayById = (cutpayId: number) => {
  return useQuery({
    queryKey: ADMIN_QUERY_KEYS.cutpay.detail(cutpayId),
    queryFn: () => adminApi.cutpay.getById(cutpayId),
    enabled: !!cutpayId,
  })
}

export const useCutPayStats = () => {
  return useQuery({
    queryKey: ADMIN_QUERY_KEYS.cutpay.stats(),
    queryFn: adminApi.cutpay.getStats,
  })
}

// Cutpay Mutations
export const useCreateCutPay = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: adminApi.cutpay.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.cutpay.lists() })
      queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.cutpay.stats() })
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
      queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.cutpay.stats() })
    },
  })
}

// Agent Queries
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
    mutationFn: ({ requestId, data }: { requestId: string; data: UpdateChildRequestStatusRequest }) => 
      adminApi.childRequests.reject(requestId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.childRequests.all })
    },
  })
}

export const useSuspendChildId = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ requestId, data }: { requestId: string; data: UpdateChildRequestStatusRequest }) => 
      adminApi.childRequests.suspend(requestId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.childRequests.all })
    },
  })
}