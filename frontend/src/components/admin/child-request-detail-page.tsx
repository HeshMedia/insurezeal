"use client"

import { useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowLeft, Building, Phone, Mail, MapPin, User, Calendar, FileText, AlertCircle, Eye, EyeOff, Lock } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { adminApi } from "@/lib/api/admin"
import { cn } from "@/lib/utils"

const statusColors = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  accepted: "bg-green-100 text-green-800 border-green-200",
  rejected: "bg-red-100 text-red-800 border-red-200",
  suspended: "bg-gray-100 text-gray-800 border-gray-200",
}

const statusLabels = {
  pending: "Pending",
  accepted: "Accepted", 
  rejected: "Rejected",
  suspended: "Suspended",
}

export function ChildRequestDetailPage() {
  const router = useRouter()
  const params = useParams()
  const requestId = params.id as string
  const [showPassword, setShowPassword] = useState(false)

  // Fetch request details using the specific API endpoint
  const { data: request, isLoading, error } = useQuery({
    queryKey: ['admin', 'childRequests', 'detail', requestId],
    queryFn: () => adminApi.childRequests.getById(requestId),
    enabled: !!requestId,
  })

  const handleBack = () => {
    router.push('/admin/child-requests')
  }

  const handleAssign = () => {
    router.push(`/admin/child-requests/${requestId}/assign`)
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    )
  }

  if (error || !request) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Requests
          </Button>
        </div>
        <Card className="border-red-200">
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-red-700 mb-2">Request Not Found</h3>
            <p className="text-red-600 mb-4">
              The child request could not be found or you don&apos;t have permission to access it.
            </p>
            <Button onClick={handleBack}>
              Return to Child Requests
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Requests
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Child Request Details</h1>
            <p className="text-sm text-gray-600">View complete request information</p>
          </div>
        </div>
        
        {request.status === 'pending' && (
          <Button onClick={handleAssign} className="bg-green-600 hover:bg-green-700">
            Assign Child ID
          </Button>
        )}
      </div>

      {/* Status Badge */}
      <div className="flex items-center gap-4">
        <Badge className={cn("text-sm px-3 py-1", statusColors[request.status])}>
          {statusLabels[request.status]}
        </Badge>
        {request.child_id && (
          <Badge variant="secondary" className="text-sm px-3 py-1">
            Child ID: {request.child_id}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Basic Request Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Request Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-700">Agent Name</p>
                  <p className="text-sm text-gray-900">{request.agent_name || 'N/A'}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-700">Agent Code</p>
                  <p className="text-sm text-gray-900">{request.agent_code || 'N/A'}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-700">Location</p>
                  <p className="text-sm text-gray-900">{request.location || 'N/A'}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-700">Phone Number</p>
                  <p className="text-sm text-gray-900">{request.phone_number || 'N/A'}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-700">Email</p>
                  <p className="text-sm text-gray-900">{request.email || 'N/A'}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Building className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-700">Code Type</p>
                  <p className="text-sm text-gray-900">{request.code_type || 'N/A'}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-700">Preferred RM Name</p>
                  <p className="text-sm text-gray-900">{request.preferred_rm_name || 'N/A'}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-gray-400" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-700">Password</p>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-gray-900 font-mono">
                      {showPassword ? (request.password || 'N/A') : '•'.repeat((request.password || '').length || 3)}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-3 w-3" />
                      ) : (
                        <Eye className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Building className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-700">Insurer ID</p>
                  <p className="text-sm text-gray-900">{request.insurer_id || 'N/A'}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Building className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-700">Broker ID</p>
                  <p className="text-sm text-gray-900">{request.broker_id || 'N/A'}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-700">Created At</p>
                  <p className="text-sm text-gray-900">
                    {new Date(request.created_at).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-700">Updated At</p>
                  <p className="text-sm text-gray-900">
                    {new Date(request.updated_at).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Assignment Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Assignment Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {request.status === 'pending' ? (
              <div className="text-center p-6 bg-yellow-50 rounded-lg">
                <p className="text-yellow-800 font-medium">Request is pending assignment</p>
                <p className="text-yellow-600 text-sm mt-1">
                  No assignment information available yet
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {request.child_id && (
                  <div>
                    <p className="text-sm font-medium text-gray-700">Child ID</p>
                    <p className="text-sm text-gray-900">{request.child_id}</p>
                  </div>
                )}

                {request.branch_code && (
                  <div>
                    <p className="text-sm font-medium text-gray-700">Branch Code</p>
                    <p className="text-sm text-gray-900">{request.branch_code}</p>
                  </div>
                )}

                {request.region && (
                  <div>
                    <p className="text-sm font-medium text-gray-700">Region</p>
                    <p className="text-sm text-gray-900">{request.region}</p>
                  </div>
                )}

                {request.manager_name && (
                  <div>
                    <p className="text-sm font-medium text-gray-700">Manager Name</p>
                    <p className="text-sm text-gray-900">{request.manager_name}</p>
                  </div>
                )}

                {request.manager_email && (
                  <div>
                    <p className="text-sm font-medium text-gray-700">Manager Email</p>
                    <p className="text-sm text-gray-900">{request.manager_email}</p>
                  </div>
                )}

                {request.approved_by && (
                  <div>
                    <p className="text-sm font-medium text-gray-700">Approved By</p>
                    <p className="text-sm text-gray-900">{request.approved_by}</p>
                  </div>
                )}

                {request.approved_at && (
                  <div>
                    <p className="text-sm font-medium text-gray-700">Approved At</p>
                    <p className="text-sm text-gray-900">
                      {new Date(request.approved_at).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Additional Information */}
        {(request.insurer || request.broker_relation) && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Company Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {request.insurer && (
                  <div className="space-y-3">
                    <h4 className="font-medium text-gray-900">Insurer Information</h4>
                    <div className="bg-blue-50 p-4 rounded-lg space-y-3">
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4 text-blue-600" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-700">Company Name</p>
                          <p className="text-sm text-gray-900">{request.insurer?.name || 'N/A'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-blue-600" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-700">Insurer Code</p>
                          <p className="text-sm text-gray-900">{request.insurer?.insurer_code || 'N/A'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-blue-600" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-700">Insurer ID</p>
                          <p className="text-sm text-gray-900">{request.insurer?.id || 'N/A'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {request.broker_relation && (
                  <div className="space-y-3">
                    <h4 className="font-medium text-gray-900">Broker Information</h4>
                    <div className="bg-green-50 p-4 rounded-lg space-y-3">
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4 text-green-600" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-700">Broker Name</p>
                          <p className="text-sm text-gray-900">{request.broker_relation?.name || 'N/A'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-green-600" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-700">Broker Code</p>
                          <p className="text-sm text-gray-900">{request.broker_relation?.broker_code || 'N/A'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-green-600" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-700">Broker ID</p>
                          <p className="text-sm text-gray-900">{request.broker_relation?.id || 'N/A'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Admin Notes */}
        {request.admin_notes && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Admin Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-gray-800 whitespace-pre-wrap">{request.admin_notes}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
