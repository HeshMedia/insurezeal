'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Edit, Camera, Mail, Phone, MapPin, Calendar, User, Briefcase } from 'lucide-react'
import { UserProfile, UpdateProfileRequest } from '@/types/profile.types'
import { ProfileEditForm } from '@/components/profile/profile-edit-form'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface DetailItem {
  label: string
  value: string | number | null | undefined
  icon: React.ComponentType<{ className?: string }>
}

interface ProfileCardProps {
  profile: UserProfile
  onUpdateProfile: (data: UpdateProfileRequest) => void
  onUploadImage: (file: File) => void
  isLoading?: boolean
  className?: string
}

export function ProfileCard({ 
  profile, 
  onUpdateProfile, 
  onUploadImage, 
  isLoading = false,
  className
}: ProfileCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [activeTab, setActiveTab] = useState('details')

  const fullName = [profile.first_name, profile.middle_name, profile.last_name]
    .filter(Boolean)
    .join(' ') || 'User'

  const initials = fullName
    .split(' ')
    .map(name => name[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const handleEditToggle = () => {
    setIsEditing(!isEditing)
  }
  const handleFormSubmit = async (data: UpdateProfileRequest) => {
    await onUpdateProfile(data)
    setIsEditing(false)
  }

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

    onUploadImage(file)
  }

  return (
    <div className={cn("w-full max-w-4xl mx-auto space-y-6", className)}>
      {/* Profile Header Card */}
      <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900">
        <CardContent className="p-8">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            {/* Avatar Section */}
            <div className="relative group">
              <Avatar className="w-24 h-24 border-4 border-white shadow-lg">
                <AvatarImage src={profile.avatar_url} alt={fullName} />
                <AvatarFallback className="text-2xl font-semibold bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                  {initials}
                </AvatarFallback>
              </Avatar>
              
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-full flex items-center justify-center cursor-pointer">
                <div className="text-center">
                  <Camera className="w-6 h-6 text-white mx-auto mb-1" />
                  <span className="text-xs text-white font-medium">Change Photo</span>
                </div>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  onChange={handleImageUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Profile Info */}
            <div className="flex-1 space-y-3">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  {fullName}
                </h1>
                <p className="text-lg text-gray-600 dark:text-gray-300">
                  @{profile.username || profile.email.split('@')[0]}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                  {profile.user_role || 'Admin'}
                </Badge>
                {profile.agent_code && (
                  <Badge variant="outline">
                    Agent Code: {profile.agent_code}
                  </Badge>
                )}
              </div>

              <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
                {profile.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    <span>{profile.email}</span>
                  </div>
                )}
                {profile.mobile_number && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    <span>{profile.mobile_number}</span>
                  </div>
                )}
                {profile.permanent_city && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    <span>{profile.permanent_city}, {profile.permanent_state}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Edit Button */}
            <Button 
              onClick={handleEditToggle}
              variant={isEditing ? "outline" : "default"}
              className="min-w-[120px]"
              disabled={isLoading}
            >
              <Edit className="w-4 h-4 mr-2" />
              {isEditing ? 'Cancel' : 'Edit Profile'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Details Card */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="details">Your Details</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsContent value="details" className="space-y-6">
              {isEditing ? (
                <ProfileEditForm
                  profile={profile}
                  onSubmit={handleFormSubmit}
                  onCancel={handleEditToggle}
                  isLoading={isLoading}
                />
              ) : (
                <ProfileDetails profile={profile} />
              )}
            </TabsContent>
            
            <TabsContent value="documents">
              <div className="text-center py-8 text-gray-500">
                <p>Document management coming soon...</p>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

// Profile Details Display Component
function ProfileDetails({ profile }: { profile: UserProfile }) {
  const personalDetails = [
    { label: 'First Name', value: profile.first_name, icon: User },
    { label: 'Middle Name', value: profile.middle_name, icon: User },
    { label: 'Last Name', value: profile.last_name, icon: User },
    { label: 'Father Name', value: profile.father_name, icon: User },
    { label: 'Mother Name', value: profile.mother_name, icon: User },
    { label: 'Date of Birth', value: profile.date_of_birth, icon: Calendar },
    { label: 'Gender', value: profile.gender, icon: User },
  ]

  const contactDetails = [
    { label: 'Email', value: profile.email, icon: Mail },
    { label: 'Mobile Number', value: profile.mobile_number, icon: Phone },
    { label: 'Alternate Mobile', value: profile.alternate_mobile, icon: Phone },
    { label: 'Alternate Email', value: profile.alternate_email, icon: Mail },
  ]

  const addressDetails = [
    { label: 'Address Line 1', value: profile.permanent_address_line1, icon: MapPin },
    { label: 'Address Line 2', value: profile.permanent_address_line2, icon: MapPin },
    { label: 'City', value: profile.permanent_city, icon: MapPin },
    { label: 'State', value: profile.permanent_state, icon: MapPin },
    { label: 'Pincode', value: profile.permanent_pincode, icon: MapPin },
  ]

  const professionalDetails = [
    { label: 'Education Level', value: profile.education_level, icon: Briefcase },
    { label: 'Specialization', value: profile.specialization, icon: Briefcase },
    { label: 'Previous Experience', value: profile.previous_insurance_experience ? 'Yes' : 'No', icon: Briefcase },
    { label: 'Years of Experience', value: profile.years_of_experience, icon: Briefcase },
    { label: 'Previous Company', value: profile.previous_company_name, icon: Briefcase },
  ]

  const DetailSection = ({ title, details }: { title: string, details: DetailItem[] }) => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white border-b pb-2">
        {title}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {details.map((detail, index) => (
          detail.value && (
            <div key={index} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
              <detail.icon className="w-4 h-4 text-gray-500" />
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {detail.label}
                </p>
                <p className="text-sm text-gray-900 dark:text-white">
                  {detail.value}
                </p>
              </div>
            </div>
          )
        ))}
      </div>
    </div>
  )

  return (
    <div className="space-y-8">
      <DetailSection title="Personal Information" details={personalDetails} />
      <Separator />
      <DetailSection title="Contact Information" details={contactDetails} />
      <Separator />
      <DetailSection title="Address Information" details={addressDetails} />
      <Separator />
      <DetailSection title="Professional Information" details={professionalDetails} />
    </div>
  )
}
