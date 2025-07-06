"use client"

import React, { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useAtom } from 'jotai'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Calculator, Save, Eye, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { extractedDataAtom, uploadedDocumentsAtom } from '@/lib/atoms/cutpay-flow'
import { useCreateCutPay } from '@/hooks/adminQuery'

// Simple form schema
const cutPayFormSchema = z.object({
  // Admin Manual Input Fields
  reporting_month: z.string().min(1, 'Reporting month is required'),
  booking_date: z.string().min(1, 'Booking date is required'),
  agent_code: z.string().min(1, 'Agent code is required'),
  code_type: z.enum(['Direct', 'Broker'], { required_error: 'Code type is required' }),
  incoming_grid_percent: z.number().min(0).max(100),
  agent_commission_given_percent: z.number().min(0).max(100),
  extra_grid: z.number().min(0),
  commissionable_premium: z.number().min(0),
})

type FormData = z.infer<typeof cutPayFormSchema>

export function CutPaySimpleForm() {
  const [extractedData] = useAtom(extractedDataAtom)
  const [uploadedDocuments] = useAtom(uploadedDocumentsAtom)
  const [calculations, setCalculations] = useState({
    payableAmount: 0,
    commissionAmount: 0,
    gridAmount: 0,
    totalAmount: 0
  })

  const createMutation = useCreateCutPay()

  const form = useForm<FormData>({
    resolver: zodResolver(cutPayFormSchema),
    defaultValues: {
      reporting_month: '',
      booking_date: new Date().toISOString().split('T')[0],
      agent_code: '',
      code_type: 'Direct',
      incoming_grid_percent: 0,
      agent_commission_given_percent: 0,
      extra_grid: 0,
      commissionable_premium: 0,
    }
  })

  // Auto-fill form with extracted data
  useEffect(() => {
    if (extractedData) {
      form.setValue('commissionable_premium', extractedData.net_premium || extractedData.gross_premium || 0)
    }
  }, [extractedData, form])

  // Calculate amounts when form values change
  const watchedValues = form.watch()
  useEffect(() => {
    const {
      commissionable_premium,
      incoming_grid_percent,
      agent_commission_given_percent,
      extra_grid
    } = watchedValues

    const premium = commissionable_premium || 0
    const gridPercent = incoming_grid_percent || 0
    const commissionPercent = agent_commission_given_percent || 0
    const extraGrid = extra_grid || 0

    const gridAmount = (premium * gridPercent) / 100
    const commissionAmount = (premium * commissionPercent) / 100
    const payableAmount = gridAmount - commissionAmount + extraGrid
    const totalAmount = gridAmount + extraGrid

    setCalculations({
      payableAmount,
      commissionAmount,
      gridAmount,
      totalAmount
    })
  }, [watchedValues])

  const onSubmit = async (data: FormData) => {
    try {
      // Create the cut pay transaction with the correct API structure
      const transactionData = {
        extracted_data: extractedData,
        admin_input: {
          reporting_month: data.reporting_month,
          booking_date: data.booking_date,
          agent_code: data.agent_code,
          code_type: data.code_type,
          incoming_grid_percent: data.incoming_grid_percent,
          agent_commission_given_percent: data.agent_commission_given_percent,
          extra_grid: data.extra_grid,
          commissionable_premium: data.commissionable_premium,
          payment_by: 'Agent', // Default value
          payment_method: 'cash', // Default value
          payout_on: 'OD', // Default value
          agent_extra_percent: 0, // Default value
          payment_by_office: '', // Default value
          insurer_id: null,
          broker_id: null,
          admin_child_id: null,
          customer_phone: '',
          customer_email: '',
          amount_received: 0,
          notes: ''
        },
        calculations: {
          receivable_from_broker: calculations.gridAmount,
          extra_amount_receivable_from_broker: data.extra_grid,
          total_receivable_from_broker: calculations.gridAmount + data.extra_grid,
          total_receivable_from_broker_with_gst: (calculations.gridAmount + data.extra_grid) * 1.18,
          cut_pay_amount: calculations.payableAmount,
          agent_po_amt: calculations.commissionAmount,
          agent_extra_amount: 0,
          total_agent_po_amt: calculations.commissionAmount
        },
        status: 'draft',
        notes: 'Created via simple form'
      }

      const result = await createMutation.mutateAsync(transactionData)
      
      toast.success('Cut Pay transaction created successfully!')
      console.log('Transaction created:', result)
      
      // TODO: Upload documents to the created transaction
      // TODO: Redirect or show success page
      
    } catch (error) {
      console.error('Failed to create transaction:', error)
      toast.error('Failed to create transaction. Please try again.')
    }
  }

  const handleViewDocument = (doc: { url?: string }) => {
    if (doc.url) {
      window.open(doc.url, '_blank')
    }
  }

  return (
    <div className="space-y-6">
      {/* Form and Content - Full Width */}
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Extracted Data Display */}
        {extractedData && (
          <Card className="bg-blue-50 border-blue-200">
            <CardHeader>
              <CardTitle className="text-lg flex items-center space-x-2">
                <FileText className="h-5 w-5" />
                <span>Extracted Policy Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                {extractedData.policy_number && (
                  <div>
                    <Label className="text-blue-800">Policy Number</Label>
                    <p className="font-medium">{extractedData.policy_number}</p>
                  </div>
                )}
                {extractedData.customer_name && (
                  <div>
                    <Label className="text-blue-800">Customer Name</Label>
                    <p className="font-medium">{extractedData.customer_name}</p>
                  </div>
                )}
                {extractedData.gross_premium && (
                  <div>
                    <Label className="text-blue-800">Gross Premium</Label>
                    <p className="font-medium">₹{extractedData.gross_premium.toLocaleString()}</p>
                  </div>
                )}
                {extractedData.net_premium && (
                  <div>
                    <Label className="text-blue-800">Net Premium</Label>
                    <p className="font-medium">₹{extractedData.net_premium.toLocaleString()}</p>
                  </div>
                )}
                {extractedData.registration_no && (
                  <div>
                    <Label className="text-blue-800">Vehicle Registration</Label>
                    <p className="font-medium">{extractedData.registration_no}</p>
                  </div>
                )}
                {extractedData.make_model && (
                  <div>
                    <Label className="text-blue-800">Vehicle Make/Model</Label>
                    <p className="font-medium">{extractedData.make_model}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Manual Input Fields */}
        <Card>
          <CardHeader>
            <CardTitle>Transaction Details</CardTitle>
          </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="reporting_month">Reporting Month *</Label>
                    <Input
                      id="reporting_month"
                      type="month"
                      {...form.register('reporting_month')}
                    />
                    {form.formState.errors.reporting_month && (
                      <p className="text-sm text-red-600">{form.formState.errors.reporting_month.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="booking_date">Booking Date *</Label>
                    <Input
                      id="booking_date"
                      type="date"
                      {...form.register('booking_date')}
                    />
                    {form.formState.errors.booking_date && (
                      <p className="text-sm text-red-600">{form.formState.errors.booking_date.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="agent_code">Agent Code *</Label>
                    <Input
                      id="agent_code"
                      placeholder="Enter agent code"
                      {...form.register('agent_code')}
                    />
                    {form.formState.errors.agent_code && (
                      <p className="text-sm text-red-600">{form.formState.errors.agent_code.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="code_type">Code Type *</Label>
                    <Select
                      value={form.watch('code_type')}
                      onValueChange={(value) => form.setValue('code_type', value as 'Direct' | 'Broker')}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select code type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Direct">Direct</SelectItem>
                        <SelectItem value="Broker">Broker</SelectItem>
                      </SelectContent>
                    </Select>
                    {form.formState.errors.code_type && (
                      <p className="text-sm text-red-600">{form.formState.errors.code_type.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="commissionable_premium">Commissionable Premium *</Label>
                    <Input
                      id="commissionable_premium"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      {...form.register('commissionable_premium', { valueAsNumber: true })}
                    />
                    {form.formState.errors.commissionable_premium && (
                      <p className="text-sm text-red-600">{form.formState.errors.commissionable_premium.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="incoming_grid_percent">Incoming Grid % *</Label>
                    <Input
                      id="incoming_grid_percent"
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      placeholder="0.00"
                      {...form.register('incoming_grid_percent', { valueAsNumber: true })}
                    />
                    {form.formState.errors.incoming_grid_percent && (
                      <p className="text-sm text-red-600">{form.formState.errors.incoming_grid_percent.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="agent_commission_given_percent">Agent Commission % *</Label>
                    <Input
                      id="agent_commission_given_percent"
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      placeholder="0.00"
                      {...form.register('agent_commission_given_percent', { valueAsNumber: true })}
                    />
                    {form.formState.errors.agent_commission_given_percent && (
                      <p className="text-sm text-red-600">{form.formState.errors.agent_commission_given_percent.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="extra_grid">Extra Grid Amount</Label>
                    <Input
                      id="extra_grid"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      {...form.register('extra_grid', { valueAsNumber: true })}
                    />
                    {form.formState.errors.extra_grid && (
                      <p className="text-sm text-red-600">{form.formState.errors.extra_grid.message}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Calculations Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Calculator className="h-5 w-5" />
                  <span>Calculated Amounts</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Grid Amount</Label>
                    <div className="p-3 bg-gray-50 rounded border">
                      <p className="font-semibold">₹{calculations.gridAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Commission Amount</Label>
                    <div className="p-3 bg-gray-50 rounded border">
                      <p className="font-semibold">₹{calculations.commissionAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Payable Amount</Label>
                    <div className="p-3 bg-blue-50 rounded border border-blue-200">
                      <p className="font-semibold text-blue-900">₹{calculations.payableAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Total Amount</Label>
                    <div className="p-3 bg-green-50 rounded border border-green-200">
                      <p className="font-semibold text-green-900">₹{calculations.totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
                    </div>
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="text-sm text-gray-600 space-y-1">
                  <p><strong>Calculation Formula:</strong></p>
                  <p>Grid Amount = Commissionable Premium × Incoming Grid %</p>
                  <p>Commission Amount = Commissionable Premium × Agent Commission %</p>
                  <p>Payable Amount = Grid Amount - Commission Amount + Extra Grid</p>
                  <p>Total Amount = Grid Amount + Extra Grid</p>
                </div>
              </CardContent>
            </Card>

        {/* Submit Button */}
        <Button
          type="submit"
          disabled={createMutation.isPending}
          className="w-full"
          size="lg"
        >
          {createMutation.isPending ? (
            <>
              <span className="animate-spin mr-2">⏳</span>
              Creating Transaction...
            </>
          ) : (
            <>
              <Save className="h-5 w-5 mr-2" />
              Create Cut Pay Transaction
            </>
          )}
        </Button>
      </form>

      {/* Document Viewer Section - Below Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Uploaded Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {uploadedDocuments.map((doc) => (
              <div key={doc.id} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{doc.name}</p>
                    <p className="text-xs text-gray-500 capitalize">{doc.type.replace('_', ' ')}</p>
                    <p className="text-xs text-gray-400">{(doc.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewDocument(doc)}
                    className="ml-2"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            {uploadedDocuments.length === 0 && (
              <div className="col-span-full">
                <p className="text-sm text-gray-500 text-center py-8">No documents uploaded</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
