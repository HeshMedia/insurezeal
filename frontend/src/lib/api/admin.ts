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
  ChildRequestListResponse,
  ChildRequestListParams,
  AssignChildIdRequest,
  ChildRequestStatusUpdate
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

// Universal Record Management Types
interface UniversalRecordUploadResponse {
  message: string
  report: {
    total_records_processed: number
    policies_updated: number
    policies_added: number
    cutpay_updated: number
    cutpay_added: number
    no_changes: number
    errors: string[]
    processing_summary: Array<{
      policy_number: string
      record_type: string
      action: string
      updated_fields: string[]
      old_values: Record<string, any>
      new_values: Record<string, any>
    }>
  }
  processing_time_seconds: number
}

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
    },

    // Export cutpay transactions to CSV
    exportCsv: async (startDate?: string, endDate?: string): Promise<Blob> => {
      const params = new URLSearchParams()
      if (startDate) params.append('start_date', startDate)
      if (endDate) params.append('end_date', endDate)
      
      const response = await apiClient.get(`/admin/cutpay/export/csv?${params.toString()}`, {
        responseType: 'blob'
      })
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
    },

    // Delete agent
    delete: async (agentId: string): Promise<{ message: string }> => {
      const response = await apiClient.delete(`/admin/agents/${agentId}`)
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
    },    // Reject child request
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

  // Universal Record Management APIs
  universalRecords: {
    // Upload universal record CSV
    upload: async (file: File): Promise<UniversalRecordUploadResponse> => {
      const formData = new FormData()
      formData.append('file', file)
      
      const response = await apiClient.post('/admin/universal-records/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
      return response.data
    },

    // Download CSV template
    downloadTemplate: async (): Promise<Blob> => {
      const response = await apiClient.get('/admin/universal-records/template', {
        responseType: 'blob'
      })
      return response.data
    }
  }
}