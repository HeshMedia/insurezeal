import axios, { AxiosInstance } from 'axios'
import Cookies from 'js-cookie'
import { 
  AgentListResponse,
  AgentListParams,
  AgentDetails,
  AdminStats,
  ChildRequest,
  ChildRequestListResponse,
  ChildRequestListParams,
  AssignChildIdRequest,
  ChildRequestStatusUpdate,
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
    // Only log errors that are not permission-related for agents
    if (error.response?.status !== 401 && error.response?.status !== 403) {
      console.error('Admin API Error:', {
        response: error.response?.data,
        status: error.response?.status,
        message: error.message
      })
    }
    
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
    },

    // Delete agent
    delete: async (agentId: string): Promise<{ message: string }> => {
      const response = await apiClient.delete(`/admin/agents/${agentId}`)
      return response.data
    },

    // Get PO Paid to Agent
    getPOPaidToAgent: async (agentCode: string): Promise<{ po_paid_amount: number }> => {
      const response = await apiClient.get(`/admin/agents/${agentCode}/po-paid`)
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
    // List child requests
    list: async (params?: ChildRequestListParams): Promise<ChildRequestListResponse> => {
      const response = await apiClient.get('/admin/child-requests', {
        params: {
          page: params?.page || 1,
          page_size: params?.page_size || 20,
          status_filter: params?.status,
          search: params?.search
        }
      })
      return response.data
    },

    // Get child request by ID
    getById: async (requestId: string): Promise<ChildRequest> => {
      const response = await apiClient.get(`/admin/child-requests/${requestId}`)
      return response.data
    },

    // Assign child ID
    assign: async (requestId: string, data: AssignChildIdRequest): Promise<ChildRequest> => {
      const response = await apiClient.put(`/admin/child-requests/${requestId}/assign`, data)
      return response.data
    },

    // Reject child request
    reject: async (requestId: string, data: ChildRequestStatusUpdate): Promise<ChildRequest> => {
      const response = await apiClient.put(`/admin/child-requests/${requestId}/reject`, data)
      return response.data
    },

    // Suspend child ID
    suspend: async (requestId: string, data: ChildRequestStatusUpdate): Promise<ChildRequest> => {
      const response = await apiClient.put(`/admin/child-requests/${requestId}/suspend`, data)
      return response.data
    },

    // Get child request statistics
    getStats: async (): Promise<{
      total_requests: number
      pending_requests: number
      approved_requests: number
      rejected_requests: number
      suspended_requests: number
    }> => {
      const response = await apiClient.get('/admin/child-statistics')
      return response.data
    }
  },
}