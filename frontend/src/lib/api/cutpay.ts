/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAuthenticatedClient } from './client'
import {
  CutPayTransaction,
  CreateCutpayTransactionCutpayPostRequest,
  UpdateCutPayRequest,
  CutPayListParams,
  CutPayListResponse,
  CutPayDocumentUploadResponse,
  CutPayDeleteResponse,
  ExtractPdfResponse,
  CutPayCalculationRequest,
  CutPayCalculationResponse,
  AgentConfig,
  CreateAgentConfigRequest,
  ListAgentConfigsParams,
  UpdateAgentConfigRequest,
  BulkPostCutpayRequest,
  BulkPostCutpayResponse,
  PolicyDetailsResponse,
  CutPayDatabaseResponse,
} from '@/types/cutpay.types'

// Create axios instance with Supabase authentication
const apiClient = createAuthenticatedClient()

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('Cutpay API Error:', {
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

export const cutpayApi = {
  // Create cutpay transaction
  create: async (data: CreateCutpayTransactionCutpayPostRequest): Promise<CutPayTransaction> => {
    const response = await apiClient.post('/cutpay/', data)
    return response.data
  },

  // List cutpay transactions
  list: async (params?: CutPayListParams): Promise<CutPayListResponse> => {
    const response = await apiClient.get('/cutpay/', {
      params: {
        broker_code: params?.broker_code,
        date_from: params?.date_from,
        date_to: params?.date_to,
        insurer_code: params?.insurer_code,
        limit: params?.limit || 100,
        search: params?.search,
        skip: params?.skip || 0
      }
    })
    const limit = params?.limit || 100
    const skip = params?.skip || 0

    const payload = response.data as
      | CutPayTransaction[]
      | {
          results?: CutPayTransaction[]
          data?: CutPayTransaction[]
          transactions?: CutPayTransaction[]
          items?: CutPayTransaction[]
          total_count?: number
          count?: number
          total?: number
          pagination?: { total?: number }
        }

    const extractTransactions = () => {
      if (Array.isArray(payload)) {
        return payload
      }
      return (
        payload?.results ||
        payload?.data ||
        payload?.transactions ||
        payload?.items ||
        []
      )
    }

    const transactions = extractTransactions()

    const extractTotalCount = () => {
      if (Array.isArray(payload)) {
        return undefined
      }
      return (
        payload?.total_count ??
        payload?.count ??
        payload?.total ??
        payload?.pagination?.total ??
        undefined
      )
    }

    const headerTotal = Number.parseInt(
      response.headers?.['x-total-count'] ?? response.headers?.['x_total_count'] ?? '',
      10
    )

    const totalCount = Number.isFinite(headerTotal)
      ? headerTotal
      : extractTotalCount()

    return {
      transactions,
      total_count: totalCount ?? (skip === 0 ? transactions.length : undefined),
      limit,
      skip,
    }
  },

  // Get specific cutpay transaction
  getById: async (cutpayId: number): Promise<CutPayTransaction> => {
    const response = await apiClient.get(`/cutpay/${cutpayId}`)
    return response.data
  },

  // Update cutpay transaction
  update: async (cutpayId: number, data: UpdateCutPayRequest): Promise<CutPayTransaction> => {
    const response = await apiClient.put(`/cutpay/${cutpayId}`, data)
    return response.data
  },

  // Delete cutpay transaction
  delete: async (cutpayId: number): Promise<CutPayDeleteResponse> => {
    const response = await apiClient.delete(`/cutpay/${cutpayId}`)
    return response.data
  },

  // Add bulk post-cutpay details
  addBulkPostDetails: async (data: BulkPostCutpayRequest): Promise<BulkPostCutpayResponse> => {
    const response = await apiClient.post('/cutpay/post-details', data)
    return response.data
  },

  // Update bulk post-cutpay details
  updateBulkPostDetails: async (data: BulkPostCutpayRequest): Promise<BulkPostCutpayResponse> => {
    const response = await apiClient.put('/cutpay/post-details', data)
    return response.data
  },

  // New policy-based endpoints
  getByPolicy: async (params: { policy_number: string; quarter: number; year: number }): Promise<PolicyDetailsResponse> => {
    const response = await apiClient.get('/cutpay/policy-details', { params })
    return response.data
  },

  updateByPolicy: async (
    params: { policy_number: string; quarter: number; year: number },
    data: CreateCutpayTransactionCutpayPostRequest
  ): Promise<CutPayDatabaseResponse> => {
    const response = await apiClient.put('/cutpay/policy-update', data, { params })
    return response.data
  },

  deleteByPolicy: async (params: { policy_number: string; quarter: number; year: number }): Promise<any> => {
    const response = await apiClient.delete('/cutpay/policy-delete', { params })
    return response.data
  },

  // Upload policy document using presigned URL flow
  uploadDocument: async (
    cutpayId: number,
    file: File,
    documentType: string = 'policy_pdf'
  ): Promise<CutPayDocumentUploadResponse> => {
    const contentType = file.type || 'application/pdf'

    // Build form body as x-www-form-urlencoded per API spec
    const body = new URLSearchParams()
    body.append('filename', file.name)
    body.append('content_type', contentType)

    // For main policy, send policy_pdf; for others, mark as additional_documents
    const docCategory = documentType === 'policy_pdf' ? 'policy_pdf' : 'additional_documents'
    body.append('document_type', docCategory)
    // API requires 'type' always; for main policy use 'policy_pdf' as type key
    body.append('type', documentType || 'policy_pdf')

    // Request presigned URL (no file upload here)
    const presignResp = await apiClient.post('/cutpay/upload-document', body, {
      params: { cutpay_id: cutpayId },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })

    const data = presignResp.data as CutPayDocumentUploadResponse & { upload_url?: string }

    // Upload binary directly to S3 if upload_url provided
    if (data.upload_url) {
      const putRes = await fetch(data.upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: file,
      })
      if (!putRes.ok) {
        throw new Error(`Failed to upload document to storage (status ${putRes.status})`)
      }
    }

    return data
  },

  // Extract PDF data
  extractPdf: async (file: File): Promise<ExtractPdfResponse> => {
    const formData = new FormData()
    formData.append('file', file)
    
    const response = await apiClient.post('/cutpay/extract-pdf', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  },

  // Calculate cutpay amounts
  calculate: async (data: CutPayCalculationRequest): Promise<CutPayCalculationResponse> => {
    const response = await apiClient.post('/cutpay/calculate', data)
    return response.data
  },

  agentConfig: {
    create: async (data: CreateAgentConfigRequest): Promise<AgentConfig> => {
      const response = await apiClient.post('/cutpay/agent-config', data)
      return response.data
    },

    list: async (params?: ListAgentConfigsParams): Promise<AgentConfig[]> => {
      const response = await apiClient.get('/cutpay/agent-config', { params })
      return response.data
    },

    getById: async (configId: number): Promise<AgentConfig> => {
      const response = await apiClient.get(`/cutpay/agent-config/${configId}`)
      return response.data
    },

    update: async (configId: number, data: UpdateAgentConfigRequest): Promise<AgentConfig> => {
      const response = await apiClient.put(`/cutpay/agent-config/${configId}`, data)
      return response.data
    },

    delete: async (configId: number): Promise<{ message: string }> => {
      const response = await apiClient.delete(`/cutpay/agent-config/${configId}`)
      return { message: response.data }
    },

    getPoPaid: async (agentCode: string): Promise<{
      agent_code: string
      total_po_paid: number
      latest_config_date: string
      configurations_count: number
    }> => {
      const response = await apiClient.get(`/cutpay/agent-config/agent/${agentCode}/po-paid`)
      return response.data
    },
  },
}
