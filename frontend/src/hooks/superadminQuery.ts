import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { superadminApi } from '@/lib/api/superadmin'
import { 
  CreateBrokerRequest,
  UpdateBrokerRequest,
  CreateInsurerRequest,
  UpdateInsurerRequest,
  CreateAdminChildIdRequest,
  UpdateAdminChildIdRequest,
  AvailableChildIdsParams
} from '@/types/superadmin.types'

// Query keys
const SUPERADMIN_QUERY_KEYS = {
  brokers: ['superadmin', 'brokers'] as const,
  broker: (code: string) => ['superadmin', 'brokers', code] as const,
  insurers: ['superadmin', 'insurers'] as const,
  insurer: (code: string) => ['superadmin', 'insurers', code] as const,
  brokersInsurersList: ['superadmin', 'brokers-insurers-list'] as const,
  adminChildIds: ['superadmin', 'adminChildIds'] as const,
  adminChildId: (id: number) => ['superadmin', 'adminChildIds', id] as const,
  availableChildIds: (params: AvailableChildIdsParams) => ['superadmin', 'adminChildIds', 'available', params] as const,
}

// ===== BROKER QUERIES =====

export const useBrokerList = () => {
  return useQuery({
    queryKey: SUPERADMIN_QUERY_KEYS.brokers,
    queryFn: superadminApi.brokers.list,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  })
}

export const useBrokerById = (brokerCode: string) => {
  return useQuery({
    queryKey: SUPERADMIN_QUERY_KEYS.broker(brokerCode),
    queryFn: () => superadminApi.brokers.getById(brokerCode),
    enabled: !!brokerCode,
  })
}

// ===== BROKER MUTATIONS =====

export const useCreateBroker = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (data: CreateBrokerRequest) => superadminApi.brokers.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SUPERADMIN_QUERY_KEYS.brokers })
      queryClient.invalidateQueries({ queryKey: SUPERADMIN_QUERY_KEYS.brokersInsurersList })
    },
  })
}

export const useUpdateBroker = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ brokerCode, data }: { brokerCode: string; data: UpdateBrokerRequest }) => 
      superadminApi.brokers.update(brokerCode, data),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: SUPERADMIN_QUERY_KEYS.brokers })
      queryClient.invalidateQueries({ queryKey: SUPERADMIN_QUERY_KEYS.broker(variables.brokerCode) })
      queryClient.invalidateQueries({ queryKey: SUPERADMIN_QUERY_KEYS.brokersInsurersList })
    },
  })
}

// ===== INSURER QUERIES =====

export const useInsurerList = () => {
  return useQuery({
    queryKey: SUPERADMIN_QUERY_KEYS.insurers,
    queryFn: superadminApi.insurers.list,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  })
}

export const useInsurerById = (insurerCode: string) => {
  return useQuery({
    queryKey: SUPERADMIN_QUERY_KEYS.insurer(insurerCode),
    queryFn: () => superadminApi.insurers.getById(insurerCode),
    enabled: !!insurerCode,
  })
}

// ===== INSURER MUTATIONS =====

export const useCreateInsurer = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (data: CreateInsurerRequest) => superadminApi.insurers.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SUPERADMIN_QUERY_KEYS.insurers })
      queryClient.invalidateQueries({ queryKey: SUPERADMIN_QUERY_KEYS.brokersInsurersList })
    },
  })
}

export const useUpdateInsurer = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ insurerCode, data }: { insurerCode: string; data: UpdateInsurerRequest }) => 
      superadminApi.insurers.update(insurerCode, data),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: SUPERADMIN_QUERY_KEYS.insurers })
      queryClient.invalidateQueries({ queryKey: SUPERADMIN_QUERY_KEYS.insurer(variables.insurerCode) })
      queryClient.invalidateQueries({ queryKey: SUPERADMIN_QUERY_KEYS.brokersInsurersList })
    },
  })
}

// ===== COMBINED BROKERS-INSURERS LIST =====

export const useBrokersInsurersList = () => {
  return useQuery({
    queryKey: SUPERADMIN_QUERY_KEYS.brokersInsurersList,
    queryFn: superadminApi.getBrokersInsurersList,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  })
}

// ===== ADMIN CHILD ID QUERIES =====

export const useAdminChildIdList = () => {
  return useQuery({
    queryKey: SUPERADMIN_QUERY_KEYS.adminChildIds,
    queryFn: superadminApi.adminChildIds.list,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  })
}

export const useAdminChildIdById = (childIdId: number) => {
  return useQuery({
    queryKey: SUPERADMIN_QUERY_KEYS.adminChildId(childIdId),
    queryFn: () => superadminApi.adminChildIds.getById(childIdId),
    enabled: !!childIdId,
  })
}

export const useAvailableAdminChildIds = (params: AvailableChildIdsParams) => {
  return useQuery({
    queryKey: SUPERADMIN_QUERY_KEYS.availableChildIds(params),
    queryFn: () => superadminApi.adminChildIds.getAvailable(params),
    enabled: !!params.insurer_code,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  })
}

// ===== ADMIN CHILD ID MUTATIONS =====

export const useCreateAdminChildId = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (data: CreateAdminChildIdRequest) => superadminApi.adminChildIds.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SUPERADMIN_QUERY_KEYS.adminChildIds })
    },
  })
}

export const useUpdateAdminChildId = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ childIdId, data }: { childIdId: number; data: UpdateAdminChildIdRequest }) => 
      superadminApi.adminChildIds.update(childIdId, data),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: SUPERADMIN_QUERY_KEYS.adminChildIds })
      queryClient.invalidateQueries({ queryKey: SUPERADMIN_QUERY_KEYS.adminChildId(variables.childIdId) })
    },
  })
}

export const useDeleteAdminChildId = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (childIdId: number) => superadminApi.adminChildIds.delete(childIdId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SUPERADMIN_QUERY_KEYS.adminChildIds })
    },
  })
}
