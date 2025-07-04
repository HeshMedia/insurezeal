'use client'

import { useParams, useRouter } from 'next/navigation'
import { DashboardWrapper } from '@/components/dashboard-wrapper'
import { useCutPayById, useCreateCutPay, useUpdateCutPay } from '@/hooks/adminQuery'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import  Loader  from '@/components/ui/loader'
import { ArrowLeft, Save } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useEffect } from 'react'

const cutpayFormSchema = z.object({
  policy_number: z.string().min(1, "Policy number is required"),
  agent_code: z.string().min(1, "Agent code is required"),
  insurance_company: z.string().min(1, "Insurance company is required"),
  broker: z.string().min(1, "Broker is required"),
  gross_amount: z.number().min(0, "Gross amount must be positive"),
  net_premium: z.number().min(0, "Net premium must be positive"),
  commission_grid: z.string().min(1, "Commission grid is required"),
  agent_commission_given_percent: z.number().min(0).max(100, "Percentage must be between 0-100"),
  cut_pay_amount: z.number().min(0, "Cut pay amount must be positive"),
  payment_by: z.string().min(1, "Payment by is required"),
  amount_received: z.number().min(0, "Amount received must be positive"),
  payment_method: z.string().min(1, "Payment method is required"),
  payment_source: z.string().min(1, "Payment source is required"),
  transaction_date: z.string().min(1, "Transaction date is required"),
  payment_date: z.string().optional(),
  notes: z.string().optional(),
})

type CutpayFormValues = z.infer<typeof cutpayFormSchema>

export default function CutPayFormPage() {
  const params = useParams()
  const router = useRouter()
  
  const cutpayId = params.id ? parseInt(params.id as string) : null
  const isEditing = !!cutpayId && cutpayId > 0
  
  const { data: cutpayData, isLoading: isLoadingCutpay } = useCutPayById(cutpayId || 0)
  const createMutation = useCreateCutPay()
  const updateMutation = useUpdateCutPay()
  
  const isLoading = createMutation.isPending || updateMutation.isPending
  
  const form = useForm<CutpayFormValues>({
    resolver: zodResolver(cutpayFormSchema),
    defaultValues: {
      policy_number: "",
      agent_code: "",
      insurance_company: "",
      broker: "",
      gross_amount: 0,
      net_premium: 0,
      commission_grid: "",
      agent_commission_given_percent: 0,
      cut_pay_amount: 0,
      payment_by: "",
      amount_received: 0,
      payment_method: "",
      payment_source: "",
      transaction_date: "",
      payment_date: "",
      notes: "",
    },
  })

  // Set form values when editing
  useEffect(() => {
    if (isEditing && cutpayData) {
      form.reset({
        policy_number: cutpayData.policy_number,
        agent_code: cutpayData.agent_code,
        insurance_company: cutpayData.insurance_company,
        broker: cutpayData.broker,
        gross_amount: cutpayData.gross_amount,
        net_premium: cutpayData.net_premium,
        commission_grid: cutpayData.commission_grid,
        agent_commission_given_percent: cutpayData.agent_commission_given_percent,
        cut_pay_amount: cutpayData.cut_pay_amount,
        payment_by: cutpayData.payment_by,
        amount_received: cutpayData.amount_received,
        payment_method: cutpayData.payment_method,
        payment_source: cutpayData.payment_source,
        transaction_date: cutpayData.transaction_date,
        payment_date: cutpayData.payment_date || "",
        notes: cutpayData.notes || "",
      })
    }
  }, [isEditing, cutpayData, form])

  const onSubmit = async (data: CutpayFormValues) => {
    try {
      if (isEditing && cutpayId) {
        await updateMutation.mutateAsync({
          cutpayId,
          data,
        })
        toast.success("Transaction updated successfully")
        router.push(`/admin/cutpay/${cutpayId}`)
      } else {
        await createMutation.mutateAsync(data)
        toast.success("Transaction created successfully")
        router.push('/admin/cutpay')
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to save transaction")
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

  if (isLoadingCutpay && isEditing) {
    return (
      <DashboardWrapper requiredRole="admin">
        <CutPayFormSkeleton />
      </DashboardWrapper>
    )
  }

  return (
    <DashboardWrapper requiredRole="admin">
      <div className="max-w-4xl mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {isEditing ? "Edit Transaction" : "Create New Transaction"}
              </h1>
              <p className="text-gray-600">
                {isEditing 
                  ? "Update the cutpay transaction details below"
                  : "Enter the details for the new cutpay transaction"
                }
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle>Transaction Details</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="insurance_company"
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
                    name="broker"
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
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="gross_amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Gross Amount *</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01"
                            placeholder="0.00" 
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
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
                            step="0.01"
                            placeholder="0.00" 
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="commission_grid"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Commission Grid *</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter commission grid" {...field} />
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
                            step="0.01"
                            min="0"
                            max="100"
                            placeholder="0.00" 
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="cut_pay_amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cut Pay Amount *</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01"
                            placeholder="0.00" 
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="amount_received"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Amount Received *</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01"
                            placeholder="0.00" 
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="payment_by"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment By *</FormLabel>
                        <FormControl>
                          <Input placeholder="Who made the payment" {...field} />
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
                        <Select onValueChange={field.onChange} value={field.value}>
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
                    name="payment_source"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment Source *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="transaction_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Transaction Date *</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="payment_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Add any additional notes..."
                          className="resize-none"
                          rows={4}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-4 pt-6 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.back()}
                    disabled={isLoading}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader  />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        {isEditing ? "Update Transaction" : "Create Transaction"}
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </DashboardWrapper>
  )
}

function CutPayFormSkeleton() {
  return (
    <div className="max-w-4xl mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-20" />
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64 mt-1" />
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="grid grid-cols-2 gap-4">
                <div>
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <div>
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
