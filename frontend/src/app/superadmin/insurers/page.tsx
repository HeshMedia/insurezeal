'use client'

import { DashboardWrapper } from '@/components/dashboard-wrapper'
import { InsurerManagement } from '@/components/superadmin/insurer-management'

export default function InsurersPage() {
  return (
    <DashboardWrapper requiredRole="admin">
      <InsurerManagement />
    </DashboardWrapper>
  )
}
