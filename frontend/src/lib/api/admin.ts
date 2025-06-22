import axios, { AxiosInstance } from 'axios'
import Cookies from 'js-cookie'
import { 
  CutPayTransaction,
  CreateCutPayRequest,
  UpdateCutPayRequest,
  CutPayListResponse,
  CutPayListParams,
  CutPayStatsResponse,
  AgentListResponse,
  AgentListParams,
  AgentDetails,
  AdminStats,
  ChildRequest,
  AssignChildIdRequest,
  UpdateChildRequestStatusRequest
} from '@/types/admin.types'

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to add auth token
apiClient.interceptors.request.use((config) => {
  const token = Cookies.get('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('Admin API Error:', {
      response: error.response?.data,
      status: error.response?.status,
      message: error.message
    })
    
    let message = 'An unexpected error occurred'
    
    if (error.response?.data) {
      if (typeof error.response.data === 'string') {
        message = error.response.data
      } else if (error.response.data.detail) {
        message = error.response.data.detail
      } else if (error.response.data.message) {
        message = error.response.data.message
      } else if (error.response.data.error) {
        message = error.response.data.error
      } else {
        message = `Server error (${error.response.status})`
      }
    } else if (error.message) {
      message = error.message
    }
    
    throw new Error(message)
  }
)

export const adminApi = {
  // Cutpay APIs
  cutpay: {
    // Create cutpay transaction
    create: async (data: CreateCutPayRequest): Promise<CutPayTransaction> => {
      const response = await apiClient.post('/admin/cutpay/', data)
      return response.data
    },

    // List cutpay transactions
    list: async (params?: CutPayListParams): Promise<CutPayListResponse> => {
      const response = await apiClient.get('/admin/cutpay/', {
        params: {
          agent_code: params?.agent_code,
          page: params?.page || 1,
          page_size: params?.page_size || 20,
          search: params?.search
        }
      })
      return response.data
    },

    // Get cutpay statistics
    getStats: async (): Promise<CutPayStatsResponse> => {
      const response = await apiClient.get('/admin/cutpay/stats')
      return response.data
    },

    // Get specific cutpay transaction
    getById: async (cutpayId: number): Promise<CutPayTransaction> => {
      const response = await apiClient.get(`/admin/cutpay/${cutpayId}`)
      return response.data
    },

    // Update cutpay transaction
    update: async (cutpayId: number, data: UpdateCutPayRequest): Promise<CutPayTransaction> => {
      const response = await apiClient.put(`/admin/cutpay/${cutpayId}`, data)
      return response.data
    }
  },

  // Agent APIs
  agents: {
    // List all agents
    list: async (params?: AgentListParams): Promise<AgentListResponse> => {
      const response = await apiClient.get('/admin/agents', {
        params: {
          page: params?.page || 1,
          page_size: params?.page_size || 20,
          search: params?.search
        }
      })
      return response.data
    },

    // Get agent details
    getById: async (agentId: string): Promise<AgentDetails> => {
      const response = await apiClient.get(`/admin/agents/${agentId}`)
      return response.data
    }
  },

  // Admin Stats
  getStats: async (): Promise<AdminStats> => {
    const response = await apiClient.get('/admin/agent-stats')
    return response.data
  },

  // Child Request APIs
  childRequests: {
    // Assign child ID
    assign: async (requestId: string, data: AssignChildIdRequest): Promise<ChildRequest> => {
      const response = await apiClient.put(`/admin/child-requests/${requestId}/assign`, data)
      return response.data
    },

    // Reject child request
    reject: async (requestId: string, data: UpdateChildRequestStatusRequest): Promise<ChildRequest> => {
      const response = await apiClient.put(`/admin/child-requests/${requestId}/reject`, data)
      return response.data
    },

    // Suspend child ID
    suspend: async (requestId: string, data: UpdateChildRequestStatusRequest): Promise<ChildRequest> => {
      const response = await apiClient.put(`/admin/child-requests/${requestId}/suspend`, data)
      return response.data
    }
  }
}