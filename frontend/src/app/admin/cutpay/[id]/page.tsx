'use client'

import { useParams, useRouter } from 'next/navigation'
import { DashboardWrapper } from '@/components/dashboard-wrapper'
import { useCutPayById } from '@/hooks/cutpayQuery'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LoadingSpinner } from '@/components/ui/loader'
import { ArrowLeft, Edit, DollarSign, Calendar, User, FileText, TrendingUp, Building2 } from 'lucide-react'

export default function CutPayDetailPage() {
  const params = useParams()
  const router = useRouter()
  const cutpayId = parseInt(params.id as string)

  const { data: cutpay, isLoading, error } = useCutPayById(cutpayId)

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

  if (error || !cutpay) {
    return (
      <DashboardWrapper requiredRole="admin">
        <div className="max-w-5xl mx-auto p-6">
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
    <DashboardWrapper requiredRole="admin">
      <div className="max-w-5xl mx-auto space-y-6 p-6">
        {/* Navigation */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Cut Pay
          </Button>
        </div>

        {/* Transaction Header - Profile-like */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
          <div className="flex flex-col lg:flex-row items-start lg:items-center gap-8">
            {/* Transaction Icon/Avatar */}
            <div className="relative">
              <div className="w-24 h-24 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center shadow-xl">
                <DollarSign className="w-12 h-12 text-white" />
              </div>
              <div className="absolute -bottom-2 -right-2">
                <Badge variant="secondary" className="bg-white shadow-md">
                  {cutpay.payment_method}
                </Badge>
              </div>
            </div>

            {/* Transaction Info */}
            <div className="flex-1 space-y-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  {cutpay.policy_number}
                </h1>
                <p className="text-lg text-gray-600 dark:text-gray-300 mt-1">
                  {cutpay.insurer_name} • Agent: {cutpay.agent_code}
                </p>
              </div>

              {/* Key Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(cutpay.cut_pay_amount)}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">Cut Pay</p>
                </div>
                <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">
                    {formatCurrency(cutpay.gross_premium)}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">Gross Premium</p>
                </div>
                <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <p className="text-2xl font-bold text-purple-600">
                    {formatCurrency(cutpay.total_receivable_from_broker)}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">Total Receivable</p>
                </div>
                <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <p className="text-2xl font-bold text-orange-600">
                    {cutpay.agent_commission_given_percent}%
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">Commission</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2">
              <Button onClick={() => router.push(`/admin/cutpay/${cutpayId}/edit`)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit Transaction
              </Button>
            </div>
          </div>
        </div>

        {/* Transaction Details - Organized like profile tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="p-6 space-y-8">
            {/* Policy & Company Information */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Building2 className="h-5 w-5 text-blue-600" />
                Policy & Company Details
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <DetailItem label="Policy Number" value={cutpay.policy_number} />
                  <DetailItem label="Insurance Company" value={cutpay.insurer_name} />
                  <DetailItem label="Broker" value={cutpay.broker_name} />
                </div>
                <div className="space-y-4">
                  <DetailItem label="Commission Grid" value={cutpay.incoming_grid_percent ? `${cutpay.incoming_grid_percent}%` : null} />
                  <DetailItem label="Payment Source" value={cutpay.payment_by_office} />
                  <DetailItem label="Payment By" value={cutpay.payment_by} />
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
                    value={formatCurrency(cutpay.gross_premium)}
                    highlight="blue"
                  />
                  <DetailItem 
                    label="Net Premium" 
                    value={formatCurrency(cutpay.net_premium)}
                    highlight="purple"
                  />
                </div>
                <div className="space-y-4">
                  <DetailItem 
                    label="Cut Pay Amount" 
                    value={formatCurrency(cutpay.cut_pay_amount)}
                    highlight="green"
                  />
                  <DetailItem 
                    label="Total Receivable" 
                    value={formatCurrency(cutpay.total_receivable_from_broker)}
                    highlight="orange"
                  />
                </div>
              </div>
            </div>

            {/* Agent & Payment Information */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <User className="h-5 w-5 text-indigo-600" />
                Agent & Payment Information
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <DetailItem label="Agent Code" value={cutpay.agent_code} />
                  <DetailItem 
                    label="Commission Percentage" 
                    value={`${cutpay.agent_commission_given_percent}%`}
                    highlight="indigo"
                  />
                </div>
                <div className="space-y-4">
                  <DetailItem label="Payment Method" value={cutpay.payment_method} />
                  <Badge variant="outline" className="text-sm">
                    {cutpay.payment_method}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Transaction Dates */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-amber-600" />
                Important Dates
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <DetailItem 
                    label="Booking Date" 
                    value={cutpay.booking_date ? formatDate(cutpay.booking_date) : null}
                  />
                  {cutpay.payout_on && (
                    <DetailItem 
                      label="Payout Date" 
                      value={formatDate(cutpay.payout_on)}
                    />
                  )}
                </div>
                <div className="space-y-4">
                  {cutpay.created_at && (
                    <DetailItem 
                      label="Created" 
                      value={formatDate(cutpay.created_at)}
                    />
                  )}
                  {cutpay.updated_at && (
                    <DetailItem 
                      label="Last Updated" 
                      value={formatDate(cutpay.updated_at)}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Notes Section */}
            {cutpay.notes && (
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-gray-600" />
                  Additional Notes
                </h3>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                    {cutpay.notes}
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
  highlight?: 'blue' | 'green' | 'purple' | 'orange' | 'indigo' | 'amber'
}

function DetailItem({ label, value, highlight }: DetailItemProps) {
  const highlightColors = {
    blue: 'text-blue-600 dark:text-blue-400',
    green: 'text-green-600 dark:text-green-400',
    purple: 'text-purple-600 dark:text-purple-400',
    orange: 'text-orange-600 dark:text-orange-400',
    indigo: 'text-indigo-600 dark:text-indigo-400',
    amber: 'text-amber-600 dark:text-amber-400',
  }

  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</p>
      <p className={`text-base ${highlight ? highlightColors[highlight] : 'text-gray-900 dark:text-white'} font-semibold`}>
        {value || <span className="text-gray-400 font-normal">Not provided</span>}
      </p>
    </div>
  )
}


