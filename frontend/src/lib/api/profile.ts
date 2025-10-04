import { createAuthenticatedClient } from './client'
import { 
  UserProfile, 
  UpdateProfileRequest, 
  ProfileImageUploadResponse,
  DocumentUploadRequest,
  DocumentUploadResponse,
  DocumentListResponse
} from '@/types/profile.types'

// Create axios instance with Supabase authentication
const apiClient = createAuthenticatedClient()

console.log('Profile API Base URL:', process.env.NEXT_PUBLIC_API_URL)

// Response interceptor for error handling  
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Only log errors that are not permission-related
    if (error.response?.status !== 401 && error.response?.status !== 403) {
      console.error('API Error Details:', {
        response: error.response?.data,
        status: error.response?.status,
        message: error.message,
        config: error.config
      })
    }
    
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

  // Upload profile image using presigned URL flow (S3)
  uploadProfileImage: async (file: File): Promise<ProfileImageUploadResponse> => {
    const contentType = file.type || 'image/jpeg'
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      throw new Error('Only image files are allowed')
    }

    // Validate file size (max 5MB for profile images)
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('Image size must be less than 5MB')
    }
    
    // Build form body as x-www-form-urlencoded per API spec
    const body = new URLSearchParams()
    body.append('filename', file.name)
    body.append('content_type', contentType)

    // Request presigned URL (no file upload here)
    const presignResp = await apiClient.post('/users/me/profile-image', body, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })

    const data = presignResp.data as ProfileImageUploadResponse & { upload_url?: string }

    // Upload binary directly to S3 if upload_url provided
    if (data.upload_url) {
      const putRes = await fetch(data.upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: file,
      })
      if (!putRes.ok) {
        throw new Error(`Failed to upload image to storage (status ${putRes.status})`)
      }
    }

    return data
  },

  // Delete profile image
  deleteProfileImage: async (): Promise<void> => {
    await apiClient.delete('/users/me/profile-image')
  },

  // Upload document using presigned URL flow (S3)
  uploadDocument: async ({ file, document_type, document_name }: DocumentUploadRequest): Promise<DocumentUploadResponse> => {
    const contentType = file.type || 'application/pdf'
    
    // Build form body as x-www-form-urlencoded per API spec
    const body = new URLSearchParams()
    body.append('filename', file.name)
    body.append('content_type', contentType)
    body.append('document_type', document_type)
    body.append('document_name', document_name)

    // Request presigned URL (no file upload here)
    const presignResp = await apiClient.post('/users/documents/upload', body, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })

    const data = presignResp.data as DocumentUploadResponse & { upload_url?: string }

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


