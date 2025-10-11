'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { DashboardWrapper } from '@/components/dashboard-wrapper'
import { useAgentById, useUpdateAgent } from '@/hooks/adminQuery'
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
  FileText
} from 'lucide-react'
import Loading from '@/app/loading'
import { ProfileDetails } from '@/components/profile/profile-details'
import { ProfileEditForm } from '@/components/profile/profile-edit-form'
import type { AgentUpdateRequest } from '@/types/admin.types'
import type { UpdateProfileRequest, UserProfile } from '@/types/profile.types'
import { toast } from 'sonner'

export default function AgentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const agentId = params.id as string

  const { data: agent, isLoading, error } = useAgentById(agentId)
  console.log('Agent data:', { agentId, agent, isLoading, error })
  const updateAgent = useUpdateAgent()
  const [isEditing, setIsEditing] = useState(false)
  const [activeTab, setActiveTab] = useState<'details' | 'documents'>('details')

  useEffect(() => {
    const shouldEdit = searchParams?.get('edit') === 'true'
    setIsEditing(shouldEdit)
    if (shouldEdit) {
      setActiveTab('details')
    }
  }, [searchParams])

  const openEdit = () => {
    setIsEditing(true)
    if (searchParams?.get('edit') !== 'true') {
      router.replace(`/admin/agents/${agentId}?edit=true`, { scroll: false })
    }
  }

  const agentProfile = useMemo<UserProfile | null>(() => {
    if (!agent) return null

    return {
      id: agent.id,
      user_id: agent.user_id,
      email: agent.email,
      first_name: agent.first_name ?? undefined,
      middle_name: agent.middle_name ?? undefined,
      last_name: agent.last_name ?? undefined,
      father_name: agent.father_name ?? undefined,
      mother_name: agent.mother_name ?? undefined,
      date_of_birth: agent.date_of_birth ?? undefined,
      gender: agent.gender,
      mobile_number: agent.mobile_number ?? undefined,
      alternate_mobile: agent.alternate_mobile ?? undefined,
      alternate_email: agent.alternate_email ?? undefined,
      permanent_address_line1: agent.permanent_address_line1 ?? undefined,
      permanent_address_line2: agent.permanent_address_line2 ?? undefined,
      permanent_city: agent.permanent_city ?? undefined,
      permanent_state: agent.permanent_state ?? undefined,
      permanent_pincode: agent.permanent_pincode ?? undefined,
      communication_same_as_permanent: agent.communication_same_as_permanent ?? undefined,
      communication_address_line1: agent.communication_address_line1 ?? undefined,
      communication_address_line2: agent.communication_address_line2 ?? undefined,
      communication_city: agent.communication_city ?? undefined,
      communication_state: agent.communication_state ?? undefined,
      communication_pincode: agent.communication_pincode ?? undefined,
      education_level: agent.education_level,
      specialization: agent.specialization ?? undefined,
      previous_insurance_experience: agent.previous_insurance_experience ?? undefined,
      years_of_experience: agent.years_of_experience ?? undefined,
      previous_company_name: agent.previous_company_name ?? undefined,
      bank_name: agent.bank_name ?? undefined,
      account_number: agent.account_number ?? undefined,
      ifsc_code: agent.ifsc_code ?? undefined,
      branch_name: agent.branch_name ?? undefined,
      nominee_name: agent.nominee_name ?? undefined,
      nominee_relationship: agent.nominee_relationship ?? undefined,
      nominee_date_of_birth: agent.nominee_date_of_birth ?? undefined,
      preferred_language: agent.preferred_language ?? undefined,
      territory_preference: agent.territory_preference ?? undefined,
      avatar_url: agent.avatar_url ?? undefined,
      preferences: agent.preferences ?? undefined,
      created_at: agent.created_at,
      updated_at: agent.updated_at,
      agent_code: agent.agent_code ?? undefined,
      user_role: agent.user_role ?? undefined,
      document_urls: agent.document_urls ?? undefined,
      username: agent.username ?? undefined,
      display_name: agent.display_name ?? undefined,
      bio: agent.bio ?? undefined,
      timezone: agent.timezone ?? undefined,
      language: agent.language ?? undefined,
    }
  }, [agent])

  const handleAgentUpdate = async (formData: UpdateProfileRequest) => {
    if (!agent) return

    const payload: AgentUpdateRequest = {
      first_name: formData.first_name ?? null,
      last_name: formData.last_name ?? null,
      middle_name: formData.middle_name ?? null,
      father_name: formData.father_name ?? null,
      mother_name: formData.mother_name ?? null,
      date_of_birth: formData.date_of_birth ?? null,
      gender: formData.gender ?? null,
      mobile_number: formData.mobile_number ?? null,
      alternate_mobile: formData.alternate_mobile ?? null,
      alternate_email: formData.alternate_email ?? null,
      permanent_address_line1: formData.permanent_address_line1 ?? null,
      permanent_address_line2: formData.permanent_address_line2 ?? null,
      permanent_city: formData.permanent_city ?? null,
      permanent_state: formData.permanent_state ?? null,
      permanent_pincode: formData.permanent_pincode ?? null,
      communication_same_as_permanent: formData.communication_same_as_permanent ?? null,
      communication_address_line1: formData.communication_address_line1 ?? null,
      communication_address_line2: formData.communication_address_line2 ?? null,
      communication_city: formData.communication_city ?? null,
      communication_state: formData.communication_state ?? null,
      communication_pincode: formData.communication_pincode ?? null,
      education_level: formData.education_level ?? null,
      specialization: formData.specialization ?? null,
      previous_insurance_experience: formData.previous_insurance_experience ?? null,
      years_of_experience: formData.years_of_experience ?? null,
      previous_company_name: formData.previous_company_name ?? null,
      bank_name: formData.bank_name ?? null,
      account_number: formData.account_number ?? null,
      ifsc_code: formData.ifsc_code ?? null,
      branch_name: formData.branch_name ?? null,
      nominee_name: formData.nominee_name ?? null,
      nominee_relationship: formData.nominee_relationship ?? null,
      nominee_date_of_birth: formData.nominee_date_of_birth ?? null,
      preferred_language: formData.preferred_language ?? null,
      territory_preference: formData.territory_preference ?? null,
      agent_code: formData.agent_code ?? null,
    }

    console.log('Updating agent:', { agentId, payload })
    try {
      await updateAgent.mutateAsync({ agentId, data: payload })
      toast.success('Agent updated successfully')
      closeEdit()
    } catch (mutationError) {
      console.error('Agent update error:', mutationError)
      toast.error(
        mutationError instanceof Error ? mutationError.message : 'Failed to update agent'
      )
    }
  }

  const closeEdit = () => {
    setIsEditing(false)
    if (searchParams?.get('edit')) {
      router.replace(`/admin/agents/${agentId}`, { scroll: false })
    }
  }

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
      <div className=" space-y-6 p-6">
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
              <Button
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
                onClick={openEdit}
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Agent
              </Button>
            </div>
          </div>
        </div>



        {/* Detailed Information */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as 'details' | 'documents')}
            className="w-full"
          >
            <div className="border-b border-gray-200 dark:border-gray-700 px-6 pt-6">
              <TabsList className="grid w-full max-w-md grid-cols-2">
                <TabsTrigger value="details" className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Details
                </TabsTrigger>
                <TabsTrigger value="documents" className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Documents
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="details" className="p-6">
              {agentProfile && (
                isEditing ? (
                  <ProfileEditForm
                    profile={agentProfile}
                    onSubmit={handleAgentUpdate}
                    onCancel={closeEdit}
                    isLoading={updateAgent.isPending}
                    mode="agent"
                  />
                ) : (
                  <ProfileDetails profile={agentProfile} onEditClick={openEdit} />
                )
              )}
            </TabsContent>

            <TabsContent value="documents" className="p-6 space-y-4">
              {agent.document_urls && Object.keys(agent.document_urls).length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(agent.document_urls).map(([docType, url]) => (
                    <div
                      key={docType}
                      className="flex items-center justify-between p-4 border rounded-lg bg-gray-50 dark:bg-gray-800/40"
                    >
                      <div>
                        <p className="font-medium capitalize text-gray-900 dark:text-white">
                          {docType.replace(/_/g, ' ')}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Uploaded document</p>
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <a href={url} target="_blank" rel="noopener noreferrer">
                          View
                        </a>
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-700 p-8 text-center text-gray-500 dark:text-gray-400">
                  No documents uploaded yet.
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </DashboardWrapper>
  )
}

