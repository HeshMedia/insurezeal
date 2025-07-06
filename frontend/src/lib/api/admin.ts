import apiClient from '.'
import { 
  CutPayTransaction,
  CreateCutPayRequest,
  UpdateCutPayRequest,
  CutPayListParams,
  // CutPayStatsResponse, // Commented out - API endpoint not working (500 error)
  DocumentUploadResponse,
  ExtractPdfResponse,
  AgentListResponse,
  AgentListParams,
  AgentDetails,
  AdminStats,
  ChildRequest,
  ChildRequestListResponse,
  ChildRequestListParams,
  AssignChildIdRequest,
  ChildRequestStatusUpdate,
  UniversalRecordUploadResponse
} from '@/types/admin.types'

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('Admin API Error:', {
      response: error.response?.data,
      status: error.response?.status,
      message: error.message
    })
    // Optionally re-throw the error to be handled by the calling code
    return Promise.reject(error)
  }
)

export const adminApi = {
  cutpay: {
    create: async (data: CreateCutPayRequest): Promise<CutPayTransaction> => {
      const response = await apiClient.post<CutPayTransaction>('/cutpay/', data)
      return response.data
    },
    list: async (params?: CutPayListParams): Promise<CutPayTransaction[]> => {
      const response = await apiClient.get<CutPayTransaction[]>('/cutpay/', { params })
      return response.data
    },
    // getStats: async (): Promise<CutPayStatsResponse> => {
    //   const response = await apiClient.get<CutPayStatsResponse>('/Prod/cutpay/stats')
    //   return response.data
    // },
    getById: async (cutpayId: number): Promise<CutPayTransaction> => {
      const response = await apiClient.get<CutPayTransaction>(`/cutpay/${cutpayId}`)
      return response.data
    },
    update: async (cutpayId: number, data: UpdateCutPayRequest): Promise<CutPayTransaction> => {
      const response = await apiClient.put<CutPayTransaction>(`/cutpay/${cutpayId}`, data)
      return response.data
    },
    delete: async (cutpayId: number): Promise<{ message: string }> => {
      const response = await apiClient.delete(`/cutpay/${cutpayId}`)
      return response.data
    },
    exportCsv: async (params: { date_from?: string, date_to?: string, format?: string }): Promise<Blob> => {
      const response = await apiClient.get<Blob>('/cutpay/export', { 
        params,
        responseType: 'blob' 
      })
      return response.data
    },
    
    // ========================================================================
    // CUTPAY CREATION FLOW - Only /Prod/cutpay/extract endpoint
    // ========================================================================
    
    // Step 1: Extract PDF data (only API endpoint used in creation flow)
    extractPdfForCreation: async (file: File): Promise<ExtractPdfResponse> => {
      const formData = new FormData()
      formData.append('file', file)
      const response = await apiClient.post<ExtractPdfResponse>('/Prod/cutpay/extract-pdf', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      return response.data
    },

    // ========================================================================
    // EXISTING METHODS - For actual transaction operations
    // ========================================================================
    uploadDocument: async (cutpayId: number, file: File, document_type: string = 'policy_pdf'): Promise<DocumentUploadResponse> => {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('document_type', document_type)
      const response = await apiClient.post<DocumentUploadResponse>(`/cutpay/${cutpayId}/upload-document`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      return response.data
    }
  },
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