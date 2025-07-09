'use client'

import { useParams, useRouter } from 'next/navigation'
import { DashboardWrapper } from '@/components/dashboard-wrapper'
import { useCutPayById, useUpdateCutPay } from '@/hooks/cutpayQuery'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LoadingSpinner } from '@/components/ui/loader'
import { 
  ArrowLeft, 
  Save, 
  CreditCard, 
  DollarSign, 
  Calendar, 
  FileText 
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useEffect } from 'react'

const cutpayFormSchema = z.object({
  policy_number: z.string().min(1, "Policy number is required"),
  agent_code: z.string().min(1, "Agent code is required"),
  insurer_name: z.string().min(1, "Insurance company is required"),
  broker_name: z.string().min(1, "Broker is required"),
  gross_premium: z.number().min(0, "Gross premium must be positive"),
  net_premium: z.number().min(0, "Net premium must be positive"),
  incoming_grid_percent: z.number().min(0).max(100, "Percentage must be between 0-100"),
  agent_commission_given_percent: z.number().min(0).max(100, "Percentage must be between 0-100"),
  cut_pay_amount: z.number().min(0, "Cut pay amount must be positive"),
  payment_by: z.string().min(1, "Payment by is required"),
  total_receivable_from_broker: z.number().min(0, "Total receivable must be positive"),
  payment_method: z.string().min(1, "Payment method is required"),
  payment_by_office: z.string().min(1, "Payment source is required"),
  booking_date: z.string().min(1, "Booking date is required"),
  payout_on: z.string().optional(),
  notes: z.string().optional(),
})

type CutpayFormValues = z.infer<typeof cutpayFormSchema>

export default function CutPayEditPage() {
  const params = useParams()
  const router = useRouter()
  
  const cutpayId = parseInt(params.id as string)
  
  const { data: cutpayData, isLoading: isLoadingCutpay } = useCutPayById(cutpayId)
  const updateMutation = useUpdateCutPay()
  
  const isLoading = updateMutation.isPending
  
  const form = useForm<CutpayFormValues>({
    resolver: zodResolver(cutpayFormSchema),
    defaultValues: {
      policy_number: "",
      agent_code: "",
      insurer_name: "",
      broker_name: "",
      gross_premium: 0,
      net_premium: 0,
      incoming_grid_percent: 0,
      agent_commission_given_percent: 0,
      cut_pay_amount: 0,
      payment_by: "",
      total_receivable_from_broker: 0,
      payment_method: "",
      payment_by_office: "",
      booking_date: "",
      payout_on: "",
      notes: "",
    },
  })

  // Set form values when data is loaded
  useEffect(() => {
    if (cutpayData) {
      form.reset({
        policy_number: cutpayData.policy_number || "",
        agent_code: cutpayData.agent_code || "",
        insurer_name: cutpayData.insurer_name || "",
        broker_name: cutpayData.broker_name || "",
        gross_premium: cutpayData.gross_premium || 0,
        net_premium: cutpayData.net_premium || 0,
        incoming_grid_percent: cutpayData.incoming_grid_percent || 0,
        agent_commission_given_percent: cutpayData.agent_commission_given_percent || 0,
        cut_pay_amount: cutpayData.cut_pay_amount || 0,
        payment_by: cutpayData.payment_by || "",
        total_receivable_from_broker: cutpayData.total_receivable_from_broker || 0,
        payment_method: cutpayData.payment_method || "",
        payment_by_office: cutpayData.payment_by_office || "",
        booking_date: cutpayData.booking_date || "",
        payout_on: cutpayData.payout_on || "",
        notes: cutpayData.notes || "",
      })
    }
  }, [cutpayData, form])

  const onSubmit = async (data: CutpayFormValues) => {
    try {
      await updateMutation.mutateAsync({
        cutpayId,
        data,
      })
      toast.success("Transaction updated successfully")
      router.push(`/admin/cutpay/${cutpayId}`)
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to update transaction")
    }
  }

  const paymentMethods = [
    "Bank Transfer",
    "Check",
    "Cash",
    "Online Transfer",
    "UPI",
    "Credit Card",
    "Other"
  ]

  const paymentSources = [
    "Agent",
    "Broker",
    "Insurance Company",
    "Third Party",
    "Other"
  ]

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
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Transaction
          </Button>
        </div>

        {/* Edit Header - Profile-like */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-lg">
              <Save className="w-8 h-8 text-white" />
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

        {/* Edit Form */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="p-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                {/* Policy & Company Information */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-blue-600" />
                    Policy & Company Details
                  </h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="policy_number"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Policy Number *</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter policy number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="agent_code"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Agent Code *</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter agent code" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="insurer_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Insurance Company *</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter insurance company" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="broker_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Broker *</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter broker name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="incoming_grid_percent"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Incoming Grid % *</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              placeholder="0" 
                              min="0" 
                              max="100"
                              {...field}
                              onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Financial Information */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-green-600" />
                    Financial Details
                  </h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="gross_premium"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Gross Premium *</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              placeholder="0.00" 
                              {...field}
                              onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="net_premium"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Net Premium *</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              placeholder="0.00" 
                              {...field}
                              onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="agent_commission_given_percent"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Agent Commission % *</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              placeholder="0" 
                              min="0" 
                              max="100"
                              {...field}
                              onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="cut_pay_amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cut Pay Amount *</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              placeholder="0.00" 
                              {...field}
                              onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="total_receivable_from_broker"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Total Receivable *</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              placeholder="0.00" 
                              {...field}
                              onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Payment Information */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-purple-600" />
                    Payment Information
                  </h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="payment_by"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Payment By *</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter payment by" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="payment_method"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Payment Method *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select payment method" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {paymentMethods.map((method) => (
                                <SelectItem key={method} value={method}>
                                  {method}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="payment_by_office"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Payment Source *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select payment source" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {paymentSources.map((source) => (
                                <SelectItem key={source} value={source}>
                                  {source}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Dates */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-amber-600" />
                    Important Dates
                  </h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="booking_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Booking Date *</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="payout_on"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Payout Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Notes */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <FileText className="h-5 w-5 text-gray-600" />
                    Additional Notes
                  </h3>
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Enter any additional notes..." 
                            rows={4}
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Form Actions */}
                <div className="border-t pt-6 flex items-center gap-4">
                  <Button 
                    type="submit" 
                    disabled={isLoading}
                    className="min-w-[120px]"
                  >
                    {isLoading ? (
                      <>
                        <LoadingSpinner />
                        <span className="ml-2">Saving...</span>
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Changes
                      </>
                    )}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => router.back()}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </div>
      </div>
    </DashboardWrapper>
  )
}
