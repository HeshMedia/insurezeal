import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { agentApi } from '@/lib/api/agent'
import { 
  CreateChildIdRequest, 
  ChildIdListParams,
} from '@/types/agent.types'
import { toast } from 'sonner'

// Query keys
export const AGENT_QUERY_KEYS = {
  childIdRequests: ['agent', 'child-id-requests'] as const,
  childIdRequest: (id: string) => ['agent', 'child-id-request', id] as const,
  activeChildIds: ['agent', 'active-child-ids'] as const,
  insurers: ['agent', 'insurers'] as const,
  brokersInsurers: ['agent', 'brokers-insurers'] as const,
} as const

// Get insurers for Direct Code selection
export const useInsurers = () => {
  return useQuery({
    queryKey: AGENT_QUERY_KEYS.insurers,
    queryFn: () => agentApi.childId.getInsurers(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  })
}

// Get brokers and insurers for Broker Code selection
export const useBrokersAndInsurers = () => {
  return useQuery({
    queryKey: AGENT_QUERY_KEYS.brokersInsurers,
    queryFn: () => agentApi.childId.getBrokersAndInsurers(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  })
}

// Get user's child ID requests
export const useChildIdRequests = (params?: ChildIdListParams) => {
  return useQuery({
    queryKey: [...AGENT_QUERY_KEYS.childIdRequests, params],
    queryFn: () => agentApi.childId.getMyRequests(params),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  })
}

// Get specific child ID request
export const useChildIdRequest = (requestId: string) => {
  return useQuery({
    queryKey: AGENT_QUERY_KEYS.childIdRequest(requestId),
    queryFn: () => agentApi.childId.getRequestById(requestId),
    enabled: !!requestId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  })
}

// Get active child IDs
export const useActiveChildIds = () => {
  return useQuery({
    queryKey: AGENT_QUERY_KEYS.activeChildIds,
    queryFn: () => agentApi.childId.getActiveChildIds(),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  })
}

// Create child ID request mutation
export const useCreateChildIdRequest = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateChildIdRequest) => agentApi.childId.create(data),
    onSuccess: (data) => {
      toast.success('Child ID request submitted successfully')
      
      // Invalidate and refetch related queries
      queryClient.invalidateQueries({ queryKey: AGENT_QUERY_KEYS.childIdRequests })
      queryClient.invalidateQueries({ queryKey: AGENT_QUERY_KEYS.activeChildIds })
      
      // Add the new request to cache
      queryClient.setQueryData(
        AGENT_QUERY_KEYS.childIdRequest(data.id),
        data
      )
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to submit child ID request')
    }
  })
}
