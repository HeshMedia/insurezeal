"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
  Award,
  Plus,
  BarChart3
} from "lucide-react"
import { useChildIdRequests, useActiveChildIds } from "@/hooks/agentQuery"
import { AgentMISTable } from "@/components/agent/dashboard-mis-table/agent-mis-table"
import Link from "next/link"
import { useState } from "react"
import { AgentStatsCards } from "./agent-stats-cards"


export function AgentOverview() {
  const { data: requestsData, isLoading: requestsLoading } = useChildIdRequests({ page: 1, page_size: 50 })
  const { data: activeChildIds, isLoading: activeLoading } = useActiveChildIds()
  // State to store MIS stats from the table
  const [misStats, setMisStats] = useState<{
    number_of_policies: number;
    running_balance: number;
    total_net_premium: number;
  } | null>(null)

  const stats = {
    totalRequests: requestsData?.total_count || 0,
    activeChildIds: activeChildIds?.length || 0,
    pendingRequests: requestsData?.requests?.filter(r => r.status === 'pending').length || 0,
    rejectedRequests: requestsData?.requests?.filter(r => r.status === 'rejected').length || 0,
    approvedRequests: requestsData?.requests?.filter(r => r.status === 'accepted').length || 0,
  }

 

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
    <div className="space-y-6 flex flex-col">
      {/* Stats Cards */}
      <AgentStatsCards stats={{ 
        activeChildIds: stats.activeChildIds, 
        pendingRequests: stats.pendingRequests,
        number_of_policies: misStats?.number_of_policies || 0,
        running_balance: misStats?.running_balance || 0,
        total_net_premium: misStats?.total_net_premium || 0,
      }} totalBalance={misStats?.running_balance || 0} />


      {/* MIS Table Section */}
      {stats.activeChildIds > 0 ? (
        <Card className="border border-gray-200">
          <CardHeader className="border-b border-gray-200 bg-gray-50/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg">
                  <BarChart3 className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold text-gray-900">
                    My Business Data (MIS)
                  </CardTitle>
                  <p className="text-sm text-gray-600 mt-1">
                    View your policy data and commission details
                  </p>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <AgentMISTable 
              onStatsUpdate={setMisStats}
            />
          </CardContent>
        </Card>
      ) : (
        <Card className="border border-orange-200 bg-orange-50/30">
          <CardContent className="p-6 text-center">
            <BarChart3 className="h-12 w-12 text-orange-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-orange-900 mb-2">
              No Business Data Available
            </h3>
            <p className="text-orange-700 mb-4">
              You need at least one approved child ID to view your MIS data and business statistics.
            </p>
            {stats.totalRequests === 0 ? (
              <Link href="/agent/child-id?tab=new-request">
                <Button className="bg-orange-600 hover:bg-orange-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Request Your First Child ID
                </Button>
              </Link>
            ) : (
              <p className="text-sm text-orange-600">
                Your child ID requests are pending approval.
              </p>
            )}
          </CardContent>
        </Card>
      )}
      
      {/* Welcome Message - Only show if no requests at all */}
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