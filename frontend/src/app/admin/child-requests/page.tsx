'use client'

import { DashboardWrapper } from '@/components/dashboard-wrapper'
import { ChildRequestManagement } from '@/components/admin/child-request-management'
import { useChildRequestList } from '@/hooks/adminQuery'

export default function ChildRequestsPage() {
  const { data: childRequestData, isLoading } = useChildRequestList({
    page: 1,
    page_size: 20
  })

  return (
    <DashboardWrapper requiredRole="admin">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Child Request Management</h1>
            <p className="text-gray-600">Manage child ID requests and approvals</p>
          </div>
        </div>
        
        <ChildRequestManagement 
          requests={childRequestData?.requests || []} 
          isLoading={isLoading}
        />
      </div>
    </DashboardWrapper>
  )
}
