'use client'

import { DashboardWrapper } from '@/components/dashboard-wrapper'
import { CutPayManagement } from '@/components/admin/enhanced-cutpay-management'
import { CutPayDialog } from '@/components/admin/cutpay-dialog'
import { useAtom } from 'jotai'
import { selectedCutpayIdAtom, isCutpayDialogOpenAtom } from '@/lib/atoms/admin'

export default function CutPayPage() {
  const [selectedCutpayId] = useAtom(selectedCutpayIdAtom)
  const [isCutpayDialogOpen, setIsCutpayDialogOpen] = useAtom(isCutpayDialogOpenAtom)

  return (
    <DashboardWrapper requiredRole="admin">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">CutPay Management</h1>
            <p className="text-gray-600">Manage commission payments and transactions</p>
          </div>
        </div>
        
        <CutPayManagement />
        
        {/* CutPay Dialog */}        <CutPayDialog
          cutpayId={selectedCutpayId}
          open={isCutpayDialogOpen}
          onOpenChange={setIsCutpayDialogOpen}
        />
      </div>
    </DashboardWrapper>
  )
}
