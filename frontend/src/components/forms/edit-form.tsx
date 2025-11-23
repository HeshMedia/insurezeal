/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Fragment, useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Info } from "lucide-react";
import { useSetAtom } from "jotai";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MonthYearPicker } from "@/components/ui/month-year-picker";

import Calculations from "@/components/admin/cutpay/calculations";
import DocumentViewer from "@/components/forms/documentviewer";
import {
  CutPayFormSchema,
  CutPayFormSchemaType,
} from "@/components/admin/cutpay/form-schema";
import {
  formFields,
  FormFieldConfig,
} from "@/components/admin/cutpay/form-config";

import { useUpdateCutPayByPolicy } from "@/hooks/cutpayQuery";
import { useAgentList } from "@/hooks/adminQuery";
import {
  useAdminChildIdList,
  useAvailableAdminChildIds,
  useBrokerList,
  useInsurerList,
} from "@/hooks/superadminQuery";

import type { AdminChildId, Broker, Insurer } from "@/types/superadmin.types";
import type { AgentSummary } from "@/types/admin.types";
import type {
  CreateCutpayTransactionCutpayPostRequest,
  ExtractedPolicyData,
} from "@/types/cutpay.types";
import { policyPdfUrlAtom } from "@/lib/atoms/cutpay";
import { numberInputOnWheelPreventChange } from "@/lib/utils/number-input";

type EditFormProps = {
  initialDbRecord?: CreateCutpayTransactionCutpayPostRequest | null;
  policyNumber: string;
  quarter: number;
  year: number;
  policyPdfUrl?: string | null;
};

const defaultFormValues: CutPayFormSchemaType = {
  policy_pdf_url: null,
  additional_documents: {},
  extracted_data: {
    policy_number: null,
    formatted_policy_number: null,
    major_categorisation: null,
    product_insurer_report: null,
    product_type: null,
    plan_type: null,
    customer_name: null,
    customer_phone_number: null,
    insurance_type: null,
    vehicle_type: null,
    gross_premium: null,
    net_premium: null,
    od_premium: null,
    tp_premium: null,
    gst_amount: null,
    registration_number: null,
    make_model: null,
    model: null,
    vehicle_variant: null,
    vehicle_class: null,
    vehicle_segment: null,
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
    is_private_car: null,
  },
  admin_input: {
    reporting_month: null,
    booking_date: null,
    agent_code: null,
    code_type: null,
    incoming_grid_percent: null,
    agent_commission_given_percent: null,
    extra_grid: null,
    commissionable_premium: null,
    payment_by: null,
    payment_method: null,
    payment_detail: null,
    payout_on: null,
    agent_extra_percent: null,
    payment_by_office: null,
    insurer_code: null,
    broker_code: null,
    admin_child_id: null,
    od_agent_payout_percent: null,
    tp_agent_payout_percent: null,
    od_incoming_grid_percent: null,
    tp_incoming_grid_percent: null,
    od_incoming_extra_grid: null,
    tp_incoming_extra_grid: null,
  },
  calculations: {
    receivable_from_broker: null,
    extra_amount_receivable_from_broker: null,
    total_receivable_from_broker: null,
    total_receivable_from_broker_with_gst: null,
    cut_pay_amount: null,
    agent_po_amt: null,
    agent_extra_amount: null,
    total_agent_po_amt: null,
    iz_total_po_percent: null,
    already_given_to_agent: null,
    broker_payout_amount: null,
  },
  claimed_by: null,
  running_bal: 0,
  cutpay_received_status: null,
  cutpay_received: null,
  notes: null,
};

const normalizeNullableString = (value?: string | null): string | null => {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
};

const normalizeCodeType = (value?: string | null): string | null => {
  const normalized = normalizeNullableString(value);
  if (!normalized) return null;
  const lower = normalized.toLowerCase();
  if (lower === "direct" || lower === "direct code") {
    return "Direct";
  }
  if (lower === "broker" || lower === "broker code") {
    return "Broker";
  }
  return normalized;
};

const normalizePayoutOn = (value?: string | null): string | null => {
  const normalized = normalizeNullableString(value);
  if (!normalized) return null;
  const upper = normalized.toUpperCase();
  if (upper === "ODTP") {
    return "OD+TP";
  }
  if (["OD", "NP", "OD+TP"].includes(upper)) {
    return upper;
  }
  return normalized;
};

const normalizeDateToISO = (value?: string | null): string | null => {
  const normalized = normalizeNullableString(value);
  if (!normalized) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(normalized)) {
    return normalized.slice(0, 10);
  }
  const slashFormat = normalized.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/);
  if (slashFormat) {
    const [, month, day, year] = slashFormat;
    return `${year}-${month}-${day}`;
  }
  return normalized;
};

type SelectOption = { value: string; label: string };

const ensureOptionExists = (
  options: SelectOption[],
  rawValue?: string | null,
  labelFactory?: (value: string) => string
): SelectOption[] => {
  const value = normalizeNullableString(rawValue);
  if (!value) {
    return options;
  }
  if (options.some((option) => option.value === value)) {
    return options;
  }
  return [
    ...options,
    {
      value,
      label: labelFactory ? labelFactory(value) : value,
    },
  ];
};

const mergeWithDefaults = (
  record?: CreateCutpayTransactionCutpayPostRequest | null
): CutPayFormSchemaType => {
  if (!record) return defaultFormValues;

  const cutpayReceivedValue =
    typeof record.cutpay_received === "number"
      ? record.cutpay_received
      : record.cutpay_received === null
      ? null
      : defaultFormValues.cutpay_received;

  const { payment_by_office: rawPaymentByOffice, ...restAdminInput } =
    record.admin_input ?? {};

  const mergedAdminInput = {
    ...defaultFormValues.admin_input,
    ...(restAdminInput as Partial<CutPayFormSchemaType["admin_input"]>),
  };

  const extractedData: CutPayFormSchemaType["extracted_data"] = {
    ...defaultFormValues.extracted_data,
    ...(record.extracted_data || {}),
  };

  const adminInput: CutPayFormSchemaType["admin_input"] = {
    ...mergedAdminInput,
    booking_date: normalizeDateToISO(mergedAdminInput.booking_date),
    reporting_month: normalizeNullableString(mergedAdminInput.reporting_month),
    agent_code: normalizeNullableString(mergedAdminInput.agent_code),
    code_type: normalizeCodeType(mergedAdminInput.code_type),
    payout_on: normalizePayoutOn(mergedAdminInput.payout_on),
    payment_by: normalizeNullableString(mergedAdminInput.payment_by),
    payment_detail: normalizeNullableString(mergedAdminInput.payment_detail),
    payment_method: normalizeNullableString(mergedAdminInput.payment_method),
    insurer_code: normalizeNullableString(mergedAdminInput.insurer_code),
    broker_code: normalizeNullableString(mergedAdminInput.broker_code),
    admin_child_id: normalizeNullableString(mergedAdminInput.admin_child_id),
    payment_by_office:
      rawPaymentByOffice !== undefined &&
      rawPaymentByOffice !== null &&
      rawPaymentByOffice !== ""
        ? Number(rawPaymentByOffice)
        : null,
  };

  return {
    ...defaultFormValues,
    ...record,
    extracted_data: extractedData,
    admin_input: adminInput,
    calculations: {
      ...defaultFormValues.calculations,
      ...(record.calculations || {}),
    },
    additional_documents: {
      ...defaultFormValues.additional_documents,
      ...(record.additional_documents || {}),
    },
    cutpay_received: cutpayReceivedValue,
    cutpay_received_status:
      (record as any).cutpay_received_status ??
      (cutpayReceivedValue == null
        ? null
        : cutpayReceivedValue === 0
        ? "No"
        : "Yes"),
    claimed_by: normalizeNullableString(record.claimed_by),
    notes: normalizeNullableString(record.notes),
  };
};

const buildPayload = (
  form: CutPayFormSchemaType,
  options?: { insuranceCompany?: string | null }
): CreateCutpayTransactionCutpayPostRequest => {
  const cutpayReceived =
    form.cutpay_received_status === "No" ? 0 : form.cutpay_received ?? null;

  const paymentBy = form.admin_input.payment_by;

  return {
    policy_pdf_url: form.policy_pdf_url ?? null,
    additional_documents:
      form.additional_documents &&
      Object.keys(form.additional_documents).length > 0
        ? form.additional_documents
        : null,
    extracted_data: form.extracted_data
      ? ({
          insurance_company: options?.insuranceCompany ?? null,
          ...form.extracted_data,
        } as ExtractedPolicyData)
      : null,
    admin_input: {
      ...form.admin_input,
      payment_detail:
        paymentBy === "InsureZeal" ? form.admin_input.payment_detail : null,
      payment_by_office:
        paymentBy === "InsureZeal"
          ? form.admin_input.payment_by_office != null
            ? String(form.admin_input.payment_by_office)
            : null
          : null,
    },
    calculations: form.calculations ?? null,
    claimed_by: form.claimed_by ?? null,
    running_bal: form.running_bal ?? 0,
    cutpay_received:
      cutpayReceived === null || cutpayReceived === undefined
        ? 0
        : cutpayReceived,
    notes: form.notes ?? null,
  };
};

const EditForm: React.FC<EditFormProps> = ({
  initialDbRecord,
  policyNumber,
  quarter,
  year,
  policyPdfUrl,
}) => {
  const router = useRouter();
  const updateCutPayByPolicy = useUpdateCutPayByPolicy();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const setPolicyPdfUrl = useSetAtom(policyPdfUrlAtom);

  // Set the policy PDF URL in the atom for the DocumentViewer
  useEffect(() => {
    if (policyPdfUrl) {
      setPolicyPdfUrl(policyPdfUrl);
    }
  }, [policyPdfUrl, setPolicyPdfUrl]);

  const { control, handleSubmit, setValue, watch, reset } =
    useForm<CutPayFormSchemaType>({
      resolver: zodResolver(CutPayFormSchema),
      defaultValues: mergeWithDefaults(initialDbRecord ?? undefined),
    });

  useEffect(() => {
    reset(mergeWithDefaults(initialDbRecord ?? undefined));
  }, [initialDbRecord, reset]);

  const insuranceCompany = useMemo(
    () => initialDbRecord?.extracted_data?.insurance_company ?? null,
    [initialDbRecord]
  );

  const paymentBy = watch("admin_input.payment_by");
  const grossPremium = watch("extracted_data.gross_premium");
  const registrationNo = watch("extracted_data.registration_number");
  const majorCategorisation = watch("extracted_data.major_categorisation");
  const productTypeValue = watch("extracted_data.product_type");
  const childIdValue = watch("admin_input.admin_child_id");
  const cutpayReceivedStatus = watch("cutpay_received_status");
  const cutPayAmount = watch("calculations.cut_pay_amount");
  const codeType = watch("admin_input.code_type");
  const insurerCode = watch("admin_input.insurer_code");
  const brokerCode = watch("admin_input.broker_code");

  const backendAgentCode = normalizeNullableString(
    initialDbRecord?.admin_input?.agent_code
  );
  const backendClaimedBy = normalizeNullableString(initialDbRecord?.claimed_by);
  const backendInsurerCode = normalizeNullableString(
    initialDbRecord?.admin_input?.insurer_code
  );
  const backendBrokerCode = normalizeNullableString(
    initialDbRecord?.admin_input?.broker_code
  );
  const backendChildId = normalizeNullableString(
    initialDbRecord?.admin_input?.admin_child_id
  );

  useEffect(() => {
    if (paymentBy === "InsureZeal" && grossPremium) {
      setValue("admin_input.payment_by_office", grossPremium, {
        shouldValidate: true,
      });
    } else if (paymentBy === "Agent") {
      setValue("admin_input.payment_by_office", 0, { shouldValidate: true });
    } else {
      setValue("admin_input.payment_by_office", null, { shouldValidate: true });
    }
  }, [paymentBy, grossPremium, setValue]);

  useEffect(() => {
    if (cutpayReceivedStatus === "No") {
      setValue("cutpay_received", 0, { shouldValidate: true });
    } else if (
      (cutpayReceivedStatus === "Yes" || cutpayReceivedStatus === "Partial") &&
      cutPayAmount
    ) {
      setValue("cutpay_received", cutPayAmount, { shouldValidate: true });
    } else if (!cutpayReceivedStatus) {
      setValue("cutpay_received", null, { shouldValidate: true });
    }
  }, [cutpayReceivedStatus, cutPayAmount, setValue]);

  useEffect(() => {
    const normalized = productTypeValue
      ? String(productTypeValue).trim().toLowerCase()
      : "";
    const isGcvProduct = ["gcv", "gcv - 3w", "gcv-w"].includes(normalized);

    if (!isGcvProduct) {
      setValue("extracted_data.gvw", null, { shouldValidate: true });
    }
  }, [productTypeValue, setValue]);

  useEffect(() => {
    const hasRegNo = registrationNo && String(registrationNo).trim() !== "";

    if (hasRegNo) {
      if (majorCategorisation !== "Motor") {
        setValue("extracted_data.major_categorisation", "Motor", {
          shouldValidate: true,
        });
      }
    } else if (majorCategorisation === "Motor") {
      setValue("extracted_data.major_categorisation", null, {
        shouldValidate: true,
      });
    }
  }, [registrationNo, majorCategorisation, setValue]);

  const { data: insurers, isLoading: insurersLoading } = useInsurerList();
  const { data: brokers, isLoading: brokersLoading } = useBrokerList();
  const { data: agents, isLoading: agentsLoading } = useAgentList();
  const { data: adminChildIds, isLoading: adminChildIdsLoading } =
    useAdminChildIdList();
  const { data: availableChildIds, isLoading: availableChildIdsLoading } =
    useAvailableAdminChildIds({
      insurer_code: insurerCode || "",
      broker_code: codeType === "Broker" ? brokerCode || "" : undefined,
    });

  useEffect(() => {
    if (childIdValue && adminChildIds) {
      const selectedChildId = adminChildIds.find(
        (child) => child.child_id === childIdValue
      );
      if (selectedChildId) {
        setValue(
          "admin_input.insurer_code",
          selectedChildId.insurer.insurer_code,
          { shouldValidate: true }
        );
        if (selectedChildId.broker?.broker_code) {
          setValue(
            "admin_input.broker_code",
            selectedChildId.broker.broker_code,
            { shouldValidate: true }
          );
        } else {
          setValue("admin_input.broker_code", null, { shouldValidate: true });
        }
      }
    }
  }, [childIdValue, adminChildIds, setValue]);

  const insurerOptions = useMemo(() => {
    const baseOptions =
      insurers
        ?.map((i: Insurer) => ({
          value: i.insurer_code ?? "",
          label: i.name ?? i.insurer_code ?? "",
        }))
        .filter((option) => option.value && option.value.trim() !== "") ?? [];
    return ensureOptionExists(
      baseOptions,
      backendInsurerCode,
      (value) => value
    );
  }, [insurers, backendInsurerCode]);

  const brokerOptions = useMemo(() => {
    const baseOptions =
      brokers
        ?.map((b: Broker) => ({
          value: b.broker_code ?? "",
          label: b.name ?? b.broker_code ?? "",
        }))
        .filter((option) => option.value && option.value.trim() !== "") ?? [];
    return ensureOptionExists(baseOptions, backendBrokerCode, (value) => value);
  }, [brokers, backendBrokerCode]);

  const agentOptions = useMemo(() => {
    const baseOptions =
      agents?.agents
        ?.map((a: AgentSummary) => {
          const fullName = `${a.first_name ?? ""} ${a.last_name ?? ""}`
            .trim()
            .replace(/\s+/g, " ");
          return {
            value: a.agent_code ?? "",
            label: fullName || a.agent_code || "Agent",
          };
        })
        .filter((option) => option.value && option.value.trim() !== "") ?? [];

    const withAgentCode = ensureOptionExists(baseOptions, backendAgentCode);
    return ensureOptionExists(withAgentCode, backendClaimedBy);
  }, [agents, backendAgentCode, backendClaimedBy]);

  const adminChildIdOptions = useMemo(() => {
    let baseOptions: SelectOption[] = [];

    if (codeType && insurerCode && (codeType === "Direct" || brokerCode)) {
      baseOptions =
        availableChildIds
          ?.map((c: AdminChildId) => ({
            value: c.child_id,
            label: `${c.child_id} - ${c.manager_name}`,
          }))
          .filter((option) => option.value && option.value.trim() !== "") ?? [];
    } else {
      baseOptions =
        adminChildIds
          ?.map((a: AdminChildId) => ({
            value: a.child_id,
            label: `${a.child_id} - ${a.manager_name}`,
          }))
          .filter((option) => option.value && option.value.trim() !== "") ?? [];
    }

    return ensureOptionExists(baseOptions, backendChildId);
  }, [
    codeType,
    insurerCode,
    brokerCode,
    availableChildIds,
    adminChildIds,
    backendChildId,
  ]);

  const codeTypeOptions = useMemo(
    () => ["Direct", "Broker"].map((o) => ({ value: o, label: o })),
    []
  );

  const paymentMethodOptions = useMemo(
    () =>
      [
        "cd/float(iz)",
        "Credit Card",
        "Cash",
        "Net Banking",
        "UPI",
        "Debit Card",
        "Cheque",
      ].map((o) => ({ value: o, label: o })),
    []
  );

  const payoutOnOptions = useMemo(
    () => ["OD", "NP", "OD+TP"].map((o) => ({ value: o, label: o })),
    []
  );

  const majorCategorisationOptions = useMemo(
    () => ["Motor", "Life", "Health"].map((o) => ({ value: o, label: o })),
    []
  );

  const planTypeOptions = useMemo(
    () => [
      { value: "Comprehensive", label: "Comprehensive" },
      { value: "STP", label: "STP" },
      { value: "SAOD", label: "SAOD" },
    ],
    []
  );

  const fuelTypeOptions = useMemo(
    () =>
      ["Petrol", "Diesel", "CNG", "Electric"].map((o) => ({
        value: o,
        label: o,
      })),
    []
  );

  const businessTypeOptions = useMemo(
    () =>
      ["Brand New", "Rollover", "Renewed"].map((o) => ({
        value: o,
        label: o,
      })),
    []
  );

  const getChildIdDisabledState = () => {
    if (!codeType) {
      return {
        disabled: true,
        tooltip: "Please select Code Type first",
      };
    }

    if (codeType === "Direct" && !insurerCode) {
      return {
        disabled: true,
        tooltip: "Please select Insurer Code first",
      };
    }

    if (codeType === "Broker" && (!insurerCode || !brokerCode)) {
      return {
        disabled: true,
        tooltip: "Please select both Insurer Code and Broker Code first",
      };
    }

    return {
      disabled: false,
      tooltip: null as string | null,
    };
  };

  const renderTag = (tag?: FormFieldConfig["tag"]) => {
    if (!tag) return null;

    const tagConfig: Record<
      NonNullable<FormFieldConfig["tag"]>,
      { label: string; className: string }
    > = {
      autofill: {
        label: "Auto-fill",
        className: "bg-blue-100 text-blue-800",
      },
      autocalculated: {
        label: "Auto-calculated",
        className: "bg-green-100 text-green-800",
      },
      "payment-method-dependent": {
        label: "Payment Dependent",
        className: "bg-orange-100 text-orange-800",
      },
    };

    const config = tagConfig[tag as NonNullable<FormFieldConfig["tag"]>];
    if (!config) return null;

    return (
      <Badge variant="outline" className={`text-xs ${config.className}`}>
        {config.label}
      </Badge>
    );
  };

  const renderField = (field: FormFieldConfig) => {
    const { key, label, type, disabled, options: configOptions, tag } = field;

    const normalizedProduct = productTypeValue
      ? String(productTypeValue).trim().toLowerCase()
      : "";
    const isGcvProduct = ["gcv", "gcv - 3w", "gcv-w"].includes(
      normalizedProduct
    );

    if (key === "extracted_data.gvw" && !isGcvProduct) {
      return null;
    }

    const payoutOn = watch("admin_input.payout_on");

    if (key === "admin_input.payment_method" && paymentBy !== "InsureZeal") {
      return null;
    }

    if (
      key === "admin_input.payment_detail" &&
      (paymentBy !== "InsureZeal" || !watch("admin_input.payment_method"))
    ) {
      return null;
    }

    if (
      key === "admin_input.broker_code" &&
      watch("admin_input.code_type") === "Direct"
    ) {
      return null;
    }

    if (
      key === "admin_input.payment_by_office" &&
      watch("admin_input.payment_by") !== "InsureZeal"
    ) {
      return null;
    }

    if (payoutOn === "OD+TP") {
      const fieldsToHideForODTP = [
        "admin_input.incoming_grid_percent",
        "admin_input.extra_grid",
        "admin_input.agent_commission_given_percent",
        "admin_input.agent_extra_percent",
      ];
      if (fieldsToHideForODTP.includes(key)) {
        return null;
      }
    }

    if (payoutOn !== "OD+TP") {
      const odtpSpecificFields = [
        "admin_input.od_incoming_grid_percent",
        "admin_input.tp_incoming_grid_percent",
        "admin_input.od_incoming_extra_grid",
        "admin_input.tp_incoming_extra_grid",
        "admin_input.od_agent_payout_percent",
        "admin_input.tp_agent_payout_percent",
      ];
      if (odtpSpecificFields.includes(key)) {
        return null;
      }
    }

    const renderDateField = () => {
      const isReportingMonth = key === "admin_input.reporting_month";

      return (
        <div key={key} className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor={key} className="text-sm font-medium text-gray-700">
              {label}
            </Label>
            {renderTag(tag)}
          </div>
          <Controller
            name={key as any}
            control={control}
            render={({ field: controllerField, fieldState }) => (
              <>
                <div className="relative w-fit">
                  {isReportingMonth ? (
                    <MonthYearPicker
                      value={controllerField.value as string}
                      onChange={controllerField.onChange}
                      placeholder="Pick a month"
                      disabled={disabled}
                    />
                  ) : (
                    <Input
                      type="date"
                      className="h-10 w-fit"
                      {...controllerField}
                      value={String(controllerField.value ?? "").split("T")[0]}
                      onChange={(e) => {
                        const value = e.target.value;
                        controllerField.onChange(value === "" ? null : value);
                      }}
                      disabled={disabled}
                    />
                  )}
                </div>
                {fieldState.error && (
                  <p className="text-red-500 text-xs mt-1">
                    {fieldState.error.message}
                  </p>
                )}
              </>
            )}
          />
        </div>
      );
    };

    const renderSelectField = () => {
      let options = configOptions || [];

      if (key === "admin_input.insurer_code") {
        options = insurerOptions;
      }
      if (key === "admin_input.broker_code") {
        options = brokerOptions;
      }
      if (key === "admin_input.agent_code") {
        options = agentOptions;
      }
      if (key === "admin_input.admin_child_id") {
        options = adminChildIdOptions;
      }
      if (key === "admin_input.code_type") {
        options = codeTypeOptions;
      }
      if (key === "admin_input.payment_by") {
        const selectedAgentCode = watch("admin_input.agent_code");
        const selectedAgent = agents?.agents.find(
          (agent: AgentSummary) => agent.agent_code === selectedAgentCode
        );

        options = ["Agent", "InsureZeal"].map((option) => {
          if (option === "Agent" && selectedAgent) {
            return {
              value: option,
              label: `Agent (${selectedAgent.first_name} ${selectedAgent.last_name})`,
            };
          }
          return { value: option, label: option };
        });
      }
      if (key === "admin_input.payment_method") {
        options = paymentMethodOptions;
      }
      if (key === "admin_input.payout_on") {
        options = payoutOnOptions;
      }
      if (key === "claimed_by") {
        options = agentOptions;
      }
      if (key === "extracted_data.major_categorisation") {
        options = majorCategorisationOptions;
      }
      if (key === "extracted_data.plan_type") {
        options = planTypeOptions;
      }
      if (key === "extracted_data.fuel_type") {
        options = fuelTypeOptions;
      }
      if (key === "extracted_data.business_type") {
        options = businessTypeOptions;
      }

      const isLoading =
        (key === "admin_input.insurer_code" && insurersLoading) ||
        (key === "admin_input.broker_code" && brokersLoading) ||
        (key === "admin_input.agent_code" && agentsLoading) ||
        (key === "admin_input.admin_child_id" &&
          (adminChildIdsLoading || availableChildIdsLoading));

      if (key === "admin_input.admin_child_id") {
        const childIdState = getChildIdDisabledState();

        return (
          <div key={key} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label
                  htmlFor={key}
                  className="text-sm font-medium text-gray-700"
                >
                  {label}
                </Label>
                {childIdState.disabled && childIdState.tooltip && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-gray-400" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{childIdState.tooltip}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
              {renderTag(tag)}
            </div>
            <Controller
              name={key as any}
              control={control}
              render={({ field: controllerField, fieldState }) => (
                <>
                  <Select
                    onValueChange={controllerField.onChange}
                    value={(controllerField.value as string) ?? undefined}
                    disabled={disabled || childIdState.disabled}
                  >
                    <SelectTrigger className="h-10 w-fit">
                      <SelectValue
                        placeholder={
                          isLoading
                            ? "Loading..."
                            : childIdState.disabled
                            ? "Select dependencies first"
                            : `Select ${label}`
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {options.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldState.error && (
                    <p className="text-red-500 text-xs mt-1">
                      {fieldState.error.message}
                    </p>
                  )}
                </>
              )}
            />
          </div>
        );
      }

      return (
        <div key={key} className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor={key} className="text-sm font-medium text-gray-700">
              {label}
            </Label>
            {renderTag(tag)}
          </div>
          <Controller
            name={key as any}
            control={control}
            render={({ field: controllerField, fieldState }) => {
              let finalOptions = options;
              const allowCustomOptionKeys = [
                "extracted_data.product_type",
                "extracted_data.fuel_type",
              ];

              if (
                allowCustomOptionKeys.includes(key) &&
                controllerField.value &&
                !options.some(
                  (option) => option.value === controllerField.value
                )
              ) {
                finalOptions = [
                  ...options,
                  {
                    value: controllerField.value as string,
                    label: controllerField.value as string,
                  },
                ];
              }

              return (
                <>
                  <Select
                    onValueChange={controllerField.onChange}
                    value={(controllerField.value as string) ?? undefined}
                    disabled={disabled}
                  >
                    <SelectTrigger className="h-10 w-fit">
                      <SelectValue
                        placeholder={
                          isLoading ? "Loading..." : `Select ${label}`
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {finalOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldState.error && (
                    <p className="text-red-500 text-xs mt-1">
                      {fieldState.error.message}
                    </p>
                  )}
                </>
              );
            }}
          />
        </div>
      );
    };

    const renderTextareaField = () => (
      <div key={key} className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor={key} className="text-sm font-medium text-gray-700">
            {label}
          </Label>
          {renderTag(tag)}
        </div>
        <Controller
          name={key as any}
          control={control}
          render={({ field: controllerField, fieldState }) => (
            <>
              <Textarea
                id={key}
                {...controllerField}
                value={String(controllerField.value ?? "")}
                onChange={(e) => {
                  const value = e.target.value;
                  controllerField.onChange(value === "" ? null : value);
                }}
                disabled={disabled}
                rows={3}
                className="resize-none w-fit"
                placeholder={`Enter ${label.toLowerCase()}...`}
              />
              {fieldState.error && (
                <p className="text-sm text-red-500 mt-1">
                  {fieldState.error.message}
                </p>
              )}
            </>
          )}
        />
      </div>
    );

    const renderInputField = () => (
      <div key={key} className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor={key} className="text-sm font-medium text-gray-700">
            {label}
          </Label>
          {renderTag(tag)}
        </div>
        <Controller
          name={key as any}
          control={control}
          render={({ field: controllerField, fieldState }) => (
            <>
              <Input
                id={key}
                type={type === "number" ? "number" : "text"}
                {...controllerField}
                value={String(controllerField.value ?? "")}
                onChange={(e) => {
                  const value = e.target.value;
                  if (type === "number") {
                    const numValue = value === "" ? null : Number(value);
                    controllerField.onChange(numValue);
                  } else {
                    controllerField.onChange(value === "" ? null : value);
                  }
                }}
                onWheel={
                  type === "number"
                    ? numberInputOnWheelPreventChange
                    : undefined
                }
                disabled={disabled}
                className={`h-10 w-fit ${disabled ? "bg-gray-50" : ""}`}
                step={type === "number" ? "0.01" : undefined}
              />
              {fieldState.error && (
                <p className="text-sm text-red-500 mt-1">
                  {fieldState.error.message}
                </p>
              )}
            </>
          )}
        />
      </div>
    );

    if (type === "date") {
      return renderDateField();
    }

    if (type === "select") {
      return renderSelectField();
    }

    if (type === "textarea") {
      return renderTextareaField();
    }

    return renderInputField();
  };

  const onSubmit = async (data: CutPayFormSchemaType) => {
    setIsSubmitting(true);
    try {
      const payload = buildPayload(data, { insuranceCompany });
      await updateCutPayByPolicy.mutateAsync({
        params: {
          policy_number: policyNumber,
          quarter,
          year,
        },
        data: payload,
      });
      toast.success("Transaction updated successfully");
      router.push(
        `/admin/cutpay/${encodeURIComponent(
          policyNumber
        )}?q=${quarter}&y=${year}`
      );
    } catch (error) {
      console.error("Failed to update transaction", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to update transaction"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const onSubmitError = () => {
    toast.error("Please fix the form errors before submitting");
  };

  return (
    <div className="w-full">
      <form
        onSubmit={handleSubmit(onSubmit, onSubmitError)}
        className="space-y-6"
      >
        {/* Header section */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Edit Cutpay Transaction</h1>
            <p className="text-sm text-gray-500">
              Policy #{policyNumber} Q{quarter} {year}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="min-w-[140px]"
            >
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>

        {/* Main layout container */}
        <div className="space-y-6">
          {/* Row 1: Extracted Data and Document Viewer */}
          <div className="flex flex-wrap md:flex-nowrap gap-6">
            <div className="w-full md:w-1/2">
              <Card className="shadow-sm border border-l-6 border-blue-500 h-full">
                <CardHeader className="bg-gray-50 border-b">
                  <CardTitle className="text-lg text-gray-800 flex items-center gap-2">
                    <span className="h-2 w-2 bg-blue-500 rounded-full" />
                    Extracted Data
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="flex flex-wrap gap-4 items-start">
                    {formFields
                      .filter((f) => f.section === "extracted")
                      .map((field) => {
                        const renderedField = renderField(field);
                        if (!renderedField) return null;
                        return (
                          <div
                            key={field.key}
                            className="space-y-2 flex-none w-fit"
                          >
                            {renderedField}
                          </div>
                        );
                      })}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="w-full md:w-1/2">
              <DocumentViewer />
            </div>
          </div>

          {/* Logic-only component for calculations */}
          <Calculations control={control} setValue={setValue} />

          {/* Row 2: Admin Input and Calculations */}
          <div className="flex flex-wrap md:flex-nowrap gap-6">
            <div className="w-full md:w-1/2">
              <Card className="shadow-sm border border-l-6 border-green-500 h-full">
                <CardHeader className="bg-gray-50 border-b">
                  <CardTitle className="text-lg text-gray-800 flex items-center gap-2">
                    <span className="h-2 w-2 bg-green-500 rounded-full" />
                    Admin Input
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="flex flex-wrap gap-4 items-start">
                    {formFields
                      .filter(
                        (f) => f.section === "admin" && f.key !== "running_bal"
                      )
                      .map((field) => {
                        const renderedField = renderField(field);
                        if (!renderedField) return null;

                        if (
                          field.key === "admin_input.payment_by" &&
                          paymentBy === "InsureZeal"
                        ) {
                          return (
                            <Fragment key={field.key}>
                              <div className="space-y-2 flex-none w-fit">
                                {renderedField}
                              </div>
                              <div
                                className="space-y-2 flex-none w-fit"
                                key="cutpay_received_status_wrapper"
                              >
                                <Label className="text-sm font-medium text-gray-700">
                                  Cutpay Received Status
                                </Label>
                                <Controller
                                  name="cutpay_received_status"
                                  control={control}
                                  render={({
                                    field: controllerField,
                                    fieldState,
                                  }) => (
                                    <>
                                      <Select
                                        onValueChange={controllerField.onChange}
                                        value={
                                          (controllerField.value as string) ??
                                          undefined
                                        }
                                      >
                                        <SelectTrigger className="h-10 w-fit">
                                          <SelectValue placeholder="Select status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="No">No</SelectItem>
                                          <SelectItem value="Yes">
                                            Yes
                                          </SelectItem>
                                          <SelectItem value="Partial">
                                            Partial
                                          </SelectItem>
                                        </SelectContent>
                                      </Select>
                                      {fieldState.error && (
                                        <p className="text-red-500 text-xs mt-1">
                                          {fieldState.error.message}
                                        </p>
                                      )}
                                    </>
                                  )}
                                />
                              </div>
                              {(cutpayReceivedStatus === "Yes" ||
                                cutpayReceivedStatus === "Partial") && (
                                <div
                                  className="space-y-2 flex-none w-fit"
                                  key="cutpay_received_wrapper"
                                >
                                  <Label className="text-sm font-medium text-gray-700">
                                    Cutpay Received Amount
                                  </Label>
                                  <Controller
                                    name="cutpay_received"
                                    control={control}
                                    render={({
                                      field: controllerField,
                                      fieldState,
                                    }) => (
                                      <>
                                        <Input
                                          type="number"
                                          className="h-10 w-fit"
                                          {...controllerField}
                                          value={String(
                                            controllerField.value ?? ""
                                          )}
                                          onChange={(e) => {
                                            const value = e.target.value;
                                            const numValue =
                                              value === ""
                                                ? null
                                                : Number(value);
                                            controllerField.onChange(numValue);
                                          }}
                                          onWheel={
                                            numberInputOnWheelPreventChange
                                          }
                                          step="0.01"
                                          placeholder="Enter received amount"
                                        />
                                        {fieldState.error && (
                                          <p className="text-red-500 text-xs mt-1">
                                            {fieldState.error.message}
                                          </p>
                                        )}
                                      </>
                                    )}
                                  />
                                </div>
                              )}
                            </Fragment>
                          );
                        }

                        return (
                          <div
                            key={field.key}
                            className="space-y-2 flex-none w-fit"
                          >
                            {renderedField}
                          </div>
                        );
                      })}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="w-full md:w-1/2">
              <Card className="shadow-sm border border-l-6 border-purple-500 h-full">
                <CardHeader className="bg-gray-50 border-b">
                  <CardTitle className="text-lg text-gray-800 flex items-center gap-2">
                    <span className="h-2 w-2 bg-purple-500 rounded-full" />
                    Calculations
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="flex flex-wrap gap-4 items-start">
                    {formFields
                      .filter((f) => f.section === "calculation")
                      .map((field) => {
                        const renderedField = renderField(field);
                        if (!renderedField) return null;
                        return (
                          <div
                            key={field.key}
                            className="space-y-2 flex-none w-fit"
                          >
                            {renderedField}
                          </div>
                        );
                      })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

export default EditForm;
