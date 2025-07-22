'use client'

import { DashboardWrapper } from '@/components/dashboard-wrapper'
import { ProfileView } from '@/components/profile/profile-view'

export default function AgentProfilePage() {
  return (
    <DashboardWrapper requiredRole="agent">
      <ProfileView />
    </DashboardWrapper>
  )
}