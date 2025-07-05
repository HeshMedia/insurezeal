'use client'

import { DashboardWrapper } from '@/components/dashboard-wrapper'
import { BrokerManagement } from '@/components/superadmin/broker-management'

export default function BrokersPage() {
  return (
    <DashboardWrapper requiredRole="superadmin">
      <BrokerManagement />
    </DashboardWrapper>
  )
}
