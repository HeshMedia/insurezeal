"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Clock, CheckCircle, XCircle, AlertCircle, Phone, Mail, MapPin, Building, User, FileText } from "lucide-react"
import { useChildIdRequest } from "@/hooks/agentQuery"
import { ChildIdStatus } from "@/types/agent.types"

interface ChildIdRequestDetailsProps {
  requestId: string
}

export function ChildIdRequestDetails({ requestId }: ChildIdRequestDetailsProps) {
  const { data: request, isLoading, error } = useChildIdRequest(requestId)

  const getStatusIcon = (status: ChildIdStatus) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-5 w-5" />
      case 'accepted':
        return <CheckCircle className="h-5 w-5" />
      case 'rejected':
        return <XCircle className="h-5 w-5" />
      case 'suspended':
        return <AlertCircle className="h-5 w-5" />
      default:
        return <FileText className="h-5 w-5" />
    }
  }

  const getStatusColor = (status: ChildIdStatus) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200'
      case 'accepted':
        return 'bg-green-100 text-green-700 border-green-200'
      case 'rejected':
        return 'bg-red-100 text-red-700 border-red-200'
      case 'suspended':
        return 'bg-orange-100 text-orange-700 border-orange-200'
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  if (error) {
    return (
      <div className="text-center p-4">
        <XCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
        <p className="text-red-600">Failed to load request details</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-5 w-5" />
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-6 w-20" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-32" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!request) {
    return (
      <div className="text-center p-4">
        <FileText className="h-8 w-8 text-gray-400 mx-auto mb-2" />
        <p className="text-gray-600">Request not found</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Status Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          {getStatusIcon(request.status)}
          <h3 className="text-lg font-medium">Request #{request.id.slice(0, 8)}</h3>
        </div>
        <Badge className={getStatusColor(request.status)}>
          {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
        </Badge>
      </div>

      {/* Request Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Contact Information */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <User className="h-4 w-4" />
              Contact Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-gray-500" />
              <span className="text-sm">{request.phone_number}</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-gray-500" />
              <span className="text-sm">{request.email}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-gray-500" />
              <span className="text-sm">{request.location}</span>
            </div>
          </CardContent>
        </Card>

        {/* Business Details */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Building className="h-4 w-4" />
              Business Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Code Type</p>
              <p className="text-sm">{request.code_type}</p>
            </div>
            {request.insurer && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Insurer</p>
                <p className="text-sm">{request.insurer.name} ({request.insurer.insurer_code})</p>
              </div>
            )}
            {request.broker_relation && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Broker</p>
                <p className="text-sm">{request.broker_relation.name} ({request.broker_relation.broker_code})</p>
              </div>
            )}
            {request.preferred_rm_name && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Preferred RM</p>
                <p className="text-sm">{request.preferred_rm_name}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Assignment Details (if approved) */}
      {request.status === 'accepted' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              Assignment Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {request.child_id && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Child ID</p>
                  <p className="text-sm font-mono bg-green-50 p-2 rounded">{request.child_id}</p>
                </div>
              )}
              {request.branch_code && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Branch Code</p>
                  <p className="text-sm">{request.branch_code}</p>
                </div>
              )}
              {request.region && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Region</p>
                  <p className="text-sm">{request.region}</p>
                </div>
              )}
              {request.manager_name && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Manager</p>
                  <p className="text-sm">{request.manager_name}</p>
                </div>
              )}
              {request.manager_email && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Manager Email</p>
                  <p className="text-sm">{request.manager_email}</p>
                </div>
              )}
            </div>
            {request.approved_at && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Approved On</p>
                <p className="text-sm">{new Date(request.approved_at).toLocaleString()}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Admin Notes */}
      {request.admin_notes && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Admin Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded">{request.admin_notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Timestamps */}
      <div className="flex justify-between text-xs text-gray-500 pt-4 border-t">
        <span>Created: {new Date(request.created_at).toLocaleString()}</span>
        <span>Updated: {new Date(request.updated_at).toLocaleString()}</span>
      </div>
    </div>
  )
}
