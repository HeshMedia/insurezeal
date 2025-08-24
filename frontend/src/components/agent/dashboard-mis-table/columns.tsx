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

export const columns = [
  // Basic Information
  createReadOnlyColumn('reporting_month', 'Reporting Month'),
  createReadOnlyColumn('booking_date', 'Booking Date'),
  createReadOnlyColumn('agent_code', 'Agent Code'),
  
  // Insurance Details
  createReadOnlyColumn('insurer_name', 'Insurer Name'),
  createReadOnlyColumn('broker_name', 'Broker Name'),
  
  // Policy Information
  columnHelper.accessor('policy_number', {
    header: 'Policy Number',
    cell: (info) => (
      <div className="px-4 py-2 font-medium text-blue-700 bg-blue-50 rounded">
        {info.getValue() || 'N/A'}
      </div>
    ),
  }),
  createReadOnlyColumn('formatted_policy_number', 'Formatted Policy No.'),
  
  // Customer Details
  createReadOnlyColumn('customer_name', 'Customer Name'),
  createReadOnlyColumn('customer_phone_number', 'Customer Phone'),
  
  // Product Information
  createReadOnlyColumn('major_categorisation', 'Major Categorisation'),
  createReadOnlyColumn('product_insurer_report', 'Product (Insurer Report)'),
  createReadOnlyColumn('product_type', 'Product Type'),
  createReadOnlyColumn('plan_type', 'Plan Type'),
  
  // Premium Information
  createCurrencyColumn('gross_premium', 'Gross Premium'),
  createCurrencyColumn('net_premium', 'Net Premium'),
  
  // Vehicle Details
  createReadOnlyColumn('registration_number', 'Registration No.'),
  createReadOnlyColumn('make_model', 'Make & Model'),
  createReadOnlyColumn('model', 'Model'),
  
  // Commission & Payout
  columnHelper.accessor('agent_commission_perc', {
    header: 'Agent Commission %',
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
  }),
  createCurrencyColumn('agent_po_amount', 'Agent PO Amount'),
  createCurrencyColumn('total_agent_po', 'Total Agent PO'),
  
  // Balance Information
  columnHelper.accessor('running_balance', {
    header: 'Running Balance',
    cell: (info) => {
      const value = info.getValue()
      
      if (value === null || value === undefined || value === '') {
        return <span className="text-gray-400 px-4 py-2">N/A</span>
      }
      
      const numValue = parseFloat(String(value))
      if (isNaN(numValue)) {
        return <span className="text-gray-400 px-4 py-2">N/A</span>
      }
      
      const isPositive = numValue >= 0
      
      return (
        <div className={`px-4 py-2 font-bold rounded ${
          isPositive 
            ? 'text-green-700 bg-green-50' 
            : 'text-red-700 bg-red-50'
        }`}>
          ₹{Math.abs(numValue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          
        </div>
      )
    },
  }),
  createCurrencyColumn('already_given_to_agent', 'Already Given to Agent'),
  
  // Timestamps
  columnHelper.accessor('created_at', {
    header: 'Created At',
    cell: (info) => {
      const value = info.getValue()
      if (!value) return <span className="text-gray-400 px-4 py-2">N/A</span>
      
      const date = new Date(value)
      return (
        <div className="px-4 py-2 text-gray-600 text-xs">
          {date.toLocaleDateString('en-IN')} {date.toLocaleTimeString('en-IN', { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </div>
      )
    },
  }),
]