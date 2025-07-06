'use client'

import { DashboardWrapper } from '@/components/dashboard-wrapper'
import { AgentOverview } from '@/components/agent/agent-overview'
import { useAuth } from '@/lib/auth-context-final'
import { Badge } from '@/components/ui/badge'

export default function AgentDashboard() {
  const { user } = useAuth()

  return (
    <DashboardWrapper requiredRole="agent">
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Welcome back, {user?.first_name || user?.username}!
              </h1>
              <p className="text-gray-600 mt-1">
                Manage your insurance business from your dashboard
              </p>
            </div>
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              Active Agent
            </Badge>
          </div>
        </div>

        {/* Agent Overview */}
        <AgentOverview />
      </div>
    </DashboardWrapper>
  )
}
