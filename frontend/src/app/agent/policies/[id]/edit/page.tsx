'use client'

import { useParams, useRouter } from 'next/navigation'
import { DashboardWrapper } from '@/components/dashboard-wrapper'
import { usePolicyDetails, useUpdatePolicy } from '@/hooks/policyQuery'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LoadingSpinner } from '@/components/ui/loader'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { 
  ArrowLeft, 
  Save, 
  Shield, 
  User, 
  Car, 
  Calendar as CalendarIcon, 
  FileText 
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useEffect } from 'react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

// Form schema for policy editing
const policyEditSchema = z.object({
  // Basic policy info
  policy_number: z.string().min(1, "Policy number is required"),
  broker_name: z.string().min(1, "Broker name is required"),
  insurance_company: z.string().min(1, "Insurance company is required"),
  customer_name: z.string().min(1, "Customer name is required"),
  customer_phone_number: z.string().optional(),
  child_id: z.string().optional(),
  
  // Policy details
  policy_type: z.string().optional(),
  insurance_type: z.string().optional(),
  vehicle_type: z.string().optional(),
  registration_number: z.string().optional(),
  vehicle_class: z.string().optional(),
  vehicle_segment: z.string().optional(),
  make_model: z.string().optional(),
  fuel_type: z.string().optional(),
  rto: z.string().optional(),
  state: z.string().optional(),
  
  // Financial details
  gross_premium: z.number().min(0, "Gross premium must be positive"),
  net_premium: z.number().min(0, "Net premium must be positive"),
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
  start_date: z.date({ required_error: "Start date is required" }),
  end_date: z.date({ required_error: "End date is required" }),
  
  // Notes
  notes: z.string().optional(),
})

type PolicyEditFormValues = z.infer<typeof policyEditSchema>

export default function PolicyEditPage() {
  const params = useParams()
  const router = useRouter()
  
  const policyId = params.id as string
  
  const { data: policyData, isLoading: isLoadingPolicy } = usePolicyDetails(policyId)
  const updateMutation = useUpdatePolicy()
  
  const isLoading = updateMutation.isPending
  
  const form = useForm<PolicyEditFormValues>({
    resolver: zodResolver(policyEditSchema),
    defaultValues: {
      policy_number: "",
      broker_name: "",
      insurance_company: "",
      customer_name: "",
      customer_phone_number: "",
      child_id: "",
      policy_type: "",
      insurance_type: "",
      vehicle_type: "",
      registration_number: "",
      vehicle_class: "",
      vehicle_segment: "",
      make_model: "",
      fuel_type: "",
      rto: "",
      state: "",
      gross_premium: 0,
      net_premium: 0,
      od_premium: 0,
      tp_premium: 0,
      gst_amount: 0,
      ncb: "",
      business_type: "",
      seating_capacity: 0,
      cc: 0,
      age_year: 0,
      gvw: 0,
      notes: "",
    },
  })
  
  // Set form values when data is loaded
  useEffect(() => {
    if (policyData) {
      form.reset({
        policy_number: policyData.policy_number || "",
        broker_name: policyData.broker_name || "",
        insurance_company: policyData.insurance_company || "",
        customer_name: policyData.customer_name || "",
        customer_phone_number: policyData.customer_phone_number || "",
        child_id: policyData.child_id || "",
        policy_type: policyData.policy_type || "",
        insurance_type: policyData.insurance_type || "",
        vehicle_type: policyData.vehicle_type || "",
        registration_number: policyData.registration_number || "",
        vehicle_class: policyData.vehicle_class || "",
        vehicle_segment: policyData.vehicle_segment || "",
        make_model: policyData.make_model || "",
        fuel_type: policyData.fuel_type || "",
        rto: policyData.rto || "",
        state: policyData.state || "",
        gross_premium: policyData.gross_premium || 0,
        net_premium: policyData.net_premium || 0,
        od_premium: policyData.od_premium || 0,
        tp_premium: policyData.tp_premium || 0,
        gst_amount: policyData.gst_amount || 0,
        ncb: policyData.ncb || "",
        business_type: policyData.business_type || "",
        seating_capacity: policyData.seating_capacity || 0,
        cc: policyData.cc || 0,
        age_year: policyData.age_year || 0,
        gvw: policyData.gvw || 0,
        start_date: policyData.start_date ? new Date(policyData.start_date) : new Date(),
        end_date: policyData.end_date ? new Date(policyData.end_date) : new Date(),
        notes: policyData.notes || "",
      })
    }
  }, [policyData, form])

  const onSubmit = async (data: PolicyEditFormValues) => {
    try {
      await updateMutation.mutateAsync({
        policyId,
        payload: {
          ...data,
          start_date: data.start_date.toISOString().split('T')[0],
          end_date: data.end_date.toISOString().split('T')[0],
        },
      })
      toast.success("Policy updated successfully")
      router.push(`/agent/policies/${policyId}`)
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to update policy")
    }
  }

  const policyTypes = [
    "Comprehensive",
    "Third Party",
    "Own Damage",
    "Third Party Fire & Theft"
  ]

  const insuranceTypes = [
    "Motor",
    "Health",
    "Life",
    "General"
  ]

  const vehicleTypes = [
    "Two Wheeler",
    "Private Car",
    "Commercial Vehicle",
    "Goods Carrying Vehicle",
    "Passenger Carrying Vehicle"
  ]

  const fuelTypes = [
    "Petrol",
    "Diesel",
    "CNG",
    "Electric",
    "Hybrid"
  ]

  if (isLoadingPolicy) {
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

  if (!policyData) {
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

  return (
    <DashboardWrapper requiredRole="agent">
      <div className="max-w-5xl mx-auto space-y-6 p-6">
        {/* Navigation */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Policy
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
                Edit Policy
              </h1>
              <p className="text-lg text-gray-600 dark:text-gray-300">
                Policy: {policyData.policy_number}
              </p>
            </div>
          </div>
        </div>

        {/* Edit Form */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="p-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                {/* Basic Information */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Shield className="h-5 w-5 text-blue-600" />
                    Basic Information
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
                      name="child_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Child ID</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter child ID" {...field} />
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
                          <FormLabel>Policy Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select policy type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {policyTypes.map((type) => (
                                <SelectItem key={type} value={type}>
                                  {type}
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
                      name="insurance_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Insurance Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select insurance type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {insuranceTypes.map((type) => (
                                <SelectItem key={type} value={type}>
                                  {type}
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

                {/* Customer Information */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <User className="h-5 w-5 text-green-600" />
                    Customer Information
                  </h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
                          <FormLabel>Phone Number</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter phone number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Vehicle Information */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Car className="h-5 w-5 text-purple-600" />
                    Vehicle Information
                  </h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="vehicle_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Vehicle Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select vehicle type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {vehicleTypes.map((type) => (
                                <SelectItem key={type} value={type}>
                                  {type}
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
                              {fuelTypes.map((type) => (
                                <SelectItem key={type} value={type}>
                                  {type}
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
                      name="cc"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CC</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              placeholder="Engine capacity" 
                              {...field}
                              onChange={e => field.onChange(parseInt(e.target.value) || 0)}
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
                          <FormLabel>Age (Years)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              placeholder="Vehicle age" 
                              {...field}
                              onChange={e => field.onChange(parseInt(e.target.value) || 0)}
                            />
                          </FormControl>
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
                            <Input placeholder="RTO office" {...field} />
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
                            <Input placeholder="State" {...field} />
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
                    <FileText className="h-5 w-5 text-green-600" />
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
                      name="od_premium"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>OD Premium</FormLabel>
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
                      name="tp_premium"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>TP Premium</FormLabel>
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
                      name="gst_amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>GST Amount</FormLabel>
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
                      name="ncb"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>NCB</FormLabel>
                          <FormControl>
                            <Input placeholder="No Claim Bonus" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Policy Dates */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <CalendarIcon className="h-5 w-5 text-amber-600" />
                    Policy Period
                  </h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
                                  variant={'outline'}
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
                                  date > new Date() || date < new Date('1900-01-01')
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
                                  variant={'outline'}
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
