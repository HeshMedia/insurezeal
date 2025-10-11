'use client'

import { useParams, useRouter } from 'next/navigation'
import { DashboardWrapper } from '@/components/dashboard-wrapper'
import { useAgentById } from '@/hooks/adminQuery'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  ArrowLeft, 
  Edit, 
  Mail, 
  User, 
  Phone,
  MapPin,
  FileText,
  Briefcase
} from 'lucide-react'
import Loading from '@/app/loading'

export default function AgentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const agentId = params.id as string

  const { data: agent, isLoading, error } = useAgentById(agentId)

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    if (firstName && lastName) {
      return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
    }
    if (firstName) {
      return firstName.charAt(0).toUpperCase()
    }
    return 'A'
  }

  const getDisplayName = () => {
    if (agent?.first_name && agent?.last_name) {
      return `${agent.first_name} ${agent.last_name}`
    }
    if (agent?.first_name) {
      return agent.first_name
    }
    return agent?.email || 'Unknown Agent'
  }

  if (isLoading) {
    return (
      <DashboardWrapper requiredRole="admin">
        <Loading />
      </DashboardWrapper>
    )
  }

  if (error || !agent) {
    return (
      <DashboardWrapper requiredRole="admin">
        <div className="max-w-4xl mx-auto py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Agent Not Found</h1>
            <p className="text-gray-600 mb-6">The requested agent could not be found.</p>
            <Button onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
          </div>
        </div>
      </DashboardWrapper>
    )
  }

  return (
    <DashboardWrapper requiredRole="admin">
      <div className="max-w-5xl mx-auto space-y-6 p-6">
        {/* Back Button */}
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Agents
          </Button>
        </div>

        {/* Agent Header */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
          <div className="flex flex-col lg:flex-row items-center gap-8">
            {/* Profile Photo Section */}
            <div className="relative">
              <Avatar className="w-32 h-32 border-4 border-white shadow-xl">
                <AvatarImage src={agent?.avatar_url || ""} alt={getDisplayName()} />
                <AvatarFallback className="text-3xl font-semibold bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                  {getInitials(agent.first_name, agent.last_name)}
                </AvatarFallback>
              </Avatar>
            </div>

            {/* Agent Info */}
            <div className="flex-1 text-center lg:text-left space-y-4">
              <div>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                  {getDisplayName()}
                </h2>
                <p className="text-lg text-gray-600 dark:text-gray-300">
                  @{agent.username || agent.email.split('@')[0]}
                </p>
              </div>
              
              <div className="flex flex-wrap justify-center lg:justify-start gap-3">
                <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-3 py-1">
                  <User className="w-3 h-3 mr-1" />
                  {agent.user_role?.toUpperCase() || 'AGENT'}
                </Badge>
                <Badge variant="outline" className="px-3 py-1">
                  ID: {agent.id}
                </Badge>
                {agent.agent_code && (
                  <Badge variant="outline" className="px-3 py-1">
                    Agent: {agent.agent_code}
                  </Badge>
                )}
              </div>

              {/* Contact Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
                {agent.email && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div className="flex-shrink-0">
                      <Mail className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Email</p>
                      <p className="text-sm text-gray-900 dark:text-white truncate">{agent.email}</p>
                    </div>
                  </div>
                )}
                
                {agent.mobile_number && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div className="flex-shrink-0">
                      <Phone className="w-4 h-4 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Phone</p>
                      <p className="text-sm text-gray-900 dark:text-white">{agent.mobile_number}</p>
                    </div>
                  </div>
                )}
                
                {agent.permanent_city && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div className="flex-shrink-0">
                      <MapPin className="w-4 h-4 text-red-600 dark:text-red-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Location</p>
                      <p className="text-sm text-gray-900 dark:text-white">
                        {agent.permanent_city}, {agent.permanent_state}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Action Button */}
            <div className="flex flex-col gap-2">
              <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white">
                <Edit className="h-4 w-4 mr-2" />
                Edit Agent
              </Button>
            </div>
          </div>
        </div>



        {/* Detailed Information */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="border-b border-gray-200 dark:border-gray-700 px-6 pt-6">
            <Tabs defaultValue="personal" className="w-full">
              <TabsList className="grid w-full max-w-2xl grid-cols-4">
                <TabsTrigger value="personal" className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Personal
                </TabsTrigger>
                <TabsTrigger value="contact" className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Contact
                </TabsTrigger>
                <TabsTrigger value="professional" className="flex items-center gap-2">
                  <Briefcase className="w-4 h-4" />
                  Professional
                </TabsTrigger>
                <TabsTrigger value="documents" className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Documents
                </TabsTrigger>
              </TabsList>
          
              <TabsContent value="personal" className="p-6 space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Personal Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <InfoItem label="First Name" value={agent.first_name} />
                    <InfoItem label="Last Name" value={agent.last_name} />
                    <InfoItem label="Middle Name" value={agent.middle_name} />
                    <InfoItem label="Date of Birth" value={agent.date_of_birth} />
                    <InfoItem label="Gender" value={agent.gender} />
                    <InfoItem label="Father's Name" value={agent.father_name} />
                    <InfoItem label="Mother's Name" value={agent.mother_name} />
                    <InfoItem label="Preferred Language" value={agent.preferred_language} />
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="contact" className="p-6 space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Contact Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <InfoItem label="Email" value={agent.email} />
                    <InfoItem label="Mobile Number" value={agent.mobile_number} />
                    <InfoItem label="Alternate Mobile" value={agent.alternate_mobile} />
                    <InfoItem label="Alternate Email" value={agent.alternate_email} />
                    <InfoItem label="Permanent Address Line 1" value={agent.permanent_address_line1} />
                    <InfoItem label="Permanent Address Line 2" value={agent.permanent_address_line2} />
                    <InfoItem label="Permanent City" value={agent.permanent_city} />
                    <InfoItem label="Permanent State" value={agent.permanent_state} />
                    <InfoItem label="Permanent Pincode" value={agent.permanent_pincode} />
                    <InfoItem label="Communication Address Line 1" value={agent.communication_address_line1} />
                    <InfoItem label="Communication Address Line 2" value={agent.communication_address_line2} />
                    <InfoItem label="Communication City" value={agent.communication_city} />
                    <InfoItem label="Communication State" value={agent.communication_state} />
                    <InfoItem label="Communication Pincode" value={agent.communication_pincode} />
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="professional" className="p-6 space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Professional Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <InfoItem label="Agent Code" value={agent.agent_code} />
                    <InfoItem label="User Role" value={agent.user_role} />
                    <InfoItem label="Education Level" value={agent.education_level} />
                    <InfoItem label="Specialization" value={agent.specialization} />
                    <InfoItem label="Years of Experience" value={agent.years_of_experience?.toString()} />
                    <InfoItem label="Previous Company" value={agent.previous_company_name} />
                    <InfoItem label="Territory Preference" value={agent.territory_preference} />
                    <InfoItem label="Language" value={agent.language} />
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="documents" className="p-6 space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Document Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <InfoItem label="PAN Number" value={agent.pan_number} />
                    <InfoItem label="Aadhaar Number" value={agent.aadhaar_number} />
                    <InfoItem label="Bank Name" value={agent.bank_name} />
                    <InfoItem label="Account Number" value={agent.account_number} />
                    <InfoItem label="IFSC Code" value={agent.ifsc_code} />
                    <InfoItem label="Branch Name" value={agent.branch_name} />
                    <InfoItem label="Nominee Name" value={agent.nominee_name} />
                    <InfoItem label="Nominee Relationship" value={agent.nominee_relationship} />
                    <InfoItem label="Nominee Date of Birth" value={agent.nominee_date_of_birth} />
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </DashboardWrapper>
  )
}

function InfoItem({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-sm text-gray-900 dark:text-white">
        {value || <span className="text-gray-400 italic">Not provided</span>}
      </p>
    </div>
  )
}

