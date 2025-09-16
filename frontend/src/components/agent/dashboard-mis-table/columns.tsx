"use client"

import { createColumnHelper } from '@tanstack/react-table'
import { AgentMISRecord } from '@/types/agent.types'

const columnHelper = createColumnHelper<AgentMISRecord>()

// Helper to create a read-only column
const createReadOnlyColumn = (id: keyof AgentMISRecord, header: string) => {
  return columnHelper.accessor(id, {
    header,
    cell: (info) => {
      const value = info.getValue()
      
      // Handle null/undefined values
      if (value === null || value === undefined || value === '') {
        return <span className="text-gray-400 px-4 py-2">N/A</span>
      }
      
      return (
        <div className="px-4 py-2 text-gray-900">
          {String(value)}
        </div>
      )
    },
  })
}

// Helper for currency formatting
const createCurrencyColumn = (id: keyof AgentMISRecord, header: string) => {
  return columnHelper.accessor(id, {
    header,
    cell: (info) => {
      const value = info.getValue()
      
      if (value === null || value === undefined || value === '') {
        return <span className="text-gray-400 px-4 py-2">N/A</span>
      }
      
      const numValue = parseFloat(String(value))
      if (isNaN(numValue)) {
        return <span className="text-gray-400 px-4 py-2">N/A</span>
      }
      
      return (
        <div className="px-4 py-2 text-gray-900 font-medium">
          ₹{numValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </div>
      )
    },
  })
}

// Helper for percentage formatting
const createPercentageColumn = (id: keyof AgentMISRecord, header: string) => {
  return columnHelper.accessor(id, {
    header,
    cell: (info) => {
      const value = info.getValue()
      
      if (value === null || value === undefined || value === '') {
        return <span className="text-gray-400 px-4 py-2">N/A</span>
      }
      
      return (
        <div className="px-4 py-2 text-green-700 font-semibold bg-green-50 rounded">
          {value}%
        </div>
      )
    },
  })
}

// Helper for date formatting
const createDateColumn = (id: keyof AgentMISRecord, header: string) => {
  return columnHelper.accessor(id, {
    header,
    cell: (info) => {
      const value = info.getValue()
      
      if (value === null || value === undefined || value === '') {
        return <span className="text-gray-400 px-4 py-2">N/A</span>
      }
      
      const date = new Date(value)
      return (
        <div className="px-4 py-2 text-gray-700">
          {date.toLocaleDateString('en-IN')}
        </div>
      )
    },
  })
}

export const columns = [
  // Date Information
  createDateColumn('booking_date', 'Booking Date'),
  createDateColumn('policy_start_date', 'Policy Start Date'),
  createDateColumn('policy_end_date', 'Policy End Date'),
  
  // Policy Information
  columnHelper.accessor('policy_number', {
    header: 'Policy Number',
    cell: (info) => (
      <div className="px-4 py-2 font-medium text-blue-700 bg-blue-50 rounded">
        {info.getValue() || 'N/A'}
      </div>
    ),
  }),
  
  // Insurance Details
  createReadOnlyColumn('insurer_name', 'Insurer Name'),
  createReadOnlyColumn('broker_name', 'Broker Name'),
  
  // Premium Information
  createCurrencyColumn('gross_premium', 'Gross Premium'),
  createCurrencyColumn('net_premium', 'Net Premium'),
  createCurrencyColumn('commissionable_premium', 'Commissionable Premium'),
  
  // Agent PO Information
  createCurrencyColumn('agent_total_po_amount', 'Agent Total PO Amount'),
  createPercentageColumn('actual_agent_po_percent', 'Actual Agent PO%'),
]