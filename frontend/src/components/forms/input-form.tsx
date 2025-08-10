/* eslint-disable @typescript-eslint/no-explicit-any */
import { zodResolver } from "@hookform/resolvers/zod";
import { useAtom } from "jotai";
import { useMemo, useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { openDB } from "idb";
import { motion, AnimatePresence } from "framer-motion";
import {
  pdfExtractionDataAtom,
  createdCutpayTransactionAtom,
  cutpayCalculationResultAtom,
} from "@/lib/atoms/cutpay";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MonthYearPicker } from "@/components/ui/month-year-picker";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingDialog } from "@/components/ui/loading-dialog";
import { useAgentList } from "@/hooks/adminQuery";
import { useCreateCutPay, useUploadCutPayDocument, useUpdateCutPay } from "@/hooks/cutpayQuery";
import { useSubmitPolicy, useChildIdOptions } from "@/hooks/policyQuery";
import { useInsurers, useBrokersAndInsurers } from "@/hooks/agentQuery";
import { useProfile } from "@/hooks/profileQuery";
import {
  useBrokerList,
  useInsurerList,
  useAdminChildIdList,
  useAvailableAdminChildIds,
} from "@/hooks/superadminQuery";
import { AgentSummary } from "@/types/admin.types";
import { clearAllFromIndexedDB } from "@/lib/utils/indexeddb";
import { CreateCutpayTransactionCutpayPostRequest } from "@/types/cutpay.types";
import { SubmitPolicyPayload, ChildIdOption } from "@/types/policy.types";
import { Insurer, Broker, AdminChildId } from "@/types/superadmin.types";
import { CutPayFormSchema, CutPayFormSchemaType } from "../admin/cutpay/form-schema";
import { formFields, FormFieldConfig, FormFieldPath } from "../admin/cutpay/form-config";
import Calculations from "../admin/cutpay/calculations";
import { Loader2 } from "lucide-react";
import DocumentViewer from "@/components/forms/documentviewer";

// Props interface for the InputForm component (supports both cutpay and policy modes)
interface InputFormProps {
  onPrev: () => void; // Function to go to the previous step
  formType: 'cutpay' | 'policy'; // Type of form to render (required)
  editId?: number; // Optional ID for edit mode
}

const InputForm: React.FC<InputFormProps> = ({
  onPrev,
  formType, // Now required parameter
  editId, // Optional ID for edit mode
}) => {
  const router = useRouter();
  // State for document viewer visibility is now managed locally
  const [isViewerOpen, setIsViewerOpen] = useState(true);
  // Global state management using Jotai atoms
  const [pdfExtractionData] = useAtom(pdfExtractionDataAtom); // Data extracted from PDF
  const [calculationResult] = useAtom(cutpayCalculationResultAtom); // Results from calculation step
  const [, setCreatedTransaction] = useAtom(createdCutpayTransactionAtom); // To store the newly created transaction
  const [isSubmitting, setIsSubmitting] = useState(false); // Tracks form submission state
  // State for tracking the progress of the submission process
  const [submissionSteps, setSubmissionSteps] = useState<
    {
      id: string;
      label: string;
      status: "pending" | "active" | "completed" | "failed";
    }[]
  >([
    {
      id: "create-transaction",
      label: "Creating transaction...",
      status: "pending",
    },
    {
      id: "upload-policy",
      label: "Uploading policy PDF...",
      status: "pending",
    },
    {
      id: "upload-additional",
      label: "Uploading additional documents...",
      status: "pending",
    },
    {
      id: "cleanup-redirect",
      label: "Cleaning up and redirecting...",
      status: "pending",
    },
  ]);
  const createCutPayMutation = useCreateCutPay();
  const uploadDocumentMutation = useUploadCutPayDocument();
  const submitPolicyMutation = useSubmitPolicy();
  const updateCutPayMutation = useUpdateCutPay();

  const { data: userProfile } = useProfile();

  // State for child ID auto-fill functionality in policy mode
  const [selectedChildIdDetails, setSelectedChildIdDetails] = useState<AdminChildId | ChildIdOption | null>(null);
  
  // State to store original running balance before calculations
  const [originalRunningBalance, setOriginalRunningBalance] = useState<number>(0);

  // React Hook Form setup for form state management and validation
  // Note: Currently uses CutPayFormSchema for both cutpay and policy modes
  // TODO: Consider creating a policy-specific schema for stricter validation in policy mode
  const { control, handleSubmit, setValue, watch, reset } =
    useForm<CutPayFormSchemaType>({
      resolver: zodResolver(CutPayFormSchema),
      defaultValues: {
        policy_pdf_url: "",
        additional_documents: {},
        extracted_data: {},
        admin_input: {
          od_agent_payout_percent: null,
          tp_agent_payout_percent: null,
          od_incoming_grid_percent: null,
          tp_incoming_grid_percent: null,
        },
        calculations: {},
        cutpay_received_status: null,
        cutpay_received: null,
      },
    });

  // Watch for changes in specific form fields to trigger side effects
  const paymentBy = watch("admin_input.payment_by");
  const grossPremium = watch("extracted_data.gross_premium");
  const registrationNo = watch("extracted_data.registration_number");
  const majorCategorisation = watch("extracted_data.major_categorisation");
  const planType = watch("extracted_data.plan_type");
  const runningBalValue = watch("running_bal");
  const childIdValue = watch("admin_input.admin_child_id");
  const cutpayReceivedStatus = watch("cutpay_received_status");
  const cutPayAmount = watch("calculations.cut_pay_amount");
  const codeType = watch("admin_input.code_type");
  const insurerCode = watch("admin_input.insurer_code");
  const brokerCode = watch("admin_input.broker_code");
  
  // Additional watches for policy form calculations
  const netPremium = watch("extracted_data.net_premium");
  const agentCommissionPercent = watch("admin_input.agent_commission_given_percent");


  // Get form fields - using cutpay fields for both modes (cutpay form is working perfectly)
  const currentFormFields = formFields;

  // Effect to reset submission state when the component mounts
  useEffect(() => {
    if (formType === 'policy') {
      setSubmissionSteps([
        {
          id: "create-policy",
          label: "Creating policy transaction",
          status: "pending",
        },
        {
          id: "upload-policy",
          label: "Uploading policy document",
          status: "pending",
        },
        {
          id: "upload-additional",
          label: "Uploading additional documents",
          status: "pending",
        },
        {
          id: "cleanup-redirect",
          label: "Cleaning up and redirecting",
          status: "pending",
        },
      ]);
    } else {
      setSubmissionSteps([
        {
          id: "create-transaction",
          label: "Creating cutpay transaction",
          status: "pending",
        },
        {
          id: "upload-policy",
          label: "Uploading policy document",
          status: "pending",
        },
        {
          id: "upload-additional",
          label: "Uploading additional documents",
          status: "pending",
        },
        {
          id: "cleanup-redirect",
          label: "Cleaning up and redirecting",
          status: "pending",
        },
      ]);
    }
    setIsSubmitting(false);
  }, [formType]);

  // Effect to auto-calculate 'payment_by_office' based on 'payment_by' and 'gross_premium'
  // Also manage payment source visibility
  useEffect(() => {
    if (paymentBy === "InsureZeal" && grossPremium) {
      // If payment is by office, set payment_by_office to the gross premium
      setValue("admin_input.payment_by_office", grossPremium, {
        shouldValidate: true,
      });
    } else if (paymentBy === "Agent") {
      // If payment is by agent, set payment_by_office to zero
      setValue("admin_input.payment_by_office", 0, { shouldValidate: true });
    }
  }, [paymentBy, grossPremium, setValue]);

  // Effect to populate the form with data extracted from the PDF.
  // This effect ONLY populates data; it does not contain business logic.
  useEffect(() => {
    if (pdfExtractionData?.extracted_data) {
      Object.entries(pdfExtractionData.extracted_data).forEach(
        ([key, value]) => {
          const formKey = `extracted_data.${key}` as FormFieldPath;
          // The `any` cast is used here because `setValue` is strictly typed,
          // but we are dynamically setting values from an object.
          
          setValue(formKey as any, value as any, { shouldValidate: true });
        }
      );
    }
  }, [pdfExtractionData, setValue]);

  // Auto-fill plan type based on PDF extraction data
  useEffect(() => {
    if (pdfExtractionData?.extracted_data?.plan_type) {
      const extractedPlanType = pdfExtractionData.extracted_data.plan_type;
      
      // Only auto-fill if the current value is empty
      if (!planType) {
        setValue("extracted_data.plan_type", extractedPlanType, {
          shouldValidate: true,
        });
      }
    }
  }, [pdfExtractionData?.extracted_data?.plan_type, planType, setValue]);

  // Auto-populate cutpay_received based on cutpay_received_status
  useEffect(() => {
    if (cutpayReceivedStatus === "No") {
      // Set cutpay_received to 0 when status is "No"
      setValue("cutpay_received", 0, { shouldValidate: true });
    } else if (cutpayReceivedStatus === "Yes" && cutPayAmount) {
      // Pre-fill with calculated cutpay amount when status is "Yes"
      setValue("cutpay_received", cutPayAmount, { shouldValidate: true });
    } else if (cutpayReceivedStatus === "Partial" && cutPayAmount) {
      // Pre-fill with calculated cutpay amount when status is "Partial" (user can edit)
      setValue("cutpay_received", cutPayAmount, { shouldValidate: true });
    } else if (!cutpayReceivedStatus) {
      // Clear cutpay_received when no status is selected
      setValue("cutpay_received", null, { shouldValidate: true });
    }
  }, [cutpayReceivedStatus, cutPayAmount, setValue]);

  // This is the single source of truth for the relationship between
  // registration number and major categorisation. It runs whenever
  // registrationNo changes, from any source (PDF load or manual input).
  useEffect(() => {
    const hasRegNo = registrationNo && String(registrationNo).trim() !== "";

    if (hasRegNo) {
      // If a registration number exists and the category isn't 'Motor', set it.
      if (majorCategorisation !== "Motor") {
        setValue("extracted_data.major_categorisation", "Motor", {
          shouldValidate: true,
        });
      }
    } else {
      // If no registration number exists and the category was 'Motor', clear it.
      // This avoids clearing a user's manual selection of 'Health' or 'Life'.
      if (majorCategorisation === "Motor") {
        setValue("extracted_data.major_categorisation", null, {
          shouldValidate: true,
        });
      }
    }
  }, [registrationNo, majorCategorisation, setValue]);

  // Fetching data for select dropdowns using custom React Query hooks
  const { data: insurers, isLoading: insurersLoading } = useInsurerList();
  const { data: brokers, isLoading: brokersLoading } = useBrokerList();
  const { data: agents, isLoading: agentsLoading } = useAgentList();
  const { data: adminChildIds, isLoading: adminChildIdsLoading } = useAdminChildIdList();
  
  // Fetching data for broker/insurer selection in policy forms
  const { data: directInsurers, isLoading: directInsurersLoading } = useInsurers();
  const { data: brokersAndInsurers, isLoading: brokersAndInsurersLoading } = useBrokersAndInsurers();

  // Policy-specific child IDs hook - use the correct policy API with required parameters
  const { data: policyChildIds, isLoading: policyChildIdsLoading } = useChildIdOptions(
    formType === 'policy' && insurerCode 
      ? {
          insurer_code: insurerCode,
          ...(codeType === 'Broker' && brokerCode && { broker_code: brokerCode }),
        }
      : undefined
  );

  // Dependent child IDs for cutpay forms based on insurer/broker selection
  const { data: availableChildIds, isLoading: availableChildIdsLoading } = useAvailableAdminChildIds({
    insurer_code: insurerCode || '',
    broker_code: codeType === 'Broker' ? brokerCode || '' : undefined,
  });

  // Auto-fill Insurance Company and Broker Name when Child ID is selected in policy mode
  useEffect(() => {
    if (childIdValue) {
      if (formType === 'policy' && policyChildIds) {
        // Handle policy child IDs (for agents)
        const selectedChildId = policyChildIds.find(child => child.child_id === childIdValue);
        if (selectedChildId) {
          setSelectedChildIdDetails(selectedChildId);
          // For policy forms, just store the selected child details for payload
          // Don't auto-fill or preserve any other fields - let user change them freely
        }
      } else if (formType === 'cutpay' && adminChildIds) {
        // Handle admin child IDs (for cutpay)
        const selectedChildId = adminChildIds.find(child => child.child_id === childIdValue);
        if (selectedChildId) {
          setSelectedChildIdDetails(selectedChildId);
          // Auto-fill Insurance Company (readonly)
          setValue("admin_input.insurer_code", selectedChildId.insurer.insurer_code, {
            shouldValidate: true,
          });
          // Auto-fill Broker Name (readonly) if available
          if (selectedChildId.broker?.broker_code) {
            setValue("admin_input.broker_code", selectedChildId.broker.broker_code, {
              shouldValidate: true,
            });
          } else {
            setValue("admin_input.broker_code", null, {
              shouldValidate: true,
            });
          }
        }
      }
    }
  }, [formType, childIdValue, adminChildIds, policyChildIds, setValue, setSelectedChildIdDetails]);

  // Clear child ID when dependencies change (for dependent dropdown functionality)
  useEffect(() => {
    if (formType === 'cutpay') {
      // Clear child ID when code type, insurer, or broker changes
      setValue('admin_input.admin_child_id', null, { shouldValidate: true });
    }
    // For policy forms, we don't clear child ID when dependencies change
    // User can freely change any field without restrictions
  }, [codeType, insurerCode, brokerCode, formType, setValue]);

  // Auto-populate policy start and end dates for policy form
  useEffect(() => {
    if (formType === 'policy') {
      // Set start date to today if not already set
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      setValue("start_date" as any, today, { shouldValidate: true });
      
      // Set end date to one year from today
      const endDateObj = new Date();
      endDateObj.setFullYear(endDateObj.getFullYear() + 1);
      const formattedEndDate = endDateObj.toISOString().split('T')[0]; // YYYY-MM-DD format
      setValue("end_date" as any, formattedEndDate, { shouldValidate: true });
    }
  }, [formType, setValue]); // Only run once when form loads

  // Update running balance for policy form when Payment by InsureZeal is selected
  useEffect(() => {
    if (formType === 'policy' && paymentBy === "InsureZeal") {
      // Calculate the new running balance based on the formula
      const totalAgentPayout = (netPremium || 0) * ((agentCommissionPercent || 0) / 100);
      const grossPremiumVal = grossPremium || 0;
      const calculatedAmount = totalAgentPayout - grossPremiumVal;
      
      // Get current running balance from form or use original balance
      const currentRunningBalance = originalRunningBalance || 0;
      const newRunningBalance = calculatedAmount + currentRunningBalance;
      
      // Update the running balance field
      setValue("running_bal", newRunningBalance, { shouldValidate: true });
    }
  }, [formType, paymentBy, netPremium, agentCommissionPercent, grossPremium, originalRunningBalance, setValue]);

  // Initialize original running balance when form loads
  useEffect(() => {
    if (formType === 'policy' && !originalRunningBalance) {
      // Set initial original balance from current form value or 0
      setOriginalRunningBalance(runningBalValue || 0);
    }
  }, [formType, originalRunningBalance, runningBalValue]);

  // Memoizing select options to prevent re-computation on every render
  const insurerOptions = useMemo(
    () =>
      insurers
        ?.map((i: Insurer) => ({
          value: i.insurer_code,
          label: i.name,
        }))
        .filter((option) => option.value && option.value.trim() !== "") || [],
    [insurers]
  );
  const brokerOptions = useMemo(
    () =>
      brokers
        ?.map((b: Broker) => ({ value: b.broker_code, label: b.name }))
        .filter((option) => option.value && option.value.trim() !== "") || [],
    [brokers]
  );
  const agentOptions = useMemo(
    () =>
      agents?.agents
        ?.map((a: AgentSummary) => ({
          value: a.agent_code ?? "",
          label: `${a.first_name} ${a.last_name}`,
        }))
        .filter((option) => option.value && option.value.trim() !== "") || [],
    [agents]
  );
  // Dynamic child ID options based on form type and dependent selections
  const adminChildIdOptions = useMemo(() => {
    if (formType === 'cutpay') {
      // Use dependent child IDs when code type, insurer, and broker are selected
      if (codeType && insurerCode && (codeType === 'Direct' || brokerCode)) {
        return availableChildIds
          ?.map((c: AdminChildId) => ({
            value: c.child_id,
            label: `${c.child_id} - ${c.manager_name}`,
          }))
          .filter((option) => option.value && option.value.trim() !== "") || [];
      }
      // Fallback to all admin child IDs if dependencies not met
      return adminChildIds
        ?.map((a: AdminChildId) => ({
          value: a.child_id,
          label: `${a.child_id} - ${a.manager_name}`,
        }))
        .filter((option) => option.value && option.value.trim() !== "") || [];
    }
    return [];
  }, [formType, codeType, insurerCode, brokerCode, availableChildIds, adminChildIds]);

  // Policy-specific child ID options for agents
  const policyChildIdOptions = useMemo(
    () =>
      policyChildIds
        ?.map((c: ChildIdOption) => ({
          value: c.child_id,
          label: `${c.child_id} - ${c.broker_name} (${c.insurance_company})`,
        }))
        .filter((option) => option.value && option.value.trim() !== "") || [],
    [policyChildIds]
  );

  // Policy-specific insurer and broker options
  const policyInsurerOptions = useMemo(() => {
    if (formType !== 'policy') return [];
    
    const sourceInsurers = codeType === 'Broker' 
      ? brokersAndInsurers?.insurers 
      : directInsurers;
    
    return sourceInsurers?.map((insurer) => ({
      value: insurer.insurer_code,
      label: `${insurer.name} (${insurer.insurer_code})`,
    })) || [];
  }, [formType, codeType, directInsurers, brokersAndInsurers]);

  const policyBrokerOptions = useMemo(() => {
    if (formType !== 'policy' || codeType !== 'Broker') return [];
    
    return brokersAndInsurers?.brokers?.map((broker) => ({
      value: broker.broker_code,
      label: `${broker.name} (${broker.broker_code})`,
    })) || [];
  }, [formType, codeType, brokersAndInsurers]);

  // Memoizing static select options
  const codeTypeOptions = useMemo(
    () => ["Direct", "Broker"].map((o) => ({ value: o, label: o })),
    []
  );
  // paymentByOptions is now dynamically generated in the renderField function
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
  const cutpayReceivedOptions = useMemo(
    () => ["Yes", "No", "Partial"].map((o) => ({ value: o, label: o })),
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
    { value: "SAOD", label: "SAOD" }
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
    () => ["Brand New", "Roll Over" , "Renewable"].map((o) => ({ value: o, label: o })),
    []
  );

  // Helper function to update the status of a submission step
  const updateStepStatus = (
    stepId: string,
    status: "pending" | "active" | "completed" | "failed"
  ) => {
    setSubmissionSteps((prev) =>
      prev.map((step) => (step.id === stepId ? { ...step, status } : step))
    );
  };

  /**
   * Checks if a document exists in IndexedDB.
   * @param documentKey - The key of the document to check (e.g., 'policy_pdf').
   * @returns A promise that resolves to true if the document exists, false otherwise.
   */
  const documentExistsInDB = async (documentKey: string): Promise<boolean> => {
    const file = await getFileFromIndexedDB(documentKey);
    return file !== null;
  };

  /**
   * Gets a summary of all available documents in IndexedDB.
   * @returns A promise that resolves to an object mapping document keys to their existence status.
   */
  const getAllAvailableDocuments = async (): Promise<
    Record<string, boolean>
  > => {
    const documentKeys = [
      "policy_pdf",
      "kyc_documents",
      "rc_document",
      "previous_policy",
    ];
    const availability: Record<string, boolean> = {};

    // Check each document key for its existence in the database
    for (const key of documentKeys) {
      availability[key] = await documentExistsInDB(key);
    }

    return availability;
  };

  /**
   * Validates which documents are available for upload from IndexedDB.
   * @returns A promise that resolves to a summary of document availability.
   */
  const validateDocumentsForUpload = async (): Promise<{
    hasDocuments: boolean;
    available: string[];
    missing: string[];
    summary: Record<string, boolean>;
  }> => {
    console.log("🔍 Validating documents for upload...");

    const summary = await getAllAvailableDocuments();
    const available = Object.entries(summary)
      .filter(([, exists]) => exists)
      .map(([key]) => key);
    const missing = Object.entries(summary)
      .filter(([, exists]) => !exists)
      .map(([key]) => key);

    const hasDocuments = available.length > 0;

    console.log("📋 Document validation results:", {
      hasDocuments,
      available: available.length,
      missing: missing.length,
      details: summary,
    });

    return { hasDocuments, available, missing, summary };
  };

  const getFileFromIndexedDB = async (
    documentKey: string
  ): Promise<File | null> => {
    console.log(`🔍 Retrieving ${documentKey} from IndexedDB using idb...`);

    // List of possible database and store names to check for compatibility
    const possibleDbs = [
      { name: "CutPayDB", storeName: "documents" },
      { name: "DocumentsDB", storeName: "documents" },
      { name: "cutpay-documents", storeName: "files" },
      { name: "fileStorage", storeName: "documents" },
    ];

    // Try to retrieve the file from each possible database/store combination
    for (const { name: dbName, storeName } of possibleDbs) {
      try {
        console.log(`🔍 Trying ${dbName}/${storeName}...`);

        // Open the database without a version to get the latest version
        const db = await openDB(dbName);

        // Check if the object store exists in the database
        if (!db.objectStoreNames.contains(storeName)) {
          console.log(`⚠️ Store ${storeName} not found in ${dbName}`);
          db.close();
          continue;
        }

        const tx = db.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);
        const result = await store.get(documentKey);

        db.close();

        if (result) {
          // Handle different possible data structures for backward compatibility
          let fileData: {
            name: string;
            type: string;
            content: ArrayBuffer | File;
          };

          if (result.content instanceof ArrayBuffer) {
            // Handle old format where content is an ArrayBuffer
            fileData = {
              name: result.name,
              type: result.type,
              content: result.content,
            };
          } else if (result.content instanceof File) {
            // Handle new format where content is already a File object
            fileData = {
              name: result.name,
              type: result.type,
              content: result.content,
            };
          } else {
            console.log(
              `⚠️ Unexpected content type for ${documentKey} in ${dbName}/${storeName}`
            );
            continue;
          }

          // Reconstruct the File object to ensure it's valid
          let file: File;
          if (fileData.content instanceof File) {
            file = fileData.content;
          } else {
            file = new File([fileData.content], fileData.name, {
              type: fileData.type,
              lastModified: Date.now(),
            });
          }

          console.log(
            `✅ Found ${documentKey} in ${dbName}: ${file.name} (${file.size} bytes)`
          );
          return file;
        } else {
          console.log(
            `⚠️ No content for ${documentKey} in ${dbName}/${storeName}`
          );
        }
      } catch (error) {
        console.log(
          `⚠️ Cannot access ${dbName}:`,
          error instanceof Error ? error.message : "Unknown error"
        );
      }
    }

    console.log(`❌ ${documentKey} not found in any database`);
    return null;
  };

  /**
   * Uploads the main policy document to the server.
   * @param cutpayId - The ID of the created cutpay transaction.
   * @returns A promise that resolves to true on success or if no file is found, false on failure.
   */
  const uploadPolicyDocument = async (cutpayId: number): Promise<boolean> => {
    console.log(" Starting policy document upload...");
    updateStepStatus("upload-policy", "active");

    try {
      const policyFile = await getFileFromIndexedDB("policy_pdf");

      if (!policyFile) {
        console.log("⚠️ No policy PDF found in IndexedDB, skipping...");
        updateStepStatus("upload-policy", "completed");
        return true; // Considered a success as it's not a failure state
      }

      console.log(
        `⬆️ Uploading policy PDF: ${policyFile.name} (${policyFile.size} bytes)`
      );
      // Use the mutation to upload the file
      const uploadResult = await uploadDocumentMutation.mutateAsync({
        cutpayId,
        file: policyFile,
        documentType: "policy_pdf",
      });

      console.log("✅ Policy PDF uploaded successfully:", uploadResult);
      updateStepStatus("upload-policy", "completed");
      return true;
    } catch (error) {
      console.error("❌ Policy PDF upload failed:", error);
      updateStepStatus("upload-policy", "failed");
      return false;
    }
  };

  /**
   * Uploads additional supporting documents (KYC, RC, etc.) to the server.
   * @param cutpayId - The ID of the created cutpay transaction.
   * @returns A promise that resolves to an object summarizing the upload results.
   */
  const uploadAdditionalDocuments = async (
    cutpayId: number
  ): Promise<{
    uploaded: number;
    failed: number;
    success: boolean;
  }> => {
    console.log("� Starting additional documents upload...");
    updateStepStatus("upload-additional", "active");

    const documentTypes = [
      { key: "kyc_documents", type: "kyc_documents", name: "KYC Documents" },
      { key: "rc_document", type: "rc_document", name: "RC Document" },
      {
        key: "previous_policy",
        type: "previous_policy",
        name: "Previous Policy",
      },
    ];

    let uploaded = 0;
    let failed = 0;

    // Loop through each document type and attempt to upload
    for (const { key, type, name } of documentTypes) {
      try {
        console.log(`🔍 Processing ${name}...`);
        const file = await getFileFromIndexedDB(key);

        if (!file) {
          console.log(`⚠️ No ${name} found, skipping...`);
          continue;
        }

        console.log(`⬆️ Uploading ${name}: ${file.name} (${file.size} bytes)`);
        const uploadResult = await uploadDocumentMutation.mutateAsync({
          cutpayId,
          file,
          documentType: type,
        });

        console.log(`✅ ${name} uploaded successfully:`, uploadResult);
        uploaded++;
      } catch (error) {
        console.error(`❌ ${name} upload failed:`, error);
        failed++;
      }
    }

    const success = uploaded > 0 || failed === 0;
    updateStepStatus("upload-additional", success ? "completed" : "failed");

    console.log(
      `📊 Additional documents summary: ${uploaded} uploaded, ${failed} failed`
    );
    return { uploaded, failed, success };
  };

  /**
   * Orchestrates the entire document upload process, including validation and individual uploads.
   * @param cutpayId - The ID of the created cutpay transaction.
   */
  const uploadDocuments = async (cutpayId: number) => {
    console.log("🚀 Starting document upload process for cutpayId:", cutpayId);

    try {
      // First, validate which documents are available to upload
      const validation = await validateDocumentsForUpload();

      if (!validation.hasDocuments) {
        console.log(
          "⚠️ No documents found in IndexedDB, completing upload as success"
        );
        updateStepStatus("upload-policy", "completed");
        updateStepStatus("upload-additional", "completed");
        return;
      }

      console.log(
        `📋 Found ${
          validation.available.length
        } documents to upload: ${validation.available.join(", ")}`
      );

      // Attempt to upload the policy document
      const policySuccess = await uploadPolicyDocument(cutpayId);

      // Attempt to upload all other additional documents
      const additionalResults = await uploadAdditionalDocuments(cutpayId);

      // Determine the overall success of the upload process
      const overallSuccess = policySuccess && additionalResults.success;

      if (overallSuccess) {
        console.log("🎉 All document uploads completed successfully");
      } else if (policySuccess || additionalResults.uploaded > 0) {
        console.log("⚠️ Some documents uploaded successfully, but some failed");
        throw new Error("Some documents failed to upload");
      } else {
        console.log("❌ All document uploads failed");
        throw new Error("All document uploads failed");
      }
    } catch (error) {
      console.error("❌ Document upload process failed:", error);
      throw error; // Re-throw to be caught by the main onSubmit handler
    }
  };

  /**
   * Handles the form submission process.
   * This function orchestrates creating the transaction, uploading documents,
   * cleaning up local storage, and redirecting the user.
   * @param data - The validated form data.
   */
  const onSubmit = async (data: CutPayFormSchemaType) => {
    console.log("Form submission started", data);
    setIsSubmitting(true);

    // Reset all submission steps to 'pending'
    setSubmissionSteps((prev) =>
      prev.map((step) => ({ ...step, status: "pending" as const }))
    );

    try {
      if (formType === 'policy') {
        // Handle policy submission
        updateStepStatus("create-policy", "active");

        // Calculate simple agent payout for policy (for display purposes)
        const netPremium = data.extracted_data?.net_premium || 0;
        const agentCommission = data.admin_input?.agent_commission_given_percent || 0;
        const totalAgentPayoutAmount = netPremium * (agentCommission / 100);
        console.log("Policy mode - Agent payout amount:", totalAgentPayoutAmount);

        // Construct the comprehensive policy payload
        const policyPayload: SubmitPolicyPayload = {
          // Required fields
          policy_number: data.extracted_data?.policy_number || "",
          policy_type: data.extracted_data?.plan_type || "",
          pdf_file_name: data.policy_pdf_url ? `policy_${data.extracted_data?.policy_number || Date.now()}.pdf` : `policy_${Date.now()}.pdf`,
          pdf_file_path: data.policy_pdf_url || `uploads/policies/policy_${Date.now()}.pdf`,
          
          // Agent and Child ID information
          // For agents, use their user_id from profile; for admins, use selected agent
          agent_id: formType === 'policy' && userProfile?.user_id ? userProfile.user_id : 
                   (agents?.agents?.find(a => a.agent_code === data.admin_input?.agent_code)?.id || ""),
          agent_code: formType === 'policy' && userProfile?.agent_code ? userProfile.agent_code : 
                     (data.admin_input?.agent_code || ""),
          child_id: data.admin_input?.admin_child_id || "",
          broker_name: selectedChildIdDetails ? 
            ('broker' in selectedChildIdDetails ? selectedChildIdDetails.broker?.name || "" : selectedChildIdDetails.broker_name) : "",
          insurance_company: selectedChildIdDetails ? 
            ('insurer' in selectedChildIdDetails ? selectedChildIdDetails.insurer?.name || "" : selectedChildIdDetails.insurance_company) : "",
          
          // Policy details from PDF extraction - use empty strings instead of undefined for string fields
          formatted_policy_number: data.extracted_data?.formatted_policy_number || "",
          major_categorisation: data.extracted_data?.major_categorisation || "",
          product_insurer_report: data.extracted_data?.product_insurer_report || "",
          product_type: data.extracted_data?.product_type || "",
          plan_type: data.extracted_data?.plan_type || "",
          customer_name: data.extracted_data?.customer_name || "",
          customer_phone_number: data.extracted_data?.customer_phone_number || "",
          insurance_type: data.extracted_data?.major_categorisation || "",
          vehicle_type: data.extracted_data?.product_insurer_report || "",
          registration_number: data.extracted_data?.registration_number || "",
          vehicle_class: data.extracted_data?.make_model || "",
          vehicle_segment: data.extracted_data?.product_type || "",
          make_model: data.extracted_data?.make_model || "",
          model: data.extracted_data?.model || "",
          vehicle_variant: data.extracted_data?.vehicle_variant || "",
          gvw: data.extracted_data?.gvw || 0,
          rto: data.extracted_data?.rto || "",
          state: data.extracted_data?.state || "",
          fuel_type: data.extracted_data?.fuel_type || "",
          cc: data.extracted_data?.cc || 0,
          age_year: data.extracted_data?.age_year || 0,
          ncb: data.extracted_data?.ncb || "",
          discount_percent: data.extracted_data?.discount_percent || 0,
          business_type: data.extracted_data?.business_type || "",
          seating_capacity: data.extracted_data?.seating_capacity || 0,
          veh_wheels: data.extracted_data?.veh_wheels || 0,
          is_private_car: data.extracted_data?.major_categorisation?.toLowerCase().includes('private') || false,
          
          // Premium information - use actual values instead of undefined
          gross_premium: grossPremium || 0,
          gst: data.extracted_data?.gst_amount || 0,
          gst_amount: data.extracted_data?.gst_amount || 0,
          net_premium: data.extracted_data?.net_premium || 0,
          od_premium: data.extracted_data?.od_premium || 0,
          tp_premium: data.extracted_data?.tp_premium || 0,
          
          // Agent commission and payout - use actual values
          agent_commission_given_percent: agentCommission || 0,
          payment_by_office: data.admin_input?.payment_by_office || 0,
          total_agent_payout_amount: totalAgentPayoutAmount || 0,
          
          // Additional fields - use form values for policy-specific fields  
          code_type: data.admin_input?.code_type || "",
          payment_by: data.admin_input?.payment_by || "",
          payment_method: data.admin_input?.payment_method && data.admin_input.payment_detail 
            ? `${data.admin_input.payment_method} - ${data.admin_input.payment_detail}`
            : data.admin_input.payment_method || "",
          cluster: (data as any).cluster || "", // Policy-specific field
          notes: data.notes || "",
          start_date: (data as any).start_date || data.admin_input?.booking_date || new Date().toISOString().split('T')[0], // Form input or booking date or current date
          end_date: (data as any).end_date || 
            ((data as any).start_date 
              ? new Date(new Date((data as any).start_date).getTime() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
              : data.admin_input?.booking_date 
                ? new Date(new Date(data.admin_input.booking_date).getTime() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]), // Form input or calculated from start_date or booking_date
          ai_confidence_score: Object.values(pdfExtractionData?.confidence_scores || {}).reduce((a, b) => a + b, 0) / Object.keys(pdfExtractionData?.confidence_scores || {}).length || 0,
          manual_override: false,
        };

        console.log("=== Policy Submission Debug Info ===");
        console.log("Form Data:", data);
        console.log("Selected Child ID Details:", selectedChildIdDetails);
        console.log("Agent Commission:", agentCommission);
        console.log("Total Agent Payout:", totalAgentPayoutAmount);
        console.log("Raw policy payload:", policyPayload);
        console.log("====================================");

        // Clean up empty strings to null for API compatibility (only for optional fields)
        const cleanPayload = Object.fromEntries(
          Object.entries(policyPayload)
            .map(([key, value]) => {
              // Keep required fields even if empty
              const requiredFields = ['policy_number', 'policy_type', 'pdf_file_path', 'pdf_file_name'];
              if (requiredFields.includes(key)) {
                return [key, value];
              }
              // For optional fields, convert empty strings to null, but keep 0 values
              return [key, value === "" ? null : value];
            })
            .filter(([, value]) => value !== undefined) // Remove undefined values completely
        ) as SubmitPolicyPayload;

        console.log("=== Cleaned Payload Debug ===");
        console.log("Cleaned policy payload:", cleanPayload);
        console.log("Payload size (JSON):", JSON.stringify(cleanPayload).length, "characters");
        console.log("JSON stringified payload:", JSON.stringify(cleanPayload, null, 2));
        console.log("============================");

        // Validate required fields before submission
        if (!policyPayload.policy_number) {
          throw new Error("Policy number is required");
        }
        if (!policyPayload.policy_type) {
          throw new Error("Policy type is required");
        }
        if (!policyPayload.pdf_file_path) {
          throw new Error("PDF file path is required");
        }
        if (!policyPayload.pdf_file_name) {
          throw new Error("PDF file name is required");
        }

        // Additional validation for better API compatibility
        if (!policyPayload.agent_code) {
          throw new Error("Agent code is required for policy submission");
        }
        if (!policyPayload.child_id) {
          throw new Error("Child ID is required for policy submission");
        }

        console.log("Sending final payload to API:", cleanPayload);
        await submitPolicyMutation.mutateAsync(cleanPayload);
        updateStepStatus("create-policy", "completed");

        // Handle document uploads
        try {
          // For policy, we can skip document uploads or implement simpler version
          updateStepStatus("upload-policy", "completed");
          updateStepStatus("upload-additional", "completed");
          
          toast.success("🎉 Policy created successfully!");
        } catch (uploadError) {
          console.error("Policy document upload error:", uploadError);
          toast.warning("⚠️ Policy created successfully, but documents could not be uploaded.");
        }

        // Clean up and redirect
        updateStepStatus("cleanup-redirect", "active");
        try {
          console.log("🧹 Cleaning up IndexedDB documents...");
          await clearAllFromIndexedDB();
          console.log("✅ IndexedDB cleanup completed");
          updateStepStatus("cleanup-redirect", "completed");

          await new Promise((resolve) => setTimeout(resolve, 1000));
          console.log("🔄 Redirecting to policies list...");
          router.push("/agent/policies");
        } catch (cleanupError) {
          console.error("❌ Cleanup error:", cleanupError);
          updateStepStatus("cleanup-redirect", "failed");
          router.push("/agent/policies");
        }

      } else {
        // Handle cutpay submission (existing logic)
        updateStepStatus("create-transaction", "active");

        // Construct the payload for the API, ensuring it matches the required interface
        const payload: CreateCutpayTransactionCutpayPostRequest = {
          // Follow the exact interface order
          policy_pdf_url: "hardcoded_policy_pdf_url", // Placeholder, actual URL is set by backend
          additional_documents: {}, // Placeholder, handled by separate uploads
          extracted_data: {
            // Start with PDF extracted data
            ...(pdfExtractionData?.extracted_data || {}),
            // Override with form data (user inputs take priority)
            ...(data.extracted_data || {}),
            // Ensure customer_phone_number is handled properly
            customer_phone_number:
              data.extracted_data?.customer_phone_number ||
              pdfExtractionData?.extracted_data?.customer_phone_number ||
              null,
          },
          admin_input: data.admin_input
            ? {
                reporting_month: data.admin_input.reporting_month || null,
                booking_date: data.admin_input.booking_date || null,
                agent_code: data.admin_input.agent_code || null,
                code_type: data.admin_input.code_type || null,
                // Conditional fields based on payout_on
                incoming_grid_percent: data.admin_input.payout_on === "OD+TP" ? null : (data.admin_input.incoming_grid_percent || null),
                agent_commission_given_percent: data.admin_input.payout_on === "OD+TP" ? null : (data.admin_input.agent_commission_given_percent || null),
                extra_grid: data.admin_input.payout_on === "OD+TP" ? null : (data.admin_input.extra_grid || null),
                // agent_extra_percent removed from new formula
                // OD+TP specific fields
                od_incoming_grid_percent: data.admin_input.payout_on === "OD+TP" ? (data.admin_input.od_incoming_grid_percent || null) : null,
                tp_incoming_grid_percent: data.admin_input.payout_on === "OD+TP" ? (data.admin_input.tp_incoming_grid_percent || null) : null,
                od_incoming_extra_grid: data.admin_input.payout_on === "OD+TP" ? (data.admin_input.od_incoming_extra_grid || null) : null,
                tp_incoming_extra_grid: data.admin_input.payout_on === "OD+TP" ? (data.admin_input.tp_incoming_extra_grid || null) : null,
                od_agent_payout_percent: data.admin_input.payout_on === "OD+TP" ? (data.admin_input.od_agent_payout_percent || null) : null,
                tp_agent_payout_percent: data.admin_input.payout_on === "OD+TP" ? (data.admin_input.tp_agent_payout_percent || null) : null,
                commissionable_premium:
                  data.admin_input.commissionable_premium || null,
                payment_by: data.admin_input.payment_by || null,
                payment_method: data.admin_input.payment_method && data.admin_input.payment_detail 
                  ? `${data.admin_input.payment_method} - ${data.admin_input.payment_detail}`
                  : data.admin_input.payment_method || null,
                payout_on: data.admin_input.payout_on || null,
                payment_by_office:
                  data.admin_input.payment_by_office?.toString() || null,
                insurer_code: data.admin_input.insurer_code || null,
                broker_code: data.admin_input.broker_code || null,
                admin_child_id: data.admin_input.admin_child_id || null,
              }
            : null,
          calculations: calculationResult || data.calculations || null,
          claimed_by: data.claimed_by || null,
          running_bal: data.running_bal || 0,
          cutpay_received:
            data.cutpay_received_status === "No"
              ? 0
              : Number(data.cutpay_received) || 0,
          notes: data.notes || null,
        };

        console.log("Final payload:", payload);

        let createdTransaction;
        
        if (editId) {
          // Edit mode - use update mutation
          createdTransaction = await updateCutPayMutation.mutateAsync({
            cutpayId: editId,
            data: payload as any, // Type assertion needed for update
          });
          updateStepStatus("create-transaction", "completed");
          toast.success("Transaction updated successfully!");
        } else {
          // Create mode - use create mutation
          createdTransaction = await createCutPayMutation.mutateAsync(payload);
          updateStepStatus("create-transaction", "completed");
        // Store the created transaction in global state
        setCreatedTransaction(createdTransaction);
        }

        // Steps 2 & 3: Upload all associated documents
        try {
          await uploadDocuments(createdTransaction.id);
          toast.success(
            "🎉 Transaction created and documents uploaded successfully!"
          );
        } catch (uploadError) {
          console.error("Document upload error:", uploadError);
          const errorMessage =
            uploadError instanceof Error
              ? uploadError.message
              : "Unknown upload error";
          // Provide specific feedback based on the upload error
          if (errorMessage.includes("Some documents failed")) {
            toast.warning(
              "⚠️ Transaction created successfully, but some documents failed to upload."
            );
          } else {
            toast.warning(
              "⚠️ Transaction created successfully, but documents could not be uploaded."
            );
          }
        }

        // Step 4: Clean up IndexedDB and redirect the user
        updateStepStatus("cleanup-redirect", "active");
        try {
          console.log("🧹 Cleaning up IndexedDB documents...");
          await clearAllFromIndexedDB(); // Remove temporary files
          console.log("✅ IndexedDB cleanup completed");
          updateStepStatus("cleanup-redirect", "completed");

          // A small delay to allow the user to see the final status
          await new Promise((resolve) => setTimeout(resolve, 1000));

          // Redirect to the main cutpay list page
          console.log("🔄 Redirecting to cutpay list...");
          router.push("/admin/cutpay");
        } catch (cleanupError) {
          console.error("❌ Cleanup error:", cleanupError);
          updateStepStatus("cleanup-redirect", "failed");
          // Redirect anyway to avoid getting stuck
          router.push("/admin/cutpay");
        }
      }

      // Reset form and component state for the next use
      reset();
      setSubmissionSteps((prev) =>
        prev.map((step) => ({ ...step, status: "pending" as const }))
      );
    } catch (error) {
      // Handle failure at the transaction creation step
      const stepId = formType === 'policy' ? "create-policy" : "create-transaction";
      updateStepStatus(stepId, "failed");
      console.error("Submission error:", error);
      toast.error(
        `Failed to create ${formType === 'policy' ? 'policy' : 'transaction'}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsSubmitting(false); // Ensure submission state is reset
    }
  };
  const keysToHideForAgent = [
    "extracted_data.customer_phone_number",
    "extracted_data.make_model",
    "extracted_data.vehicle_variant",
  ];
 

  const renderField = (field: FormFieldConfig) => {
    const { key, label, type, disabled, options: configOptions, tag } = field;
    // Allow all fields to be editable in policy mode - no readonly restrictions

    // Get current payout_on value for conditional rendering
    const payoutOn = watch("admin_input.payout_on");

    // Skip payment method field if payment is by Agent
    if (key === "admin_input.payment_method" && paymentBy === "Agent") {
      return null;
    }

    // Skip payment detail field if payment is by Agent or no payment method is selected
    if (key === "admin_input.payment_detail" && (paymentBy === "Agent" || !watch("admin_input.payment_method"))) {
      return null;
    }

    // Skip broker_code field if code_type is "Direct"
    if (key === "admin_input.broker_code" && watch("admin_input.code_type") === "Direct") {
      return null;
    }

    // Conditional rendering for OD+TP: hide regular fields when payout_on is "OD+TP"
    if (payoutOn === "OD+TP") {
      const fieldsToHideForODTP = [
        'admin_input.incoming_grid_percent',
        'admin_input.extra_grid', 
        'admin_input.agent_commission_given_percent',
        'admin_input.agent_extra_percent'
      ];
      if (fieldsToHideForODTP.includes(key)) {
        return null;
      }
    }

    // Conditional rendering for OD+TP: show OD+TP specific fields only when payout_on is "OD+TP"
    if (payoutOn !== "OD+TP") {
      const odtpSpecificFields = [
        'admin_input.od_incoming_grid_percent',
        'admin_input.tp_incoming_grid_percent',
        'admin_input.od_incoming_extra_grid',
        'admin_input.tp_incoming_extra_grid',
        'admin_input.od_agent_payout_percent',
        'admin_input.tp_agent_payout_percent'
      ];
      if (odtpSpecificFields.includes(key)) {
        return null;
      }
    }

    // Helper function to render tags
    const renderTag = () => {
      if (!tag) return null;

      if (tag === "autofill") {
        // For 'autofill', the tag should only appear if the data came from the initial PDF extraction.
        // It should not appear just because a user manually filled an empty field.
        const fieldKey = key.substring("extracted_data.".length);
        const originalValue =
          pdfExtractionData?.extracted_data?.[
            fieldKey as keyof typeof pdfExtractionData.extracted_data
          ];

        if (
          originalValue === null ||
          originalValue === undefined ||
          String(originalValue).trim() === ""
        ) {
          return null; // Don't show tag if it wasn't in the original data or was empty.
        }
      }

      const tagConfig = {
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

      const config = tagConfig[tag];
      if (!config) return null;

      return (
        <Badge variant="outline" className={`text-xs ${config.className}`}>
          {config.label}
        </Badge>
      );
    };

    // Render Date or Month/Year Picker
    if (type === "date") {
      const isReportingMonth = key === "admin_input.reporting_month";

      return (
        <div key={key} className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor={key} className="text-sm font-medium text-gray-700">{label}</Label>
            {renderTag()}
          </div>
          <Controller
            name={key as any}
            control={control}
            render={({ field: controllerField, fieldState }) => (
              <>
                <div className="relative ">
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
                      className="h-10"
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
    }

    // Render Select (Dropdown) Input
    if (type === "select") {
      let options = configOptions || [];
      // Dynamically assign options based on the field key
      if (key === "admin_input.insurer_code") {
        // For policy forms, use policy-specific insurer options based on code type
        options = formType === 'policy' ? policyInsurerOptions : insurerOptions;
      }
      if (key === "admin_input.broker_code") {
        // For policy forms, use policy-specific broker options; for cutpay use admin options
        options = formType === 'policy' ? policyBrokerOptions : brokerOptions;
      }
      if (key === "admin_input.agent_code") options = agentOptions;
      if (key === "admin_input.admin_child_id") {
        // For policy forms, use policy child IDs (agent-specific)
        // For cutpay forms, use admin child IDs (admin/superadmin access)
        options = formType === 'policy' ? policyChildIdOptions : adminChildIdOptions;
      }
      if (key === "admin_input.code_type") options = codeTypeOptions;
      if (key === "admin_input.payment_by") {
        // Enhanced payment by options with agent name when applicable
        const selectedAgentCode = watch("admin_input.agent_code");
        const selectedAgent = agents?.agents.find((agent: AgentSummary) => agent.agent_code === selectedAgentCode);
        
        options = ["Agent", "InsureZeal"].map((option) => {
          if (option === "Agent" && selectedAgent) {
            return {
              value: option,
              label: `Agent (${selectedAgent.first_name} ${selectedAgent.last_name})`
            };
          }
          return { value: option, label: option };
        });
      }
      if (key === "admin_input.payment_method") options = paymentMethodOptions;
      if (key === "admin_input.payout_on") options = payoutOnOptions;
      if (key === "claimed_by") options = agentOptions;
      if (key === "cutpay_received") options = cutpayReceivedOptions;
      if (key === "extracted_data.major_categorisation")
        options = majorCategorisationOptions;
      if (key === "extracted_data.product_type") {
        // Use the static options defined in form-config.ts
        options = field.options || [];
      }
      if (key === "extracted_data.plan_type") options = planTypeOptions;
      if (key === "extracted_data.fuel_type") options = fuelTypeOptions;
      if (key === "extracted_data.business_type") options = businessTypeOptions;

      // Check if the data for this select is currently loading
      const isLoading =
        (key === "admin_input.insurer_code" && 
         (formType === 'policy' ? (directInsurersLoading || brokersAndInsurersLoading) : insurersLoading)) ||
        (key === "admin_input.broker_code" && 
         (formType === 'policy' ? brokersAndInsurersLoading : brokersLoading)) ||
        (key === "admin_input.agent_code" && agentsLoading) ||
        (key === "admin_input.admin_child_id" && 
         (formType === 'policy' ? policyChildIdsLoading : (adminChildIdsLoading || availableChildIdsLoading)));

      return (
        <div key={key} className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor={key} className="text-sm font-medium text-gray-700">{label}</Label>
            {renderTag()}
          </div>
          <Controller
            name={key as any}
            control={control}
            render={({ field: controllerField, fieldState }) => {
              // Special handling for product_type: if the current value is not in the options,
              // add it as a temporary option so it can be displayed
              let finalOptions = options;
              if (key === "extracted_data.product_type" && controllerField.value) {
                const currentValue = controllerField.value as string;
                if (!options.some(option => option.value === currentValue)) {
                  finalOptions = [
                    ...options,
                    { value: currentValue, label: currentValue }
                  ];
                }
              }

              return (
              <>
                <Select
                  onValueChange={controllerField.onChange}
                  value={
                    (controllerField.value as string) ?? undefined
                  }
                  disabled={disabled}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue
                      placeholder={isLoading ? "Loading..." : `Select ${label}`}
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
    }

    // Render Textarea Input
    if (type === "textarea") {
      return (
        <div key={key} className="space-y-2 col-span-2">
          <div className="flex items-center justify-between">
            <Label htmlFor={key} className="text-sm font-medium text-gray-700">{label}</Label>
            {renderTag()}
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
                  className="resize-none"
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
    }

    // Render standard Text or Number Input
    return (
      <div key={key} className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor={key} className="text-sm font-medium text-gray-700">{label}</Label>
          {renderTag()}
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
                    // Handle number conversion, allowing empty/null values
                    const numValue = value === "" ? null : Number(value);
                    controllerField.onChange(numValue);
                    
                    // Track manual edits for cutpay amount
                    if (key === "calculations.cut_pay_amount" && numValue !== null) {
                      // This indicates a manual edit - we'll need to communicate this to the calculations component
                      // For now, we'll just log it
                      console.log("Cutpay amount manually edited to:", numValue);
                    }
                  } else {
                    // Handle string values, allowing empty/null values
                    controllerField.onChange(value === "" ? null : value);
                  }
                }}
                disabled={disabled}
                className={`h-10 ${disabled ? 'bg-gray-50' : ''}`}
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
  };

  // The main component render method
  return (
    <div className="flex h-full">
      <div className="w-full">
        <form
          onSubmit={handleSubmit(
            (data) => {
              console.log("Form submitted with data:", data);
              onSubmit(data);
            },
            (errors) => {
              // Handle form validation errors
              console.log("Form validation errors:", errors);
              toast.error("Please fix the form errors before submitting");
            }
          )}
          className="space-y-6"
        >
          {/* Header section with title and document viewer toggle */}
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">Admin Input</h1>
            <div className="flex gap-2">
              <Button
                type="button"
                onClick={() => setIsViewerOpen(!isViewerOpen)}
                variant="outline"
              >
                {isViewerOpen ? "Hide" : "Show"} Document
              </Button>
            </div>
          </div>

          {/* Main layout container */}
          <div className="space-y-6">
            {/* Row 1: Extracted Data and Document Viewer */}
            <div className="flex flex-wrap md:flex-nowrap gap-6">
              <div
                className={`transition-all duration-300 ease-in-out ${
                  isViewerOpen ? "w-full md:w-1/2" : "w-full"
                }`}
              >
                <Card className="shadow-sm border border-l-6 border-blue-500 h-full">
                  <CardHeader className="bg-gray-50 border-b">
                    <CardTitle className="text-lg text-gray-800 flex items-center gap-2">
                      <span className="h-2 w-2 bg-blue-500 rounded-full"></span>
                      Extracted Data
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {currentFormFields
                      .filter((f) => {
                        // Hide specific extracted fields for agents
                        if (keysToHideForAgent.includes(f.key)) {
                          return false;
                        }
                        // Show only extracted section fields
                        return f.section === "extracted";
                      })
                      .map((field) => renderField(field as FormFieldConfig))}
                  </CardContent>

                </Card>
              </div>

              <AnimatePresence>
                {isViewerOpen && (
                  <motion.div
                    className="w-full md:w-1/2"
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "50%" }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <DocumentViewer />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Logic-only component for calculations */}
            <Calculations control={control} setValue={setValue} />

            {/* Row 2: Admin Input and Calculations */}
            <div className="flex flex-wrap md:flex-nowrap gap-6">
              <div className="w-full md:w-1/2">
                <Card className="shadow-sm border border-l-6 border-green-500 h-full">
                  <CardHeader className="bg-gray-50 border-b flex flex-row items-center justify-between px-4 py-0">
                    <CardTitle className="text-lg text-gray-800 flex items-center gap-2">
                      <span className="h-2 w-2 bg-green-500 rounded-full"></span>
                      Input
                    </CardTitle>
                    {(formType === 'cutpay' && typeof runningBalValue === "number") || 
                     (formType === 'policy' && typeof runningBalValue === "number") ? (
                      <div className="text-right">
                        <Label className="text-sm font-medium text-gray-500">
                          Running Balance
                        </Label>
                        <div
                          className={`px-4 py-2 mt-1 rounded-lg border-2 font-bold ${
                            runningBalValue < 0
                              ? "bg-red-50 border-red-300 text-red-700"
                              : "bg-green-50 border-green-300 text-green-700"
                          }`}
                        >
                          <span className="text-xl">
                            ₹{runningBalValue.toFixed(2)}
                          </span>
                          {/* Show additional info for policy form when Payment by InsureZeal */}
                          {formType === 'policy' && paymentBy === "InsureZeal" && (
                            <div className="text-xs mt-1 font-normal">
                              {(() => {
                                const totalAgentPayout = (netPremium || 0) * ((agentCommissionPercent || 0) / 100);
                                const grossPremiumVal = grossPremium || 0;
                                const calculatedAmount = totalAgentPayout - grossPremiumVal;
                                const currentRunningBalance = (runningBalValue || 0) - calculatedAmount; // Original balance before this transaction
                                
                                if (runningBalValue > 0) {
                                  return `InsureZeal owes ₹${Math.abs(runningBalValue).toFixed(2)} to Agent (₹${calculatedAmount.toFixed(2)} + ₹${currentRunningBalance.toFixed(2)})`;
                                } else if (runningBalValue < 0) {
                                  return `Agent owes ₹${Math.abs(runningBalValue).toFixed(2)} to InsureZeal (₹${calculatedAmount.toFixed(2)} + ₹${currentRunningBalance.toFixed(2)})`;
                                } else {
                                  return "Account is balanced";
                                }
                              })()}
                            </div>
                          )}
                          {/* Show standard info for cutpay or policy without InsureZeal payment */}
                          {(formType === 'cutpay' || (formType === 'policy' && paymentBy !== "InsureZeal")) && (
                            <div className="text-xs mt-1 font-normal">
                              {(() => {
                                if (runningBalValue > 0) {
                                  return `InsureZeal owes ₹${Math.abs(runningBalValue).toFixed(2)} to Agent`;
                                } else if (runningBalValue < 0) {
                                  return `Agent owes ₹${Math.abs(runningBalValue).toFixed(2)} to InsureZeal`;
                                } else {
                                  return "Account is balanced";
                                }
                              })()}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </CardHeader>
                  <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {currentFormFields
                      .filter(
                        (f) => {
                          if (formType === 'policy') {
                            // For policy mode: show essential fields for policy creation
                            return f.section === "admin" && 
                                   f.key !== "running_bal" && 
                                   (f.key === "admin_input.admin_child_id" ||
                                    f.key === "admin_input.agent_commission_given_percent" ||
                                    f.key === "admin_input.code_type" ||
                                    f.key === "admin_input.insurer_code" ||
                                    f.key === "admin_input.broker_code" ||
                                    f.key === "admin_input.payment_by" ||
                                    f.key === "admin_input.payment_method" ||
                                    // Hide payment_by_office when payment_by is "Agent" 
                                    (f.key === "admin_input.payment_by_office" && paymentBy !== "Agent") ||
                                    f.key === "notes");
                          } else {
                            // For cutpay mode: show all admin fields except running_bal
                            return f.section === "admin" && f.key !== "running_bal";
                          }
                        }
                      )
                      .reduce((acc, field) => {
                        const renderedField = renderField(field as FormFieldConfig);
                        if (renderedField) {
                          acc.push(renderedField);
                        }

                        if (
                          formType === 'cutpay' &&
                          field.key === "admin_input.payment_by" &&
                          paymentBy === "InsureZeal"
                        ) {
                          acc.push(
                            <div
                              className="space-y-2"
                              key="cutpay_received_status_wrapper"
                            >
                              <Label
                                className="text-sm font-medium text-gray-700"
                              >
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
                                        (controllerField.value as string) ?? undefined
                                      }
                                    >
                                      <SelectTrigger className="h-10">
                                        <SelectValue placeholder="Select status" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="No">No</SelectItem>
                                        <SelectItem value="Yes">Yes</SelectItem>
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
                          );

                          // Add cutpay_received input field when status is "Yes" or "Partial"
                          if (
                            cutpayReceivedStatus === "Yes" ||
                            cutpayReceivedStatus === "Partial"
                          ) {
                            acc.push(
                              <div
                                className="space-y-2"
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
                                        className="h-10"
                                        {...controllerField}
                                        value={String(controllerField.value ?? "")}
                                        onChange={(e) => {
                                          const value = e.target.value;
                                          const numValue = value === "" ? null : Number(value);
                                          controllerField.onChange(numValue);
                                        }}
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
                            );
                          }
                        }
                        
                        return acc;
                      }, [] as React.ReactNode[])}
                  </CardContent>
                </Card>
              </div>

              <div className="w-full md:w-1/2">
                <Card className="shadow-sm border border-l-6 border-purple-500 ">
                  <CardHeader className="bg-gray-50 border-b">
                    <CardTitle className="text-lg text-gray-800 flex items-center gap-2">
                      <span className="h-2 w-2 bg-purple-500 rounded-full"></span>
                      Calculations
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {formType === 'policy' ? (
                      // For policy mode: show calculation based on payment_by selection
                      <>
                        <div className="space-y-2">
                          <Label className="text-sm font-medium text-gray-700">
                            Total Agent Payout Amount
                          </Label>
                          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                            <div className="text-lg font-semibold text-green-800">
                              ₹{(() => {
                                const netPremium = watch("extracted_data.net_premium") || 0;
                                const agentCommission = watch("admin_input.agent_commission_given_percent") || 0;
                                const totalAgentPayout = (netPremium * (agentCommission / 100));
                                
                                return totalAgentPayout.toFixed(2);
                              })()}
                            </div>
                            <div className="text-sm text-green-600 mt-1">
                              Net Premium × Agent Commission %
                            </div>
                          </div>
                        </div>

                        {paymentBy === "InsureZeal" && (
                          <div className="space-y-2">
                            <Label className="text-sm font-medium text-gray-700">
                              Payment Calculation
                            </Label>
                            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                              <div className="text-lg font-semibold text-blue-800">
                                ₹{(() => {
                                  const totalAgentPayout = (netPremium || 0) * ((agentCommissionPercent || 0) / 100);
                                  const grossPremiumVal = grossPremium || 0;
                                  const calculatedAmount = totalAgentPayout - grossPremiumVal;
                                  return calculatedAmount.toFixed(2);
                                })()}
                              </div>
                              <div className="text-sm text-blue-600 mt-1">
                                Total Agent Payout (₹{((netPremium || 0) * ((agentCommissionPercent || 0) / 100)).toFixed(2)}) - Gross Premium (₹{(grossPremium || 0).toFixed(2)})
                              </div>
                              <div className="text-xs text-gray-500 mt-2">
                                {(() => {
                                  const totalAgentPayout = (netPremium || 0) * ((agentCommissionPercent || 0) / 100);
                                  const grossPremiumVal = grossPremium || 0;
                                  const calculatedAmount = totalAgentPayout - grossPremiumVal;
                                  if (calculatedAmount > 0) {
                                    return "This positive amount will be added to running balance (InsureZeal owes more to agent)";
                                  } else if (calculatedAmount < 0) {
                                    return "This negative amount will be added to running balance (Agent owes to InsureZeal)";
                                  } else {
                                    return "This transaction is balanced - no change to running balance";
                                  }
                                })()}
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      // For cutpay mode: show all calculation fields
                      currentFormFields
                        .filter((f) => f.section === "calculation")
                        .map((field) => renderField(field as FormFieldConfig))
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>

          {/* Policy-specific fields section - Only shown in policy mode */}
          {formType === 'policy' && (
            <div className="mt-6">
              <Card className="shadow-sm border border-l-6 border-purple-500">
                <CardHeader className="bg-gray-50 border-b">
                  <CardTitle className="text-lg text-gray-800 flex items-center gap-2">
                    <span className="h-2 w-2 bg-purple-500 rounded-full"></span>
                    Policy Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Cluster Field */}
                  <div className="space-y-2">
                    <Label htmlFor="cluster" className="text-sm font-medium text-gray-700">Cluster</Label>
                    <Controller
                      name={"cluster" as any}
                      control={control}
                      render={({ field: controllerField, fieldState }) => (
                        <>
                          <Input
                            id="cluster"
                            type="text"
                            {...controllerField}
                            value={String(controllerField.value ?? "")}
                            onChange={(e) => {
                              const value = e.target.value;
                              controllerField.onChange(value === "" ? null : value);
                            }}
                            className="h-10"
                            placeholder="Enter cluster"
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

                  {/* Start Date Field */}
                  <div className="space-y-2">
                    <Label htmlFor="start_date" className="text-sm font-medium text-gray-700">Policy Start Date</Label>
                    <Controller
                      name={"start_date" as any}
                      control={control}
                      render={({ field: controllerField, fieldState }) => (
                        <>
                          <Input
                            id="start_date"
                            type="date"
                            {...controllerField}
                            value={String(controllerField.value ?? "")}
                            onChange={(e) => {
                              const value = e.target.value;
                              controllerField.onChange(value === "" ? null : value);
                            }}
                            className="h-10"
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

                  {/* End Date Field */}
                  <div className="space-y-2">
                    <Label htmlFor="end_date" className="text-sm font-medium text-gray-700">Policy End Date</Label>
                    <Controller
                      name={"end_date" as any}
                      control={control}
                      render={({ field: controllerField, fieldState }) => (
                        <>
                          <Input
                            id="end_date"
                            type="date"
                            {...controllerField}
                            value={String(controllerField.value ?? "")}
                            onChange={(e) => {
                              const value = e.target.value;
                              controllerField.onChange(value === "" ? null : value);
                            }}
                            className="h-10"
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
                </CardContent>
              </Card>
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex justify-between mt-6">
            <Button
              type="button"
              onClick={onPrev}
              variant="outline"
              disabled={isSubmitting}
            >
              Previous
            </Button>
            <Button type="submit" disabled={isSubmitting} className="min-w-[120px]">
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSubmitting ? "Processing..." : "Submit & Next"}
            </Button>
          </div>

          {/* Loading dialog shown during submission */}
          <LoadingDialog
            open={isSubmitting}
            title={formType === 'policy' ? "Creating Policy" : "Creating Cutpay Transaction"}
            steps={submissionSteps}
          />
        </form>
      </div>
    </div>
  );
};

export default InputForm;