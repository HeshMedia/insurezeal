'use client'

import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { DashboardWrapper } from '@/components/dashboard-wrapper'
import {usePolicyDetailsByNumber } from '@/hooks/policyQuery'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LoadingSpinner } from '@/components/ui/loader'
import { 
  ArrowLeft, 
  Edit, 
  Shield, 
  Calendar, 
  User, 
  FileText, 
  TrendingUp,
  Car
} from 'lucide-react'
import { useAtom } from 'jotai'
import { selectedPolicyContextAtom } from '@/lib/atoms/policy'

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

  const { data: policyNumData, isLoading: loadingNum, error: errorNum } = usePolicyDetailsByNumber({
    policy_number: policyId,
    quarter: qQuarter,
    year: qYear,
  })


  const policy = policyNumData
  const isLoading = loadingNum
  const error = errorNum

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

  if (qQuarter < 1 || qQuarter > 4 || qYear < 2020 || qYear > 2030) {
    return (
      <DashboardWrapper requiredRole="agent">
        <div className="max-w-5xl mx-auto p-6">
          <div className="flex items-center justify-center min-h-[300px]">
            <div className="text-center space-y-4">
              <h1 className="text-2xl font-bold text-gray-900">Quarter/Year required</h1>
              <p className="text-gray-600">Open this policy from the list so quarter and year are included in the URL.</p>
              <Button onClick={() => router.push('/agent/policies')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go to Policies
              </Button>
            </div>
          </div>
        </div>
      </DashboardWrapper>
    )
  }

  if (error || !policy) {
    return (
      <DashboardWrapper requiredRole="agent">
        <div className="max-w-5xl mx-auto p-6">
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

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return '₹0.00'
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  return (
    <DashboardWrapper requiredRole="agent">
      <div className="max-w-5xl mx-auto space-y-6 p-6">
        {/* Navigation */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Policies
          </Button>
        </div>

        {/* Policy Header - Profile-like */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
          <div className="flex flex-col lg:flex-row items-start lg:items-center gap-8">
            {/* Policy Icon/Avatar */}
            <div className="relative">
              <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-xl">
                <Shield className="w-12 h-12 text-white" />
              </div>
              <div className="absolute -bottom-2 -right-2">
                <Badge variant="secondary" className="bg-white shadow-md">
                  {policy.policy_type}
                </Badge>
              </div>
            </div>

            {/* Policy Info */}
            <div className="flex-1 space-y-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  {policy.policy_number}
                </h1>
                <p className="text-lg text-gray-600 dark:text-gray-300 mt-1">
                  {policy.insurance_company} • Agent: {policy.agent_code}
                </p>
              </div>

              {/* Key Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">
                    {formatCurrency(policy.gross_premium)}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">Gross Premium</p>
                </div>
                <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(policy.net_premium)}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">Net Premium</p>
                </div>
                <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <p className="text-2xl font-bold text-purple-600">
                    {formatCurrency(policy.od_premium)}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">OD Premium</p>
                </div>
                <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <p className="text-2xl font-bold text-orange-600">
                    {formatCurrency(policy.tp_premium)}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">TP Premium</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2">
              <Button onClick={() => {
                const q = qQuarter || selectedPolicy.quarter || 0
                const y = qYear || selectedPolicy.year || 0
                if (q && y) {
                  router.push(`/agent/policies/${policyId}/edit?quarter=${q}&year=${y}`)
                } else {
                  router.push(`/agent/policies/${policyId}/edit`)
                }
              }}>
                <Edit className="h-4 w-4 mr-2" />
                Edit Policy
              </Button>
              {/* Delete is admin-only; hidden for agents */}
            </div>
          </div>
        </div>

        {/* Policy Details - Organized like profile tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
          <div className="space-y-8">
            {/* Customer Information */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <User className="h-5 w-5 text-blue-600" />
                Customer Information
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <DetailItem label="Customer Name" value={policy.customer_name} />
                  <DetailItem label="Phone Number" value={policy.customer_phone_number} />
                  <DetailItem label="Child ID" value={policy.child_id} />
                </div>
                <div className="space-y-4">
                  <DetailItem label="Broker Name" value={policy.broker_name} />
                  <DetailItem label="Payment Method" value={policy.payment_method} />
                  <DetailItem label="Payment By" value={policy.payment_by} />
                </div>
              </div>
            </div>

            {/* Vehicle Information */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Car className="h-5 w-5 text-green-600" />
                Vehicle Information
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <DetailItem label="Vehicle Type" value={policy.vehicle_type} />
                  <DetailItem label="Registration Number" value={policy.registration_number} />
                  <DetailItem label="Make & Model" value={policy.make_model} />
                  <DetailItem label="Vehicle Class" value={policy.vehicle_class} />
                  <DetailItem label="Vehicle Segment" value={policy.vehicle_segment} />
                </div>
                <div className="space-y-4">
                  <DetailItem label="Fuel Type" value={policy.fuel_type} />
                  <DetailItem label="CC" value={policy.cc?.toString()} />
                  <DetailItem label="RTO" value={policy.rto} />
                  <DetailItem label="State" value={policy.state} />
                  <DetailItem label="Age (Years)" value={policy.age_year?.toString()} />
                </div>
              </div>
            </div>

            {/* Financial Information */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                Financial Details
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <DetailItem 
                    label="Gross Premium" 
                    value={formatCurrency(policy.gross_premium)}
                    highlight="blue"
                  />
                  <DetailItem 
                    label="Net Premium" 
                    value={formatCurrency(policy.net_premium)}
                    highlight="purple"
                  />
                  <DetailItem 
                    label="GST Amount" 
                    value={formatCurrency(policy.gst_amount)}
                    highlight="indigo"
                  />
                </div>
                <div className="space-y-4">
                  <DetailItem 
                    label="OD Premium" 
                    value={formatCurrency(policy.od_premium)}
                    highlight="green"
                  />
                  <DetailItem 
                    label="TP Premium" 
                    value={formatCurrency(policy.tp_premium)}
                    highlight="orange"
                  />
                  <DetailItem label="NCB" value={policy.ncb} />
                </div>
              </div>
            </div>

            {/* Policy Dates */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-amber-600" />
                Policy Period
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <DetailItem 
                    label="Start Date" 
                    value={policy.start_date ? formatDate(policy.start_date) : null}
                  />
                  <DetailItem 
                    label="End Date" 
                    value={policy.end_date ? formatDate(policy.end_date) : null}
                  />
                </div>
                <div className="space-y-4">
                  {policy.created_at && (
                    <DetailItem 
                      label="Created" 
                      value={formatDate(policy.created_at)}
                    />
                  )}
                  {policy.updated_at && (
                    <DetailItem 
                      label="Last Updated" 
                      value={formatDate(policy.updated_at)}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Notes Section */}
            {policy.notes && (
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-gray-600" />
                  Additional Notes
                </h3>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                    {policy.notes}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardWrapper>
  )
}

interface DetailItemProps {
  label: string
  value?: string | null
  highlight?: 'blue' | 'green' | 'purple' | 'orange' | 'indigo'
}

function DetailItem({ label, value, highlight }: DetailItemProps) {
  const getHighlightClass = () => {
    switch (highlight) {
      case 'blue': return 'text-blue-600 font-semibold'
      case 'green': return 'text-green-600 font-semibold'
      case 'purple': return 'text-purple-600 font-semibold'
      case 'orange': return 'text-orange-600 font-semibold'
      case 'indigo': return 'text-indigo-600 font-semibold'
      default: return 'text-gray-900 dark:text-white'
    }
  }

  return (
    <div className="flex flex-col space-y-1">
      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</span>
      <span className={`text-base ${getHighlightClass()}`}>
        {value || 'Not specified'}
      </span>
    </div>
  )
}
