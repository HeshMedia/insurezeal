'use client'

import React from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Save, X } from 'lucide-react'
import { UserProfile, UpdateProfileRequest } from '@/types/profile.types'
import { toast } from 'sonner'

interface ProfileFormData {
  first_name: string
  middle_name?: string
  last_name: string
  father_name?: string
  mother_name?: string
  date_of_birth?: string
  gender?: 'male' | 'female' | 'other'
  mobile_number?: string
  alternate_mobile?: string
  alternate_email?: string
  permanent_address_line1?: string
  permanent_address_line2?: string
  permanent_city?: string
  permanent_state?: string
  permanent_pincode?: string
  communication_same_as_permanent?: boolean
  communication_address_line1?: string
  communication_address_line2?: string
  communication_city?: string
  communication_state?: string
  communication_pincode?: string
  education_level?: 'high_school' | 'diploma' | 'bachelors' | 'masters' | 'doctorate' | 'professional'
  specialization?: string
  previous_insurance_experience?: boolean
  years_of_experience?: number
  previous_company_name?: string
  bank_name?: string
  account_number?: string
  ifsc_code?: string
  branch_name?: string
  nominee_name?: string
  nominee_relationship?: string
  nominee_date_of_birth?: string
  preferred_language?: string
  territory_preference?: string
  timezone?: string
  language?: string
  username?: string
  display_name?: string
  bio?: string
}

interface ProfileEditFormProps {
  profile: UserProfile
  onSubmit: (data: UpdateProfileRequest) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
}

export function ProfileEditForm({ profile, onSubmit, onCancel, isLoading = false }: ProfileEditFormProps) {  const form = useForm<ProfileFormData>({
    defaultValues: {
      first_name: profile.first_name || '',
      middle_name: profile.middle_name || '',
      last_name: profile.last_name || '',
      father_name: profile.father_name || '',
      mother_name: profile.mother_name || '',
      date_of_birth: profile.date_of_birth || '',
      gender: profile.gender || undefined,
      mobile_number: profile.mobile_number || '',
      alternate_mobile: profile.alternate_mobile || '',
      alternate_email: profile.alternate_email || '',
      permanent_address_line1: profile.permanent_address_line1 || '',
      permanent_address_line2: profile.permanent_address_line2 || '',
      permanent_city: profile.permanent_city || '',
      permanent_state: profile.permanent_state || '',
      permanent_pincode: profile.permanent_pincode || '',
      communication_same_as_permanent: profile.communication_same_as_permanent || false,
      communication_address_line1: profile.communication_address_line1 || '',
      communication_address_line2: profile.communication_address_line2 || '',
      communication_city: profile.communication_city || '',
      communication_state: profile.communication_state || '',
      communication_pincode: profile.communication_pincode || '',
      education_level: profile.education_level || undefined,
      specialization: profile.specialization || '',
      previous_insurance_experience: profile.previous_insurance_experience || false,
      years_of_experience: profile.years_of_experience || undefined,
      previous_company_name: profile.previous_company_name || '',
      bank_name: profile.bank_name || '',
      account_number: profile.account_number || '',
      ifsc_code: profile.ifsc_code || '',
      branch_name: profile.branch_name || '',
      nominee_name: profile.nominee_name || '',
      nominee_relationship: profile.nominee_relationship || '',
      nominee_date_of_birth: profile.nominee_date_of_birth || '',
      preferred_language: profile.preferred_language || '',
      territory_preference: profile.territory_preference || '',
      timezone: profile.timezone || '',
      language: profile.language || '',
      username: profile.username || '',
      display_name: profile.display_name || '',
      bio: profile.bio || '',
    },
  })

  const { register, handleSubmit, watch, setValue } = form
  const watchSameAddress = watch('communication_same_as_permanent')

  // Auto-fill communication address when checkbox is checked
  React.useEffect(() => {
    if (watchSameAddress) {
      setValue('communication_address_line1', form.getValues('permanent_address_line1'))
      setValue('communication_address_line2', form.getValues('permanent_address_line2'))
      setValue('communication_city', form.getValues('permanent_city'))
      setValue('communication_state', form.getValues('permanent_state'))
      setValue('communication_pincode', form.getValues('permanent_pincode'))
    }
  }, [watchSameAddress, setValue, form])
  const handleFormSubmit = async (data: ProfileFormData) => {
    // Simple validation
    if (!data.first_name?.trim()) {
      toast.error('First name is required')
      return
    }
    if (!data.last_name?.trim()) {
      toast.error('Last name is required')
      return
    }

    // Process form data to create the payload.
    // Convert empty strings or undefined values to null to ensure all fields are sent.
    const payload = Object.fromEntries(
      Object.entries(data).map(([key, value]) => {
        if (value === undefined || (typeof value === 'string' && value.trim() === '')) {
          return [key, null]
        }
        return [key, value]
      })
    )

    // Prepare update data with proper type conversion for numeric fields.
    const updateData: UpdateProfileRequest = {
      ...payload,
      years_of_experience:
        payload.years_of_experience !== null ? Number(payload.years_of_experience) : null,
    }

    console.log('Form data being submitted:', updateData)
    await onSubmit(updateData)
  }
  const FormField = ({ label, required, children }: { label: string, required?: boolean, children: React.ReactNode }) => (
    <div className="space-y-2">
      <Label className="text-sm font-medium">
        {label} {required && <span className="text-red-500">*</span>}
      </Label>
      {children}
    </div>
  )

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-8">
      {/* Personal Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white border-b pb-2">
          Personal Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <FormField label="First Name" required>
            <Input 
              {...register('first_name', { required: true })} 
              placeholder="Enter first name" 
            />
          </FormField>
          
          <FormField label="Middle Name">
            <Input {...register('middle_name')} placeholder="Enter middle name" />
          </FormField>
          
          <FormField label="Last Name" required>
            <Input 
              {...register('last_name', { required: true })} 
              placeholder="Enter last name" 
            />
          </FormField>
            <FormField label="Father's Name">
            <Input {...register('father_name')} placeholder="Enter father&apos;s name" />
          </FormField>
          
          <FormField label="Mother's Name">
            <Input {...register('mother_name')} placeholder="Enter mother&apos;s name" />
          </FormField>
          
          <FormField label="Date of Birth">
            <Input {...register('date_of_birth')} type="date" />
          </FormField>
          
          <FormField label="Gender">
            <Select 
              value={watch('gender') || ''} 
              onValueChange={(value) => setValue('gender', value as 'male' | 'female' | 'other')}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
        </div>
      </div>      <Separator />

      {/* Contact Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white border-b pb-2">
          Contact Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Mobile Number">
            <Input {...register('mobile_number')} placeholder="Enter mobile number" />
          </FormField>
          
          <FormField label="Alternate Mobile">
            <Input {...register('alternate_mobile')} placeholder="Enter alternate mobile" />
          </FormField>
          
          <FormField label="Alternate Email">
            <Input {...register('alternate_email')} type="email" placeholder="Enter alternate email" />
          </FormField>
        </div>
      </div>

      <Separator />

      {/* Address Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white border-b pb-2">
          Permanent Address
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Address Line 1">
            <Input {...register('permanent_address_line1')} placeholder="Enter address line 1" />
          </FormField>
          
          <FormField label="Address Line 2">
            <Input {...register('permanent_address_line2')} placeholder="Enter address line 2" />
          </FormField>
          
          <FormField label="City">
            <Input {...register('permanent_city')} placeholder="Enter city" />
          </FormField>
          
          <FormField label="State">
            <Input {...register('permanent_state')} placeholder="Enter state" />
          </FormField>
          
          <FormField label="Pincode">
            <Input {...register('permanent_pincode')} placeholder="Enter pincode" />
          </FormField>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="sameAddress"
            checked={watchSameAddress}
            onCheckedChange={(checked) => setValue('communication_same_as_permanent', checked as boolean)}
          />
          <Label htmlFor="sameAddress" className="text-sm">
            Communication address same as permanent address
          </Label>
        </div>

        {!watchSameAddress && (
          <>
            <h4 className="text-md font-medium text-gray-800 dark:text-gray-200 mt-6 mb-4">
              Communication Address
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Address Line 1">
                <Input {...register('communication_address_line1')} placeholder="Enter address line 1" />
              </FormField>
              
              <FormField label="Address Line 2">
                <Input {...register('communication_address_line2')} placeholder="Enter address line 2" />
              </FormField>
              
              <FormField label="City">
                <Input {...register('communication_city')} placeholder="Enter city" />
              </FormField>
              
              <FormField label="State">
                <Input {...register('communication_state')} placeholder="Enter state" />
              </FormField>
              
              <FormField label="Pincode">
                <Input {...register('communication_pincode')} placeholder="Enter pincode" />
              </FormField>
            </div>
          </>
        )}
      </div>

      <Separator />

      {/* Professional Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white border-b pb-2">
          Professional Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Education Level">
            <Select 
              value={watch('education_level') || ''}
              onValueChange={(value) => setValue('education_level', value as 'high_school' | 'diploma' | 'bachelors' | 'masters' | 'doctorate' | 'professional')}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select education level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high_school">High School</SelectItem>
                <SelectItem value="diploma">Diploma</SelectItem>                <SelectItem value="bachelors">Bachelor&apos;s Degree</SelectItem>
                <SelectItem value="masters">Master&apos;s Degree</SelectItem>
                <SelectItem value="doctorate">Doctorate</SelectItem>
                <SelectItem value="professional">Professional</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          
          <FormField label="Specialization">
            <Input {...register('specialization')} placeholder="Enter specialization" />
          </FormField>
          
          <FormField label="Years of Experience">
            <Input {...register('years_of_experience')} type="number" placeholder="Enter years of experience" />
          </FormField>
          
          <FormField label="Previous Company">
            <Input {...register('previous_company_name')} placeholder="Enter previous company name" />
          </FormField>
        </div>        <div className="flex items-center space-x-2">
          <Checkbox
            id="previousExperience"
            checked={watch('previous_insurance_experience')}
            onCheckedChange={(checked) => setValue('previous_insurance_experience', checked as boolean)}
          />
          <Label htmlFor="previousExperience" className="text-sm">
            I have previous insurance experience
          </Label>
        </div>
      </div>

      <Separator />

      {/* Bank Details */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white border-b pb-2">
          Bank Details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Bank Name">
            <Input {...register('bank_name')} placeholder="Enter bank name" />
          </FormField>
          
          <FormField label="Account Number">
            <Input {...register('account_number')} placeholder="Enter account number" />
          </FormField>
          
          <FormField label="IFSC Code">
            <Input {...register('ifsc_code')} placeholder="Enter IFSC code" />
          </FormField>
          
          <FormField label="Branch Name">
            <Input {...register('branch_name')} placeholder="Enter branch name" />
          </FormField>
        </div>
      </div>

      <Separator />

      {/* Nominee Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white border-b pb-2">
          Nominee Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <FormField label="Nominee Name">
            <Input {...register('nominee_name')} placeholder="Enter nominee name" />
          </FormField>
          
          <FormField label="Relationship">
            <Input {...register('nominee_relationship')} placeholder="Enter relationship" />
          </FormField>
          
          <FormField label="Nominee Date of Birth">
            <Input {...register('nominee_date_of_birth')} type="date" />
          </FormField>
        </div>
      </div>

      <Separator />

      {/* Preferences & Settings */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white border-b pb-2">
          Preferences & Settings
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Username">
            <Input {...register('username')} placeholder="Enter username" />
          </FormField>
          
          <FormField label="Display Name">
            <Input {...register('display_name')} placeholder="Enter display name" />
          </FormField>
          
          <FormField label="Preferred Language">
            <Input {...register('preferred_language')} placeholder="Enter preferred language" />
          </FormField>
          
          <FormField label="Territory Preference">
            <Input {...register('territory_preference')} placeholder="Enter territory preference" />
          </FormField>
          
          <FormField label="Timezone">
            <Select 
              value={watch('timezone') || ''}
              onValueChange={(value) => setValue('timezone', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Asia/Kolkata">Asia/Kolkata (IST)</SelectItem>
                <SelectItem value="America/New_York">America/New_York (EST)</SelectItem>
                <SelectItem value="Europe/London">Europe/London (GMT)</SelectItem>
                <SelectItem value="Asia/Dubai">Asia/Dubai (GST)</SelectItem>
                <SelectItem value="Asia/Singapore">Asia/Singapore (SGT)</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          
          <FormField label="Language">
            <Select 
              value={watch('language') || ''}
              onValueChange={(value) => setValue('language', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="hi">Hindi</SelectItem>
                <SelectItem value="mr">Marathi</SelectItem>
                <SelectItem value="ta">Tamil</SelectItem>
                <SelectItem value="te">Telugu</SelectItem>
                <SelectItem value="gu">Gujarati</SelectItem>
                <SelectItem value="bn">Bengali</SelectItem>
                <SelectItem value="kn">Kannada</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
        </div>
        
        <FormField label="Bio">
          <Textarea 
            {...register('bio')} 
            placeholder="Enter a brief bio or description" 
            rows={3}
          />
        </FormField>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-4 pt-6 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
        >
          <X className="w-4 h-4 mr-2" />
          Cancel
        </Button>
          <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          {isLoading ? 'Updating...' : 'Update Profile'}
        </Button>
      </div>
    </form>
  )
}
