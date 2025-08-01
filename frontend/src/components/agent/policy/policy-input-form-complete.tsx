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
import { Checkbox } from '@/components/ui/checkbox'
import DocumentViewer from '@/components/forms/documentviewer'

// Atoms and utilities
import { 
  policyPdfExtractionDataAtom,
  createdPolicyAtom 
} from '@/lib/atoms/policy'
import { clearAllFromIndexedDB } from '@/lib/utils/indexeddb'

// Hooks and API
import { useSubmitPolicy, useUploadPolicyPdf, useChildIdOptions } from '@/hooks/policyQuery'
import { SubmitPolicyPayload } from '@/types/policy.types'

// Form schema for policy input - complete with all API fields
const PolicyFormSchema = z.object({
  // Basic agent/broker info
  agent_id: z.string().min(1, 'Agent ID is required'),
  agent_code: z.string().min(1, 'Agent code is required'),
  child_id: z.string().optional(),
  broker_name: z.string().min(1, 'Broker name is required'),
  insurance_company: z.string().min(1, 'Insurance company is required'),
  
  // Policy identification
  policy_number: z.string().min(1, 'Policy number is required'),
  formatted_policy_number: z.string().optional(),
  policy_type: z.string().min(1, 'Policy type is required'),
  
  // Product details
  major_categorisation: z.string().optional(),
  product_insurer_report: z.string().optional(),
  product_type: z.string().optional(),
  plan_type: z.string().optional(),
  insurance_type: z.string().optional(),
  
  // Customer information
  customer_name: z.string().min(1, 'Customer name is required'),
  customer_phone_number: z.string().optional(),
  
  // Vehicle details
  vehicle_type: z.string().optional(),
  registration_number: z.string().optional(),
  registration_no: z.string().optional(),
  vehicle_class: z.string().optional(),
  vehicle_segment: z.string().optional(),
  make_model: z.string().optional(),
  model: z.string().optional(),
  vehicle_variant: z.string().optional(),
  gvw: z.number().min(0).optional(),
  rto: z.string().optional(),
  state: z.string().optional(),
  fuel_type: z.string().optional(),
  cc: z.number().min(0).optional(),
  age_year: z.number().min(0).optional(),
  seating_capacity: z.number().min(0).optional(),
  veh_wheels: z.number().min(0).optional(),
  is_private_car: z.boolean().optional(),
  
  // Policy terms
  ncb: z.string().optional(),
  discount_percent: z.number().min(0).optional(),
  business_type: z.string().optional(),
  
  // Financial details (optional for agents, required for admins)
  gross_premium: z.number().min(0).optional(),
  net_premium: z.number().min(0).optional(),
  od_premium: z.number().min(0).optional(),
  tp_premium: z.number().min(0).optional(),
  gst: z.number().min(0).optional(),
  gst_amount: z.number().min(0).optional(),
  
  // Agent commission (optional for agent form)
  agent_commission_given_percent: z.number().min(0).optional(),
  agent_extra_percent: z.number().min(0).optional(),
  payment_by_office: z.number().min(0).optional(),
  total_agent_payout_amount: z.number().min(0).optional(),
  
  // Payment details
  code_type: z.string().optional(),
  payment_by: z.string().optional(),
  payment_method: z.string().optional(),
  cluster: z.string().optional(),
  
  // Dates
  start_date: z.date({ required_error: 'Start date is required' }),
  end_date: z.date({ required_error: 'End date is required' }),
  
  // Notes
  notes: z.string().optional(),

  // File handling (not in form but part of submission)
  pdf_file_path: z.string().optional(),
  pdf_file_name: z.string().optional(),
  ai_confidence_score: z.number().optional(),
  manual_override: z.boolean().optional(),
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

  // API hooks
  const submitPolicyMutation = useSubmitPolicy()
  const uploadPolicyPdfMutation = useUploadPolicyPdf()
  const { data: childIdOptions } = useChildIdOptions()

  // Form setup
  const form = useForm<PolicyFormValues>({
    resolver: zodResolver(PolicyFormSchema),
    defaultValues: {
      // Basic agent/broker info
      agent_id: '',
      agent_code: '',
      child_id: '',
      broker_name: '',
      insurance_company: '',
      
      // Policy identification
      policy_number: '',
      formatted_policy_number: '',
      policy_type: '',
      
      // Product details
      major_categorisation: '',
      product_insurer_report: '',
      product_type: '',
      plan_type: '',
      insurance_type: '',
      
      // Customer information
      customer_name: '',
      customer_phone_number: '',
      
      // Vehicle details
      vehicle_type: '',
      registration_number: '',
      registration_no: '',
      vehicle_class: '',
      vehicle_segment: '',
      make_model: '',
      model: '',
      vehicle_variant: '',
      gvw: 0,
      rto: '',
      state: '',
      fuel_type: '',
      cc: 0,
      age_year: 0,
      seating_capacity: 0,
      veh_wheels: 0,
      is_private_car: false,
      
      // Policy terms
      ncb: '',
      discount_percent: 0,
      business_type: '',
      
      // Financial details
      gross_premium: 0,
      net_premium: 0,
      od_premium: 0,
      tp_premium: 0,
      gst: 0,
      gst_amount: 0,
      
      // Agent commission
      agent_commission_given_percent: 0,
      agent_extra_percent: 0,
      payment_by_office: 0,
      total_agent_payout_amount: 0,
      
      // Payment details
      code_type: '',
      payment_by: '',
      payment_method: '',
      cluster: '',
      
      // Notes
      notes: '',
    },
  })

  // Pre-populate form with extracted data
  useEffect(() => {
    if (pdfExtractionData?.extracted_data) {
      const data = pdfExtractionData.extracted_data
      
      form.setValue('policy_number', data.policy_number || '')
      form.setValue('customer_name', data.customer_name || '')
      form.setValue('gross_premium', data.gross_premium || 0)
      form.setValue('net_premium', data.net_premium || 0)
      form.setValue('od_premium', data.od_premium || 0)
      form.setValue('tp_premium', data.tp_premium || 0)
      form.setValue('gst_amount', data.gst_amount || 0)
      form.setValue('registration_number', data.registration_number || '')
      form.setValue('make_model', data.make_model || '')
      form.setValue('fuel_type', data.fuel_type || '')
      form.setValue('rto', data.rto || '')
      form.setValue('state', data.state || '')
      form.setValue('seating_capacity', data.seating_capacity || 0)
      form.setValue('cc', data.cc || 0)
      form.setValue('age_year', data.age_year || 0)
      form.setValue('gvw', data.gvw || 0)
      form.setValue('ncb', data.ncb || '')
      form.setValue('business_type', data.business_type || '')
    }
  }, [pdfExtractionData, form])

  // Helper function to update submission step status
  const updateStepStatus = (stepId: string, status: 'pending' | 'active' | 'completed' | 'failed') => {
    setSubmissionSteps(prev => 
      prev.map(step => 
        step.id === stepId ? { ...step, status } : step
      )
    )
  }

  const onSubmit = async (data: PolicyFormValues) => {
    setIsSubmitting(true)
    
    try {
      // Step 1: Submit policy
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

      const createdPolicy = await submitPolicyMutation.mutateAsync(submitPayload)
      setCreatedPolicy(createdPolicy)
      updateStepStatus('submit-policy', 'completed')

      // Step 2: Upload PDF (if available)
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
      console.error('❌ Error submitting policy:', error)
      toast.error('Failed to create policy. Please try again.')
      
      // Mark current active step as failed
      setSubmissionSteps(prev => 
        prev.map(step => 
          step.status === 'active' ? { ...step, status: 'failed' } : step
        )
      )
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

      {/* Document Viewer - Fixed position viewer */}
      <DocumentViewer />

      {/* Form */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          
          {/* Row 1: Admin Input */}
          <div className="w-full">
            {/* Basic Agent/Broker Information */}
            <Card>
              <CardHeader>
                <CardTitle>Agent & Broker Details</CardTitle>
                <CardDescription>Basic identification and broker information</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

                  <FormField
                    control={form.control}
                    name="code_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Code Type</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter code type" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Policy Identification */}
            <Card>
              <CardHeader>
                <CardTitle>Policy Identification</CardTitle>
                <CardDescription>Policy numbers and type information</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                    name="formatted_policy_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Formatted Policy Number</FormLabel>
                        <FormControl>
                          <Input placeholder="Formatted policy number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="policy_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Policy Type *</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter policy type" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Product Details */}
            <Card>
              <CardHeader>
                <CardTitle>Product Details</CardTitle>
                <CardDescription>Product classification and type information</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="major_categorisation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Major Categorisation</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select categorisation" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="PRIVATE CAR">PRIVATE CAR</SelectItem>
                            <SelectItem value="TWO WHEELER">TWO WHEELER</SelectItem>
                            <SelectItem value="COMMERCIAL VEHICLE">COMMERCIAL VEHICLE</SelectItem>
                            <SelectItem value="HEALTH">HEALTH</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="product_insurer_report"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Product Insurer Report</FormLabel>
                        <FormControl>
                          <Input placeholder="Product insurer report" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="product_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Product Type</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter product type" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="plan_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Plan Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select plan type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Comprehensive">Comprehensive</SelectItem>
                            <SelectItem value="Third Party">Third Party</SelectItem>
                            <SelectItem value="Third Party Fire Theft">Third Party Fire Theft</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="insurance_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Insurance Type</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter insurance type" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="business_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Business Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select business type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="NEW">NEW</SelectItem>
                            <SelectItem value="ROLLOVER">ROLLOVER</SelectItem>
                            <SelectItem value="RENEWAL">RENEWAL</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Customer Information */}
            <Card>
              <CardHeader>
                <CardTitle>Customer Information</CardTitle>
                <CardDescription>Customer contact details</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        <FormLabel>Customer Phone Number</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter phone number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Vehicle Details */}
            <Card>
              <CardHeader>
                <CardTitle>Vehicle Details</CardTitle>
                <CardDescription>Complete vehicle information</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                    name="registration_no"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Registration No</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter registration no" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="vehicle_class"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vehicle Class</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter vehicle class" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="vehicle_segment"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vehicle Segment</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter vehicle segment" {...field} />
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
                          <Input placeholder="Enter make & model" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="model"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Model</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter model" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="vehicle_variant"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vehicle Variant</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter vehicle variant" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="fuel_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fuel Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select fuel type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="PETROL">PETROL</SelectItem>
                            <SelectItem value="DIESEL">DIESEL</SelectItem>
                            <SelectItem value="CNG">CNG</SelectItem>
                            <SelectItem value="ELECTRIC">ELECTRIC</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="rto"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>RTO</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter RTO" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter state" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="cc"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CC</FormLabel>
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
                    name="age_year"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Age (Year)</FormLabel>
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
                    name="seating_capacity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Seating Capacity</FormLabel>
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
                    name="gvw"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>GVW</FormLabel>
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
                    name="veh_wheels"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vehicle Wheels</FormLabel>
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
                    name="is_private_car"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Is Private Car</FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Policy Terms */}
            <Card>
              <CardHeader>
                <CardTitle>Policy Terms</CardTitle>
                <CardDescription>NCB and discount information</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="ncb"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>NCB</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter NCB" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="discount_percent"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Discount %</FormLabel>
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

            {/* Financial Details - Conditional based on showCalculations */}
            {showCalculations && (
              <Card>
                <CardHeader>
                  <CardTitle>Financial Information</CardTitle>
                  <CardDescription>Premium and financial details</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="gross_premium"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Gross Premium</FormLabel>
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
                          <FormLabel>Net Premium</FormLabel>
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

                    <FormField
                      control={form.control}
                      name="gst"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>GST</FormLabel>
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
                      name="gst_amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>GST Amount</FormLabel>
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
                      name="agent_commission_given_percent"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Agent Commission %</FormLabel>
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
                      name="agent_extra_percent"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Agent Extra %</FormLabel>
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
                      name="payment_by_office"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Payment By Office</FormLabel>
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
                      name="total_agent_payout_amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Total Agent Payout Amount</FormLabel>
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

            {/* Payment Details */}
            <Card>
              <CardHeader>
                <CardTitle>Payment Details</CardTitle>
                <CardDescription>Payment method and cluster information</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="payment_by"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment By</FormLabel>
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
                        <FormLabel>Payment Method</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter payment method" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="cluster"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cluster</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter cluster" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Policy Period */}
            <Card>
              <CardHeader>
                <CardTitle>Policy Period</CardTitle>
                <CardDescription>Set the policy start and end dates</CardDescription>
              </CardHeader>
              <CardContent>
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
                                  <span>Pick a date</span>
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
                              disabled={(date) =>
                                date < new Date('1900-01-01')
                              }
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
                                  <span>Pick a date</span>
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
                              disabled={(date) =>
                                date < new Date('1900-01-01')
                              }
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
                <CardDescription>Any additional information about this policy</CardDescription>
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
          </div>
        </form>
      </Form>
    </div>
  )
}

export default PolicyInputForm
