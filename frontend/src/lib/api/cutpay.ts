import axios, { AxiosInstance } from 'axios'
import Cookies from 'js-cookie'
import {
  CutPayTransaction,
  CreateCutPayRequest,
  UpdateCutPayRequest,
  CutPayListParams,
  CutPayDocumentUploadResponse,
  ExtractPdfResponse,
  CutPayDeleteResponse
} from '@/types/cutpay.types'

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: 'https://bha0h2t0a2.execute-api.ap-south-1.amazonaws.com/Prod',
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
  create: async (data: CreateCutPayRequest): Promise<CutPayTransaction> => {
    const response = await apiClient.post('/cutpay/', data)
    return response.data
  },

  // List cutpay transactions
  list: async (params?: CutPayListParams): Promise<CutPayTransaction[]> => {
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
    return response.data
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

  // Upload policy document
  uploadDocument: async (
    cutpayId: number, 
    file: File, 
    documentType: string = 'policy_pdf'
  ): Promise<CutPayDocumentUploadResponse> => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('document_type', documentType)
    
    const response = await apiClient.post(`/cutpay/${cutpayId}/upload-document`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
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
  }
}
