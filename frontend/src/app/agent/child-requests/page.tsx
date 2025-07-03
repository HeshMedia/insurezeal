'use client'

import { DashboardWrapper } from '@/components/dashboard-wrapper'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Building, Phone, Mail, MapPin, User, Plus } from 'lucide-react'
import { useState } from 'react'

// Placeholder for agent's child requests
const mockChildRequests = [
  {
    id: '1',
    insurance_company: 'LIC India',
    broker: 'Prime Insurance Brokers',
    location: 'Mumbai, Maharashtra',
    phone_number: '+91-9876543210',
    email: 'agent@example.com',
    status: 'pending' as const,
    child_id: null,
    created_at: '2024-12-01T10:00:00Z',
  },
  {
    id: '2',
    insurance_company: 'HDFC Life',
    broker: 'Elite Brokers Ltd',
    location: 'Delhi, NCR',
    phone_number: '+91-9876543211',
    email: 'agent2@example.com',
    status: 'accepted' as const,
    child_id: 'CH001234',
    created_at: '2024-11-28T14:30:00Z',
  },
]

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  accepted: 'bg-green-100 text-green-800 border-green-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
  suspended: 'bg-gray-100 text-gray-800 border-gray-200',
}

const statusLabels = {
  pending: 'Pending',
  accepted: 'Accepted',
  rejected: 'Rejected',
  suspended: 'Suspended',
}

export default function AgentChildRequestsPage() {
  const [requests] = useState(mockChildRequests)

  return (
    <DashboardWrapper requiredRole="agent">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Child Requests</h1>
            <p className="text-gray-600">Manage your child ID requests and applications</p>
          </div>
          <Button className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            New Request
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Requests</p>
                  <p className="text-2xl font-bold text-gray-900">{requests.length}</p>
                </div>
                <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <Building className="h-4 w-4 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Pending</p>
                  <p className="text-2xl font-bold text-yellow-600">
                    {requests.filter(r => r.status === 'pending').length}
                  </p>
                </div>
                <div className="h-8 w-8 bg-yellow-100 rounded-full flex items-center justify-center">
                  <User className="h-4 w-4 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Accepted</p>
                  <p className="text-2xl font-bold text-green-600">
                    {requests.filter(r => r.status === 'accepted').length}
                  </p>
                </div>
                <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                  <User className="h-4 w-4 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Active Child IDs</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {requests.filter(r => r.status === 'accepted' && r.child_id).length}
                  </p>
                </div>
                <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <Building className="h-4 w-4 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Requests List */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Your Requests</h2>
          
          {requests.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <div className="space-y-3">
                  <div className="h-12 w-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
                    <Building className="h-6 w-6 text-gray-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">No requests yet</h3>
                    <p className="text-gray-600">Get started by creating your first child ID request</p>
                  </div>
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Request
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {requests.map((request) => (
                <Card key={request.id} className="hover:shadow-sm transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-lg font-semibold text-gray-900">
                          {request.insurance_company}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={statusColors[request.status]}>
                            {statusLabels[request.status]}
                          </Badge>
                          {request.child_id && (
                            <Badge variant="secondary" className="text-xs">
                              ID: {request.child_id}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center gap-2 text-gray-600">
                        <Building className="h-4 w-4 text-gray-400" />
                        <span className="font-medium">Broker:</span>
                        <span>{request.broker}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <MapPin className="h-4 w-4 text-gray-400" />
                        <span className="font-medium">Location:</span>
                        <span>{request.location}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <Phone className="h-4 w-4 text-gray-400" />
                        <span className="font-medium">Phone:</span>
                        <span>{request.phone_number}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <Mail className="h-4 w-4 text-gray-400" />
                        <span className="font-medium">Email:</span>
                        <span className="truncate">{request.email}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-4 pt-3 border-t">
                      <span className="text-xs text-gray-500">
                        Created: {new Date(request.created_at).toLocaleDateString()}
                      </span>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-3"
                        >
                          View Details
                        </Button>
                        {request.status === 'pending' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-3 text-blue-600 border-blue-200 hover:bg-blue-50"
                          >
                            Edit
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardWrapper>
  )
}
