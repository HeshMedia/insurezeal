'use client'

import { MasterSheetTable } from '@/components/admin/mis/master-sheet-table'
import React, { useState } from 'react'

function MasterSheetPage() {
  const [, setPendingChangesCount] = useState(0)

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col bg-gray-50 p-4">

      {/* Table Container */}
      <div className="flex-1 w-[80vw] bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <MasterSheetTable onPendingChangesCount={setPendingChangesCount} />
      </div>
    </div>
  )
}

export default MasterSheetPage
