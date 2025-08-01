'use client'

import { DashboardWrapper } from '@/components/dashboard-wrapper'
import { PolicyManagement } from '@/components/agent/policy/policy-management'

export default function PoliciesPage() {
  return (
    <DashboardWrapper requiredRole="agent">
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Policies</h2>
            <p className="text-muted-foreground">
              Manage and view your policy records
            </p>
          </div>
        </div>
        <PolicyManagement />
      </div>
    </DashboardWrapper>
  )
}