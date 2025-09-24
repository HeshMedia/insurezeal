'use client'

import { DashboardWrapper } from '@/components/dashboard-wrapper'
import { EnhancedAgentManagement } from '@/components/admin/agent/enhanced-agent-management'

export default function AgentsPage() {
  return (
    <DashboardWrapper requiredRole="admin">
      <div className="space-y-3">
        <EnhancedAgentManagement />
      </div>
    </DashboardWrapper>
  )
}
