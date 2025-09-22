'use client'

import AdminOverview from '@/components/admin/admin-overview'
import { DashboardWrapper } from '@/components/dashboard-wrapper'

export default function AdminPage() {
  return (
    <DashboardWrapper requiredRole="admin">
      <AdminOverview />
    </DashboardWrapper>
  )
}
