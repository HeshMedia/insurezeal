/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { DashboardWrapper } from '@/components/dashboard-wrapper'
import { useCutPayByPolicy } from '@/hooks/cutpayQuery'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/ui/loader'
import { ArrowLeft } from 'lucide-react'
import { PolicyDashboard, PolicyData } from '@/components/admin/cutpay/policy-dashboard'

export default function CutPayDetailPage() {
  const params = useParams()
  const router = useRouter()
  const search = useSearchParams()
  const cutpayId = parseInt(params.id as string)
  const policy = search.get('policy') || ''
  const quarter = search.get('q') ? parseInt(search.get('q') as string) : undefined
  const year = search.get('y') ? parseInt(search.get('y') as string) : undefined

  const { data, isLoading, error } = useCutPayByPolicy(policy, quarter, year, true)

  const normalize = (): PolicyData | null => {
    if (!data) return null

    const db = (data as any)?.database_record as any
    const sheet = (data as any)?.google_sheets_data as Record<string, string>

    const get = (key: string): string => (sheet && sheet[key]) ? String(sheet[key]) : ''

    return {
      policy_number: data.policy_number,
      quarter: data.quarter,
      year: data.year,
      quarter_sheet_name: data.quarter_sheet_name,
      policy_details: {
        agent_code: db?.agent_code || get('Agent Code') || '',
        booking_date: db?.booking_date || get("Booking Date(Click to select Date)") || '',
        policy_start_date: db?.policy_start_date || get('Policy Start Date') || '',
        policy_end_date: db?.policy_end_date || get('Policy End Date') || '',
        created_at: db?.created_at || '',
        updated_at: db?.updated_at || '',
      },
      policy_info: {
        reporting_month: get("Reporting Month (mmm'yy)"),
        child_id: get("Child ID/ User ID [Provided by Insure Zeal]"),
        major_categorisation: get("Major Categorisation( Motor/Life/ Health)"),
        product: get('Product (Insurer Report)'),
        product_type: get('Product Type'),
        plan_type: get('Plan type (Comp/STP/SAOD)'),
        gross_premium: get('Gross premium'),
        gst_amount: get('GST Amount'),
        net_premium: get(' Net premium '),
        od_premium: get('OD Preimium'),
        tp_premium: get('TP Premium'),
        registration_no: get('Registration.no'),
        make_model: get('Make_Model'),
        model: get('Model'),
        vehicle_variant: get('Vehicle_Variant'),
        gvw: get('GVW'),
        rto: get('RTO'),
        state: get('State'),
        fuel_type: get('Fuel Type'),
        cc: get('CC'),
        age_year: get('Age(Year)'),
        ncb: get('NCB (YES/NO)'),
        discount_percent: get('Discount %'),
        business_type: get('Business Type'),
        seating_capacity: get('Seating Capacity'),
        veh_wheels: get('Veh_Wheels'),
        customer_name: get('Customer Name'),
        customer_number: get('Customer Number'),
        commissionable_premium: get('Commissionable Premium'),
        incoming_grid_percent: get('Incoming Grid %'),
        receivable_from_broker: get('Receivable from Broker'),
        extra_grid: get('Extra Grid'),
        extra_amount_receivable: get('Extra Amount Receivable from Broker'),
        total_receivable: get('Total Receivable from Broker'),
        claimed_by: get('Claimed By'),
        payment_by: get('Payment by'),
        payment_mode: get('Payment Mode'),
        agent_code: get('Agent Code') || db?.agent_code || '',
      },
      metadata: {
        fetched_at: String((data as any).metadata?.fetched_at || ''),
        search_quarter: (data as any).metadata?.search_quarter || data.quarter_sheet_name,
        database_search_completed: Boolean((data as any).metadata?.database_search_completed),
        sheets_search_completed: Boolean((data as any).metadata?.sheets_search_completed),
      }
    }
  }

  const normalized = normalize()

  if (isLoading) {
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

  if (error || !normalized) {
    return (
      <DashboardWrapper requiredRole="admin">
        <div className=" p-6">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center space-y-4">
              <h1 className="text-2xl font-bold text-gray-900">Transaction Not Found</h1>
              <p className="text-gray-600">The requested cutpay transaction could not be found.</p>
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
      <div className=" space-y-6">
        <div className="mb-4">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
        <PolicyDashboard 
          data={normalized}
          onEdit={() => router.push(`/admin/cutpay/${cutpayId}/edit?policy=${encodeURIComponent(policy)}&q=${quarter}&y=${year}`)}
          onDownload={() => {}}
        />
      </div>
    </DashboardWrapper>
  )
}


