'use client'

import { useParams } from 'next/navigation'
import { DashboardWrapper } from '@/components/dashboard-wrapper'
import { ChildIdRequestDetails } from '@/components/agent/child-id/child-id-request-details'

export default function ChildIdDetailsPage() {
  const params = useParams()
  const requestId = params.requestId as string
  
  return (
    <DashboardWrapper requiredRole="agent">
      <ChildIdRequestDetails requestId={requestId} />
    </DashboardWrapper>
  )
}
