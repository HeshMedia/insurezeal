'use client'

import { DashboardWrapper } from '@/components/dashboard-wrapper'
import { ComprehensiveCutPayForm } from '@/components/admin/comprehensive-cutpay-form'

export default function CutPayCreatePage() {
  return (
    <DashboardWrapper requiredRole="admin">
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Create Cut Pay Transaction</h1>
          <p className="text-muted-foreground">
            Upload documents and create a new cut pay transaction
          </p>
        </div>
        <ComprehensiveCutPayForm />
      </div>
    </DashboardWrapper>
  )
}