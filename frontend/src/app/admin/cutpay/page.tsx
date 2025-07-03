'use client'

import { DashboardWrapper } from '@/components/dashboard-wrapper'
import { CutPayManagement } from '@/components/admin/enhanced-cutpay-management'

export default function CutPayPage() {
  return (
    <DashboardWrapper requiredRole="admin">
      <div className="space-y-3">
        <CutPayManagement />
      </div>
    </DashboardWrapper>
  )
}
