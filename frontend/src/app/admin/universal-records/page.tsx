'use client'

import { DashboardWrapper } from '@/components/dashboard-wrapper'
import { UniversalRecordManagement } from '@/components/admin/universal-record-management'

export default function UniversalRecordsPage() {
  return (
    <DashboardWrapper requiredRole="admin">
      <div className="space-y-3">
        <UniversalRecordManagement />
      </div>
    </DashboardWrapper>
  )
}
