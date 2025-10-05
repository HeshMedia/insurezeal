'use client'

import React, { useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Camera, 
  Mail, 
  Phone, 
  MapPin, 
  Upload, 
  Trash2,
  Edit
} from 'lucide-react'
import { UserProfile } from '@/types/profile.types'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { toast } from 'sonner'

interface ProfileHeaderProps {
  profile: UserProfile
  onUploadImage: (file: File) => void
  onDeleteImage: () => void
  isLoading?: boolean
}

export function ProfileHeader({ 
  profile, 
  onUploadImage, 
  onDeleteImage, 
  isLoading = false 
}: ProfileHeaderProps) {
  const [showImageOptions, setShowImageOptions] = useState(false)

  const fullName = [profile.first_name, profile.middle_name, profile.last_name]
    .filter(Boolean)
    .join(' ') || 'User'

  const initials = fullName
    .split(' ')
    .map(name => name[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB')
      return
    }

    // Validate image dimensions (optional, for better UX)
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        // Recommend square images but don't enforce
        if (Math.abs(img.width - img.height) > 100) {
          toast.warning('For best results, use a square image')
        }
        
        onUploadImage(file)
        setShowImageOptions(false)
      }
      img.onerror = () => {
        toast.error('Failed to load image. Please try another file.')
      }
      img.src = e.target?.result as string
    }
    reader.readAsDataURL(file)
  }

  const handleDeleteImage = () => {
    onDeleteImage()
    setShowImageOptions(false)
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
      <div className="flex flex-col lg:flex-row items-center gap-8">
        {/* Profile Photo Section */}
        <div className="relative group">
          <Avatar className="w-32 h-32 border-4 border-white shadow-xl">
            <AvatarImage src={profile.avatar_url} alt={fullName} />
            <AvatarFallback className="text-3xl font-semibold bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
              {initials}
            </AvatarFallback>
          </Avatar>
          
          {/* Image Actions */}
          <Dialog open={showImageOptions} onOpenChange={setShowImageOptions}>
            <DialogTrigger asChild>
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-full flex items-center justify-center cursor-pointer">
                <Camera className="w-8 h-8 text-white" />
              </div>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Profile Picture</DialogTitle>
                <DialogDescription>
                  Choose an action for your profile picture
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-3">
                <Button
                  variant="outline"
                  disabled={isLoading}
                  className="w-full justify-start"
                  onClick={() => document.getElementById('avatar-upload')?.click()}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {isLoading ? 'Uploading...' : 'Upload New Picture'}
                </Button>
                <p className="text-xs text-gray-500 text-center px-2">
                  Accepts JPG, PNG, GIF (max 5MB)
                </p>
                
                {profile.avatar_url && (
                  <Button
                    variant="outline"
                    disabled={isLoading}
                    className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                    onClick={handleDeleteImage}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Remove Picture
                  </Button>
                )}
                
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  disabled={isLoading}
                />
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Profile Info */}
        <div className="flex-1 text-center lg:text-left space-y-4">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {fullName}
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-300">
              @{profile.username || profile.email.split('@')[0]}
            </p>
          </div>
          
          <div className="flex flex-wrap justify-center lg:justify-start gap-3">
            <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-3 py-1">
              <Edit className="w-3 h-3 mr-1" />
              {profile.user_role || 'Admin'}
            </Badge>
            <Badge variant="outline" className="px-3 py-1">
              ID: {profile.user_id}
            </Badge>
            {profile.agent_code && (
              <Badge variant="outline" className="px-3 py-1">
                Agent: {profile.agent_code}
              </Badge>
            )}
          </div>

          {/* Contact Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
            {profile.email && (
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex-shrink-0">
                  <Mail className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Email</p>
                  <p className="text-sm text-gray-900 dark:text-white truncate">{profile.email}</p>
                </div>
              </div>
            )}
            
            {profile.mobile_number && (
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex-shrink-0">
                  <Phone className="w-4 h-4 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Phone</p>
                  <p className="text-sm text-gray-900 dark:text-white">{profile.mobile_number}</p>
                </div>
              </div>
            )}
            
            {profile.permanent_city && (
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex-shrink-0">
                  <MapPin className="w-4 h-4 text-red-600 dark:text-red-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Location</p>
                  <p className="text-sm text-gray-900 dark:text-white">
                    {profile.permanent_city}, {profile.permanent_state}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
