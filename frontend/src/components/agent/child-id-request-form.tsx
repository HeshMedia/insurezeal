"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Phone, Mail, MapPin, Building, User, FileText } from "lucide-react"
import { useInsurers, useBrokersAndInsurers, useCreateChildIdRequest } from "@/hooks/agentQuery"
import { CreateChildIdRequest, CodeType } from "@/types/agent.types"

const childIdRequestSchema = z.object({
  phone_number: z.string()
    .min(10, "Phone number must be 10 digits")
    .max(10, "Phone number must be 10 digits")
    .regex(/^[6-9]\d{9}$/, "Enter valid Indian phone number"),
  email: z.string().email("Enter valid email address"),
  location: z.string()
    .min(2, "Location must be at least 2 characters")
    .max(200, "Location must be less than 200 characters"),
  code_type: z.enum(["Direct Code", "Broker Code"] as const),
  insurer_code: z.string().min(1, "Please select an insurer"),
  broker_code: z.string().optional(),
  preferred_rm_name: z.string().optional(),
  password: z.string().min(6, "Password must be at least 6 characters"),
})

type ChildIdRequestFormValues = z.infer<typeof childIdRequestSchema>

export function ChildIdRequestForm() {
  const [codeType, setCodeType] = useState<CodeType>("Direct Code")
  
  // API hooks with error handling
  const { data: insurers, isLoading: insurersLoading, error: insurersError } = useInsurers()
  const { data: brokersInsurers, isLoading: brokersInsurersLoading, error: brokersInsurersError } = useBrokersAndInsurers()
  const createRequestMutation = useCreateChildIdRequest()

  const form = useForm<ChildIdRequestFormValues>({
    resolver: zodResolver(childIdRequestSchema),
    defaultValues: {
      phone_number: "",
      email: "",
      location: "",
      code_type: "Direct Code",
      insurer_code: "",
      broker_code: "",
      preferred_rm_name: "",
      password: "",
    },
  })

  // Update form when code type changes
  useEffect(() => {
    try {
      form.setValue("code_type", codeType)
      form.setValue("insurer_code", "")
      form.setValue("broker_code", "")
    } catch (error) {
      console.error('Error updating form values:', error)
    }
  }, [codeType, form])

  const onSubmit = async (data: ChildIdRequestFormValues) => {
    try {
      const requestData: CreateChildIdRequest = {
        phone_number: data.phone_number,
        email: data.email,
        location: data.location,
        code_type: data.code_type,
        insurer_code: data.insurer_code,
        password: data.password,
        ...(data.code_type === "Broker Code" && data.broker_code && { broker_code: data.broker_code }),
        ...(data.preferred_rm_name && { preferred_rm_name: data.preferred_rm_name }),
      }

      await createRequestMutation.mutateAsync(requestData)
      form.reset()
      setCodeType("Direct Code")
    } catch (error) {
      console.error('Request submission error:', error)
    }
  }

  const currentInsurers = codeType === "Direct Code" ? insurers : brokersInsurers?.insurers
  const currentBrokers = brokersInsurers?.brokers || []

  // Show error states
  if (insurersError || brokersInsurersError) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Card className="border border-red-200 shadow-sm">
          <CardContent className="p-6">
            <div className="text-center">
              <div className="text-red-600 mb-2">Error loading form data</div>
              <p className="text-sm text-gray-600">
                {insurersError?.message || brokersInsurersError?.message || 'Please try refreshing the page'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card className="border border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            Request Child ID
          </CardTitle>
          <p className="text-sm text-gray-600">
            Submit a request for a new child ID to start your insurance business
          </p>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              
              {/* Code Type Selection */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Code Type</Label>
                <RadioGroup
                  value={codeType}
                  onValueChange={(value: CodeType) => setCodeType(value)}
                  className="flex space-x-6"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Direct Code" id="direct" />
                    <Label htmlFor="direct">Direct Code</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Broker Code" id="broker" />
                    <Label htmlFor="broker">Broker Code</Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Contact Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="phone_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        Phone Number
                      </FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="10-digit phone number" 
                          maxLength={10}
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        Email
                      </FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="your@email.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Location
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="City, State, Address" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Broker Selection (for Broker Code type) */}
              {codeType === "Broker Code" && (
                <FormField
                  control={form.control}
                  name="broker_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Building className="h-4 w-4" />
                        Select Broker
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Choose a broker" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {brokersInsurersLoading ? (
                            <SelectItem value="loading" disabled>Loading brokers...</SelectItem>
                          ) : (
                            currentBrokers && currentBrokers.length > 0 ? currentBrokers.map((broker) => (
                              broker.broker_code && broker.broker_code.trim() !== "" ? (
                                <SelectItem key={broker.broker_code} value={broker.broker_code}>
                                  {broker.name} ({broker.broker_code})
                                </SelectItem>
                              ) : null
                            )).filter(Boolean) : (
                              <SelectItem value="no-brokers" disabled>No brokers available</SelectItem>
                            )
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Insurer Selection */}
              <FormField
                control={form.control}
                name="insurer_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Building className="h-4 w-4" />
                      Select Insurer
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose an insurer" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(insurersLoading || brokersInsurersLoading) ? (
                          <SelectItem value="loading" disabled>Loading insurers...</SelectItem>
                        ) : (
                          currentInsurers && currentInsurers.length > 0 ? currentInsurers.map((insurer) => (
                            insurer.insurer_code && insurer.insurer_code.trim() !== "" ? (
                              <SelectItem key={insurer.insurer_code} value={insurer.insurer_code}>
                                {insurer.name} ({insurer.insurer_code})
                              </SelectItem>
                            ) : null
                          )).filter(Boolean) : (
                            <SelectItem value="no-insurers" disabled>No insurers available</SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Preferred RM Name */}
              <FormField
                control={form.control}
                name="preferred_rm_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Preferred RM Name (Optional)
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="Relationship Manager name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Password Field */}
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Password
                    </FormLabel>
                    <FormControl>
                      <PasswordInput placeholder="Enter password for child ID" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end pt-4">
                <Button 
                  type="submit" 
                  disabled={createRequestMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700 min-w-[120px]"
                >
                  {createRequestMutation.isPending ? 'Submitting...' : 'Submit Request'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
