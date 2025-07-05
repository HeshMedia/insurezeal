'use client'

import { DashboardWrapper } from '@/components/dashboard-wrapper'
import { SuperAdminOverview } from '@/components/superadmin/superadmin-overview'

export default function SuperAdminPage() {
  return (
    <DashboardWrapper requiredRole="superadmin">
      <SuperAdminOverview />
    </DashboardWrapper>
  )
}
