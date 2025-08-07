"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
  FileText, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Award,
  Plus,
  TrendingUp,
  Calendar
} from "lucide-react"
import { useChildIdRequests, useActiveChildIds } from "@/hooks/agentQuery"
import Link from "next/link"

export function AgentOverview() {
  const { data: requestsData, isLoading: requestsLoading } = useChildIdRequests({ page: 1, page_size: 50 })
  const { data: activeChildIds, isLoading: activeLoading } = useActiveChildIds()

  const stats = {
    totalRequests: requestsData?.total_count || 0,
    activeChildIds: activeChildIds?.length || 0,
    pendingRequests: requestsData?.requests?.filter(r => r.status === 'pending').length || 0,
    rejectedRequests: requestsData?.requests?.filter(r => r.status === 'rejected').length || 0,
    approvedRequests: requestsData?.requests?.filter(r => r.status === 'accepted').length || 0,
  }

  const recentRequests = requestsData?.requests?.slice(0, 3) || []

  if (requestsLoading || activeLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="border border-gray-200">
              <CardContent className="p-6">
                <div className="animate-pulse space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border border-gray-200 hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Approved Child IDs</p>
                <p className="text-2xl font-bold text-green-600">{stats.activeChildIds}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <Award className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        

        <Card className="border border-gray-200 hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending Approval for Child IDs</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.pendingRequests}</p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-full">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

     
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border border-gray-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-blue-600" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/agent/child-id?tab=new-request" className="block">
              <Button className="w-full justify-start bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-2" />
                Request New Child ID
              </Button>
            </Link>
            
            <Link href="/agent/child-id?tab=active" className="block">
              <Button variant="outline" className="w-full justify-start">
                <Award className="h-4 w-4 mr-2" />
                View Active Child IDs
              </Button>
            </Link>
            
            <Link href="/agent/child-id?tab=requests" className="block">
              <Button variant="outline" className="w-full justify-start">
                <FileText className="h-4 w-4 mr-2" />
                Track My Requests
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Recent Requests */}
        <Card className="border border-gray-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-gray-600" />
                Recent Requests
              </CardTitle>
              <Link href="/agent/child-id?tab=requests">
                <Button variant="ghost" size="sm">
                  View All
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentRequests.length === 0 ? (
              <div className="text-center py-6">
                <FileText className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">No requests yet</p>
                <Link href="/agent/child-id?tab=new-request">
                  <Button size="sm" className="mt-2">
                    Create First Request
                  </Button>
                </Link>
              </div>
            ) : (
              recentRequests.map((request) => (
                <div key={request.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                      {request.status === 'pending' && <Clock className="h-4 w-4 text-yellow-600" />}
                      {request.status === 'accepted' && <CheckCircle className="h-4 w-4 text-green-600" />}
                      {request.status === 'rejected' && <XCircle className="h-4 w-4 text-red-600" />}
                      {request.status === 'suspended' && <XCircle className="h-4 w-4 text-orange-600" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        #{request.id.slice(0, 8)}
                      </p>
                      <p className="text-xs text-gray-600">
                        {request.insurer?.name || 'Unknown Insurer'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(request.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Welcome Message */}
      {stats.totalRequests === 0 && (
        <Card className="border border-blue-200 bg-blue-50/30">
          <CardContent className="p-6 text-center">
            <Award className="h-12 w-12 text-blue-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-blue-900 mb-2">
              Welcome to Child ID Management
            </h3>
            <p className="text-blue-700 mb-4">
              Get started by requesting your first child ID to begin your insurance business.
            </p>
            <Link href="/agent/child-id?tab=new-request">
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-2" />
                Request Your First Child ID
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
