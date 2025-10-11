import { createAuthenticatedClient } from './client'
import { 
  ChildIdRequest,
  CreateChildIdRequest,
  ChildIdListResponse,
  ChildIdListParams,
  InsurerDropdownResponse,
  BrokerInsurerDropdownResponse,
  AgentMISParams,
  AgentMISResponse
} from '@/types/agent.types'

// Create axios instance with Supabase authentication
const apiClient = createAuthenticatedClient()

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('Agent API Error:', {
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

export const agentApi = {
  
  // Child ID APIs
  childId: {
    // Get insurers for Direct Code selection
    getInsurers: async (): Promise<InsurerDropdownResponse[]> => {
      const response = await apiClient.get('/get-insurers')
      return response.data
    },

    // Get brokers and insurers for Broker Code selection
    getBrokersAndInsurers: async (): Promise<BrokerInsurerDropdownResponse> => {
      const response = await apiClient.get('/get-brokers-and-insurers')
      return response.data
    },

    // Create new child ID request
    create: async (data: CreateChildIdRequest): Promise<ChildIdRequest> => {
      const response = await apiClient.post('/request', data)
      return response.data
    },

    // Get user's child ID requests (paginated)
    getMyRequests: async (params?: ChildIdListParams): Promise<ChildIdListResponse> => {
      const response = await apiClient.get('/my-requests', {
        params: {
          page: params?.page || 1,
          page_size: params?.page_size || 20
        }
      })
      return response.data
    },

    // Get specific child ID request details
    getRequestById: async (requestId: string): Promise<ChildIdRequest> => {
      const response = await apiClient.get(`/request/${requestId}`)
      return response.data
    },

    // Get user's active (accepted) child IDs
    getActiveChildIds: async (): Promise<ChildIdRequest[]> => {
      const response = await apiClient.get('/active')
      return response.data
    }
  },
  // MIS APIs
  mis: {
    // Get agent MIS data (agent's own quarterly data)
    getAgentMISData: async (params: AgentMISParams): Promise<AgentMISResponse> => {
      const {
        quarter = 3,
        year = 2025,
        page = 1,
        page_size = 50,
        date_from,
        date_to,
      } = params
      
      const response = await apiClient.get(`/mis/my-mis`, {
        params: {
          quarter,
          year,
          page,
          page_size,
          date_from,
          date_to,
        }
      })
      return response.data
    }
  }
}