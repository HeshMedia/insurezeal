"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Search, Edit, Eye, Phone, Mail, User } from "lucide-react"
import { useRejectChildRequest, useSuspendChildId } from "@/hooks/adminQuery"
import type { ChildRequest } from "@/types/admin.types"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface ChildRequestManagementProps {
  requests?: ChildRequest[]
  isLoading?: boolean
}

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

function RequestCard({ request, onAction }: { request: ChildRequest; onAction: (action: 'reject' | 'suspend', request: ChildRequest) => void }) {
  const router = useRouter()

  // Safety check for request object
  if (!request || typeof request !== 'object') {
    return (
      <Card className="border border-red-200">
        <CardContent className="p-4 text-center">
          <p className="text-red-600 text-sm">Invalid request data</p>
        </CardContent>
      </Card>
    )
  }

  const handleAssignClick = () => {
    router.push(`/admin/child-requests/${request.id}/assign`)
  }

  const handleViewClick = () => {
    router.push(`/admin/child-requests/${request.id}`)
  }

  return (
    <Card className="hover:shadow-sm transition-shadow border border-gray-200">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg font-semibold text-gray-900">
              {request.location || 'No Location'}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={cn("text-xs font-medium", statusColors[request.status])}>
                {statusLabels[request.status]}
              </Badge>
              {request.child_id && (
                <Badge variant="secondary" className="text-xs">
                  ID: {request.child_id}
                </Badge>
              )}
              {request.code_type && (
                <Badge variant="outline" className="text-xs">
                  {request.code_type}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleViewClick}
              className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600"
            >
              <Eye className="h-4 w-4" />
            </Button>
            {request.status === 'pending' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleAssignClick}
                className="h-8 w-8 p-0 hover:bg-green-50 hover:text-green-600"
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2 text-gray-600">
            <Phone className="h-4 w-4 text-gray-400" />
            <span className="font-medium">Phone:</span>
            <span>{request.phone_number || 'N/A'}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-600">
            <Mail className="h-4 w-4 text-gray-400" />
            <span className="font-medium">Email:</span>
            <span className="truncate">{request.email || 'N/A'}</span>
          </div>
        </div>
        
        {request.preferred_rm_name && (
          <div className="mt-3 p-2 bg-blue-50 rounded-md">
            <div className="flex items-center gap-2 text-sm text-blue-800">
              <User className="h-4 w-4" />
              <span className="font-medium">Preferred RM:</span>
              <span>{request.preferred_rm_name}</span>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mt-4 pt-3 border-t">
          <span className="text-xs text-gray-500">
            Created: {request.created_at ? new Date(request.created_at).toLocaleDateString() : 'N/A'}
          </span>
          <div className="flex gap-2">
            {request.status === 'pending' && (
              <>
                <Button
                  size="sm"
                  onClick={handleAssignClick}
                  className="h-7 px-3 bg-green-600 hover:bg-green-700 text-white"
                >
                  Assign ID
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onAction('reject', request)}
                  className="h-7 px-3 text-red-600 border-red-200 hover:bg-red-50"
                >
                  Reject
                </Button>
              </>
            )}
            {request.status === 'accepted' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onAction('suspend', request)}
                className="h-7 px-3 text-orange-600 border-orange-200 hover:bg-orange-50"
              >
                Suspend
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function ChildRequestDialog({ open, onOpenChange, request, action }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  request: ChildRequest | null
  action: 'reject' | 'suspend' | null
}) {
  const [notes, setNotes] = useState('')
  
  const rejectMutation = useRejectChildRequest()
  const suspendMutation = useSuspendChildId()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!request) return

    try {
      if (action === 'reject') {
        await rejectMutation.mutateAsync({
          requestId: request.id,
          data: { 
            admin_notes: notes 
          }
        })
        toast.success('Request rejected successfully')
      } else if (action === 'suspend') {
        await suspendMutation.mutateAsync({
          requestId: request.id,
          data: { 
            admin_notes: notes 
          }
        })
        toast.success('Child ID suspended successfully')
      }
      
      onOpenChange(false)
      setNotes('')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'An error occurred')
    }
  }

  const isLoading = rejectMutation.isPending || suspendMutation.isPending

  if (!request) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {action === 'reject' && 'Reject Request'}
            {action === 'suspend' && 'Suspend Child ID'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Request Summary */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-medium text-gray-900 mb-2">Request Summary</h3>
            <div className="space-y-1 text-sm">
              <p><span className="font-medium">Location:</span> {request.location || 'N/A'}</p>
              <p><span className="font-medium">Email:</span> {request.email || 'N/A'}</p>
              <p><span className="font-medium">Phone:</span> {request.phone_number || 'N/A'}</p>
              {request.child_id && (
                <p><span className="font-medium">Child ID:</span> {request.child_id}</p>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="notes">
                {action === 'reject' ? 'Reason for Rejection' : 'Reason for Suspension'} *
              </Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={
                  action === 'reject' 
                    ? "Please provide a reason for rejecting this request..."
                    : "Please provide a reason for suspending this child ID..."
                }
                rows={3}
                disabled={isLoading}
                required
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading || !notes.trim()}
                className={cn(
                  action === 'reject' && "bg-red-600 hover:bg-red-700",
                  action === 'suspend' && "bg-orange-600 hover:bg-orange-700"
                )}
              >
                {isLoading ? 'Processing...' : 
                 action === 'reject' ? 'Reject Request' : 'Suspend ID'}
              </Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function ChildRequestManagement({ requests = [], isLoading = false }: ChildRequestManagementProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedRequest, setSelectedRequest] = useState<ChildRequest | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogAction, setDialogAction] = useState<'reject' | 'suspend' | null>(null)

  // Ensure requests is always an array
  const safeRequests = Array.isArray(requests) ? requests : []

  const filteredRequests = safeRequests.filter(request => {
    const matchesSearch = 
      (request.location?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (request.email?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (request.phone_number || '').includes(searchQuery) ||
      (request.child_id || '').includes(searchQuery)
    
    const matchesStatus = statusFilter === 'all' || request.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const handleAction = (action: 'reject' | 'suspend', request: ChildRequest) => {
    try {
      setSelectedRequest(request)
      setDialogAction(action)
      setDialogOpen(true)
    } catch (error) {
      console.error('Error handling action:', error)
      toast.error('An error occurred while opening the dialog')
    }
  }

  const getStatusCounts = () => {
    return {
      all: safeRequests.length,
      pending: safeRequests.filter(r => r.status === 'pending').length,
      accepted: safeRequests.filter(r => r.status === 'accepted').length,
      rejected: safeRequests.filter(r => r.status === 'rejected').length,
      suspended: safeRequests.filter(r => r.status === 'suspended').length,
    }
  }

  const statusCounts = getStatusCounts()

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="flex gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-32" />
          ))}
        </div>
        <div className="grid gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Child Request Management</h1>
          <p className="text-sm text-gray-600">Manage and process child ID requests from agents</p>
        </div>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-5 gap-3">
        {Object.entries(statusCounts).map(([status, count]) => (
          <Card 
            key={status}
            className={cn(
              "cursor-pointer transition-all hover:shadow-sm border border-gray-200",
              statusFilter === status && "ring-2 ring-blue-500 bg-blue-50"
            )}
            onClick={() => setStatusFilter(status)}
          >
            <CardContent className="p-3 text-center">
              <div className="text-lg font-bold text-gray-900">{count}</div>
              <div className="text-sm text-gray-600 capitalize">
                {status === 'all' ? 'Total' : status}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search by location, email, phone, or child ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="accepted">Accepted</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Requests Grid */}
      <div className="grid gap-4">
        {filteredRequests.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="text-gray-500">
                {searchQuery || statusFilter !== 'all' 
                  ? 'No requests match your current filters'
                  : 'No child requests found'
                }
              </div>
            </CardContent>
          </Card>
        ) : (
          filteredRequests.map((request) => {
            try {
              return (
                <RequestCard
                  key={request?.id || Math.random()}
                  request={request}
                  onAction={handleAction}
                />
              )
            } catch (error) {
              console.error('Error rendering request card:', error, request)
              return (
                <Card key={request?.id || Math.random()} className="border border-red-200">
                  <CardContent className="p-4 text-center">
                    <p className="text-red-600 text-sm">Error displaying request</p>
                  </CardContent>
                </Card>
              )
            }
          })
        )}
      </div>

      {/* Dialog */}
      <ChildRequestDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        request={selectedRequest}
        action={dialogAction}
      />
    </div>
  )
}
