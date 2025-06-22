'use client'

import { DashboardWrapper } from '@/components/dashboard-wrapper'
import { AdminOverview } from '@/components/admin/admin-overview'

export default function AdminPage() {
  return (
    <DashboardWrapper requiredRole="admin">
      <AdminOverview />
    </DashboardWrapper>
  )
}
