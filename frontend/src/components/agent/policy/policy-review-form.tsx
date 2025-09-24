"use client";

import { useMemo, useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAtom } from "jotai";
import { PolicyReviewFormSchema, PolicyReviewFormSchemaType } from "@/components/agent/policy/policy-form-schema";
import { pdfExtractionDataAtom } from "@/lib/atoms/cutpay";
import { useInsurers, useBrokersAndInsurers, useChildIdRequests } from "@/hooks/agentQuery";
import { useSubmitPolicy, useUploadPolicyPdf } from "@/hooks/policyQuery";
import { useProfile } from "@/hooks/profileQuery";
import DocumentViewer from "@/components/forms/documentviewer";
import { Mosaic, type MosaicNode } from "react-mosaic-component";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { SubmitPolicyPayload } from "@/types/policy.types";
import { useRouter } from 'next/navigation'
import { getFromIndexedDB } from '@/lib/utils/indexeddb'


type SimpleInsurer = { insurer_code: string; name: string };
type SimpleBroker = { broker_code: string; name: string };

interface PolicyReviewFormProps {
  onPrev: () => void;
  onSuccess: () => void;
}

const PolicyReviewForm = ({ onPrev, onSuccess }: PolicyReviewFormProps) => {
  const [pdfExtractionData] = useAtom(pdfExtractionDataAtom);
  const submitPolicyMutation = useSubmitPolicy();
  const uploadPolicyMutation = useUploadPolicyPdf();
  const { data: userProfile } = useProfile();
  const [isViewerOpen, setIsViewerOpen] = useState(true);
  const router = useRouter()

  type ViewId = "input" | "doc";
  const initialLayout: MosaicNode<ViewId> | null = useMemo(() => ({
    direction: "row",
    first: "input",
    second: "doc",
    splitPercentage: 50,
  }), []);
  const [layout, setLayout] = useState<MosaicNode<ViewId> | null>(initialLayout);
  useEffect(() => {
    setLayout(isViewerOpen ? initialLayout : "input");
  }, [isViewerOpen, initialLayout]);

  const form = useForm<PolicyReviewFormSchemaType>({
    resolver: zodResolver(PolicyReviewFormSchema),
    defaultValues: {
      policy_number: pdfExtractionData?.extracted_data?.policy_number || "",
      code_type: "Direct",
      insurer_code: "",
      broker_code: null,
      child_id: "",
      payment_by: "Agent",
      payment_method: null,
      payment_detail: null,
      payment_by_office: 0,
      agent_commission_given_percent: 0,
      notes: "",
    },
  });

  const codeType = form.watch("code_type");
  const insurerCode = form.watch("insurer_code");
  const paymentBy = form.watch("payment_by");
  const paymentMethod = form.watch("payment_method");
  const brokerCode = form.watch("broker_code") || undefined;

  // Payment method options matching CutPay form
  const paymentMethodOptions = useMemo(() => [
    { value: "Credit Card", label: "Credit Card" },
    { value: "Bank Transfer", label: "Bank Transfer" },
    { value: "Cheque", label: "Cheque" },
    { value: "Cash", label: "Cash" },
    { value: "cd/float(iz)", label: "cd/float(iz)" },
    { value: "UPI", label: "UPI" },
    { value: "Net Banking", label: "Net Banking" },
  ], []);

  // Options
  const { data: directInsurers } = useInsurers();
  const { data: brokersAndInsurers } = useBrokersAndInsurers();
  const { data: myRequests } = useChildIdRequests();

  const insurerOptions = useMemo(() => {
    const src = (codeType === "Broker"
      ? (brokersAndInsurers?.insurers as SimpleInsurer[] | undefined)
      : (directInsurers as SimpleInsurer[] | undefined)) || [];
    return src.map((i) => ({ value: i.insurer_code, label: `${i.name}` }));
  }, [codeType, directInsurers, brokersAndInsurers]);

  const brokerOptions = useMemo(() => {
    if (codeType !== "Broker") return [];
    const src = (brokersAndInsurers?.brokers as SimpleBroker[] | undefined) || [];
    return src.map((b) => ({ value: b.broker_code, label: `${b.name}` }));
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

  // Simple calculation preview
  const netPremium = Number(pdfExtractionData?.extracted_data?.net_premium || 0);
  const grossPremium = Number(pdfExtractionData?.extracted_data?.gross_premium || 0);
  const agentCommissionPercent = Number(form.watch("agent_commission_given_percent") || 0);
  const totalAgentPayout = useMemo(() => netPremium * (agentCommissionPercent / 100), [netPremium, agentCommissionPercent]);

  // Auto-populate payment_by_office when Payment By is InsureZeal (same logic as existing form)
  useEffect(() => {
    if (paymentBy === "InsureZeal") {
      form.setValue("payment_by_office", grossPremium, { shouldValidate: true });
    } else if (paymentBy === "Agent") {
      form.setValue("payment_by_office", 0, { shouldValidate: true });
    }
  }, [paymentBy, grossPremium, form]);

  const onSubmit = async (values: PolicyReviewFormSchemaType) => {
    try {
      // VALIDATION: Compare manual selections with extracted data
      const validationExtracted = pdfExtractionData?.extracted_data;
      if (validationExtracted) {
        const extractedInsurer = validationExtracted.ai_detected_insurer_name;
        const extractedBroker = validationExtracted.ai_detected_broker_name;

        // Get selected insurer name from options
        const selectedInsurerOption = insurerOptions.find(opt => opt.value === values.insurer_code);
        const selectedInsurerName = selectedInsurerOption?.label;

        // Get selected broker name from options (if applicable)
        let selectedBrokerName = null;
        if (codeType === "Broker" && values.broker_code) {
          const selectedBrokerOption = brokerOptions.find(opt => opt.value === values.broker_code);
          selectedBrokerName = selectedBrokerOption?.label;
        }

        // Validate insurer match
        if (extractedInsurer && selectedInsurerName) {
          const normalizeString = (str: string) => str.toLowerCase().trim();
          if (normalizeString(extractedInsurer) !== normalizeString(selectedInsurerName)) {
            toast.error(`Selection Mismatch: The selected Insurer "${selectedInsurerName}" does not match the AI-detected insurer in the uploaded PDF ("${extractedInsurer}"). Please review your selection or upload the correct document.`);
            return;
          }
        }

        // Validate broker match (if broker code type is selected)
        if (codeType === "Broker" && extractedBroker && selectedBrokerName) {
          const normalizeString = (str: string) => str.toLowerCase().trim();
          if (normalizeString(extractedBroker) !== normalizeString(selectedBrokerName)) {
            toast.error(`Selection Mismatch: The selected Broker "${selectedBrokerName}" does not match the AI-detected broker in the uploaded PDF ("${extractedBroker}"). Please review your selection or upload the correct document.`);
            return;
          }
        }
      }

      // Proceed even if preview URL is absent; we'll read the file from IndexedDB

      const extracted = pdfExtractionData?.extracted_data || {
        policy_number: null,
        formatted_policy_number: null,
        major_categorisation: null,
        product_insurer_report: null,
        product_type: null,
        plan_type: null,
        customer_name: null,
        customer_phone_number: null,
        registration_number: null,
        make_model: null,
        model: null,
        vehicle_variant: null,
        gvw: null,
        rto: null,
        state: null,
        fuel_type: null,
        cc: null,
        age_year: null,
        ncb: null,
        discount_percent: null,
        business_type: null,
        seating_capacity: null,
        veh_wheels: null,
        start_date: null,
        end_date: null,
        gross_premium: null,
        gst_amount: null,
        net_premium: null,
        od_premium: null,
        tp_premium: null,
        ai_detected_insurer_name: null,
        ai_detected_broker_name: null,
      };

      // Compute AI confidence (supports both policy and cutpay extraction shapes)
      const aiConfidenceScore: number | undefined = (() => {
        const data = pdfExtractionData as unknown as {
          confidence_score?: number;
          confidence_scores?: Record<string, number>;
        } | null;
        if (!data) return undefined;
        if (typeof data.confidence_score === "number") return data.confidence_score;
        const scores = data.confidence_scores;
        if (scores && typeof scores === "object") {
          const scoreValues = Object.values(scores);
          if (scoreValues.length) return scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length;
        }
        return undefined;
      })();

      // Agent code is optional - warn if missing but don't block
      if (!userProfile?.agent_code) {
        toast.warning("Agent code is missing from your profile. Policy will be created without agent code.");
      }

      // Generate PDF file path and name for S3 upload
      const policyNumber = values.policy_number.replace(/[^a-zA-Z0-9]/g, '_'); // Sanitize policy number for filename
      const timestamp = Date.now();
      const pdfFileName = `policy_${policyNumber}_${timestamp}.pdf`;
      const pdfFilePath = `policies/${new Date().getFullYear()}/${pdfFileName}`;

      const payload: SubmitPolicyPayload = {
        policy_number: values.policy_number,
        policy_type: extracted.plan_type || "Standard",
        pdf_file_path: pdfFilePath,
        pdf_file_name: pdfFileName,

        // Agent context (optional)
        agent_id: userProfile?.user_id || undefined,
        agent_code: userProfile?.agent_code || undefined,
        child_id: values.child_id,
        insurer_code: values.insurer_code,
        broker_code: values.broker_code || undefined,

        // Extracted details
        formatted_policy_number: extracted.formatted_policy_number || undefined,
        major_categorisation: extracted.major_categorisation || undefined,
        product_insurer_report: extracted.product_insurer_report || undefined,
        product_type: extracted.product_type || undefined,
        plan_type: extracted.plan_type || undefined,
        customer_name: extracted.customer_name || undefined,
        customer_phone_number: extracted.customer_phone_number || undefined,
        insurance_type: extracted.major_categorisation || undefined,
        vehicle_type: extracted.product_insurer_report || undefined,
        registration_number: extracted.registration_number || undefined,
        vehicle_class: extracted.make_model || undefined,
        vehicle_segment: extracted.product_type || undefined,
        make_model: extracted.make_model || undefined,
        model: extracted.model || undefined,
        vehicle_variant: extracted.vehicle_variant || undefined,
        gvw: extracted.gvw || undefined,
        rto: extracted.rto || undefined,
        state: extracted.state || undefined,
        fuel_type: extracted.fuel_type || undefined,
        cc: extracted.cc || undefined,
        age_year: extracted.age_year || undefined,
        ncb: extracted.ncb || undefined,
        discount_percent: extracted.discount_percent || undefined,
        business_type: extracted.business_type || undefined,
        seating_capacity: extracted.seating_capacity || undefined,
        veh_wheels: extracted.veh_wheels || undefined,
        start_date: extracted.start_date || undefined,
        end_date: extracted.end_date || undefined,

        // Premium
        gross_premium: extracted.gross_premium || undefined,
        gst: extracted.gst_amount || undefined,
        gst_amount: extracted.gst_amount || undefined,
        net_premium: extracted.net_premium || undefined,
        od_premium: extracted.od_premium || undefined,
        tp_premium: extracted.tp_premium || undefined,

        // Admin inputs
        agent_commission_given_percent: values.agent_commission_given_percent || undefined,
        payment_by_office: values.payment_by_office || undefined,
        total_agent_payout_amount: totalAgentPayout || undefined,
        code_type: values.code_type,
        payment_by: values.payment_by,
        payment_method: values.payment_method && values.payment_detail
          ? `${values.payment_method}-${values.payment_detail}`
          : values.payment_method || undefined,
        notes: values.notes || undefined,
        // AI metadata
        ai_confidence_score: aiConfidenceScore,
        manual_override: false,
      };

      const created = await submitPolicyMutation.mutateAsync(payload);

      // After creation, upload the policy PDF using the predefined file path
      const stored = await getFromIndexedDB('policy_pdf')
      if (stored?.content) {
        try {
          // Create a new File object with the predefined filename
          const pdfFile = new File([stored.content], pdfFileName, { type: 'application/pdf' });
          
          await uploadPolicyMutation.mutateAsync({
            file: pdfFile,
            policy_id: created.id,
            document_type: 'policy_pdf',
          })
        } catch (e) {
          const message = e instanceof Error ? e.message : 'Failed to upload policy PDF'
          toast.warning(message)
        }
      } else {
        toast.warning('Policy created, but PDF not found in IndexedDB for upload')
      }

      toast.success("Policy created successfully");
      router.push("/agent/policies");
      onSuccess();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to create policy";
      toast.error(message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Policy Details</h2>
        <Button type="button" variant="outline" onClick={() => setIsViewerOpen((v) => !v)}>
          {isViewerOpen ? "Hide" : "Show"} Document
        </Button>
      </div>

      <div className="w-full resize-y overflow-auto min-h-[400px] h-[70vh]">
        <Mosaic<ViewId>
          className="h-full"
          value={layout}
          onChange={setLayout}
          resize={{ minimumPaneSizePercentage: 15 }}
          renderTile={(id) => (
            id === "input" ? (
              <div className="h-full overflow-auto pr-1">
                <Card className="shadow-sm border border-l-6 border-green-500 h-full">
                  <CardHeader className="bg-gray-50 border-b">
                    <CardTitle className="text-lg text-gray-800 flex items-center gap-2">
                      <span className="h-2 w-2 bg-green-500 rounded-full"></span>
                      Input
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">
                    <div className="flex flex-wrap gap-4 items-start">
                      {/* Policy Number */}
                      <div className="space-y-2 flex-none w-fit">
                        <Label className="text-sm font-medium text-gray-700">Policy Number</Label>
                        <Controller
                          name="policy_number"
                          control={form.control}
                          render={({ field, fieldState }) => (
                            <>
                              <Input {...field} className="h-10 w-fit" disabled/>
                              {fieldState.error && (
                                <p className="text-xs text-red-500 mt-1">{fieldState.error.message}</p>
                              )}
                            </>
                          )}
                        />
                      </div>

                      {/* Code Type */}
                      <div className="space-y-2 flex-none w-fit">
                        <Label className="text-sm font-medium text-gray-700">Code Type</Label>
                        <Controller
                          name="code_type"
                          control={form.control}
                          render={({ field }) => (
                            <Select value={field.value} onValueChange={field.onChange}>
                              <SelectTrigger className="h-10 w-fit">
                                <SelectValue placeholder="Select Code Type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Direct">Direct</SelectItem>
                                <SelectItem value="Broker">Broker</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </div>

                      {/* Insurer Code */}
                      <div className="space-y-2 flex-none w-fit">
                        <Label className="text-sm font-medium text-gray-700">Insurer</Label>
                        <Controller
                          name="insurer_code"
                          control={form.control}
                          render={({ field, fieldState }) => (
                            <>
                              <Select value={field.value} onValueChange={field.onChange}>
                                <SelectTrigger className="h-10 w-fit">
                                  <SelectValue placeholder="Select Insurer" />
                                </SelectTrigger>
                                <SelectContent>
                                  {insurerOptions.map((o: { value: string; label: string }) => (
                                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {fieldState.error && (
                                <p className="text-xs text-red-500 mt-1">{fieldState.error.message}</p>
                              )}
                            </>
                          )}
                        />
                      </div>

                      {/* Broker Code (conditional) */}
                      {codeType === "Broker" && (
                        <div className="space-y-2 flex-none w-fit">
                          <Label className="text-sm font-medium text-gray-700">Broker</Label>
                          <Controller
                            name="broker_code"
                            control={form.control}
                            render={({ field }) => (
                              <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                                <SelectTrigger className="h-10 w-fit">
                                  <SelectValue placeholder="Select Broker" />
                                </SelectTrigger>
                                <SelectContent>
                                  {brokerOptions.map((o: { value: string; label: string }) => (
                                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          />
                        </div>
                      )}

                      {/* Child ID */}
                      <div className="space-y-2 flex-none w-fit">
                        <Label className="text-sm font-medium text-gray-700">Child ID</Label>
                        <Controller
                          name="child_id"
                          control={form.control}
                          render={({ field, fieldState }) => (
                            <>
                              <Select value={field.value} onValueChange={field.onChange}>
                                <SelectTrigger className="h-10 w-fit">
                                  <SelectValue placeholder="Select Child ID" />
                                </SelectTrigger>
                                <SelectContent>
                                  {myChildIdOptions.map((o) => (
                                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {fieldState.error && (
                                <p className="text-xs text-red-500 mt-1">{fieldState.error.message}</p>
                              )}
                            </>
                          )}
                        />
                      </div>

                      {/* Payment By */}
                      <div className="space-y-2 flex-none w-fit">
                        <Label className="text-sm font-medium text-gray-700">Payment By</Label>
                        <Controller
                          name="payment_by"
                          control={form.control}
                          render={({ field }) => (
                            <Select value={field.value} onValueChange={field.onChange}>
                              <SelectTrigger className="h-10 w-fit">
                                <SelectValue placeholder="Select Payment By" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Agent">Agent</SelectItem>
                                <SelectItem value="InsureZeal">InsureZeal</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </div>

                      {/* Payment Method (hidden when payment_by is Agent) */}
                      {paymentBy !== "Agent" && (
                        <div className="space-y-2 flex-none w-fit">
                          <Label className="text-sm font-medium text-gray-700">Payment Method</Label>
                          <Controller
                            name="payment_method"
                            control={form.control}
                            render={({ field }) => (
                              <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                                <SelectTrigger className="h-10 w-fit">
                                  <SelectValue placeholder="Select Payment Method" />
                                </SelectTrigger>
                                <SelectContent>
                                  {paymentMethodOptions.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          />
                        </div>
                      )}

                      {/* Payment Detail (hidden when payment_by is Agent or no payment method selected) */}
                      {paymentBy !== "Agent" && paymentMethod && (
                        <div className="space-y-2 flex-none w-fit">
                          <Label className="text-sm font-medium text-gray-700">Payment Detail</Label>
                          <Controller
                            name="payment_detail"
                            control={form.control}
                            render={({ field }) => (
                              <Input 
                                className="h-10 w-fit" 
                                placeholder="e.g., Ref #12345" 
                                value={String(field.value ?? "")} 
                                onChange={(e) => field.onChange(e.target.value || null)} 
                              />
                            )}
                          />
                        </div>
                      )}

                      {/* Payment By Office */}
                      {paymentBy == "InsureZeal" && (
                      <div className="space-y-2 flex-none w-fit">
                        <Label className="text-sm font-medium text-gray-700">Payment By InsureZeal</Label>
                        <Controller
                          name="payment_by_office"
                          control={form.control}
                          render={({ field }) => (
                            <Input className="h-10 w-fit" type="number" value={String(field.value ?? "")} onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))} />
                          )}
                        />
                      </div>
                          )}

                      {/* Agent Commission % */}
                      <div className="space-y-2 flex-none w-fit">
                        <Label className="text-sm font-medium text-gray-700">Agent Commission (%)</Label>
                        <Controller
                          name="agent_commission_given_percent"
                          control={form.control}
                          render={({ field }) => (
                            <Input className="h-10 w-fit" type="number" step="0.01" value={String(field.value ?? "")} onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))} />
                          )}
                        />
                      </div>
                    </div>

                    {/* Notes (full width) */}
                    <div className="space-y-2 w-full">
                      <Label className="text-sm font-medium text-gray-700">Notes</Label>
                      <Controller
                        name="notes"
                        control={form.control}
                        render={({ field }) => (
                          <Textarea rows={3} value={String(field.value ?? "")} onChange={(e) => field.onChange(e.target.value || null)} />
                        )}
                      />
                    </div>

                    {/* Calculation section */}
                    <div className="space-y-4">
                      {/* Total Agent Payout */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-gray-700">Total Agent Payout Amount</Label>
                        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-lg font-semibold text-green-800">
                          ₹{(totalAgentPayout || 0).toFixed(2)}
                        </div>
                      </div>

                      {/* Payment Calculation when payment by InsureZeal */}
                      {paymentBy === "InsureZeal" && (
                        <div className="space-y-2">
                          <Label className="text-sm font-medium text-gray-700">Payment Calculation</Label>
                          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="text-lg font-semibold text-blue-800">
                              ₹{(totalAgentPayout - grossPremium).toFixed(2)}
                            </div>
                            <div className="text-xs text-gray-500 mt-2">
                              {(() => {
                                const calculatedAmount = totalAgentPayout - grossPremium;
                                if (calculatedAmount > 0) {
                                  return "This positive amount will be added to running balance (InsureZeal owes more to agent)";
                                } else if (calculatedAmount < 0) {
                                  return "This negative amount will be added to running balance (Agent owes to InsureZeal)";
                                }
                                return "This transaction is balanced - no change to running balance";
                              })()}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="h-full w-full overflow-hidden">
                <DocumentViewer />
              </div>
            )
          )}
        />
      </div>

      {/* Actions */}
      <div className="flex justify-between mt-6">
        <Button type="button" variant="outline" onClick={onPrev} disabled={form.formState.isSubmitting}>Previous</Button>
        <Button type="button" className="min-w-[120px]" disabled={form.formState.isSubmitting} onClick={form.handleSubmit(onSubmit)}>
          {form.formState.isSubmitting ? "Processing..." : "Submit Policy"}
        </Button>
      </div>
    </div>
  );
};

export default PolicyReviewForm;