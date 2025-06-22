import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { profileApi } from '@/lib/api/profile'

// Query keys
const QUERY_KEYS = {
  profile: ['profile'] as const,
  documents: ['documents'] as const,
}

// Get current profile
export const useProfile = () => {
  return useQuery({
    queryKey: QUERY_KEYS.profile,
    queryFn: profileApi.getCurrentProfile,
  })
}

// Update profile
export const useUpdateProfile = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: profileApi.updateProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.profile })
    },
  })
}

// Upload profile image
export const useUploadProfileImage = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: profileApi.uploadProfileImage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.profile })
    },
  })
}

// Delete profile image
export const useDeleteProfileImage = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: profileApi.deleteProfileImage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.profile })
    },
  })
}

// Get user documents
export const useUserDocuments = () => {
  return useQuery({
    queryKey: QUERY_KEYS.documents,
    queryFn: profileApi.getUserDocuments,
  })
}

// Upload document
export const useUploadDocument = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: profileApi.uploadDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documents })
    },
  })
}

// Delete document
export const useDeleteDocument = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: profileApi.deleteDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documents })
    },
  })
}