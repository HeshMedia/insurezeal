'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAtom } from 'jotai'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { CalendarIcon, ArrowLeft, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'

// UI Components
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LoadingDialog } from '@/components/ui/loading-dialog'

// Atoms and utilities
import { 
  policyPdfExtractionDataAtom,
  createdPolicyAtom 
} from '@/lib/atoms/policy'
import { clearAllFromIndexedDB } from '@/lib/utils/indexeddb'

// Hooks and API
import { useSubmitPolicy, useUploadPolicyPdf, useChildIdOptions } from '@/hooks/policyQuery'
import { SubmitPolicyPayload } from '@/types/policy.types'

// Form schema for policy input
const PolicyFormSchema = z.object({
  // Basic policy info
  agent_code: z.string().min(1, 'Agent code is required'),
  agent_id: z.string().min(1, 'Agent ID is required'),
  child_id: z.string().optional(),
  broker_name: z.string().min(1, 'Broker name is required'),
  insurance_company: z.string().min(1, 'Insurance company is required'),
  
  // Policy details extracted from PDF (can be edited)
  policy_number: z.string().min(1, 'Policy number is required'),
  major_categorisation: z.string().optional(),
  product_type: z.string().optional(),
  plan_type: z.string().optional(),
  customer_name: z.string().min(1, 'Customer name is required'),
  customer_phone_number: z.string().optional(),
  policy_type: z.string().optional(),
  insurance_type: z.string().optional(),
  vehicle_type: z.string().optional(),
  registration_number: z.string().optional(),
  vehicle_class: z.string().optional(),
  make_model: z.string().optional(),
  fuel_type: z.string().optional(),
  rto: z.string().optional(),
  state: z.string().optional(),
  
  // Financial details (optional for agents, required for admins)
  gross_premium: z.number().min(0).optional(),
  net_premium: z.number().min(0).optional(),
  od_premium: z.number().min(0).optional(),
  tp_premium: z.number().min(0).optional(),
  gst_amount: z.number().min(0).optional(),
  
  // Additional fields
  ncb: z.string().optional(),
  business_type: z.string().optional(),
  seating_capacity: z.number().min(0).optional(),
  cc: z.number().min(0).optional(),
  age_year: z.number().min(0).optional(),
  gvw: z.number().min(0).optional(),
  
  // Dates
  start_date: z.date({ required_error: 'Start date is required' }),
  end_date: z.date({ required_error: 'End date is required' }),
  
  // Notes
  notes: z.string().optional(),
})

type PolicyFormValues = z.infer<typeof PolicyFormSchema>

interface PolicyInputFormProps {
  onPrev: () => void
  showCalculations?: boolean
}

const PolicyInputForm: React.FC<PolicyInputFormProps> = ({
  onPrev,
  showCalculations = true,
}) => {
  const router = useRouter()
  const [pdfExtractionData] = useAtom(policyPdfExtractionDataAtom)
  const [, setCreatedPolicy] = useAtom(createdPolicyAtom)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // State for tracking the progress of the submission process
  const [submissionSteps, setSubmissionSteps] = useState<
    {
      id: string
      label: string
      status: 'pending' | 'active' | 'completed' | 'failed'
    }[]
  >([
    {
      id: 'submit-policy',
      label: 'Submitting policy...',
      status: 'pending',
    },
    {
      id: 'upload-pdf',
      label: 'Uploading policy PDF...',
      status: 'pending',
    },
    {
      id: 'cleanup-redirect',
      label: 'Cleaning up and redirecting...',
      status: 'pending',
    },
  ])

  // Mutations
  const submitPolicyMutation = useSubmitPolicy()
  const uploadPolicyPdfMutation = useUploadPolicyPdf()

  // Get child ID options
  const { data: childIdOptions } = useChildIdOptions()

  // Form setup
  const form = useForm<PolicyFormValues>({
    resolver: zodResolver(PolicyFormSchema),
    defaultValues: {
      agent_code: '',
      agent_id: '',
      child_id: '',
      broker_name: '',
      insurance_company: '',
      policy_number: '',
      customer_name: '',
      customer_phone_number: '',
      gross_premium: 0,
      net_premium: 0,
      od_premium: 0,
      tp_premium: 0,
      gst_amount: 0,
      seating_capacity: 0,
      cc: 0,
      age_year: 0,
      gvw: 0,
    },
  })

  // Pre-populate form with extracted data
  useEffect(() => {
    if (pdfExtractionData?.extracted_data) {
      const data = pdfExtractionData.extracted_data
      
      // Update form with extracted data
      Object.entries(data).forEach(([key, value]) => {
        if (value != null && form.getValues(key as keyof PolicyFormValues) !== undefined) {
          if (key === 'start_date' || key === 'end_date') {
            if (typeof value === 'string') {
              form.setValue(key as keyof PolicyFormValues, new Date(value) as Date & PolicyFormValues[keyof PolicyFormValues])
            }
          } else {
            form.setValue(key as keyof PolicyFormValues, value as PolicyFormValues[keyof PolicyFormValues])
          }
        }
      })
    }
  }, [pdfExtractionData, form])

  const updateStepStatus = (stepId: string, status: 'pending' | 'active' | 'completed' | 'failed') => {
    setSubmissionSteps(prev =>
      prev.map(step => (step.id === stepId ? { ...step, status } : step))
    )
  }

  const onSubmit = async (data: PolicyFormValues) => {
    console.log('Policy form submission started', data)
    setIsSubmitting(true)

    // Reset all submission steps to 'pending'
    setSubmissionSteps(prev =>
      prev.map(step => ({ ...step, status: 'pending' as const }))
    )

    try {
      // Step 1: Submit the policy
      updateStepStatus('submit-policy', 'active')
      
      const submitPayload: SubmitPolicyPayload = {
        agent_code: data.agent_code,
        agent_id: data.agent_id,
        ai_confidence_score: pdfExtractionData?.confidence_score || 0,
        broker_name: data.broker_name,
        child_id: data.child_id || '',
        end_date: format(data.end_date, 'yyyy-MM-dd'),
        gross_premium: data.gross_premium || 0,
        gst: data.gst_amount || 0,
        insurance_company: data.insurance_company,
        insurance_type: data.insurance_type || '',
        manual_override: true,
        net_premium: data.net_premium || 0,
        od_premium: data.od_premium || 0,
        pdf_file_name: '',
        pdf_file_path: '',
        policy_number: data.policy_number,
        policy_type: data.policy_type || '',
        registration_number: data.registration_number || '',
        start_date: format(data.start_date, 'yyyy-MM-dd'),
        tp_premium: data.tp_premium || 0,
        vehicle_class: data.vehicle_class || '',
        vehicle_segment: '',
        vehicle_type: data.vehicle_type || '',
      }

      console.log('Final policy payload:', submitPayload)

      const createdPolicy = await submitPolicyMutation.mutateAsync(submitPayload)
      updateStepStatus('submit-policy', 'completed')
      setCreatedPolicy(createdPolicy)

      // Step 2: Upload policy PDF if available
      updateStepStatus('upload-pdf', 'active')
      
      // Get the policy PDF from IndexedDB or atom
      const policyPdfFile = null // You might need to get this from atoms or IndexedDB
      if (policyPdfFile && createdPolicy.id) {
        await uploadPolicyPdfMutation.mutateAsync({
          file: policyPdfFile,
          policy_id: createdPolicy.id,
        })
      }
      updateStepStatus('upload-pdf', 'completed')

      // Step 3: Cleanup and redirect
      updateStepStatus('cleanup-redirect', 'active')
      
      toast.success('🎉 Policy created successfully!')
      
      // Clear IndexedDB
      try {
        await clearAllFromIndexedDB()
        console.log('✅ IndexedDB cleared successfully')
      } catch (cleanupError) {
        console.warn('⚠️ Failed to clear IndexedDB:', cleanupError)
      }

      updateStepStatus('cleanup-redirect', 'completed')

      // Redirect to the policy details page
      setTimeout(() => {
        router.push(`/agent/policies/${createdPolicy.id}`)
      }, 1000)

    } catch (error) {
      console.error('❌ Policy submission failed:', error)
      toast.error('Failed to create policy. Please try again.')
      
      // Mark current step as failed
      const activeStep = submissionSteps.find(step => step.status === 'active')
      if (activeStep) {
        updateStepStatus(activeStep.id, 'failed')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Loading Dialog */}
      <LoadingDialog
        open={isSubmitting}
        title="Creating Policy"
        description="Please wait while we process your policy submission..."
        steps={submissionSteps}
      />

      {/* Form */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>Enter agent and broker details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  name="agent_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Agent ID *</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter agent ID" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="child_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Child ID</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select child ID" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {childIdOptions?.map((option) => (
                            <SelectItem key={option.child_id} value={option.child_id}>
                              {option.child_id} - {option.broker_name}
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
                  name="broker_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Broker Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter broker name" {...field} />
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
                      <FormLabel>Insurance Company *</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter insurance company" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Policy Details */}
          <Card>
            <CardHeader>
              <CardTitle>Policy Details</CardTitle>
              <CardDescription>Review and edit policy information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
                  name="customer_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter customer name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="customer_phone_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter customer phone" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="vehicle_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vehicle Type</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter vehicle type" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="registration_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Registration Number</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter registration number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="make_model"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Make & Model</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter make and model" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Financial Details */}
          {showCalculations && (
            <Card>
              <CardHeader>
                <CardTitle>Financial Information</CardTitle>
                <CardDescription>Premium and financial details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="gross_premium"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Gross Premium *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="0"
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
                            placeholder="0"
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
                    name="od_premium"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>OD Premium</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="0"
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
                    name="tp_premium"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>TP Premium</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="0"
                            {...field}
                            onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Policy Period */}
          <Card>
            <CardHeader>
              <CardTitle>Policy Period</CardTitle>
              <CardDescription>Set the policy start and end dates</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="start_date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Start Date *</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                'w-full pl-3 text-left font-normal',
                                !field.value && 'text-muted-foreground'
                              )}
                            >
                              {field.value ? (
                                format(field.value, 'PPP')
                              ) : (
                                <span>Pick start date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => date < new Date('1900-01-01')}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="end_date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>End Date *</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                'w-full pl-3 text-left font-normal',
                                !field.value && 'text-muted-foreground'
                              )}
                            >
                              {field.value ? (
                                format(field.value, 'PPP')
                              ) : (
                                <span>Pick end date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => date < new Date('1900-01-01')}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Additional Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter any additional notes about this policy..."
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-between items-center pt-6">
            <Button type="button" variant="outline" onClick={onPrev}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Previous
            </Button>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            >
              {isSubmitting ? (
                <>
                  <Upload className="w-4 h-4 mr-2 animate-spin" />
                  Creating Policy...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Create Policy
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}

export default PolicyInputForm
