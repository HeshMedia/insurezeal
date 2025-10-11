import type {
  PolicyDetailsResponse,
  ExtractedPolicyData,
  AdminInputData,
  CalculationResult,
  CutPayCalculationResponse,
  CreateCutpayTransactionCutpayPostRequest,
} from '@/types/cutpay.types'
import type { ExtractPdfResponse } from '@/types/cutpay.types'

export const toStringOrNull = (val: unknown): string | null => {
  if (val === null || val === undefined) return null
  const s = String(val)
  return s.trim() === '' ? null : s
}

export const toNumberOrNull = (val: unknown): number | null => {
  if (val === null || val === undefined) return null

  if (typeof val === 'number') {
    return Number.isFinite(val) ? val : null
  }

  if (typeof val === 'string') {
    const trimmed = val.trim()
    if (trimmed === '') return null

    const normalized = trimmed
      .replace(/₹/g, '')
      .replace(/,/g, '')
      .replace(/\s+/g, '')

    if (normalized === '') return null

    const parsed = Number(normalized)
    return Number.isNaN(parsed) ? null : parsed
  }

  // Fallback for values like BigInt or boolean
  const coerced = Number(val)
  return Number.isNaN(coerced) ? null : coerced
}

const buildSheetRecord = (sheet?: Record<string, string> | null): Record<string, unknown> => {
  if (!sheet) return {}

  const rawPaymentMode = sheet['Payment Mode'] || ''
  const dashIndex = rawPaymentMode.indexOf(' - ')
  const parsedPaymentMethod = dashIndex >= 0 ? rawPaymentMode.slice(0, dashIndex).trim() : rawPaymentMode
  const parsedPaymentDetail = dashIndex >= 0 ? rawPaymentMode.slice(dashIndex + 3).trim() : null
  const insurerBrokerCode = sheet['Insurer /broker code'] || ''
  const derivedCodeType = insurerBrokerCode && insurerBrokerCode.trim() !== '' ? 'Broker' : 'Direct'

  return {
    policy_number: sheet['Policy number'] || null,
    formatted_policy_number: sheet['Formatted Policy number'] || null,
    major_categorisation: sheet["Major Categorisation( Motor/Life/ Health)"] || null,
    product_insurer_report: sheet['Product (Insurer Report)'] || null,
    product_type: sheet['Product Type'] || null,
    plan_type: sheet['Plan type (Comp/STP/SAOD)'] || null,
    customer_name: sheet['Customer Name'] || null,
    gross_premium: toNumberOrNull(sheet['Gross premium'] || null),
    net_premium: toNumberOrNull(sheet[' Net premium '] || null),
    od_premium: toNumberOrNull(sheet['OD Preimium'] || null),
    tp_premium: toNumberOrNull(sheet['TP Premium'] || null),
    gst_amount: toNumberOrNull(sheet['GST Amount'] || null),
    registration_number: sheet['Registration.no'] || null,
    make_model: sheet['Make_Model'] || null,
    model: sheet['Model'] || null,
    vehicle_variant: sheet['Vehicle_Variant'] || null,
    gvw: toNumberOrNull(sheet['GVW'] || null),
    rto: sheet['RTO'] || null,
    state: sheet['State'] || null,
    fuel_type: sheet['Fuel Type'] || null,
    cc: toNumberOrNull(sheet['CC'] || null),
    age_year: toNumberOrNull(sheet['Age(Year)'] || null),
    ncb: sheet['NCB (YES/NO)'] || null,
    discount_percent: toNumberOrNull(sheet['Discount %'] || null),
    business_type: sheet['Business Type'] || null,
    seating_capacity: toNumberOrNull(sheet['Seating Capacity'] || null),
    veh_wheels: toNumberOrNull(sheet['Veh_Wheels'] || null),
    reporting_month: sheet["Reporting Month (mmm'yy)"] || null,
    booking_date: sheet['Booking Date(Click to select Date)'] || null,
    agent_code: sheet['Agent Code'] || null,
    commissionable_premium: toNumberOrNull(sheet['Commissionable Premium'] || null),
    incoming_grid_percent: toNumberOrNull(sheet['Incoming Grid %'] || null),
    extra_grid: toNumberOrNull(sheet['Extra Grid'] || null),
    receivable_from_broker: toNumberOrNull(sheet['Receivable from Broker'] || null),
    extra_amount_receivable_from_broker: toNumberOrNull(sheet['Extra Amount Receivable from Broker'] || null),
    total_receivable_from_broker: toNumberOrNull(sheet['Total Receivable from Broker'] || null),
    total_receivable_from_broker_with_gst: toNumberOrNull(sheet['Total Receivable from Broker Include 18% GST'] || null),
    claimed_by: sheet['Claimed By'] || null,
    payment_by: sheet['Payment by'] || null,
    payment_method: parsedPaymentMethod || null,
    payment_detail: parsedPaymentDetail,
    payment_by_office: toNumberOrNull(sheet['Payment By Office'] || null),
    agent_commission_given_percent: toNumberOrNull(sheet['As per Broker PO%'] || null),
    admin_child_id: sheet['Child ID/ User ID [Provided by Insure Zeal]'] || null,
    code_type: derivedCodeType,
  }
}

const combineRecords = (
  dbRecord?: Record<string, unknown> | null,
  sheetRecord?: Record<string, unknown>
): Record<string, unknown> | undefined => {
  if (!dbRecord && !sheetRecord) return undefined

  const combined: Record<string, unknown> = {
    ...(sheetRecord ?? {}),
    ...(dbRecord ?? {}),
  }

  if (dbRecord?.payment_method && typeof dbRecord.payment_method === 'string') {
    const paymentModeStr = dbRecord.payment_method as string
    const dashIdx = paymentModeStr.indexOf(' - ')
    if (dashIdx >= 0) {
      combined.payment_method = paymentModeStr.slice(0, dashIdx).trim()
      combined.payment_detail = paymentModeStr.slice(dashIdx + 3).trim()
    }
  }

  return combined
}

export const transformCutpayRecord = (data: Record<string, unknown> | null): {
  extracted_data: ExtractedPolicyData
  admin_input: AdminInputData
  calculations: CalculationResult
  claimed_by: string | null
  running_bal: number | null
  notes: string | null
  cutpay_received: number | null
} | null => {
  if (!data) return null

  return {
    extracted_data: {
      policy_number: toStringOrNull(data['policy_number']),
      formatted_policy_number: toStringOrNull(data['formatted_policy_number']),
      major_categorisation: toStringOrNull(data['major_categorisation']),
      product_insurer_report: toStringOrNull(data['product_insurer_report']),
      product_type: toStringOrNull(data['product_type']),
      plan_type: toStringOrNull(data['plan_type']),
      customer_name: toStringOrNull(data['customer_name']),
      customer_phone_number: toStringOrNull(data['customer_phone_number']),
      gross_premium: toNumberOrNull(data['gross_premium']),
      net_premium: toNumberOrNull(data['net_premium']),
      od_premium: toNumberOrNull(data['od_premium']),
      tp_premium: toNumberOrNull(data['tp_premium']),
      gst_amount: toNumberOrNull(data['gst_amount']),
      registration_number: toStringOrNull(data['registration_number']),
      make_model: toStringOrNull(data['make_model']),
      model: toStringOrNull(data['model']),
      vehicle_variant: toStringOrNull(data['vehicle_variant']),
      gvw: toNumberOrNull(data['gvw']),
      rto: toStringOrNull(data['rto']),
      state: toStringOrNull(data['state']),
      fuel_type: toStringOrNull(data['fuel_type']),
      cc: toNumberOrNull(data['cc']),
      age_year: toNumberOrNull(data['age_year']),
      ncb: toStringOrNull(data['ncb']),
      discount_percent: toNumberOrNull(data['discount_percent']),
      business_type: toStringOrNull(data['business_type']),
      seating_capacity: toNumberOrNull(data['seating_capacity']),
      veh_wheels: toNumberOrNull(data['veh_wheels']),
      insurance_company: toStringOrNull(data['insurance_company']) ?? undefined,
      start_date: toStringOrNull(data['start_date']),
      end_date: toStringOrNull(data['end_date']),
    },
    admin_input: {
      reporting_month: toStringOrNull(data['reporting_month']),
      booking_date: toStringOrNull(data['booking_date']),
      agent_code: toStringOrNull(data['agent_code']),
      code_type: toStringOrNull(data['code_type']),
      incoming_grid_percent: toNumberOrNull(data['incoming_grid_percent']),
      agent_commission_given_percent: toNumberOrNull(data['agent_commission_given_percent']),
      extra_grid: toNumberOrNull(data['extra_grid']),
      commissionable_premium: toNumberOrNull(data['commissionable_premium']),
      payment_by: toStringOrNull(data['payment_by']),
      payment_method: toStringOrNull(data['payment_method']),
      payment_detail: toStringOrNull(data['payment_detail']),
      payout_on: toStringOrNull(data['payout_on']),
    agent_extra_percent: toNumberOrNull(data['agent_extra_percent']),
    payment_by_office: toStringOrNull(data['payment_by_office']),
      insurer_code: data['insurer_id'] != null ? String(data['insurer_id']) : toStringOrNull(data['insurer_code']),
      broker_code: data['broker_id'] != null ? String(data['broker_id']) : toStringOrNull(data['broker_code']),
      admin_child_id: toStringOrNull(data['admin_child_id'] ?? data['child_id_request_id']),
      od_incoming_grid_percent: toNumberOrNull(data['od_incoming_grid_percent']),
      tp_incoming_grid_percent: toNumberOrNull(data['tp_incoming_grid_percent']),
      od_incoming_extra_grid: toNumberOrNull(data['od_incoming_extra_grid']),
      tp_incoming_extra_grid: toNumberOrNull(data['tp_incoming_extra_grid']),
      od_agent_payout_percent: toNumberOrNull(data['od_agent_payout_percent']),
      tp_agent_payout_percent: toNumberOrNull(data['tp_agent_payout_percent']),
    },
    calculations: {
      receivable_from_broker: toNumberOrNull(data['receivable_from_broker']),
      extra_amount_receivable_from_broker: toNumberOrNull(data['extra_amount_receivable_from_broker']),
      total_receivable_from_broker: toNumberOrNull(data['total_receivable_from_broker']),
      total_receivable_from_broker_with_gst: toNumberOrNull(data['total_receivable_from_broker_with_gst']),
      cut_pay_amount: toNumberOrNull(data['cut_pay_amount']),
      agent_po_amt: toNumberOrNull(data['agent_po_amt']),
      agent_extra_amount: toNumberOrNull(data['agent_extra_amount']),
      total_agent_po_amt: toNumberOrNull(data['total_agent_po_amt']),
    },
    claimed_by: toStringOrNull(data['claimed_by']),
    running_bal: toNumberOrNull(data['running_bal']),
    notes: toStringOrNull(data['notes']),
    cutpay_received: toNumberOrNull(data['cutpay_received'] ?? data['cutpay_recieved']),
  }
}

export interface CutpayPrefillPayload {
  combinedRecord?: Record<string, unknown>
  transformed: ReturnType<typeof transformCutpayRecord>
  pdfExtractionData: ExtractPdfResponse
  calculationResult: CutPayCalculationResponse | null
  formValues: CreateCutpayTransactionCutpayPostRequest
  policyPdfUrl: string | null
  additionalDocumentUrls: {
    kyc_documents: string | null
    rc_document: string | null
    previous_policy: string | null
  }
}

export const prepareCutpayPrefill = (
  policyData: PolicyDetailsResponse | null | undefined,
  useSheetFallback = true
): CutpayPrefillPayload | null => {
  if (!policyData || !policyData.database_record) {
    return null
  }

  const dbRecord = policyData.database_record as Record<string, unknown> | undefined
  const sheetRecord = useSheetFallback
    ? buildSheetRecord((policyData.google_sheets_data as Record<string, string> | undefined) ?? null)
    : {}

  const combinedRecord = combineRecords(dbRecord, sheetRecord)
  const transformed = transformCutpayRecord(combinedRecord ?? null)

  if (!transformed) {
    return null
  }

  const calculationRaw = transformed.calculations
  const hasCalculationValues = Object.values(calculationRaw).some(
    (value) => value !== null && value !== undefined
  )

  const calculationResult = hasCalculationValues
    ? {
        receivable_from_broker: calculationRaw.receivable_from_broker ?? 0,
        extra_amount_receivable_from_broker:
          calculationRaw.extra_amount_receivable_from_broker ?? 0,
        total_receivable_from_broker: calculationRaw.total_receivable_from_broker ?? 0,
        total_receivable_from_broker_with_gst:
          calculationRaw.total_receivable_from_broker_with_gst ?? 0,
        cut_pay_amount: calculationRaw.cut_pay_amount ?? 0,
        agent_po_amt: calculationRaw.agent_po_amt ?? 0,
        agent_extra_amount: calculationRaw.agent_extra_amount ?? 0,
        total_agent_po_amt: calculationRaw.total_agent_po_amt ?? 0,
      }
    : null

  const pdfExtractionData: ExtractPdfResponse = {
    extraction_status: 'completed',
    extracted_data: transformed.extracted_data,
    confidence_scores: {},
    errors: undefined,
    extraction_time: new Date().toISOString(),
  }

  const formValues: CreateCutpayTransactionCutpayPostRequest = {
    policy_pdf_url: toStringOrNull(dbRecord?.policy_pdf_url),
    additional_documents: (dbRecord?.additional_documents as Record<string, unknown>) ?? null,
    extracted_data: transformed.extracted_data,
    admin_input: transformed.admin_input,
    calculations: transformed.calculations,
    claimed_by: transformed.claimed_by,
    running_bal: transformed.running_bal ?? undefined,
    cutpay_received: transformed.cutpay_received ?? undefined,
    notes: transformed.notes,
  }

  const additionalDocumentUrls = {
    kyc_documents: toStringOrNull(dbRecord?.kyc_documents),
    rc_document: toStringOrNull(dbRecord?.rc_document),
    previous_policy: toStringOrNull(dbRecord?.previous_policy),
  }

  return {
    combinedRecord,
    transformed,
    pdfExtractionData,
    calculationResult,
    formValues,
    policyPdfUrl: toStringOrNull(dbRecord?.policy_pdf_url),
    additionalDocumentUrls,
  }
}
