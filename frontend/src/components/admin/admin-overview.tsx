"use client"

import { StatsCards } from "./stats-cards"
import { AnalyticsCharts } from "./analytics-charts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Activity, Clock, Users, FileText, TrendingUp } from "lucide-react"
import { useAdminStats, useCutPayStats, useChildRequestStats } from "@/hooks/adminQuery"

export function AdminOverview() {
  const { data: adminStats, isLoading: adminStatsLoading } = useAdminStats()
  const { data: cutpayStats, isLoading: cutpayStatsLoading } = useCutPayStats()
  const { data: childStats, isLoading: childStatsLoading } = useChildRequestStats()

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const getRecentActivity = () => {
    const activities = []
    
    // Add top agents from cutpay stats
    if (cutpayStats?.stats?.top_agents && cutpayStats.stats.top_agents.length > 0) {
      cutpayStats.stats.top_agents.slice(0, 3).forEach((agent, index) => {
        if (agent.agent_code && agent.total_cut_pay_amount) {
          activities.push({
            id: `agent-${index}`,
            type: 'cutpay',
            title: `High CutPay Transaction`,
            description: `${agent.agent_code} - ${formatCurrency(agent.total_cut_pay_amount)}`,
            time: 'Recent',
            avatar: agent.agent_code.charAt(0),
            color: 'bg-green-100 text-green-600'
          })
        }
      })
    }

    // Add new agents activity if available
    if (adminStats?.new_agents_this_month && adminStats.new_agents_this_month > 0) {
      activities.push({
        id: 'new-agents',
        type: 'agent',
        title: 'New Agent Registrations',
        description: `${adminStats.new_agents_this_month} new agents joined this month`,
        time: 'This month',
        avatar: 'NA',
        color: 'bg-blue-100 text-blue-600'
      })
    }

    // Add child requests activity if available
    if (childStats?.pending_requests && childStats.pending_requests > 0) {
      activities.push({
        id: 'pending-child-requests',
        type: 'child_request',
        title: 'Pending Child Requests',
        description: `${childStats.pending_requests} child ID requests need approval`,
        time: 'Pending',
        avatar: 'CR',
        color: 'bg-orange-100 text-orange-600'
      })
    }

    return activities.slice(0, 5)
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">Welcome to Admin Dashboard</h1>
            <p className="text-blue-100">
              Manage your insurance platform with comprehensive tools and insights
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">
              {cutpayStats?.stats ? formatCurrency(cutpayStats.stats.total_cut_pay_amount) : '₹0'}
            </div>
            <div className="text-blue-100 text-sm">Total CutPay Volume</div>
          </div>
        </div>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Agents</p>
                <p className="text-2xl font-bold text-gray-900">
                  {adminStats?.total_agents || 0}
                </p>
              </div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">CutPay Transactions</p>
                <p className="text-2xl font-bold text-gray-900">
                  {cutpayStats?.stats?.total_transactions || 0}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Child Requests</p>
                <p className="text-2xl font-bold text-gray-900">
                  {childStats?.total_requests || 0}
                </p>
              </div>
              <FileText className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending Approvals</p>
                <p className="text-2xl font-bold text-gray-900">
                  {childStats?.pending_requests || 0}
                </p>
              </div>
              <Clock className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Statistics Cards */}
      <StatsCards />

      {/* Analytics Charts */}
      <AnalyticsCharts />

      {/* Recent Activity */}
      <div className="grid gap-6 md:grid-cols-1">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-600" />
              Recent Activity
            </CardTitle>
            <Badge variant="secondary" className="text-xs">
              Real-time data
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {getRecentActivity().length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  <Activity className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p>No recent activity</p>
                </div>
              ) : (
                getRecentActivity().map((activity) => (
                  <div key={activity.id} className="flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-lg transition-colors">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className={activity.color}>
                        {activity.avatar}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {activity.title}
                      </p>
                      <p className="text-sm text-gray-500 truncate">
                        {activity.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <Clock className="h-3 w-3" />
                      {activity.time}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
