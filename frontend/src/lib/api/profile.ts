import axios, { AxiosInstance } from 'axios'
import Cookies from 'js-cookie'
import { 
  UserProfile, 
  UpdateProfileRequest, 
  ProfileImageUploadResponse,
  DocumentUploadRequest,
  DocumentUploadResponse,
  DocumentListResponse
} from '@/types/profile.types'

// Create axios instance (reusing the same configuration as auth.ts)
const apiClient: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

console.log('Profile API Base URL:', process.env.NEXT_PUBLIC_API_URL)

// Request interceptor to add auth token
apiClient.interceptors.request.use((config) => {
  const token = Cookies.get('access_token')
  console.log('API Request token:', token ? 'Token present' : 'No token found')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  console.log('API Request:', {
    method: config.method,
    url: config.url,
    baseURL: config.baseURL,
    headers: config.headers,
    data: config.data
  })
  return config
})

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error Details:', {
      response: error.response?.data,
      status: error.response?.status,
      message: error.message,
      config: error.config
    })
    
    // Extract meaningful error message
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

export const profileApi = {
  // Get current user profile
  getCurrentProfile: async (): Promise<UserProfile> => {
    const response = await apiClient.get('/users/me')
    return response.data
  },
  // Update current user profile
  updateProfile: async (data: UpdateProfileRequest): Promise<UserProfile> => {
    console.log('Updating profile with data:', data)
    try {
      const response = await apiClient.put('/users/me', data)
      console.log('Profile update response:', response.data)
      return response.data
    } catch (error) {
      console.error('Profile update failed:', error)
      throw error
    }
  },

  // Upload profile image
  uploadProfileImage: async (file: File): Promise<ProfileImageUploadResponse> => {
    const formData = new FormData()
    formData.append('file', file)

    const response = await apiClient.post('/users/me/profile-image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  },

  // Delete profile image
  deleteProfileImage: async (): Promise<void> => {
    await apiClient.delete('/users/me/profile-image')
  },

  // Upload document
  uploadDocument: async ({ file, document_type, document_name }: DocumentUploadRequest): Promise<DocumentUploadResponse> => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('document_type', document_type)
    formData.append('document_name', document_name)

    const response = await apiClient.post('/users/documents/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  },

  // Get user documents
  getUserDocuments: async (): Promise<DocumentListResponse> => {
    const response = await apiClient.get('/users/documents')
    return response.data
  },

  // Delete document
  deleteDocument: async (documentId: string): Promise<void> => {
    await apiClient.delete(`/users/documents/${documentId}`)
  },
}


