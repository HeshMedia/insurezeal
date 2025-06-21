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
    const message = error.response?.data?.detail || error.message || 'An error occurred'
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
    const response = await apiClient.put('/users/me', data)
    return response.data
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

// TanStack Query Keys
export const profileQueryKeys = {
  all: ['profile'] as const,
  profile: () => [...profileQueryKeys.all, 'current'] as const,
  documents: () => [...profileQueryKeys.all, 'documents'] as const,
}

// TanStack Query Hooks
export const useProfile = () => {
  return {
    // Query hooks
    useGetProfile: () => {
      const { useQuery } = require('@tanstack/react-query')
      return useQuery({
        queryKey: profileQueryKeys.profile(),
        queryFn: profileApi.getCurrentProfile,
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 10 * 60 * 1000, // 10 minutes
      })
    },

    useGetDocuments: () => {
      const { useQuery } = require('@tanstack/react-query')
      return useQuery({
        queryKey: profileQueryKeys.documents(),
        queryFn: profileApi.getUserDocuments,
        staleTime: 2 * 60 * 1000, // 2 minutes
      })
    },

    // Mutation hooks
    useUpdateProfile: () => {
      const { useMutation, useQueryClient } = require('@tanstack/react-query')
      const queryClient = useQueryClient()

      return useMutation({
        mutationFn: profileApi.updateProfile,
        onSuccess: (data: UserProfile) => {
          // Update the profile cache
          queryClient.setQueryData(profileQueryKeys.profile(), data)
          queryClient.invalidateQueries({ queryKey: profileQueryKeys.profile() })
        },
      })
    },

    useUploadProfileImage: () => {
      const { useMutation, useQueryClient } = require('@tanstack/react-query')
      const queryClient = useQueryClient()

      return useMutation({
        mutationFn: profileApi.uploadProfileImage,
        onSuccess: () => {
          // Invalidate profile cache to refetch with new image
          queryClient.invalidateQueries({ queryKey: profileQueryKeys.profile() })
        },
      })
    },

    useDeleteProfileImage: () => {
      const { useMutation, useQueryClient } = require('@tanstack/react-query')
      const queryClient = useQueryClient()

      return useMutation({
        mutationFn: profileApi.deleteProfileImage,
        onSuccess: () => {
          // Invalidate profile cache to refetch without image
          queryClient.invalidateQueries({ queryKey: profileQueryKeys.profile() })
        },
      })
    },

    useUploadDocument: () => {
      const { useMutation, useQueryClient } = require('@tanstack/react-query')
      const queryClient = useQueryClient()

      return useMutation({
        mutationFn: profileApi.uploadDocument,
        onSuccess: () => {
          // Invalidate documents cache to show new document
          queryClient.invalidateQueries({ queryKey: profileQueryKeys.documents() })
          // Also invalidate profile to update document_urls if needed
          queryClient.invalidateQueries({ queryKey: profileQueryKeys.profile() })
        },
      })
    },

    useDeleteDocument: () => {
      const { useMutation, useQueryClient } = require('@tanstack/react-query')
      const queryClient = useQueryClient()

      return useMutation({
        mutationFn: profileApi.deleteDocument,
        onSuccess: () => {
          // Invalidate documents cache to remove deleted document
          queryClient.invalidateQueries({ queryKey: profileQueryKeys.documents() })
          // Also invalidate profile to update document_urls if needed
          queryClient.invalidateQueries({ queryKey: profileQueryKeys.profile() })
        },
      })
    },
  }
}