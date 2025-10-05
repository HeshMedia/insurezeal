'use client'

import React from 'react'
import { useAtom } from 'jotai'
import { toast } from 'sonner'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { ProfileHeader } from './profile-header'
import { ProfileTabs } from './profile-tabs'
import { ProfileDetails } from './profile-details'
import { ProfileEditForm } from './profile-edit-form'
import { DocumentManagement } from './document-management'
import { useProfile, useUpdateProfile, useUploadProfileImage, useDeleteProfileImage } from '@/hooks/profileQuery'
import { isEditingProfileAtom, activeProfileTabAtom } from '@/lib/atoms/profile'
import type { UpdateProfileRequest } from '@/types/profile.types'

export function ProfileView() {
  const { data: profile, isLoading, error } = useProfile()
  const updateProfileMutation = useUpdateProfile()
  const uploadImageMutation = useUploadProfileImage()
  const deleteImageMutation = useDeleteProfileImage()
  const [isEditing, setIsEditing] = useAtom(isEditingProfileAtom)
  const [activeTab] = useAtom(activeProfileTabAtom)
  
  const handleUpdateProfile = async (data: UpdateProfileRequest) => {
    console.log('Submitting profile data:', data)
    try {
      await updateProfileMutation.mutateAsync(data)
      toast.success('Profile updated successfully!')
      setIsEditing(false)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update profile'
      toast.error(errorMessage)
      console.error('Update profile error:', {
        error,
        message: error instanceof Error ? error.message : 'Unknown error',
        data: data
      })
    }
  }

  const handleUploadImage = async (file: File) => {
    try {
      await uploadImageMutation.mutateAsync(file)
      toast.success('Profile image updated successfully!')
    } catch (error) {
      toast.error('Failed to upload profile image')
      console.error('Upload image error:', error)
    }
  }

  const handleDeleteImage = async () => {
    try {
      await deleteImageMutation.mutateAsync()
      toast.success('Profile image deleted successfully!')
    } catch (error) {
      toast.error('Failed to delete profile image')
      console.error('Delete image error:', error)
    }
  }

  const isLoaderActive = 
    updateProfileMutation.isPending || 
    uploadImageMutation.isPending || 
    deleteImageMutation.isPending

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <LoadingSpinner />
          <p className="text-sm text-gray-500">Loading profile...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <p className="text-red-500">Failed to load profile</p>
          <p className="text-sm text-gray-500">{error.message}</p>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <p className="text-gray-500">No profile data available</p>
        </div>
      </div>
    )
  }

  return (
    <div className=" mx-auto space-y-6 p-6">
      <div className="space-y-6">
        {/* Profile Header */}
        <ProfileHeader
          profile={profile}
          onUploadImage={handleUploadImage}
          onDeleteImage={handleDeleteImage}
          isLoading={isLoaderActive}
        />

        {/* Profile Content */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <ProfileTabs />
          
          <div className="p-6">
            {activeTab === 'details' && (
              <>
                {isEditing ? (
                  <ProfileEditForm
                    profile={profile}
                    onSubmit={handleUpdateProfile}
                    onCancel={() => setIsEditing(false)}
                    isLoading={isLoaderActive}
                  />
                ) : (
                  <ProfileDetails
                    profile={profile}
                    onEditClick={() => setIsEditing(true)}
                  />
                )}
              </>
            )}
            
            {activeTab === 'documents' && (
              <DocumentManagement profile={profile} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}