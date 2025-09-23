'use client'

import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { DashboardWrapper } from '@/components/dashboard-wrapper'
import { usePolicyDetailsByNumber } from '@/hooks/policyQuery'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/ui/loader'
import { ArrowLeft } from 'lucide-react'
import { useAtom } from 'jotai'
import { selectedPolicyContextAtom } from '@/lib/atoms/policy'
import { PolicyDashboard, PolicyData } from '@/components/admin/cutpay/policy-dashboard'

export default function PolicyDetailPage() {
  const params = useParams()
  const router = useRouter()
  const policyId = params.id as string
  const [selectedPolicy] = useAtom(selectedPolicyContextAtom)

  // Expect id param to be policy_number. Read quarter/year (accept Q2 or 2)
  const searchParams = useSearchParams()
  const rawQuarter = searchParams.get('quarter') || String(selectedPolicy.quarter ?? '')
  const rawYear = searchParams.get('year') || String(selectedPolicy.year ?? '')
  const qQuarter = (() => {
    const digits = rawQuarter.replace(/[^0-9]/g, '')
    const n = parseInt(digits || '0', 10)
    return isNaN(n) ? 0 : n
  })()
  const qYear = (() => {
    const n = parseInt(rawYear || '0', 10)
    return isNaN(n) ? 0 : n
  })()

  const { data: policyData, isLoading, error } = usePolicyDetailsByNumber({
    policy_number: policyId,
    quarter: qQuarter,
    year: qYear,
  })

  // Transform policy data to match PolicyDashboard's expected interface
  const normalize = (): PolicyData | null => {
    if (!policyData) return null

    const policy = policyData as unknown as Record<string, unknown>
    return {
      policy_number: String(policy.policy_number || policyId),
      quarter: qQuarter || 0,
      year: qYear || 0,
      quarter_sheet_name: `Q${qQuarter} ${qYear}`,
      policy_details: {
        agent_code: String(policy.agent_code || ''),
        booking_date: String(policy.booking_date || policy.created_at || ''),
        policy_start_date: String(policy.start_date || ''),
        policy_end_date: String(policy.end_date || ''),
        created_at: String(policy.created_at || ''),
        updated_at: String(policy.updated_at || ''),
      },
      policy_info: {
        reporting_month: String(policy.reporting_month || ''),
        child_id: String(policy.child_id || ''),
        major_categorisation: String(policy.major_categorisation || ''),
        product: String(policy.product || policy.product_type || ''),
        product_type: String(policy.product_type || ''),
        plan_type: String(policy.plan_type || ''),
        gross_premium: String(policy.gross_premium || 0),
        gst_amount: String(policy.gst_amount || 0),
        net_premium: String(policy.net_premium || 0),
        od_premium: String(policy.od_premium || 0),
        tp_premium: String(policy.tp_premium || 0),
        registration_no: String(policy.registration_number || ''),
        make_model: String(policy.make_model || ''),
        model: String(policy.model || ''),
        vehicle_variant: String(policy.vehicle_variant || ''),
        gvw: String(policy.gvw || ''),
        rto: String(policy.rto || ''),
        state: String(policy.state || ''),
        fuel_type: String(policy.fuel_type || ''),
        cc: String(policy.cc || ''),
        age_year: String(policy.age_year || ''),
        ncb: String(policy.ncb || ''),
        discount_percent: String(policy.discount_percent || ''),
        business_type: String(policy.business_type || ''),
        seating_capacity: String(policy.seating_capacity || ''),
        veh_wheels: String(policy.veh_wheels || ''),
        customer_name: String(policy.customer_name || ''),
        customer_number: String(policy.customer_phone_number || ''),
        commissionable_premium: String(policy.commissionable_premium || 0),
        incoming_grid_percent: String(policy.incoming_grid_percent || 0),
        receivable_from_broker: String(policy.receivable_from_broker || 0),
        extra_grid: String(policy.extra_grid || 0),
        extra_amount_receivable: String(policy.extra_amount_receivable || 0),
        total_receivable: String(policy.total_receivable || 0),
        claimed_by: String(policy.claimed_by || ''),
        payment_by: String(policy.payment_by || ''),
        payment_mode: String(policy.payment_method || ''),
        agent_code: String(policy.agent_code || ''),
      },
      metadata: {
        fetched_at: new Date().toISOString(),
        search_quarter: `Q${qQuarter} ${qYear}`,
        database_search_completed: true,
        sheets_search_completed: true,
      }
    }
  }

  const normalized = normalize()

  if (isLoading) {
    return (
      <DashboardWrapper requiredRole="agent">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-4">
            <LoadingSpinner />
            <p className="text-sm text-gray-500">Loading policy details...</p>
          </div>
        </div>
      </DashboardWrapper>
    )
  }

  if (error || !normalized) {
    return (
      <DashboardWrapper requiredRole="agent">
        <div className="container mx-auto p-6">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center space-y-4">
              <h1 className="text-2xl font-bold text-gray-900">Policy Not Found</h1>
              <p className="text-gray-600">The requested policy could not be found.</p>
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
    <DashboardWrapper requiredRole="agent">
      <div className="container mx-auto space-y-6">
        <div className="mb-4">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
        <PolicyDashboard 
          data={normalized}
          onDownload={() => {}}
        />
      </div>
    </DashboardWrapper>
  )
}
