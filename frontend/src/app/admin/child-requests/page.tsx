'use client'

import { DashboardWrapper } from '@/components/dashboard-wrapper'
import { ChildRequestManagement } from '@/components/admin/child-id/child-request-management'
import { useChildRequestList } from '@/hooks/adminQuery'

export default function ChildRequestsPage() {
  const { data: childRequestData, isLoading } = useChildRequestList({
    page: 1,
    page_size: 20
  })

  return (
    <DashboardWrapper requiredRole="admin">
      <div className="space-y-3">
        <ChildRequestManagement 
          requests={childRequestData?.requests || []} 
          isLoading={isLoading}
        />
      </div>
    </DashboardWrapper>
  )
}
