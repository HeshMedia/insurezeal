"use client";

import { useMemo, useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAtom } from "jotai";
import { PolicyReviewFormSchema, PolicyReviewFormSchemaType } from "./policy-form-schema";
import { pdfExtractionDataAtom, policyPdfUrlAtom } from "@/lib/atoms/cutpay";
import { useInsurers, useBrokersAndInsurers, useChildIdRequests } from "@/hooks/agentQuery";
import { useSubmitPolicy } from "@/hooks/policyQuery";
import { useProfile } from "@/hooks/profileQuery";
import DocumentViewer from "@/components/forms/documentviewer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { SubmitPolicyPayload } from "@/types/policy.types";
import { useRouter } from 'next/navigation'


type SimpleInsurer = { insurer_code: string; name: string };
type SimpleBroker = { broker_code: string; name: string };

interface PolicyReviewFormProps {
  onPrev: () => void;
  onSuccess: () => void;
}

const PolicyReviewForm = ({ onPrev, onSuccess }: PolicyReviewFormProps) => {
  const [pdfExtractionData] = useAtom(pdfExtractionDataAtom);
  const [policyPdfUrl] = useAtom(policyPdfUrlAtom);
  const submitPolicyMutation = useSubmitPolicy();
  const { data: userProfile } = useProfile();
  const [isViewerOpen, setIsViewerOpen] = useState(true);
  const router = useRouter()

  const form = useForm<PolicyReviewFormSchemaType>({
    resolver: zodResolver(PolicyReviewFormSchema),
    defaultValues: {
      policy_number: pdfExtractionData?.extracted_data?.policy_number || "",
      start_date: pdfExtractionData?.extracted_data?.start_date || null,
      end_date: pdfExtractionData?.extracted_data?.end_date || null,
      code_type: "Direct",
      insurer_code: "",
      broker_code: null,
      child_id: "",
      payment_by: "Agent",
      payment_method: null,
      payment_by_office: 0,
      agent_commission_given_percent: 0,
      notes: "",
    },
  });

  const codeType = form.watch("code_type");
  const insurerCode = form.watch("insurer_code");
  const paymentBy = form.watch("payment_by");
  const brokerCode = form.watch("broker_code") || undefined;

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

  // Autofill start/end if missing (today + 1 year)
  useEffect(() => {
    if (!form.getValues("start_date")) {
      const today = new Date().toISOString().split("T")[0];
      form.setValue("start_date", today, { shouldValidate: true });
    }
    if (!form.getValues("end_date")) {
      const end = new Date();
      end.setFullYear(end.getFullYear() + 1);
      form.setValue("end_date", end.toISOString().split("T")[0], { shouldValidate: true });
    }
  }, [form]);

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
      if (!policyPdfUrl) {
        toast.error("Policy PDF missing. Please upload in Step 1.");
        return;
      }

      const extracted = pdfExtractionData?.extracted_data || {};

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

      const payload: SubmitPolicyPayload = {
        policy_number: values.policy_number,
        policy_type: extracted.plan_type || "Policy",
        pdf_file_path: policyPdfUrl,
        pdf_file_name: `policy_${values.policy_number || Date.now()}.pdf`,

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
        payment_method: values.payment_method || undefined,
        notes: values.notes || undefined,

        // Dates
        start_date: values.start_date || undefined,
        end_date: values.end_date || undefined,

        // AI metadata
        ai_confidence_score: aiConfidenceScore,
        manual_override: false,
      };

      await submitPolicyMutation.mutateAsync(payload);
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

      <div className="flex flex-wrap md:flex-nowrap gap-6">
        {/* Left column: single consolidated form box */}
        <div className={`transition-all duration-300 ${isViewerOpen ? "w-full md:w-1/2" : "w-full"}`}>
          <Card className="shadow-sm border border-l-6 border-green-500 h-full">
            <CardHeader className="bg-gray-50 border-b">
              <CardTitle className="text-lg text-gray-800 flex items-center gap-2">
                <span className="h-2 w-2 bg-green-500 rounded-full"></span>
                Input
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Policy Number */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Policy Number</Label>
                  <Controller
                    name="policy_number"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <>
                        <Input {...field} className="h-10" />
                        {fieldState.error && (
                          <p className="text-xs text-red-500 mt-1">{fieldState.error.message}</p>
                        )}
                      </>
                    )}
                  />
                </div>

                {/* Start Date */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Policy Start Date</Label>
                  <Controller
                    name="start_date"
                    control={form.control}
                    render={({ field }) => (
                      <Input className="h-10" type="date" value={String(field.value ?? "")} onChange={(e) => field.onChange(e.target.value || null)} />
                    )}
                  />
                </div>

                {/* End Date */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Policy End Date</Label>
                  <Controller
                    name="end_date"
                    control={form.control}
                    render={({ field }) => (
                      <Input className="h-10" type="date" value={String(field.value ?? "")} onChange={(e) => field.onChange(e.target.value || null)} />
                    )}
                  />
                </div>

                {/* Code Type */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Code Type</Label>
                  <Controller
                    name="code_type"
                    control={form.control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="h-10">
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
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Insurer</Label>
                  <Controller
                    name="insurer_code"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className="h-10">
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
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">Broker</Label>
                    <Controller
                      name="broker_code"
                      control={form.control}
                      render={({ field }) => (
                        <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                          <SelectTrigger className="h-10">
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
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Child ID</Label>
                  <Controller
                    name="child_id"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className="h-10">
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
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Payment By</Label>
                  <Controller
                    name="payment_by"
                    control={form.control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="h-10">
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
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">Payment Method</Label>
                    <Controller
                      name="payment_method"
                      control={form.control}
                      render={({ field }) => (
                        <Input className="h-10" value={String(field.value ?? "")} onChange={(e) => field.onChange(e.target.value || null)} />
                      )}
                    />
                  </div>
                )}

                {/* Payment By Office */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Payment By Office</Label>
                  <Controller
                    name="payment_by_office"
                    control={form.control}
                    render={({ field }) => (
                      <Input className="h-10" type="number" value={String(field.value ?? "")} onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))} />
                    )}
                  />
                </div>

                {/* Agent Commission % */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Agent Commission (%)</Label>
                  <Controller
                    name="agent_commission_given_percent"
                    control={form.control}
                    render={({ field }) => (
                      <Input className="h-10" type="number" step="0.01" value={String(field.value ?? "")} onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))} />
                    )}
                  />
                </div>
              </div>

              {/* Notes (full width) */}
              <div className="space-y-2">
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

        {/* Right column: Document viewer */}
        {isViewerOpen && (
          <div className="w-full md:w-1/2 transition-all duration-300">
            <DocumentViewer />
          </div>
        )}
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