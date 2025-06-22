'use client'

import { DashboardWrapper } from '@/components/dashboard-wrapper'
import { EnhancedAgentManagement } from '@/components/admin/enhanced-agent-management'
import { AgentDialog } from '@/components/admin/agent-dialog'
import { useAtom } from 'jotai'
import { selectedAgentIdAtom, isAgentDialogOpenAtom } from '@/lib/atoms/admin'

export default function AgentsPage() {
  const [selectedAgentId] = useAtom(selectedAgentIdAtom)
  const [isAgentDialogOpen, setIsAgentDialogOpen] = useAtom(isAgentDialogOpenAtom)

  return (
    <DashboardWrapper requiredRole="admin">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Agent Management</h1>
            <p className="text-gray-600">Manage agents, view profiles, and track performance</p>
          </div>
        </div>
        
        <EnhancedAgentManagement />
        
        {/* Agent Dialog */}        <AgentDialog
          agentId={selectedAgentId}
          open={isAgentDialogOpen}
          onOpenChange={setIsAgentDialogOpen}
        />
      </div>
    </DashboardWrapper>
  )
}
