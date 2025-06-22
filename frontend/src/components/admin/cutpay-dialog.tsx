"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { useCreateCutPay, useUpdateCutPay, useCutPayById } from "@/hooks/adminQuery"
import  Loader  from "@/components/ui/loader"
import { toast } from "sonner"
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

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

interface CutPayDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cutpayId?: number | null
}

export function CutPayDialog({ open, onOpenChange, cutpayId }: CutPayDialogProps) {
  const [selectedDate, setSelectedDate] = useState<Date>()
  const [selectedPaymentDate, setSelectedPaymentDate] = useState<Date>()
  
  const { data: cutpayData, isLoading: isLoadingCutpay } = useCutPayById(cutpayId || 0)
  const createMutation = useCreateCutPay()
  const updateMutation = useUpdateCutPay()
  
  const isEditing = !!cutpayId
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
  useState(() => {
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
  })

  const onSubmit = async (data: CutpayFormValues) => {
    try {
      if (isEditing && cutpayId) {
        await updateMutation.mutateAsync({
          cutpayId,
          data,
        })
        toast.success("Transaction updated successfully")
      } else {
        await createMutation.mutateAsync(data)
        toast.success("Transaction created successfully")
      }
      onOpenChange(false)
      form.reset()
    } catch (error: any) {
      toast.error(error.message || "Failed to save transaction")
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Transaction" : "Create New Transaction"}
          </DialogTitle>
          <DialogDescription>
            {isEditing 
              ? "Update the cutpay transaction details below"
              : "Enter the details for the new cutpay transaction"
            }
          </DialogDescription>
        </DialogHeader>

        {isLoadingCutpay && isEditing ? (
          <div className="flex items-center justify-center py-12">
            <Loader />
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Policy Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Policy Information</h3>
                  
                  <FormField
                    control={form.control}
                    name="policy_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Policy Number</FormLabel>
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
                        <FormLabel>Agent Code</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter agent code" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="insurance_company"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Insurance Company</FormLabel>
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
                        <FormLabel>Broker</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter broker name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Financial Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Financial Details</h3>
                  
                  <FormField
                    control={form.control}
                    name="gross_amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Gross Amount</FormLabel>
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
                        <FormLabel>Net Premium</FormLabel>
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
                    name="commission_grid"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Commission Grid</FormLabel>
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
                        <FormLabel>Agent Commission (%)</FormLabel>
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
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Payment Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Payment Details</h3>
                  
                  <FormField
                    control={form.control}
                    name="cut_pay_amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cut Pay Amount</FormLabel>
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
                        <FormLabel>Amount Received</FormLabel>
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
                    name="payment_by"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment By</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter payment source" {...field} />
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
                        <FormLabel>Payment Method</FormLabel>
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
                </div>

                {/* Date and Additional Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Additional Information</h3>
                  
                  <FormField
                    control={form.control}
                    name="payment_source"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment Source</FormLabel>
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

                  <FormField
                    control={form.control}
                    name="transaction_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Transaction Date</FormLabel>
                        <FormControl>
                          <Input 
                            type="date" 
                            {...field}
                          />
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
                        <FormLabel>Payment Date (Optional)</FormLabel>
                        <FormControl>
                          <Input 
                            type="date" 
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes (Optional)</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Enter any additional notes"
                            className="resize-none"
                            rows={3}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading && <Loader />}
                  {isEditing ? "Update Transaction" : "Create Transaction"}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  )
}
