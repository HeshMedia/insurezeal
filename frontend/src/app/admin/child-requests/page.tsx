'use client'

import { DashboardWrapper } from '@/components/dashboard-wrapper'
import { ChildRequestManagement } from '@/components/admin/child-id/child-request-management'

export default function ChildRequestsPage() {
  return (
    <DashboardWrapper requiredRole="admin">
      <div className="space-y-3">
        <ChildRequestManagement />
      </div>
    </DashboardWrapper>
  )
}
