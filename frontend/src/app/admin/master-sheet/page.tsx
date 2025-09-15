'use client'

import React from 'react'
import { MasterSheetTableWrapper } from '@/components/mistable/admin-mis-table.config'

function MasterSheetPage() {
  return (
    <div className="h-[calc(100vh-80px)] flex flex-col bg-gray-50 p-4">
      {/* Table Container */}
      <div className="flex-1 w-[80vw] bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        {/* Use MasterSheetTableWrapper as a React component, not a function call */}
        <MasterSheetTableWrapper userRole="admin" />
      </div>
    </div>
  )
}

export default MasterSheetPage
