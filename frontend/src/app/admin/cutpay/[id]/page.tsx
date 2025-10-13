'use client'

import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { DashboardWrapper } from '@/components/dashboard-wrapper'
import { useCutPayByPolicy } from '@/hooks/cutpayQuery'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { PolicyDashboard, PolicyData } from '@/components/admin/cutpay/policy-dashboard'
import Loading from '@/app/loading'

export default function CutPayDetailPage() {
  const params = useParams()
  const router = useRouter()
  const search = useSearchParams()
  const cutpayId = parseInt(params.id as string)
  const policy = search.get('policy') || ''
  const quarter = search.get('q') ? parseInt(search.get('q') as string) : undefined
  const year = search.get('y') ? parseInt(search.get('y') as string) : undefined

  const { data, error, isLoading } = useCutPayByPolicy(policy, quarter, year, true)

  const normalize = (): PolicyData | null => {
    if (!data) return null

    // Extract from new API response format
    const policyData = data.policy_data
    const metadata = data.metadata
    const adminInput = policyData.admin_input
    const extractedData = policyData.extracted_data
    
    // For now, google_sheets_data is not in the new response, so we'll use empty object
    const sheet = {} as Record<string, string>
    const get = (key: string): string => (sheet && sheet[key]) ? String(sheet[key]) : ''

    return {
      policy_number: metadata.policy_number,
      quarter: metadata.quarter,
      year: metadata.year,
      quarter_sheet_name: metadata.quarter_sheet_name,
      policy_details: {
        agent_code: adminInput?.agent_code || get('Agent Code') || '',
        booking_date: adminInput?.booking_date || get("Booking Date(Click to select Date)") || '',
        policy_start_date: extractedData?.start_date || get('Policy Start Date') || '',
        policy_end_date: extractedData?.end_date || get('Policy End Date') || '',
        created_at: policyData.created_at || '',
        updated_at: policyData.updated_at || '',
      },
      policy_info: {
        reporting_month: adminInput?.reporting_month || get("Reporting Month (mmm'yy)"),
        child_id: adminInput?.admin_child_id || get("Child ID/ User ID [Provided by Insure Zeal]"),
        major_categorisation: extractedData?.major_categorisation || get("Major Categorisation( Motor/Life/ Health)"),
        product: extractedData?.product_insurer_report || get('Product (Insurer Report)'),
        product_type: extractedData?.product_type || get('Product Type'),
        plan_type: extractedData?.plan_type || get('Plan type (Comp/STP/SAOD)'),
        gross_premium: String(extractedData?.gross_premium || '') || get('Gross premium'),
        gst_amount: String(extractedData?.gst_amount || '') || get('GST Amount'),
        net_premium: String(extractedData?.net_premium || '') || get('Net premium'),
        od_premium: String(extractedData?.od_premium || '') || get('OD Preimium'),
        tp_premium: String(extractedData?.tp_premium || '') || get('TP Premium'),
        registration_no: extractedData?.registration_number || get('Registration.no'),
        make_model: extractedData?.make_model || get('Make_Model'),
        model: extractedData?.model || get('Model'),
        vehicle_variant: extractedData?.vehicle_variant || get('Vehicle_Variant'),
        gvw: String(extractedData?.gvw || '') || get('GVW'),
        rto: extractedData?.rto || get('RTO'),
        state: extractedData?.state || get('State'),
        fuel_type: extractedData?.fuel_type || get('Fuel Type'),
        cc: String(extractedData?.cc || '') || get('CC'),
        age_year: String(extractedData?.age_year || '') || get('Age(Year)'),
        ncb: extractedData?.ncb || get('NCB (YES/NO)'),
        discount_percent: String(extractedData?.discount_percent || '') || get('Discount %'),
        business_type: extractedData?.business_type || get('Business Type'),
        seating_capacity: String(extractedData?.seating_capacity || '') || get('Seating Capacity'),
        veh_wheels: String(extractedData?.veh_wheels || '') || get('Veh_Wheels'),
        customer_name: extractedData?.customer_name || get('Customer Name'),
        customer_number: extractedData?.customer_phone_number || get('Customer Number'),
        commissionable_premium: String(adminInput?.commissionable_premium || '') || get('Commissionable Premium'),
        incoming_grid_percent: String(adminInput?.incoming_grid_percent || '') || get('Incoming Grid %'),
        receivable_from_broker: String(policyData.calculations?.receivable_from_broker || '') || get('Receivable from Broker'),
        extra_grid: String(adminInput?.extra_grid || '') || get('Extra Grid'),
        extra_amount_receivable: String(policyData.calculations?.extra_amount_receivable_from_broker || '') || get('Extra Amount Receivable from Broker'),
        total_receivable: String(policyData.calculations?.total_receivable_from_broker || '') || get('Total Receivable from Broker'),
        claimed_by: policyData.claimed_by || get('Claimed By'),
        payment_by: adminInput?.payment_by || get('Payment by'),
        payment_mode: adminInput?.payment_method || get('Payment Mode'),
        agent_code: adminInput?.agent_code || get('Agent Code') || '',
      },
      metadata: {
        fetched_at: metadata.fetched_at,
        search_quarter: metadata.search_quarter || metadata.quarter_sheet_name,
        database_search_completed: metadata.database_search_completed,
        sheets_search_completed: metadata.sheets_search_completed,
      }
    }
  }

  const normalized = normalize()

  // Show loading while fetching
  if (isLoading) {
    return (
      <DashboardWrapper requiredRole="admin">
            <Loading />
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


