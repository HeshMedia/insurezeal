'use client'

import { useParams, useRouter } from 'next/navigation'
import { DashboardWrapper } from '@/components/dashboard-wrapper'
import { useCutPayById } from '@/hooks/cutpayQuery'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/ui/loader'
import { ArrowLeft } from 'lucide-react'
import InputForm from '@/components/forms/input-form'
import { useAtom } from 'jotai'
import { pdfExtractionDataAtom } from '@/lib/atoms/cutpay'
import { useEffect } from 'react'
import { CutPayTransaction } from '@/types/cutpay.types'

export default function CutPayEditPage() {
  const params = useParams()
  const router = useRouter()
  const cutpayId = parseInt(params.id as string)
  
  const { data: cutpayData, isLoading: isLoadingCutpay } = useCutPayById(cutpayId)
  const [, setPdfExtractionData] = useAtom(pdfExtractionDataAtom)

  // Transform cutpay data to match the form structure
  const transformCutpayData = (data: CutPayTransaction | null) => {
    if (!data) return null

    return {
      extracted_data: {
        policy_number: data.policy_number,
        formatted_policy_number: data.formatted_policy_number,
        major_categorisation: data.major_categorisation,
        product_insurer_report: data.product_insurer_report,
        product_type: data.product_type,
        plan_type: data.plan_type,
        customer_name: data.customer_name,
        customer_phone_number: null, // Not in CutPayTransaction
        gross_premium: data.gross_premium,
        net_premium: data.net_premium,
        od_premium: data.od_premium,
        tp_premium: data.tp_premium,
        gst_amount: data.gst_amount,
        registration_number: data.registration_number,
        make_model: data.make_model,
        model: data.model,
        vehicle_variant: data.vehicle_variant,
        gvw: data.gvw,
        rto: data.rto,
        state: data.state,
        fuel_type: data.fuel_type,
        cc: data.cc,
        age_year: data.age_year,
        ncb: data.ncb,
        discount_percent: data.discount_percent,
        business_type: data.business_type,
        seating_capacity: data.seating_capacity,
        veh_wheels: data.veh_wheels,
      },
      admin_input: {
        reporting_month: data.reporting_month,
        booking_date: data.booking_date,
        agent_code: data.agent_code,
        code_type: data.code_type,
        incoming_grid_percent: data.incoming_grid_percent,
        agent_commission_given_percent: data.agent_commission_given_percent,
        extra_grid: data.extra_grid,
        commissionable_premium: data.commissionable_premium,
        payment_by: data.payment_by,
        payment_method: data.payment_method,
        payout_on: data.payout_on,
        agent_extra_percent: data.agent_extra_percent,
        payment_by_office: data.payment_by_office,
        insurer_code: data.insurer_id?.toString() || null,
        broker_code: data.broker_id?.toString() || null,
        admin_child_id: data.child_id_request_id,
        // OD+TP specific fields - these may not exist in the current transaction
        od_incoming_grid_percent: null,
        tp_incoming_grid_percent: null,
        od_incoming_extra_grid: null,
        tp_incoming_extra_grid: null,
        od_agent_payout_percent: null,
        tp_agent_payout_percent: null,
      },
      calculations: {
        receivable_from_broker: data.receivable_from_broker,
        extra_amount_receivable_from_broker: data.extra_amount_receivable_from_broker,
        total_receivable_from_broker: data.total_receivable_from_broker,
        total_receivable_from_broker_with_gst: data.total_receivable_from_broker_with_gst,
        cut_pay_amount: data.cut_pay_amount,
        agent_po_amt: data.agent_po_amt,
        agent_extra_amount: data.agent_extra_amount,
        total_agent_po_amt: data.total_agent_po_amt,
      },
      claimed_by: data.claimed_by,
      running_bal: data.running_bal,
      notes: data.notes,
    }
  }

  // Set the extracted data when cutpay data is loaded
  useEffect(() => {
    if (cutpayData) {
      const transformedData = transformCutpayData(cutpayData)
      if (transformedData) {
        setPdfExtractionData({
          extracted_data: transformedData.extracted_data,
          confidence_scores: {},
          extraction_status: 'completed',
          extraction_time: new Date().toISOString()
        })
      }
    }
  }, [cutpayData, setPdfExtractionData])

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

  if (!cutpayData) {
    return (
      <DashboardWrapper requiredRole="admin">
        <div className="max-w-5xl mx-auto p-6">
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
                Policy: {cutpayData.policy_number}
              </p>
            </div>
          </div>
        </div>

        {/* Reusable InputForm for editing */}
        <InputForm 
          onPrev={handlePrev} 
          formType="cutpay" 
          editId={cutpayId}
        />
      </div>
    </DashboardWrapper>
  )
}
