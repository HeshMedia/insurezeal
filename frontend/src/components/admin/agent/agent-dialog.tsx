"use client"

import { useMemo } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAgentByUserId } from "@/hooks/adminQuery"
import { formatDate, normalizeDocumentUrls } from "@/lib/utils"
import { 
  User, 
  Mail, 
  MapPin, 
  Calendar, 
  Building, 
  CreditCard,
  FileText,
  Shield,
  Edit,
  Eye,
} from "lucide-react"
import AgentDialogSkeleton from "./AgentDialogSkeleton"

interface AgentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId?: string | null
  agentId?: string | null
}

export function AgentDialog({ open, onOpenChange, userId, agentId }: AgentDialogProps) {
  const resolvedUserId = userId ?? agentId ?? ""
  const { data: agent, isLoading, error } = useAgentByUserId(resolvedUserId)

  const documents = useMemo(() => normalizeDocumentUrls(agent?.document_urls), [agent?.document_urls])

  if (!resolvedUserId) return null

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

  const getRoleColor = (role?: string) => {
    switch (role?.toLowerCase()) {
      case 'admin':
        return 'bg-red-100 text-red-700'
      case 'agent':
        return 'bg-blue-100 text-blue-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={agent?.avatar_url || ""} alt={getDisplayName()} />
              <AvatarFallback className="bg-blue-100 text-blue-700">
                {getInitials(agent?.first_name, agent?.last_name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-xl font-semibold">{getDisplayName()}</h2>
              <p className="text-sm text-gray-500">{agent?.email}</p>
            </div>
          </DialogTitle>
          <DialogDescription>
            Complete agent profile and information details
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <AgentDialogSkeleton />
        ) : error ? (
          <div className="py-12 text-center">
            <p className="text-red-600">Failed to load agent details</p>
          </div>
        ) : agent ? (
          <div className="space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-blue-600" />
                    <div>
                      <p className="text-xs text-gray-500">Role</p>
                      <Badge className={`text-xs ${getRoleColor(agent.user_role)}`}>
                        {agent.user_role}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-green-600" />
                    <div>
                      <p className="text-xs text-gray-500">Joined</p>
                      <p className="text-sm font-medium">
                        {agent.created_at ? formatDate(agent.created_at) : '-'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4 text-purple-600" />
                    <div>
                      <p className="text-xs text-gray-500">Agent Code</p>
                      <p className="text-sm font-medium font-mono">
                        {agent.agent_code || 'Not assigned'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-orange-600" />
                    <div>
                      <p className="text-xs text-gray-500">Documents</p>
                      <p className="text-sm font-medium">
                        {documents.length} uploaded
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Detailed Information */}
            <Tabs defaultValue="personal" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="personal">Personal</TabsTrigger>
                <TabsTrigger value="contact">Contact</TabsTrigger>
                <TabsTrigger value="professional">Professional</TabsTrigger>
                <TabsTrigger value="documents">Documents</TabsTrigger>
              </TabsList>
              
              <TabsContent value="personal" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Personal Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InfoItem label="First Name" value={agent.first_name} />
                    <InfoItem label="Last Name" value={agent.last_name} />
                    <InfoItem label="Middle Name" value={agent.middle_name} />
                    <InfoItem label="Father's Name" value={agent.father_name} />
                    <InfoItem label="Mother's Name" value={agent.mother_name} />
                    <InfoItem label="Date of Birth" value={agent.date_of_birth ? formatDate(agent.date_of_birth) : null} />
                    <InfoItem label="Gender" value={agent.gender} />
                    <InfoItem label="Username" value={agent.username} />
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="contact" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Mail className="h-5 w-5" />
                      Contact Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <InfoItem label="Email" value={agent.email} />
                      <InfoItem label="Mobile Number" value={agent.mobile_number} />
                      <InfoItem label="Alternate Mobile" value={agent.alternate_mobile} />
                      <InfoItem label="Alternate Email" value={agent.alternate_email} />
                    </div>
                    
                    <div className="space-y-4">
                      <h4 className="font-semibold flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        Permanent Address
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
                        <InfoItem label="Address Line 1" value={agent.permanent_address_line1} />
                        <InfoItem label="Address Line 2" value={agent.permanent_address_line2} />
                        <InfoItem label="City" value={agent.permanent_city} />
                        <InfoItem label="State" value={agent.permanent_state} />
                        <InfoItem label="Pincode" value={agent.permanent_pincode} />
                      </div>
                    </div>
                    
                    {!agent.communication_same_as_permanent && (
                      <div className="space-y-4">
                        <h4 className="font-semibold flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          Communication Address
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
                          <InfoItem label="Address Line 1" value={agent.communication_address_line1} />
                          <InfoItem label="Address Line 2" value={agent.communication_address_line2} />
                          <InfoItem label="City" value={agent.communication_city} />
                          <InfoItem label="State" value={agent.communication_state} />
                          <InfoItem label="Pincode" value={agent.communication_pincode} />
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="professional" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building className="h-5 w-5" />
                      Professional Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <InfoItem label="Education Level" value={agent.education_level} />
                      <InfoItem label="Specialization" value={agent.specialization} />
                      <InfoItem label="Years of Experience" value={agent.years_of_experience?.toString()} />
                      <InfoItem label="Previous Company" value={agent.previous_company_name} />
                      <InfoItem label="Territory Preference" value={agent.territory_preference} />
                      <InfoItem label="Preferred Language" value={agent.preferred_language} />
                    </div>
                    
                    <div className="space-y-4">
                      <h4 className="font-semibold flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        Banking Information
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
                        <InfoItem label="Bank Name" value={agent.bank_name} />
                        <InfoItem label="Account Number" value={agent.account_number} />
                        <InfoItem label="IFSC Code" value={agent.ifsc_code} />
                        <InfoItem label="Branch Name" value={agent.branch_name} />
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <h4 className="font-semibold">Identity Information</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
                        <InfoItem label="Aadhaar Number" value={agent.aadhaar_number} />
                        <InfoItem label="PAN Number" value={agent.pan_number} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="documents" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Uploaded Documents
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {documents.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {documents.map(({ label, url }) => (
                          <div key={url} className="flex items-center justify-between p-3 border rounded-lg">
                            <div>
                              <p className="font-medium capitalize">{label}</p>
                              <p className="text-sm text-gray-500">Uploaded document</p>
                            </div>
                            <Button variant="outline" size="sm" asChild>
                              <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                                <Eye className="h-4 w-4" />
                                View
                              </a>
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-8">No documents uploaded yet.</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-2 pt-4 border-t">
              <Button variant="outline">
                <Edit className="h-4 w-4 mr-2" />
                Edit Agent
              </Button>
              <Button onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function InfoItem({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-sm font-medium text-gray-700">{label}</p>
      <p className="text-sm text-gray-900 mt-1">
        {value || <span className="text-gray-400">Not provided</span>}
      </p>
    </div>
  )
}


