"use client"

import { createColumnHelper } from '@tanstack/react-table'
import { MasterSheetRecord } from '@/types/mis.types'
import { EditableCell } from './editable-cell'

const columnHelper = createColumnHelper<MasterSheetRecord>()

// Helper to create an editable column to reduce boilerplate
const createEditableColumn = (id: keyof MasterSheetRecord, header: string) => {
  return columnHelper.accessor(id, {
    header,
    cell: EditableCell,
  })
}

export const columns = [
  columnHelper.accessor('row_number', {
    header: 'Row #',
    cell: (info) => <div className="px-4 py-2 font-mono text-xs text-center text-gray-500">{info.getValue()}</div>,
  }),
  columnHelper.accessor('policy_number', {
    header: 'Policy Number',
    cell: (info) => <div className="px-4 py-2 font-medium text-gray-900">{info.getValue()}</div>,
  }),
  createEditableColumn('reporting_month', 'Reporting Month'),
  createEditableColumn('booking_date', 'Booking Date'),
  createEditableColumn('agent_code', 'Agent Code'),
  createEditableColumn('code_type', 'Code Type'),
  createEditableColumn('insurer_name', 'Insurer Name'),
  createEditableColumn('broker_name', 'Broker Name'),
  createEditableColumn('insurer_broker_code', 'Insurer Broker Code'),
  createEditableColumn('formatted_policy_number', 'Formatted Policy No.'),
  createEditableColumn('customer_name', 'Customer Name'),
  createEditableColumn('customer_phone_number', 'Customer Phone'),
  createEditableColumn('major_categorisation', 'Major Categorisation'),
  createEditableColumn('product_insurer_report', 'Product (Insurer Report)'),
  createEditableColumn('product_type', 'Product Type'),
  createEditableColumn('plan_type', 'Plan Type'),
  createEditableColumn('gross_premium', 'Gross Premium'),
  createEditableColumn('net_premium', 'Net Premium'),
  createEditableColumn('od_premium', 'OD Premium'),
  createEditableColumn('tp_premium', 'TP Premium'),
  createEditableColumn('gst_amount', 'GST Amount'),
  createEditableColumn('commissionable_premium', 'Commissionable Premium'),
  createEditableColumn('registration_no', 'Registration No.'),
  createEditableColumn('make_model', 'Make & Model'),
  createEditableColumn('model', 'Model'),
  createEditableColumn('vehicle_variant', 'Vehicle Variant'),
  createEditableColumn('gvw', 'GVW'),
  createEditableColumn('rto', 'RTO'),
  createEditableColumn('state', 'State'),
  createEditableColumn('cluster', 'Cluster'),
  createEditableColumn('fuel_type', 'Fuel Type'),
  createEditableColumn('cc', 'CC'),
  createEditableColumn('age_year', 'Age (Year)'),
  createEditableColumn('ncb', 'NCB'),
  createEditableColumn('discount_percent', 'Discount %'),
  createEditableColumn('business_type', 'Business Type'),
  createEditableColumn('seating_capacity', 'Seating Capacity'),
  createEditableColumn('vehicle_wheels', 'Vehicle Wheels'),
  createEditableColumn('incoming_grid_perc', 'Incoming Grid %'),
  createEditableColumn('agent_commission_perc', 'Agent Commission %'),
  createEditableColumn('extra_grid_perc', 'Extra Grid %'),
  createEditableColumn('agent_extra_perc', 'Agent Extra %'),
  createEditableColumn('payment_by', 'Payment By'),
  createEditableColumn('payment_method', 'Payment Method'),
  createEditableColumn('payout_on', 'Payout On'),
  createEditableColumn('payment_by_office', 'Payment By Office'),
  createEditableColumn('receivable_from_broker', 'Receivable from Broker'),
  createEditableColumn('extra_amount_receivable', 'Extra Amount Receivable'),
  createEditableColumn('total_receivable', 'Total Receivable'),
  createEditableColumn('total_receivable_with_gst', 'Total Receivable with GST'),
  createEditableColumn('cut_pay_amount', 'CutPay Amount'),
  createEditableColumn('agent_po_amount', 'Agent PO Amount'),
  createEditableColumn('agent_extra_amount', 'Agent Extra Amount'),
  createEditableColumn('total_agent_po', 'Total Agent PO'),
  createEditableColumn('claimed_by', 'Claimed By'),
  createEditableColumn('running_balance', 'Running Balance'),
  createEditableColumn('cutpay_received', 'CutPay Received'),
  createEditableColumn('already_given_to_agent', 'Already Given to Agent'),
  createEditableColumn('iz_total_po_percent', 'IZ Total PO %'),
  createEditableColumn('broker_po_percent', 'Broker PO %'),
  createEditableColumn('broker_payout_amount', 'Broker Payout Amount'),
  createEditableColumn('invoice_status', 'Invoice Status'),
  createEditableColumn('remarks', 'Remarks'),
  createEditableColumn('company', 'Company'),
  createEditableColumn('notes', 'Notes'),
]