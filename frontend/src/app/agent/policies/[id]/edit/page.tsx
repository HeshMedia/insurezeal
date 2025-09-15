'use client'

import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMemo, useEffect } from 'react'
import { DashboardWrapper } from '@/components/dashboard-wrapper'
import { usePolicyDetailsByNumber, useUpdatePolicyByNumber } from '@/hooks/policyQuery'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { LoadingSpinner } from '@/components/ui/loader'
import { ArrowLeft, Save, Shield, User, Car, TrendingUp, Calendar } from 'lucide-react'
import { toast } from 'sonner'
import { useAtom } from 'jotai'
import { selectedPolicyContextAtom } from '@/lib/atoms/policy'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useInsurers, useBrokersAndInsurers, useChildIdRequests } from '@/hooks/agentQuery'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Policy } from '@/types/policy.types'

// Policy types for dropdown
const policyTypes = [
  'Motor - Private Car',
  'Motor - Two Wheeler', 
  'Motor - Commercial Vehicle',
  'Health',
  'Life',
  'General',
  'Other'
]

// Form schema for policy editing
const PolicyEditSchema = z.object({
  policy_number: z.string().min(1, "Policy number is required"),
  insurance_company: z.string().min(1, "Insurance company is required"),
  broker_name: z.string().optional(),
  insurer_code: z.string().min(1, "Insurer is required"),
  broker_code: z.string().optional(),
  code_type: z.enum(["Direct", "Broker"]),
  child_id: z.string().min(1, "Child ID is required"),
  customer_name: z.string().min(1, "Customer name is required"),
  customer_phone_number: z.string().optional(),
  policy_type: z.string().min(1, "Policy type is required"),
  vehicle_type: z.string().optional(),
  registration_number: z.string().optional(),
  make_model: z.string().optional(),
  fuel_type: z.string().optional(),
  cc: z.number().optional(),
  rto: z.string().optional(),
  state: z.string().optional(),
  gross_premium: z.number().min(0),
  net_premium: z.number().min(0),
  od_premium: z.number().min(0),
  tp_premium: z.number().min(0),
  gst_amount: z.number().min(0),
  payment_by: z.enum(["Agent", "InsureZeal"]),
  payment_method: z.string().optional(),
  payment_by_office: z.number().optional(),
  agent_commission_given_percent: z.number().optional(),
  start_date: z.string(),
  end_date: z.string(),
  notes: z.string().optional(),
})

type PolicyEditFormData = z.infer<typeof PolicyEditSchema>

type SimpleInsurer = { insurer_code: string; name: string };
type SimpleBroker = { broker_code: string; name: string };

export default function PolicyEditPage() {
  const params = useParams()
  const router = useRouter()
  const policyId = params.id as string
  const [selectedPolicy] = useAtom(selectedPolicyContextAtom)

  // Get quarter/year from URL or atom
  const searchParams = useSearchParams()
  const rawQuarter = searchParams.get('quarter') || String(selectedPolicy?.quarter ?? '')
  const rawYear = searchParams.get('year') || String(selectedPolicy?.year ?? '')
  const qQuarter = (() => {
    const digits = rawQuarter.replace(/[^0-9]/g, '')
    const n = parseInt(digits || '0', 10)
    return isNaN(n) ? 0 : n
  })()
  const qYear = (() => {
    const n = parseInt(rawYear || '0', 10)
    return isNaN(n) ? 0 : n
  })()
  
  const { data: policyData, isLoading: isLoadingPolicy } = usePolicyDetailsByNumber({
    policy_number: policyId,
    quarter: qQuarter,
    year: qYear,
  })
  const updateMutation = useUpdatePolicyByNumber()
  
  // Insurer/Broker/Child dropdown data
  const { data: directInsurers } = useInsurers()
  const { data: brokersAndInsurers } = useBrokersAndInsurers()
  const { data: myRequests } = useChildIdRequests()
  
  const form = useForm<PolicyEditFormData>({
    resolver: zodResolver(PolicyEditSchema),
    defaultValues: {
      policy_number: '',
      insurance_company: '',
      broker_name: '',
      insurer_code: '',
      broker_code: '',
      code_type: 'Direct',
      child_id: '',
      customer_name: '',
      customer_phone_number: '',
      policy_type: '',
      vehicle_type: '',
      registration_number: '',
      make_model: '',
      fuel_type: '',
      cc: 0,
      rto: '',
      state: '',
      gross_premium: 0,
      net_premium: 0,
      od_premium: 0,
      tp_premium: 0,
      gst_amount: 0,
      payment_by: 'Agent',
      payment_method: '',
      payment_by_office: 0,
      agent_commission_given_percent: 0,
      start_date: '',
      end_date: '',
      notes: '',
    }
  })

  const codeType = form.watch("code_type")
  const insurerCode = form.watch("insurer_code")
  const brokerCode = form.watch("broker_code")
  const paymentBy = form.watch("payment_by")

  // Populate form when policy data loads
  useEffect(() => {
    if (policyData) {
      form.reset({
        policy_number: policyData.policy_number || '',
        insurance_company: policyData.insurance_company || '',
        broker_name: policyData.broker_name || '',
        insurer_code: (policyData as Policy & { insurer_code?: string }).insurer_code || '',
        broker_code: (policyData as Policy & { broker_code?: string }).broker_code || '',
        code_type: policyData.code_type as "Direct" | "Broker" || 'Direct',
        child_id: policyData.child_id || '',
        customer_name: policyData.customer_name || '',
        customer_phone_number: policyData.customer_phone_number || '',
        policy_type: policyData.policy_type || '',
        vehicle_type: policyData.vehicle_type || '',
        registration_number: policyData.registration_number || '',
        make_model: policyData.make_model || '',
        fuel_type: policyData.fuel_type || '',
        cc: policyData.cc || 0,
        rto: policyData.rto || '',
        state: policyData.state || '',
        gross_premium: policyData.gross_premium || 0,
        net_premium: policyData.net_premium || 0,
        od_premium: policyData.od_premium || 0,
        tp_premium: policyData.tp_premium || 0,
        gst_amount: policyData.gst_amount || 0,
        payment_by: policyData.payment_by as "Agent" | "InsureZeal" || 'Agent',
        payment_method: policyData.payment_method || '',
        payment_by_office: policyData.payment_by_office || 0,
        agent_commission_given_percent: policyData.agent_commission_given_percent || 0,
        start_date: policyData.start_date || '',
        end_date: policyData.end_date || '',
        notes: policyData.notes || '',
      })
    }
  }, [policyData, form])

  // Dropdown options
  const insurerOptions = useMemo(() => {
    const src = (codeType === "Broker"
      ? (brokersAndInsurers?.insurers as SimpleInsurer[] | undefined)
      : (directInsurers as SimpleInsurer[] | undefined)) || [];
    return src.map((i) => ({ value: i.insurer_code, label: i.name }));
  }, [codeType, directInsurers, brokersAndInsurers]);

  const brokerOptions = useMemo(() => {
    if (codeType !== "Broker") return [];
    const src = (brokersAndInsurers?.brokers as SimpleBroker[] | undefined) || [];
    return src.map((b) => ({ value: b.broker_code, label: b.name }));
  }, [codeType, brokersAndInsurers]);

  type MyChildRequest = {
    id: string;
    status: "pending" | "accepted" | "rejected" | "suspended";
    child_id?: string | null;
    insurer?: { insurer_code: string; name: string } | null;
    broker_relation?: { broker_code: string; name: string } | null;
  };

  const myChildIdOptions = useMemo(() => {
    const list = ((myRequests as unknown as { requests?: MyChildRequest[] } | undefined)?.requests) || [];
    return list
      .filter((r) => r.status === "accepted" && r.child_id)
      .filter((r) => {
        const insurerMatch = insurerCode ? r.insurer?.insurer_code === insurerCode : true;
        const brokerMatch = codeType === "Broker" ? r.broker_relation?.broker_code === brokerCode : true;
        return insurerMatch && brokerMatch;
      })
      .map((r) => ({
        value: r.child_id as string,
        label: `${r.child_id} - ${r.broker_relation?.name || ""} (${r.insurer?.name || ""})`,
      }));
  }, [myRequests, insurerCode, brokerCode, codeType]);

  const isLoading = updateMutation.isPending

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

  if (qQuarter < 1 || qQuarter > 4 || qYear < 2020 || qYear > 2030) {
    return (
      <DashboardWrapper requiredRole="agent">
        <div className="max-w-5xl mx-auto p-6">
          <div className="flex items-center justify-center min-h-[300px]">
            <div className="text-center space-y-4">
              <h1 className="text-2xl font-bold text-gray-900">Quarter/Year required</h1>
              <p className="text-gray-600">Open this edit page from the policy details so quarter and year are included in the URL.</p>
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

  const onSubmit = async (values: PolicyEditFormData) => {
    try {
      await updateMutation.mutateAsync({
        policy_number: policyId,
        quarter: qQuarter,
        year: qYear,
        payload: {
          policy_number: values.policy_number,
          insurance_company: values.insurance_company,
          broker_name: values.broker_name,
          child_id: values.child_id,
          policy_type: values.policy_type,
          vehicle_type: values.vehicle_type,
          registration_number: values.registration_number,
          gross_premium: values.gross_premium || 0,
          net_premium: values.net_premium || 0,
          od_premium: values.od_premium || 0,
          tp_premium: values.tp_premium || 0,
          payment_by_office: values.payment_by_office || 0,
          start_date: values.start_date,
          end_date: values.end_date,
        }
      })
      toast.success('Policy updated successfully')
      router.push(`/agent/policies/${policyId}?quarter=${qQuarter}&year=${qYear}`)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update policy'
      toast.error(errorMessage)
    }
  }

  return (
    <DashboardWrapper requiredRole="agent">
      <div className="w-full max-w-none mx-auto space-y-6 p-6">
        {/* Navigation */}
        <div className="flex items-center justify-between mb-6">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Policy Details
          </Button>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Edit Policy</h1>
          </div>
        </div>

        {/* Full Width Form */}
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            
                {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-blue-600" />
                    Basic Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                    name="code_type"
                      render={({ field }) => (
                        <FormItem>
                        <FormLabel>Code Type *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select code type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Direct">Direct</SelectItem>
                            <SelectItem value="Broker">Broker</SelectItem>
                          </SelectContent>
                        </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                    name="insurer_code"
                      render={({ field }) => (
                        <FormItem>
                        <FormLabel>Insurer *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select insurer" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {insurerOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                  {codeType === "Broker" && (
                    <FormField
                      control={form.control}
                      name="broker_code"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Broker *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                          <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select broker" />
                              </SelectTrigger>
                          </FormControl>
                            <SelectContent>
                              {brokerOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                    <FormField
                      control={form.control}
                    name="child_id"
                      render={({ field }) => (
                        <FormItem>
                        <FormLabel>Child ID *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                              <SelectValue placeholder="Select child ID" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                            {myChildIdOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
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
                    name="policy_type"
                      render={({ field }) => (
                        <FormItem>
                        <FormLabel>Policy Type *</FormLabel>
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
                  </div>
              </CardContent>
            </Card>

                {/* Customer Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5 text-green-600" />
                    Customer Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
              </CardContent>
            </Card>

                {/* Vehicle Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Car className="h-5 w-5 text-purple-600" />
                    Vehicle Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                          <Input placeholder="Enter make & model" {...field} />
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
                            <FormControl>
                          <Input placeholder="Enter fuel type" {...field} />
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
                            placeholder="Enter CC" 
                              {...field}
                            onChange={(e) => field.onChange(Number(e.target.value))}
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
                  </div>
              </CardContent>
            </Card>

                {/* Financial Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-orange-600" />
                  Financial Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <FormField
                      control={form.control}
                      name="gross_premium"
                      render={({ field }) => (
                        <FormItem>
                        <FormLabel>Gross Premium</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                            step="0.01"
                            placeholder="Enter gross premium" 
                              {...field}
                            onChange={(e) => field.onChange(Number(e.target.value))}
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
                            placeholder="Enter net premium" 
                              {...field}
                            onChange={(e) => field.onChange(Number(e.target.value))}
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
                            step="0.01"
                            placeholder="Enter OD premium" 
                              {...field}
                            onChange={(e) => field.onChange(Number(e.target.value))}
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
                            step="0.01"
                            placeholder="Enter TP premium" 
                              {...field}
                            onChange={(e) => field.onChange(Number(e.target.value))}
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
                            step="0.01"
                            placeholder="Enter GST amount" 
                              {...field}
                            onChange={(e) => field.onChange(Number(e.target.value))}
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
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select payment by" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Agent">Agent</SelectItem>
                            <SelectItem value="InsureZeal">InsureZeal</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {paymentBy === "InsureZeal" && (
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
                  )}

                  <FormField
                    control={form.control}
                    name="agent_commission_given_percent"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Agent Commission %</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01"
                            placeholder="Enter commission %" 
                            {...field} 
                            onChange={(e) => field.onChange(Number(e.target.value))}
                          />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
              </CardContent>
            </Card>

                {/* Policy Dates */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-amber-600" />
                    Policy Period
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="start_date"
                      render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Date</FormLabel>
                              <FormControl>
                          <Input type="date" {...field} />
                              </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="end_date"
                      render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Date</FormLabel>
                              <FormControl>
                          <Input type="date" {...field} />
                              </FormControl>
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
                          placeholder="Enter additional notes..."
                            rows={4}
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
              </CardContent>
            </Card>

            {/* Submit Button */}
            <div className="flex justify-end gap-4">
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <LoadingSpinner />
                    Updating...
                      </>
                    ) : (
                      <>
                    <Save className="h-4 w-4 mr-2" />
                    Update Policy
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
      </div>
    </DashboardWrapper>
  )
}
