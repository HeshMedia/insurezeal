'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Edit, User, Mail, Phone, MapPin, Calendar, Briefcase, GraduationCap, CreditCard, Users, Settings, Globe } from 'lucide-react'
import { UserProfile } from '@/types/profile.types'

interface ProfileDetailsProps {
  profile: UserProfile
  onEditClick: () => void
}

export function ProfileDetails({ profile, onEditClick }: ProfileDetailsProps) {
  const personalDetails = [
    { label: 'First Name', value: profile.first_name, icon: User },
    { label: 'Middle Name', value: profile.middle_name, icon: User },
    { label: 'Last Name', value: profile.last_name, icon: User },
    { label: 'Father Name', value: profile.father_name, icon: User },
    { label: 'Mother Name', value: profile.mother_name, icon: User },
    { label: 'Date of Birth', value: profile.date_of_birth, icon: Calendar },
    { label: 'Gender', value: profile.gender, icon: User },
    { label: 'Username', value: profile.username, icon: User },
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
    { label: 'Education Level', value: profile.education_level, icon: GraduationCap },
    { label: 'Specialization', value: profile.specialization, icon: Briefcase },
    { label: 'Previous Experience', value: profile.previous_insurance_experience ? 'Yes' : 'No', icon: Briefcase },
    { label: 'Years of Experience', value: profile.years_of_experience, icon: Briefcase },
    { label: 'Previous Company', value: profile.previous_company_name, icon: Briefcase },
    { label: 'Agent Code', value: profile.agent_code, icon: Briefcase },
  ]

  const communicationAddressDetails = [
    { label: 'Same as Permanent', value: profile.communication_same_as_permanent ? 'Yes' : 'No', icon: MapPin },
    { label: 'Address Line 1', value: profile.communication_address_line1, icon: MapPin },
    { label: 'Address Line 2', value: profile.communication_address_line2, icon: MapPin },
    { label: 'City', value: profile.communication_city, icon: MapPin },
    { label: 'State', value: profile.communication_state, icon: MapPin },
    { label: 'Pincode', value: profile.communication_pincode, icon: MapPin },
  ]

  const bankDetails = [
    { label: 'Bank Name', value: profile.bank_name, icon: CreditCard },
    { label: 'Account Number', value: profile.account_number, icon: CreditCard },
    { label: 'IFSC Code', value: profile.ifsc_code, icon: CreditCard },
    { label: 'Branch Name', value: profile.branch_name, icon: CreditCard },
  ]

  const nomineeDetails = [
    { label: 'Nominee Name', value: profile.nominee_name, icon: Users },
    { label: 'Relationship', value: profile.nominee_relationship, icon: Users },
    { label: 'Date of Birth', value: profile.nominee_date_of_birth, icon: Calendar },
  ]

  const preferencesDetails = [
    { label: 'Preferred Language', value: profile.preferred_language, icon: Globe },
    { label: 'Territory Preference', value: profile.territory_preference, icon: MapPin },
    { label: 'Timezone', value: profile.timezone, icon: Settings },
    { label: 'Language', value: profile.language, icon: Globe },
    { label: 'Display Name', value: profile.display_name, icon: User },
    { label: 'Bio', value: profile.bio, icon: User },
  ]

  const DetailSection = ({ title, details }: { 
    title: string, 
    details: Array<{ label: string; value: string | number | boolean | null | undefined; icon: React.ComponentType<{ className?: string }> }> 
  }) => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
        {title}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {details.map((detail, index) => (
          detail.value && (
            <div key={index} className="flex items-start gap-3 p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
              <div className="flex-shrink-0 mt-0.5">
                <detail.icon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {detail.label}
                </p>
                <p className="text-sm text-gray-900 dark:text-white mt-1 break-words">
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
      {/* Header with Edit Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Details</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Your personal and professional information
          </p>
        </div>
        <Button onClick={onEditClick} className="flex items-center gap-2">
          <Edit className="w-4 h-4" />
          Edit Details
        </Button>
      </div>      {/* Profile Details */}
      <div className="space-y-8">
        <DetailSection title="Personal Information" details={personalDetails} />
        <Separator />
        <DetailSection title="Contact Information" details={contactDetails} />
        <Separator />
        <DetailSection title="Permanent Address" details={addressDetails} />
        <Separator />
        <DetailSection title="Communication Address" details={communicationAddressDetails} />
        <Separator />
        <DetailSection title="Professional Information" details={professionalDetails} />
        <Separator />
        <DetailSection title="Bank Details" details={bankDetails} />
        <Separator />
        <DetailSection title="Nominee Information" details={nomineeDetails} />
        <Separator />
        <DetailSection title="Preferences & Settings" details={preferencesDetails} />
      </div>
    </div>
  )
}
