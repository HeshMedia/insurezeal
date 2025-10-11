'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { DashboardWrapper } from '@/components/dashboard-wrapper'
import { useCutPayByPolicy } from '@/hooks/cutpayQuery'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import InputForm from '@/components/forms/input-form'
import { useAtom, useSetAtom } from 'jotai'
import { pdfExtractionDataAtom, cutpayCalculationResultAtom, policyPdfUrlAtom, additionalDocumentsUrlsAtom } from '@/lib/atoms/cutpay'
import { useEffect, useMemo } from 'react'
import type { ExtractedPolicyData, AdminInputData, CalculationResult } from '@/types/cutpay.types'
import Loading from '@/app/loading'

const toStringOrNull = (val: unknown): string | null => {
  if (val === null || val === undefined) return null
  const s = String(val)
  return s === '' ? null : s
}

const toNumberOrNull = (val: unknown): number | null => {
  if (val === null || val === undefined || val === '') return null
  const n = Number(val)
  return Number.isNaN(n) ? null : n
}

export default function CutPayEditPage() {
  // const params = useParams()
  const router = useRouter()
  const search = useSearchParams()
  // const cutpayId = parseInt(params.id as string)
  const policy = search.get('policy') || ''
  const quarter = search.get('q') ? parseInt(search.get('q') as string) : undefined
  const year = search.get('y') ? parseInt(search.get('y') as string) : undefined
  
  const { data: policyData, isLoading } = useCutPayByPolicy(policy, quarter, year, true)
  const [, setPdfExtractionData] = useAtom(pdfExtractionDataAtom)
  const [, setCalculationResult] = useAtom(cutpayCalculationResultAtom)
  const setPolicyPdfUrl = useSetAtom(policyPdfUrlAtom)
  const setAdditionalDocUrls = useSetAtom(additionalDocumentsUrlsAtom)

  // Build a combined record from Google Sheets + DB for form auto-fill
  // Priority: DB record fields (if exist) > Google Sheets fields
  const dbRecord = policyData?.database_record as Record<string, unknown> | undefined
  const sheet = policyData?.google_sheets_data as Record<string, string> | undefined
  const fromSheet = useMemo<Record<string, unknown>>(() => {
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
      admin_child_id: sheet["Child ID/ User ID [Provided by Insure Zeal]"] || null,
      code_type: derivedCodeType,
    }
  }, [sheet])
  
  // Combine: Start with sheet data as fallback, then apply DB record on top
  // This ensures calculations and all DB fields take priority
  const combinedRecord = useMemo<Record<string, unknown> | undefined>(() => {
    if (!dbRecord && !sheet) return undefined
    
    // Start with sheet data as base, then overlay DB record
    const combined = { ...(fromSheet || {}), ...(dbRecord || {}) }
    
    // Parse payment_method and payment_detail from DB if they exist as combined string
    if (dbRecord?.payment_method && typeof dbRecord.payment_method === 'string') {
      const paymentModeStr = dbRecord.payment_method as string
      const dashIdx = paymentModeStr.indexOf(' - ')
      if (dashIdx >= 0) {
        combined.payment_method = paymentModeStr.slice(0, dashIdx).trim()
        combined.payment_detail = paymentModeStr.slice(dashIdx + 3).trim()
      }
    }
    
    return combined
  }, [dbRecord, sheet, fromSheet])

  // Transform cutpay data to match the form structure
  const transformCutpayData = (data: Record<string, unknown> | null): {
    extracted_data: ExtractedPolicyData
    admin_input: AdminInputData
    calculations: CalculationResult
    claimed_by: string | null
    running_bal: number | null
    notes: string | null
  } | null => {
    if (!data) return null

    return {
      extracted_data: {
        policy_number: toStringOrNull((data)['policy_number']),
        formatted_policy_number: toStringOrNull((data)['formatted_policy_number']),
        major_categorisation: toStringOrNull((data)['major_categorisation']),
        product_insurer_report: toStringOrNull((data)['product_insurer_report']),
        product_type: toStringOrNull((data)['product_type']),
        plan_type: toStringOrNull((data)['plan_type']),
        customer_name: toStringOrNull((data)['customer_name']),
        customer_phone_number: null,
        gross_premium: toNumberOrNull((data)['gross_premium']),
        net_premium: toNumberOrNull((data)['net_premium']),
        od_premium: toNumberOrNull((data)['od_premium']),
        tp_premium: toNumberOrNull((data)['tp_premium']),
        gst_amount: toNumberOrNull((data)['gst_amount']),
        registration_number: toStringOrNull((data)['registration_number']),
        make_model: toStringOrNull((data)['make_model']),
        model: toStringOrNull((data)['model']),
        vehicle_variant: toStringOrNull((data)['vehicle_variant']),
        gvw: toNumberOrNull((data)['gvw']),
        rto: toStringOrNull((data)['rto']),
        state: toStringOrNull((data)['state']),
        fuel_type: toStringOrNull((data)['fuel_type']),
        cc: toNumberOrNull((data)['cc']),
        age_year: toNumberOrNull((data)['age_year']),
        ncb: toStringOrNull((data)['ncb']),
        discount_percent: toNumberOrNull((data)['discount_percent']),
        business_type: toStringOrNull((data)['business_type']),
        seating_capacity: toNumberOrNull((data)['seating_capacity']),
        veh_wheels: toNumberOrNull((data)['veh_wheels']),
        insurance_company: undefined
      },
      admin_input: {
        reporting_month: toStringOrNull((data)['reporting_month']),
        booking_date: toStringOrNull((data)['booking_date']),
        agent_code: toStringOrNull((data)['agent_code']),
        code_type: toStringOrNull((data)['code_type']),
        incoming_grid_percent: toNumberOrNull((data)['incoming_grid_percent']),
        agent_commission_given_percent: toNumberOrNull((data)['agent_commission_given_percent']),
        extra_grid: toNumberOrNull((data)['extra_grid']),
        commissionable_premium: toNumberOrNull((data)['commissionable_premium']),
        payment_by: toStringOrNull((data)['payment_by']),
        payment_method: toStringOrNull((data)['payment_method']),
        payout_on: toStringOrNull((data)['payout_on']),
        agent_extra_percent: toNumberOrNull((data)['agent_extra_percent']),
        payment_by_office: toStringOrNull((data)['payment_by_office']),
        insurer_code: (data)['insurer_id'] != null ? String((data)['insurer_id'] as unknown) : null,
        broker_code: (data)['broker_id'] != null ? String((data)['broker_id'] as unknown) : null,
        admin_child_id: toStringOrNull((data)['admin_child_id'] ?? (data)['child_id_request_id']),
        // OD+TP specific fields - these may not exist in the current transaction
        od_incoming_grid_percent: null,
        tp_incoming_grid_percent: null,
        od_incoming_extra_grid: null,
        tp_incoming_extra_grid: null,
        od_agent_payout_percent: null,
        tp_agent_payout_percent: null,
      },
      calculations: {
        receivable_from_broker: toNumberOrNull((data)['receivable_from_broker']),
        extra_amount_receivable_from_broker: toNumberOrNull((data)['extra_amount_receivable_from_broker']),
        total_receivable_from_broker: toNumberOrNull((data)['total_receivable_from_broker']),
        total_receivable_from_broker_with_gst: toNumberOrNull((data)['total_receivable_from_broker_with_gst']),
        cut_pay_amount: toNumberOrNull((data)['cut_pay_amount']),
        agent_po_amt: toNumberOrNull((data)['agent_po_amt']),
        agent_extra_amount: toNumberOrNull((data)['agent_extra_amount']),
        total_agent_po_amt: toNumberOrNull((data)['total_agent_po_amt']),
      },
      claimed_by: toStringOrNull((data)['claimed_by']),
      running_bal: toNumberOrNull((data)['running_bal']),
      notes: toStringOrNull((data)['notes']),
    }
  }

  // Set the extracted data and calculations when cutpay data is loaded
  useEffect(() => {
    if (combinedRecord && Object.keys(combinedRecord).length) {
      const transformedData = transformCutpayData(combinedRecord)
      if (transformedData) {
        // Set extracted data for auto-fill
        setPdfExtractionData({
          extracted_data: transformedData.extracted_data,
          confidence_scores: {},
          extraction_status: 'completed',
          extraction_time: new Date().toISOString(),
        })
        
        // Set calculation results if they exist and have valid values
        if (transformedData.calculations && Object.values(transformedData.calculations).some(v => v !== null && v !== undefined)) {
          // Filter out null/undefined and ensure all required fields are present
          const calc = transformedData.calculations
          const hasRequiredFields = 
            calc.receivable_from_broker !== null && calc.receivable_from_broker !== undefined &&
            calc.cut_pay_amount !== null && calc.cut_pay_amount !== undefined
          
          if (hasRequiredFields) {
            setCalculationResult({
              receivable_from_broker: calc.receivable_from_broker ?? 0,
              extra_amount_receivable_from_broker: calc.extra_amount_receivable_from_broker ?? 0,
              total_receivable_from_broker: calc.total_receivable_from_broker ?? 0,
              total_receivable_from_broker_with_gst: calc.total_receivable_from_broker_with_gst ?? 0,
              cut_pay_amount: calc.cut_pay_amount ?? 0,
              agent_po_amt: calc.agent_po_amt ?? 0,
              agent_extra_amount: calc.agent_extra_amount ?? 0,
              total_agent_po_amt: calc.total_agent_po_amt ?? 0,
            })
          }
        }
      }
    }

    // Set S3/remote URLs for document viewer from API if available
    try {
      const policyUrl = (dbRecord && typeof dbRecord === 'object' ? (dbRecord as Record<string, unknown>)['policy_pdf_url'] : null) as string | null
      if (policyUrl) setPolicyPdfUrl(policyUrl)
      // If future API adds additional document URLs, set them here
      setAdditionalDocUrls({ kyc_documents: null, rc_document: null, previous_policy: null })
    } catch {}
  }, [combinedRecord, dbRecord, setPdfExtractionData, setCalculationResult, setPolicyPdfUrl, setAdditionalDocUrls])

  const handlePrev = () => {
    router.back()
  }

  // Show loading while fetching
  if (isLoading) {
    return (
      <DashboardWrapper requiredRole="admin">
            <Loading />
      </DashboardWrapper>
    )
  }

  if (!policyData || !policyData.database_record) {
    return (
      <DashboardWrapper requiredRole="admin">
        <div className=" mx-auto p-6">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center space-y-4">
              <h1 className="text-2xl font-bold text-gray-900">Transaction Not Found</h1>
              <p className="text-gray-600">The requested transaction could not be found.</p>
              <Button onClick={() => router.back()}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go Back
              </Button>
            </div>
          </div>
        </div>
      </DashboardWrapper>
    )
  }

  return (
    <DashboardWrapper requiredRole="admin">
      <div className=" space-y-6 p-6 overflow-y-hidden">
        {/* Navigation */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" onClick={handlePrev}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Transaction
          </Button>
        </div>

        

        {/* Reusable InputForm for editing */}
        <InputForm 
          onPrev={handlePrev} 
          policyNumber={policy}
          quarter={quarter as number}
          year={year as number}
          initialDbRecord={combinedRecord}
        />
      </div>
    </DashboardWrapper>
  )
}
