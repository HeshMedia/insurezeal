'use client'

import { DashboardWrapper } from '@/components/dashboard-wrapper'
import { AdminChildIdManagement } from '@/components/superadmin/admin-child-id-management'

export default function AdminChildIdsPage() {
  return (
    <DashboardWrapper requiredRole="admin">
      <AdminChildIdManagement />
    </DashboardWrapper>
  )
}
