import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/lib/api/admin'
import { 
  AgentListParams,
  ChildRequestListParams,
  AssignChildIdRequest,
  ChildRequestStatusUpdate
} from '@/types/admin.types'
import { useBrokersInsurersList, useAvailableAdminChildIds } from './superadminQuery'


// Query keys
const ADMIN_QUERY_KEYS = {

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

// Get PO Paid to Agent by agent code
export const usePOPaidToAgent = (agentCode: string, enabled = true) => {
  return useQuery({
    queryKey: ['admin', 'po-paid', agentCode],
    queryFn: () => adminApi.agents.getPOPaidToAgent(agentCode),
    enabled: enabled && !!agentCode,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

// Admin Stats Query
export const useAdminStats = () => {
  return useQuery({
    queryKey: ADMIN_QUERY_KEYS.stats,
    queryFn: adminApi.getStats,
  })
}

// CutPay Stats Query - TEMPORARY: Will be moved to cutpayQuery.ts
export const useCutPayStats = () => {
  return useQuery({
    queryKey: ['admin', 'cutpay', 'stats'],
    queryFn: async () => {
      // Placeholder implementation since backend stats might be incomplete
      return {
        stats: {
          total_transactions: 0,
          total_cut_pay_amount: 0,
          monthly_breakdown: [],
          top_agents: []
        }
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
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

// Convenience re-exports for admin use
export const useAdminBrokersInsurers = useBrokersInsurersList
export const useAdminAvailableChildIds = useAvailableAdminChildIds