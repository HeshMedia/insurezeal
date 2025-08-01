import axios, { AxiosInstance } from 'axios'
import Cookies from 'js-cookie'
import { 
  Broker,
  CreateBrokerRequest,
  UpdateBrokerRequest,
  Insurer,
  CreateInsurerRequest,
  UpdateInsurerRequest,
  BrokerInsurerListResponse,
  AdminChildId,
  CreateAdminChildIdRequest,
  UpdateAdminChildIdRequest,
  AvailableChildIdsParams
} from '@/types/superadmin.types'

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
      console.error('SuperAdmin API Error:', {
        response: error.response?.data,
        status: error.response?.status,
        message: error.message
      })
    }
    
    const message = error.response?.data?.detail || 
                    error.response?.data?.message || 
                    error.message || 
                    'An unexpected error occurred'
    
    throw new Error(message)
  }
)

export const superadminApi = {
  
  // Broker APIs
  brokers: {
    // Get all brokers
    list: async (): Promise<Broker[]> => {
      const response = await apiClient.get('/superadmin/brokers')
      return response.data
    },

    // Create new broker
    create: async (data: CreateBrokerRequest): Promise<Broker> => {
      const response = await apiClient.post('/superadmin/brokers', data)
      return response.data
    },

    // Get broker by code
    getById: async (brokerCode: string): Promise<Broker> => {
      const response = await apiClient.get(`/superadmin/brokers/${brokerCode}`)
      return response.data
    },

    // Update broker
    update: async (brokerCode: string, data: UpdateBrokerRequest): Promise<Broker> => {
      const response = await apiClient.put(`/superadmin/brokers/${brokerCode}`, data)
      return response.data
    }
  },

  // Insurer APIs
  insurers: {
    // Get all insurers
    list: async (): Promise<Insurer[]> => {
      const response = await apiClient.get('/superadmin/insurers')
      return response.data
    },

    // Create new insurer
    create: async (data: CreateInsurerRequest): Promise<Insurer> => {
      const response = await apiClient.post('/superadmin/insurers', data)
      return response.data
    },

    // Get insurer by ID
    getById: async (insurerCode: string): Promise<Insurer> => {
      const response = await apiClient.get(`/superadmin/insurers/${insurerCode}`)
      return response.data
    },

    // Update insurer
    update: async (insurerCode: string, data: UpdateInsurerRequest): Promise<Insurer> => {
      const response = await apiClient.put(`/superadmin/insurers/${insurerCode}`, data)
      return response.data
    }
  },

  // Combined Brokers-Insurers List
  getBrokersInsurersList: async (): Promise<BrokerInsurerListResponse> => {
    const response = await apiClient.get('/superadmin/brokers-insurers-list')
    return response.data
  },

  // Admin Child ID APIs
  adminChildIds: {
    // Get all admin child IDs
    list: async (): Promise<AdminChildId[]> => {
      const response = await apiClient.get('/superadmin/admin-child-ids')
      return response.data
    },

    // Create new admin child ID
    create: async (data: CreateAdminChildIdRequest): Promise<AdminChildId> => {
      const response = await apiClient.post('/superadmin/admin-child-ids', data)
      return response.data
    },

    // Get admin child ID by ID
    getById: async (childIdId: number): Promise<AdminChildId> => {
      const response = await apiClient.get(`/superadmin/admin-child-ids/${childIdId}`)
      return response.data
    },

    // Update admin child ID
    update: async (childIdId: number, data: UpdateAdminChildIdRequest): Promise<AdminChildId> => {
      const response = await apiClient.put(`/superadmin/admin-child-ids/${childIdId}`, data)
      return response.data
    },

    // Delete admin child ID
    delete: async (childIdId: number): Promise<{ message: string }> => {
      const response = await apiClient.delete(`/superadmin/admin-child-ids/${childIdId}`)
      return response.data
    },

    // Get available admin child IDs
    getAvailable: async (params: AvailableChildIdsParams): Promise<AdminChildId[]> => {
      const response = await apiClient.get('/superadmin/admin-child-ids/available', {
        params: {
          insurer_code: params.insurer_code,
          broker_code: params.broker_code
        }
      })
      return response.data
    }
  }
}
