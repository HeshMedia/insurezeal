'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { DashboardWrapper } from '@/components/dashboard-wrapper'
import { useCutPayByPolicy } from '@/hooks/cutpayQuery'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/ui/loader'
import { ArrowLeft } from 'lucide-react'
import InputForm from '@/components/forms/input-form'
import { useAtom } from 'jotai'
import { pdfExtractionDataAtom } from '@/lib/atoms/cutpay'
import { useEffect } from 'react'
import type { ExtractedPolicyData, AdminInputData, CalculationResult } from '@/types/cutpay.types'
// Types are inferred via API response normalization, no explicit imports needed

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
  
  const { data: policyData, isLoading: isLoadingCutpay } = useCutPayByPolicy(policy, quarter, year, true)
  const [, setPdfExtractionData] = useAtom(pdfExtractionDataAtom)

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

  // Set the extracted data when cutpay data is loaded
  useEffect(() => {
    const dbRecord = policyData?.database_record as Record<string, unknown>
    if (dbRecord) {
      const transformedData = transformCutpayData(dbRecord)
      if (transformedData) {
        setPdfExtractionData({
          extracted_data: transformedData.extracted_data,
          confidence_scores: {},
          extraction_status: 'completed',
          extraction_time: new Date().toISOString()
        })
      }
    }
  }, [policyData, setPdfExtractionData])

  const handlePrev = () => {
    router.back()
  }

  if (isLoadingCutpay) {
    return (
      <DashboardWrapper requiredRole="admin">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-4">
            <LoadingSpinner />
            <p className="text-sm text-gray-500">Loading transaction details...</p>
          </div>
        </div>
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
      <div className="max-w-5xl mx-auto space-y-6 p-6">
        {/* Navigation */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" onClick={handlePrev}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Transaction
          </Button>
        </div>

        {/* Edit Header */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-lg">
              <ArrowLeft className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Edit Transaction
              </h1>
              <p className="text-lg text-gray-600 dark:text-gray-300">
                Policy: {policy}
              </p>
            </div>
          </div>
        </div>

        {/* Reusable InputForm for editing */}
        <InputForm 
          onPrev={handlePrev} 
          policyNumber={policy}
          quarter={quarter as number}
          year={year as number}
          initialDbRecord={policyData?.database_record as Record<string, unknown>}
        />
      </div>
    </DashboardWrapper>
  )
}
