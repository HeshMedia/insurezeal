"use client"

import { Card, CardContent,} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
  Award,
  Plus,
} from "lucide-react"
import { useChildIdRequests, useActiveChildIds } from "@/hooks/agentQuery"
import { AgentMISTable } from "@/components/agent/dashboard-mis-table/agent-mis-table"
import Link from "next/link"
import { useState, useEffect } from "react"
import { AgentStatsCards } from "./agent-stats-cards"
import { agentApi } from '@/lib/api/agent'
import { AgentMISStats } from '@/types/agent.types'


export function AgentOverview() {
  const { data: requestsData, isLoading: requestsLoading } = useChildIdRequests({ page: 1, page_size: 50 })
  const { data: activeChildIds, isLoading: activeLoading } = useActiveChildIds()
  
  // State to store overall MIS stats (not quarter-specific)
  const [overallStats, setOverallStats] = useState<AgentMISStats | null>(null)
  const [, setStatsLoading] = useState(true)

  // Fetch overall stats on component mount (current quarter data for overall stats)
  useEffect(() => {
    const fetchOverallStats = async () => {
      try {
        setStatsLoading(true)
        // Get current quarter/year for overall stats
        const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3)
        const currentYear = new Date().getFullYear()
        
        const response = await agentApi.mis.getAgentMISData({
          quarter: currentQuarter,
          year: currentYear,
          page: 1,
          page_size: 1 // We only need the stats, not the records
        })
        
        setOverallStats(response.stats)
      } catch (error) {
        console.error('Failed to fetch overall stats:', error)
        // Set default stats if fetch fails
        setOverallStats({
          number_of_policies: 0,
          running_balance: 0,
          total_net_premium: 0,
          commissionable_premium: 0
        })
      } finally {
        setStatsLoading(false)
      }
    }

    fetchOverallStats()
  }, []) // Only run once on mount

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
        number_of_policies: overallStats?.number_of_policies || 0,
        running_balance: overallStats?.running_balance || 0,
        total_net_premium: overallStats?.total_net_premium || 0,
        commissionable_premium: overallStats?.commissionable_premium || 0,
      }} totalBalance={overallStats?.running_balance || 0} />


      {/* MIS Table Section */}
      <Card className="border border-gray-200 !p-0">
        <CardContent className="p-0">
          <AgentMISTable />
        </CardContent>
      </Card>
      
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