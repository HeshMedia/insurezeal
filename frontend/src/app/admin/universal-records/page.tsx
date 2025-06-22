'use client'

import { DashboardWrapper } from '@/components/dashboard-wrapper'
import { UniversalRecordManagement } from '@/components/admin/universal-record-management'

export default function UniversalRecordsPage() {
  return (
    <DashboardWrapper requiredRole="admin">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Universal Record Management</h1>
            <p className="text-gray-600">Upload and reconcile data from external systems</p>
          </div>
        </div>
        
        <UniversalRecordManagement />
      </div>
    </DashboardWrapper>
  )
}
