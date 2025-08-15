'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AgentConfigManagement } from '@/components/admin/cutpay/adminconfig'
import { DashboardWrapper } from '@/components/dashboard-wrapper'
import { CutPayManagement } from '@/components/admin/enhanced-cutpay-management'

export default function CutPayPage() {
  return (
    <DashboardWrapper requiredRole="admin">
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <Tabs defaultValue="transactions" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="agent-configs">Payout Payments</TabsTrigger>
          </TabsList>
          <TabsContent value="transactions" className="space-y-4">
            <CutPayManagement />
          </TabsContent>
          <TabsContent value="agent-configs" className="space-y-4">
            <AgentConfigManagement />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardWrapper>
  )
}
