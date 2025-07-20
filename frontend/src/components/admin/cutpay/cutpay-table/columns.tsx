"use client"

import { createColumnHelper } from '@tanstack/react-table'
import { CutPayTransaction } from '@/types/cutpay.types'
import { EditableCell } from './editable-cell'
import { Badge } from '@/components/ui/badge'

const columnHelper = createColumnHelper<CutPayTransaction>()

const invoiceStatusOptions = [
  { value: 'GST pending', label: 'GST Pending' },
  { value: 'invoicing pending', label: 'Invoicing Pending' },
  { value: 'paid', label: 'Paid' },
  { value: 'payment pending', label: 'Payment Pending' },
]

export const columns = [
  columnHelper.accessor('id', {
    header: 'Cutpay ID',
    cell: (info) => <div className="px-4 py-2 font-mono text-xs text-center text-gray-500">{info.getValue()}</div>,
    enableSorting: false,
  }),
  columnHelper.accessor('policy_number', {
    header: 'Policy Number',
    cell: (info) => <div className="px-4 py-2 font-medium text-gray-900">{info.getValue()}</div>,
  }),
  columnHelper.accessor('already_given_to_agent', {
    header: 'Given to Agent',
    cell: EditableCell,
    meta: { type: 'number' },
  }),
  columnHelper.accessor('iz_total_po_percent', {
    header: 'IZ Total PO %',
    cell: EditableCell,
    meta: { type: 'number' },
  }),
  columnHelper.accessor('broker_po_percent', {
    header: 'Broker PO %',
    cell: EditableCell,
    meta: { type: 'number' },
  }),
  columnHelper.accessor('broker_payout_amount', {
    header: 'Broker Payout Amt',
    cell: EditableCell,
    meta: { type: 'number' },
  }),
  columnHelper.accessor('invoice_status', {
    header: 'Invoice Status',
    cell: EditableCell,
    meta: {
      type: 'select',
      options: invoiceStatusOptions,
    },
  }),
  columnHelper.accessor('remarks', {
    header: 'Remarks',
    cell: EditableCell,
    meta: { type: 'text' },
  }),
  columnHelper.accessor('company', {
    header: 'Company',
    cell: EditableCell,
    meta: { type: 'text' },
  }),
  // Additional read-only columns
  columnHelper.accessor('agent_code', {
    header: 'Agent Code',
    cell: (info) => <div className="px-4 py-2"><Badge variant="outline">{info.getValue()}</Badge></div>,
  }),
  columnHelper.accessor('customer_name', {
    header: 'Customer',
    cell: (info) => <div className="px-4 py-2">{info.getValue()}</div>,
  }),
  columnHelper.accessor('gross_premium', {
    header: 'Gross Premium',
    cell: (info) => <div className="px-4 py-2 text-right font-mono">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(info.getValue() || 0)}</div>,
  }),
  columnHelper.accessor('created_at', {
    header: 'Created Date',
    cell: (info) => <div className="px-4 py-2">{new Date(info.getValue()).toLocaleDateString('en-IN')}</div>,
  }),
]