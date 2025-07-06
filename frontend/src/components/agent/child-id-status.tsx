"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Clock, CheckCircle, XCircle, AlertCircle, FileText, Search, Eye } from "lucide-react"
import { useChildIdRequests } from "@/hooks/agentQuery"
import { ChildIdStatus as StatusType } from "@/types/agent.types"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ChildIdRequestDetails } from "./child-id-request-details"

interface ChildIdStatusProps {
  searchTerm?: string
  onSearchChange?: (term: string) => void
}

export function ChildIdStatus({ searchTerm = "", onSearchChange }: ChildIdStatusProps) {
  const [page, setPage] = useState(1)
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null)
  
  const { data, isLoading, error } = useChildIdRequests({ 
    page, 
    page_size: 10 
  })

  const getStatusIcon = (status: StatusType) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4" />
      case 'accepted':
        return <CheckCircle className="h-4 w-4" />
      case 'rejected':
        return <XCircle className="h-4 w-4" />
      case 'suspended':
        return <AlertCircle className="h-4 w-4" />
      default:
        return <FileText className="h-4 w-4" />
    }
  }

  const getStatusColor = (status: StatusType) => {
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

  const filteredRequests = data?.requests.filter(request => 
    request.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
    request.phone_number.includes(searchTerm) ||
    request.insurer?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    request.broker_relation?.name.toLowerCase().includes(searchTerm.toLowerCase())
  ) || []

  if (error) {
    return (
      <Card className="border border-red-200">
        <CardContent className="p-8 text-center">
          <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Error loading requests</h3>
          <p className="text-red-600">{error.message}</p>
        </CardContent>
      </Card>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="border border-gray-200">
            <CardContent className="p-4">
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with search */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Your Child ID Requests</h2>
          <p className="text-sm text-gray-600 mt-1">
            Total: {data?.total_count || 0} requests
          </p>
        </div>
        
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search requests..."
            value={searchTerm}
            onChange={(e) => onSearchChange?.(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {filteredRequests.length === 0 ? (
        <Card className="border border-gray-200">
          <CardContent className="p-8 text-center">
            {searchTerm ? (
              <>
                <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No matching requests</h3>
                <p className="text-gray-600">Try adjusting your search terms.</p>
              </>
            ) : (
              <>
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No requests found</h3>
                <p className="text-gray-600">You havent  submitted any child ID requests yet.</p>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredRequests.map((request) => (
            <Card key={request.id} className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(request.status)}
                      <CardTitle className="text-base">
                        Request #{request.id.slice(0, 8)}
                      </CardTitle>
                    </div>
                    <Badge className={getStatusColor(request.status)}>
                      {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">
                      {new Date(request.created_at).toLocaleDateString()}
                    </span>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" onClick={() => setSelectedRequestId(request.id)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Request Details</DialogTitle>
                        </DialogHeader>
                        {selectedRequestId && (
                          <ChildIdRequestDetails requestId={selectedRequestId} />
                        )}
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Code Type</p>
                    <p className="text-sm text-gray-600">{request.code_type}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Location</p>
                    <p className="text-sm text-gray-600">{request.location}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Phone</p>
                    <p className="text-sm text-gray-600">{request.phone_number}</p>
                  </div>
                  {request.insurer && (
                    <div>
                      <p className="text-sm font-medium text-gray-900">Insurer</p>
                      <p className="text-sm text-gray-600">{request.insurer.name}</p>
                    </div>
                  )}
                  {request.broker_relation && (
                    <div>
                      <p className="text-sm font-medium text-gray-900">Broker</p>
                      <p className="text-sm text-gray-600">{request.broker_relation.name}</p>
                    </div>
                  )}
                  {request.child_id && (
                    <div className="md:col-span-2">
                      <p className="text-sm font-medium text-gray-900">Assigned Child ID</p>
                      <p className="text-sm text-gray-600 font-mono bg-gray-50 p-2 rounded">
                        {request.child_id}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {data && data.total_pages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Page {data.page} of {data.total_pages}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(data.total_pages, p + 1))}
              disabled={page === data.total_pages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
