import { zodResolver } from "@hookform/resolvers/zod";
import { useAtom } from "jotai";
import { useMemo, useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { openDB } from "idb";
import { pdfExtractionDataAtom, createdCutpayTransactionAtom, cutpayCalculationResultAtom } from "@/lib/atoms/cutpay";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { MonthYearPicker } from "@/components/ui/month-year-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingDialog } from "@/components/ui/loading-dialog";
import { useAgentList } from "@/hooks/adminQuery";
import { useCreateCutPay, useUploadCutPayDocument } from "@/hooks/cutpayQuery";
import {
  useBrokerList,
  useInsurerList,
  useAdminChildIdList,
} from "@/hooks/superadminQuery";
import { AgentSummary } from "@/types/admin.types";
import { clearAllFromIndexedDB } from "@/lib/utils/indexeddb";
import { CreateCutpayTransactionCutpayPostRequest } from "@/types/cutpay.types";
import { Insurer, Broker, AdminChildId } from "@/types/superadmin.types";
import { CutPayFormSchema, CutPayFormSchemaType } from "./form-schema";
import { formFields, FormFieldConfig, FormFieldPath } from "./form-config";
import Calculations from "./calculations";

interface AdminInputFormProps {
  onPrev: () => void;
  isViewerOpen: boolean;
  setIsViewerOpen: (isOpen: boolean) => void;
}

import { PanelLeftClose, PanelRightClose, Loader2 } from "lucide-react";

const AdminInputForm: React.FC<AdminInputFormProps> = ({
  onPrev,
  isViewerOpen,
  setIsViewerOpen,
}) => {
  const router = useRouter();
  const [pdfExtractionData] = useAtom(pdfExtractionDataAtom);
  const [calculationResult] = useAtom(cutpayCalculationResultAtom);
  const [, setCreatedTransaction] = useAtom(createdCutpayTransactionAtom);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // State for submission progress
  const [submissionSteps, setSubmissionSteps] = useState<{
    id: string;
    label: string;
    status: 'pending' | 'active' | 'completed' | 'failed';
  }[]>([
    { id: 'create-transaction', label: 'Creating transaction...', status: 'pending' },
    { id: 'upload-policy', label: 'Uploading policy PDF...', status: 'pending' },
    { id: 'upload-additional', label: 'Uploading additional documents...', status: 'pending' },
    { id: 'cleanup-redirect', label: 'Cleaning up and redirecting...', status: 'pending' },
  ]);

  const createCutPayMutation = useCreateCutPay();
  const uploadDocumentMutation = useUploadCutPayDocument();

  // Reset states when component mounts or when needed
  useEffect(() => {
    setSubmissionSteps([
      { id: 'create-transaction', label: 'Creating cutpay transaction', status: 'pending' },
      { id: 'upload-policy', label: 'Uploading policy document', status: 'pending' },
      { id: 'upload-additional', label: 'Uploading additional documents', status: 'pending' },
      { id: 'cleanup-redirect', label: 'Cleaning up and redirecting', status: 'pending' },
    ]);
    setIsSubmitting(false);
  }, []);

  const { control, handleSubmit, setValue, watch, reset, formState } = useForm<CutPayFormSchemaType>({
    resolver: zodResolver(CutPayFormSchema),
    defaultValues: {
      policy_pdf_url: "",
      additional_documents: {},
      extracted_data: {},
      admin_input: {},
      calculations: {},
      cutpay_received_status: null,
      cutpay_received: null,
    },
  });

  console.log('AdminInputForm rendered'); // Debug log
  console.log('Form errors:', formState.errors); // Debug form errors

  // Watch for payment_by changes to auto-calculate payment_by_office
  const paymentBy = watch('admin_input.payment_by');
  const grossPremium = watch('extracted_data.gross_premium');

  useEffect(() => {
    if (paymentBy === 'InsureZeal' && grossPremium) {
      // If payment by office, set to gross premium
      setValue('admin_input.payment_by_office', grossPremium, { shouldValidate: true });
    } else if (paymentBy === 'Agent') {
      // If payment by agent, set to zero by default
      setValue('admin_input.payment_by_office', 0, { shouldValidate: true });
    }
  }, [paymentBy, grossPremium, setValue]);

  useEffect(() => {
    if (pdfExtractionData?.extracted_data) {
      Object.entries(pdfExtractionData.extracted_data).forEach(
        ([key, value]) => {
          const formKey = `extracted_data.${key}` as FormFieldPath;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setValue(formKey, value as any, { shouldValidate: true });
        }
      );
    }
  }, [pdfExtractionData, setValue]);

  const { data: insurers, isLoading: insurersLoading } = useInsurerList();
  const { data: brokers, isLoading: brokersLoading } = useBrokerList();
  const { data: agents, isLoading: agentsLoading } = useAgentList();
  const { data: adminChildIds, isLoading: adminChildIdsLoading } =
    useAdminChildIdList();

  const insurerOptions = useMemo(
    () =>
      insurers?.map((i: Insurer) => ({
        value: i.insurer_code,
        label: i.name,
      })).filter(option => option.value && option.value.trim() !== '') || [],
    [insurers]
  );
  const brokerOptions = useMemo(
    () =>
      brokers?.map((b: Broker) => ({ value: b.broker_code, label: b.name }))
        .filter(option => option.value && option.value.trim() !== '') || [],
    [brokers]
  );
  const agentOptions = useMemo(
    () =>
      agents?.agents?.map((a: AgentSummary) => ({
        value: a.agent_code ?? "",
        label: `${a.first_name} ${a.last_name}`,
      })).filter(option => option.value && option.value.trim() !== '') || [],
    [agents]
  );
  const adminChildIdOptions = useMemo(
    () =>
      adminChildIds?.map((a: AdminChildId) => ({
        value: a.child_id,
        label: `${a.child_id} - ${a.manager_name}`,
      })).filter(option => option.value && option.value.trim() !== '') || [],
    [adminChildIds]
  );

  const codeTypeOptions = useMemo(
    () => ["Direct", "Broker"].map((o) => ({ value: o, label: o })),
    []
  );
  const paymentByOptions = useMemo(
    () => ["Agent", "InsureZeal"].map((o) => ({ value: o, label: o })),
    []
  );
  const paymentMethodOptions = useMemo(
    () => [
      "cd/float(iz)", 
      "Credit Card", 
      "Cash", 
      "Net Banking", 
      "UPI", 
      "Debit Card", 
      "Cheque"
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
    () => ["Comp", "STP", "SAOD"].map((o) => ({ value: o, label: o })),
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
    () => ["Private", "Commercial"].map((o) => ({ value: o, label: o })),
    []
  );

  /**
   * Initialize IndexedDB with proper schema using idb package
   * @param dbName - Name of the database
   * @param storeName - Name of the object store
   * @returns Database instance or null if failed
   */
  const initializeDB = async (dbName: string, storeName: string) => {
    try {
      // First try to open existing database to get current version
      try {
        const existingDb = await openDB(dbName);
        const currentVersion = existingDb.version;
        existingDb.close();
        
        // Open with upgrade if needed
        const db = await openDB(dbName, currentVersion, {
          upgrade(db) {
            if (!db.objectStoreNames.contains(storeName)) {
              console.log(`🔧 Creating object store: ${storeName}`);
              db.createObjectStore(storeName);
            }
          },
        });
        return db;
      } catch {
        // Database doesn't exist, create new one
        const db = await openDB(dbName, 1, {
          upgrade(db) {
            if (!db.objectStoreNames.contains(storeName)) {
              console.log(`🔧 Creating object store: ${storeName}`);
              db.createObjectStore(storeName);
            }
          },
        });
        return db;
      }
    } catch (error) {
      console.error(`❌ Failed to initialize ${dbName}:`, error);
      return null;
    }
  };

  /**
   * Save a file to IndexedDB using idb package
   * @param documentKey - Key to store the document under
   * @param file - File to save
   * @param dbName - Database name (default: 'CutPayDB')
   * @param storeName - Store name (default: 'documents')
   * @returns Success status
   */
  const saveFileToIndexedDB = async (documentKey: string, file: File, dbName = 'CutPayDB', storeName = 'documents') => {
    try {
      const db = await initializeDB(dbName, storeName);
      if (!db) return false;

      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      
      await store.put({
        name: file.name,
        type: file.type,
        content: file
      }, documentKey);
      
      await tx.done;
      db.close();
      
      console.log(`✅ Saved ${documentKey} to ${dbName}/${storeName}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to save ${documentKey}:`, error);
      return false;
    }
  };

  /**
   * Debug function to inspect all IndexedDB databases and their contents
   * Uses the idb package for clean, promise-based interactions
   */
  const debugIndexedDB = async () => {
    try {
      console.log('🔍 Debugging IndexedDB contents with idb...');
      
      // List all available databases if supported
      if ('databases' in indexedDB) {
        try {
          const databases = await indexedDB.databases();
          console.log('📂 Available databases:', databases.map(db => `${db.name} (v${db.version})`));
        } catch (error) {
          console.log('⚠️ Could not list databases:', error);
        }
      }
      
      const possibleDbs = [
        { name: 'CutPayDB', storeName: 'documents' },
        { name: 'DocumentsDB', storeName: 'documents' },
        { name: 'cutpay-documents', storeName: 'files' },
        { name: 'fileStorage', storeName: 'documents' }
      ];

      for (const { name: dbName, storeName } of possibleDbs) {
        try {
          console.log(`🔍 Checking database: ${dbName}`);
          // Open database without version to get current version
          const db = await openDB(dbName);
          
          console.log(`📂 ${dbName} - object stores:`, Array.from(db.objectStoreNames));
          
          if (db.objectStoreNames.contains(storeName)) {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const keys = await store.getAllKeys();
            
            console.log(`🔑 ${dbName}/${storeName} keys:`, keys);
            
            if (keys.length > 0) {
              const values = await store.getAll();
              console.log(`📄 ${dbName}/${storeName} contents:`);
              values.forEach((doc, index) => {
                console.log(`  ${keys[index]}:`, {
                  name: doc.name,
                  type: doc.type,
                  hasContent: !!doc.content,
                  size: doc.content?.size || doc.size || 'unknown'
                });
              });
            } else {
              console.log(`📭 ${dbName}/${storeName} is empty`);
            }
          } else {
            console.log(`⚠️ Store ${storeName} not found in ${dbName}`);
          }
          
          db.close();
        } catch (error) {
          console.log(`⚠️ Cannot access database ${dbName}:`, error instanceof Error ? error.message : 'Unknown error');
        }
      }
    } catch (error) {
      console.error('❌ Debug IndexedDB error:', error);
    }
  };

  // Call debug function when component mounts
  useEffect(() => {
    debugIndexedDB();
  }, []);

  // Helper function to update step status
  const updateStepStatus = (stepId: string, status: 'pending' | 'active' | 'completed' | 'failed') => {
    setSubmissionSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, status } : step
    ));
  };

  /**
   * Check if a document exists in IndexedDB
   * @param documentKey - Key of the document to check
   * @returns True if document exists, false otherwise
   */
  const documentExistsInDB = async (documentKey: string): Promise<boolean> => {
    const file = await getFileFromIndexedDB(documentKey);
    return file !== null;
  };

  /**
   * Get all available documents from IndexedDB
   * @returns Object with document keys and their availability
   */
  const getAllAvailableDocuments = async (): Promise<Record<string, boolean>> => {
    const documentKeys = ['policy_pdf', 'kyc_documents', 'rc_document', 'previous_policy'];
    const availability: Record<string, boolean> = {};
    
    for (const key of documentKeys) {
      availability[key] = await documentExistsInDB(key);
    }
    
    return availability;
  };

  /**
   * Validate documents before upload
   * @returns Validation summary
   */
  const validateDocumentsForUpload = async (): Promise<{
    hasDocuments: boolean;
    available: string[];
    missing: string[];
    summary: Record<string, boolean>;
  }> => {
    console.log('🔍 Validating documents for upload...');
    
    const summary = await getAllAvailableDocuments();
    const available = Object.entries(summary)
      .filter(([, exists]) => exists)
      .map(([key]) => key);
    const missing = Object.entries(summary)
      .filter(([, exists]) => !exists)
      .map(([key]) => key);
    
    const hasDocuments = available.length > 0;
    
    console.log('📋 Document validation results:', {
      hasDocuments,
      available: available.length,
      missing: missing.length,
      details: summary
    });
    
    return { hasDocuments, available, missing, summary };
  };

  /**
   * Retrieve a file from IndexedDB using the idb package
   * Tries multiple possible database/store combinations with auto-version handling
   * @param documentKey - Key of the document to retrieve
   * @returns File object or null if not found
   */
  const getFileFromIndexedDB = async (documentKey: string): Promise<File | null> => {
    console.log(`🔍 Retrieving ${documentKey} from IndexedDB using idb...`);
    
    const possibleDbs = [
      { name: 'CutPayDB', storeName: 'documents' },
      { name: 'DocumentsDB', storeName: 'documents' },
      { name: 'cutpay-documents', storeName: 'files' },
      { name: 'fileStorage', storeName: 'documents' }
    ];

    for (const { name: dbName, storeName } of possibleDbs) {
      try {
        console.log(`🔍 Trying ${dbName}/${storeName}...`);
        
        // Open database without specifying version to get current version
        const db = await openDB(dbName);
        
        if (!db.objectStoreNames.contains(storeName)) {
          console.log(`⚠️ Store ${storeName} not found in ${dbName}`);
          db.close();
          continue;
        }

        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const result = await store.get(documentKey);
        
        db.close();
        
        if (result) {
          // Handle different data structures
          let fileData: { name: string; type: string; content: ArrayBuffer | File };
          
          if (result.content instanceof ArrayBuffer) {
            // Old format: content is ArrayBuffer
            fileData = {
              name: result.name,
              type: result.type,
              content: result.content
            };
          } else if (result.content instanceof File) {
            // New format: content is File
            fileData = {
              name: result.name,
              type: result.type,
              content: result.content
            };
          } else {
            console.log(`⚠️ Unexpected content type for ${documentKey} in ${dbName}/${storeName}`);
            continue;
          }
          
          // Create File object
          let file: File;
          if (fileData.content instanceof File) {
            file = fileData.content;
          } else {
            file = new File([fileData.content], fileData.name, {
              type: fileData.type,
              lastModified: Date.now()
            });
          }
          
          console.log(`✅ Found ${documentKey} in ${dbName}: ${file.name} (${file.size} bytes)`);
          return file;
        } else {
          console.log(`⚠️ No content for ${documentKey} in ${dbName}/${storeName}`);
        }
      } catch (error) {
        console.log(`⚠️ Cannot access ${dbName}:`, error instanceof Error ? error.message : 'Unknown error');
      }
    }

    console.log(`❌ ${documentKey} not found in any database`);
    return null;
  };

  /**
   * Upload policy document to server
   * @param cutpayId - The cutpay transaction ID
   * @returns Success status
   */
  const uploadPolicyDocument = async (cutpayId: number): Promise<boolean> => {
    console.log('� Starting policy document upload...');
    updateStepStatus('upload-policy', 'active');
    
    try {
      const policyFile = await getFileFromIndexedDB('policy_pdf');
      
      if (!policyFile) {
        console.log('⚠️ No policy PDF found in IndexedDB, skipping...');
        updateStepStatus('upload-policy', 'completed');
        return true; // Mark as success since it's optional
      }

      console.log(`⬆️ Uploading policy PDF: ${policyFile.name} (${policyFile.size} bytes)`);
      const uploadResult = await uploadDocumentMutation.mutateAsync({
        cutpayId,
        file: policyFile,
        documentType: 'policy_pdf'
      });
      
      console.log('✅ Policy PDF uploaded successfully:', uploadResult);
      updateStepStatus('upload-policy', 'completed');
      return true;
      
    } catch (error) {
      console.error('❌ Policy PDF upload failed:', error);
      updateStepStatus('upload-policy', 'failed');
      return false;
    }
  };

  /**
   * Upload additional documents to server
   * @param cutpayId - The cutpay transaction ID
   * @returns Object with upload results
   */
  const uploadAdditionalDocuments = async (cutpayId: number): Promise<{
    uploaded: number;
    failed: number;
    success: boolean;
  }> => {
    console.log('� Starting additional documents upload...');
    updateStepStatus('upload-additional', 'active');
    
    const documentTypes = [
      { key: 'kyc_documents', type: 'kyc_documents', name: 'KYC Documents' },
      { key: 'rc_document', type: 'rc_document', name: 'RC Document' },
      { key: 'previous_policy', type: 'previous_policy', name: 'Previous Policy' }
    ];
    
    let uploaded = 0;
    let failed = 0;

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
          documentType: type
        });
        
        console.log(`✅ ${name} uploaded successfully:`, uploadResult);
        uploaded++;
        
      } catch (error) {
        console.error(`❌ ${name} upload failed:`, error);
        failed++;
      }
    }

    const success = uploaded > 0 || failed === 0;
    updateStepStatus('upload-additional', success ? 'completed' : 'failed');
    
    console.log(`📊 Additional documents summary: ${uploaded} uploaded, ${failed} failed`);
    return { uploaded, failed, success };
  };

  /**
   * Main document upload orchestrator with validation
   * @param cutpayId - The cutpay transaction ID
   */
  const uploadDocuments = async (cutpayId: number) => {
    console.log('🚀 Starting document upload process for cutpayId:', cutpayId);

    try {
      // Pre-upload validation
      const validation = await validateDocumentsForUpload();
      
      if (!validation.hasDocuments) {
        console.log('⚠️ No documents found in IndexedDB, completing upload as success');
        updateStepStatus('upload-policy', 'completed');
        updateStepStatus('upload-additional', 'completed');
        return;
      }

      console.log(`📋 Found ${validation.available.length} documents to upload: ${validation.available.join(', ')}`);
      
      // Upload policy document
      const policySuccess = await uploadPolicyDocument(cutpayId);
      
      // Upload additional documents
      const additionalResults = await uploadAdditionalDocuments(cutpayId);
      
      // Determine overall success
      const overallSuccess = policySuccess && additionalResults.success;
      
      if (overallSuccess) {
        console.log('🎉 All document uploads completed successfully');
      } else if (policySuccess || additionalResults.uploaded > 0) {
        console.log('⚠️ Some documents uploaded successfully, but some failed');
        throw new Error('Some documents failed to upload');
      } else {
        console.log('❌ All document uploads failed');
        throw new Error('All document uploads failed');
      }
      
    } catch (error) {
      console.error('❌ Document upload process failed:', error);
      throw error;
    }
  };

  const onSubmit = async (data: CutPayFormSchemaType) => {
    console.log('Form submission started', data);
    setIsSubmitting(true);

    // Reset all steps to pending
    setSubmissionSteps(prev => prev.map(step => ({ ...step, status: 'pending' as const })));

    try {
      // Step 1: Create the cutpay transaction
      updateStepStatus('create-transaction', 'active');
      
      // Construct the payload according to CreateCutpayTransactionCutpayPostRequest
      const payload: CreateCutpayTransactionCutpayPostRequest = {
        // Follow the exact interface order
        policy_pdf_url: "hardcoded_policy_pdf_url",
        additional_documents: {},
        extracted_data: {
          // Start with PDF extracted data
          ...(pdfExtractionData?.extracted_data || {}),
          // Override with form data (user inputs take priority)
          ...(data.extracted_data || {}),
          // Ensure customer_phone_number is handled properly
          customer_phone_number: data.extracted_data?.customer_phone_number || 
                                 pdfExtractionData?.extracted_data?.customer_phone_number || 
                                 null,
        },
        admin_input: data.admin_input ? {
          reporting_month: data.admin_input.reporting_month || null,
          booking_date: data.admin_input.booking_date || null,
          agent_code: data.admin_input.agent_code || null,
          code_type: data.admin_input.code_type || null,
          incoming_grid_percent: data.admin_input.incoming_grid_percent || null,
          agent_commission_given_percent: data.admin_input.agent_commission_given_percent || null,
          extra_grid: data.admin_input.extra_grid || null,
          commissionable_premium: data.admin_input.commissionable_premium || null,
          payment_by: data.admin_input.payment_by || null,
          payment_method: data.admin_input.payment_method || null,
          payout_on: data.admin_input.payout_on || null,
          agent_extra_percent: data.admin_input.agent_extra_percent || null,
          payment_by_office: data.admin_input.payment_by_office?.toString() || null,
          insurer_code: data.admin_input.insurer_code || null,
          broker_code: data.admin_input.broker_code || null,
          admin_child_id: data.admin_input.admin_child_id || null,
        } : null,
        calculations: calculationResult || data.calculations || null,
        claimed_by: data.claimed_by || null,
        running_bal: data.running_bal || 0,
        cutpay_received: data.cutpay_received_status === 'No' ? 0 : (Number(data.cutpay_received) || 0),
        notes: data.notes || null,
      };

      console.log('Final payload:', payload);

      const createdTransaction = await createCutPayMutation.mutateAsync(payload);
      updateStepStatus('create-transaction', 'completed');
      
      // Store the created transaction
      setCreatedTransaction(createdTransaction);

      // Step 2 & 3: Upload documents
      try {
        await uploadDocuments(createdTransaction.id);
        toast.success("🎉 Transaction created and documents uploaded successfully!");
      } catch (uploadError) {
        console.error('Document upload error:', uploadError);
        const errorMessage = uploadError instanceof Error ? uploadError.message : 'Unknown upload error';
        if (errorMessage.includes('Some documents failed')) {
          toast.warning("⚠️ Transaction created successfully, but some documents failed to upload.");
        } else {
          toast.warning("⚠️ Transaction created successfully, but documents could not be uploaded.");
        }
      }
      
      // Step 4: Cleanup IndexedDB and redirect
      updateStepStatus('cleanup-redirect', 'active');
      try {
        console.log('🧹 Cleaning up IndexedDB documents...');
        await clearAllFromIndexedDB();
        console.log('✅ IndexedDB cleanup completed');
        updateStepStatus('cleanup-redirect', 'completed');
        
        // Small delay to show completion
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Redirect to cutpay list page
        console.log('🔄 Redirecting to cutpay list...');
        router.push('/admin/cutpay');
      } catch (cleanupError) {
        console.error('❌ Cleanup error:', cleanupError);
        updateStepStatus('cleanup-redirect', 'failed');
        // Still redirect even if cleanup fails
        router.push('/admin/cutpay');
      }
      
      // Reset form and states
      reset();
      setSubmissionSteps(prev => prev.map(step => ({ ...step, status: 'pending' as const })));

    } catch (error) {
      updateStepStatus('create-transaction', 'failed');
      console.error('Submission error:', error);
      toast.error(`Failed to create transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderField = (field: FormFieldConfig) => {
    const { key, label, type, options: configOptions, disabled } = field;

    if (type === "date") {
      const isReportingMonth = key === "admin_input.reporting_month";
      
      return (
        <div key={key} className="space-y-1">
          <Label htmlFor={key}>{label}</Label>
          <Controller
            name={key}
            control={control}
            render={({ field: controllerField, fieldState }) => (
              <>
                {isReportingMonth ? (
                  <MonthYearPicker
                    value={controllerField.value as string}
                    onChange={controllerField.onChange}
                    placeholder="Pick a month"
                    disabled={disabled}
                  />
                ) : (
                  <DatePicker
                    value={controllerField.value as string}
                    onChange={controllerField.onChange}
                    placeholder="Pick a date"
                    disabled={disabled}
                  />
                )}
                {fieldState.error && (
                  <p className="text-red-500 text-xs">
                    {fieldState.error.message}
                  </p>
                )}
              </>
            )}
          />
        </div>
      );
    }

    if (type === "select") {
      let options = configOptions || [];
      if (key === "admin_input.insurer_code") options = insurerOptions;
      if (key === "admin_input.broker_code") options = brokerOptions;
      if (key === "admin_input.agent_code") options = agentOptions;
      if (key === "admin_input.admin_child_id") options = adminChildIdOptions;
      if (key === "admin_input.code_type") options = codeTypeOptions;
      if (key === "admin_input.payment_by") options = paymentByOptions;
      if (key === "admin_input.payment_method") options = paymentMethodOptions;
      if (key === "admin_input.payout_on") options = payoutOnOptions;
      if (key === "claimed_by") options = agentOptions;
      if (key === "cutpay_received") options = cutpayReceivedOptions;
      if (key === "extracted_data.major_categorisation")
        options = majorCategorisationOptions;
      if (key === "extracted_data.plan_type") options = planTypeOptions;
      if (key === "extracted_data.fuel_type") options = fuelTypeOptions;
      if (key === "extracted_data.business_type") options = businessTypeOptions;

      const isLoading =
        (key === "admin_input.insurer_code" && insurersLoading) ||
        (key === "admin_input.broker_code" && brokersLoading) ||
        (key === "admin_input.agent_code" && agentsLoading) ||
        (key === "admin_input.admin_child_id" && adminChildIdsLoading);

      return (
        <div key={key} className="space-y-1">
          <Label htmlFor={key}>{label}</Label>
          <Controller
            name={key}
            control={control}
            render={({ field: controllerField, fieldState }) => (
              <>
                <Select
                  onValueChange={controllerField.onChange}
                  defaultValue={controllerField.value as string}
                  disabled={disabled}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={isLoading ? "Loading..." : `Select ${label}`}
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
                  <p className="text-red-500 text-xs">
                    {fieldState.error.message}
                  </p>
                )}
              </>
            )}
          />
        </div>
      );
    }

    if (type === "textarea") {
      return (
        <div key={key} className="space-y-1">
          <Label htmlFor={key}>{label}</Label>
          <Controller
            name={key}
            control={control}
            render={({ field: controllerField, fieldState }) => (
              <>
                <Textarea
                  id={key}
                  {...controllerField}
                  value={String(controllerField.value ?? "")}
                  onChange={(e) => {
                    const value = e.target.value;
                    controllerField.onChange(value === '' ? null : value);
                  }}
                  disabled={disabled}
                  rows={3}
                  placeholder={`Enter ${label.toLowerCase()}...`}
                />
                {fieldState.error && (
                  <p className="text-sm text-red-500">
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
      <div key={key} className="space-y-1">
        <Label htmlFor={key}>{label}</Label>
        <Controller
          name={key}
          control={control}
          render={({ field: controllerField, fieldState }) => (
            <>
              <Input
                id={key}
                type={type === 'number' ? 'number' : 'text'}
                {...controllerField}
                value={String(controllerField.value ?? "")}
                onChange={(e) => {
                  const value = e.target.value;
                  if (type === 'number') {
                    // Convert to number or null for number fields
                    controllerField.onChange(value === '' ? null : Number(value));
                  } else {
                    // Keep as string for text fields
                    controllerField.onChange(value === '' ? null : value);
                  }
                }}
                disabled={disabled}
              />
              {fieldState.error && (
                <p className="text-sm text-red-500">
                  {fieldState.error.message}
                </p>
              )}
            </>
          )}
        />
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit(
      (data) => {
        console.log('Form submitted with data:', data);
        onSubmit(data);
      },
      (errors) => {
        console.log('Form validation errors:', errors);
        toast.error('Please fix the form errors before submitting');
      }
    )} className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Admin Input</h1>
        <div className="flex gap-2">
          <Button
            type="button"
            onClick={async () => {
              await debugIndexedDB();
              
              // Run document validation
              const validation = await validateDocumentsForUpload();
              console.log('� Document validation complete:', validation);
              
              console.log('�🛠️ Development helpers available:');
              console.log('- saveFileToIndexedDB(key, file) - Save file to IndexedDB');
              console.log('- getFileFromIndexedDB(key) - Retrieve file from IndexedDB');
              console.log('- validateDocumentsForUpload() - Check available documents');
              console.log('- getAllAvailableDocuments() - Get document availability map');
              console.log('- documentExistsInDB(key) - Check if specific document exists');
              
              // Expose functions to window for testing (development only)
              const w = window as typeof window & Record<string, unknown>;
              w.saveFileToIndexedDB = saveFileToIndexedDB;
              w.getFileFromIndexedDB = getFileFromIndexedDB;
              w.validateDocumentsForUpload = validateDocumentsForUpload;
              w.getAllAvailableDocuments = getAllAvailableDocuments;
              w.documentExistsInDB = documentExistsInDB;
            }}
            variant="outline"
            size="sm"
          >
            🔍 Debug DB
          </Button>
          <Button
            type="button"
            onClick={() => setIsViewerOpen(!isViewerOpen)}
            variant="outline"
          >
            {isViewerOpen ? "Hide" : "Show"} Document
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Extracted Data</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {formFields.filter((f) => f.section === "extracted").map(renderField)}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Admin Input</CardTitle>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsViewerOpen(!isViewerOpen)}
          >
            {isViewerOpen ? (
              <PanelRightClose className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
            <span className="sr-only">Toggle Document Viewer</span>
          </Button>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {formFields.filter((f) => f.section === "admin").map(renderField)}
          
          {/* Custom Cutpay Received Fields */}
          <div className="space-y-1">
            <Label htmlFor="cutpay_received_status">Cutpay Received</Label>
            <Controller
              name="cutpay_received_status"
              control={control}
              render={({ field: controllerField, fieldState }) => (
                <>
                  <Select
                    onValueChange={controllerField.onChange}
                    defaultValue={controllerField.value as string}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="No">No</SelectItem>
                      <SelectItem value="Yes">Yes</SelectItem>
                      <SelectItem value="Partial">Partial</SelectItem>
                    </SelectContent>
                  </Select>
                  {fieldState.error && (
                    <p className="text-red-500 text-xs">
                      {fieldState.error.message}
                    </p>
                  )}
                </>
              )}
            />
          </div>

          {/* Conditional Amount Field */}
          {(watch('cutpay_received_status') === 'Yes' || watch('cutpay_received_status') === 'Partial') && (
            <div className="space-y-1">
              <Label htmlFor="cutpay_received">Amount</Label>
              <Controller
                name="cutpay_received"
                control={control}
                render={({ field: controllerField, fieldState }) => (
                  <>
                    <Input
                      id="cutpay_received"
                      type="number"
                      step="0.01"
                      {...controllerField}
                      value={String(controllerField.value ?? "")}
                      onChange={(e) => {
                        const value = e.target.value;
                        controllerField.onChange(value === '' ? null : parseFloat(value));
                      }}
                      placeholder="Enter amount"
                    />
                    {fieldState.error && (
                      <p className="text-red-500 text-xs">
                        {fieldState.error.message}
                      </p>
                    )}
                  </>
                )}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Calculations control={control} setValue={setValue} />

      <Card>
        <CardHeader>
          <CardTitle>Calculations</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {formFields
            .filter((f) => f.section === "calculation")
            .map(renderField)}
        </CardContent>
      </Card>

      <div className="flex justify-between mt-6">
        <Button type="button" onClick={onPrev} variant="outline" disabled={isSubmitting}>
          Previous
        </Button>
        <Button 
          type="submit" 
          disabled={isSubmitting} 
          className="min-w-[120px]"
        >
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isSubmitting ? "Processing..." : "Submit & Next"}
        </Button>
      </div>

      {/* Loading Dialog */}
      <LoadingDialog
        open={isSubmitting}
        title="Creating Cutpay Transaction"
        steps={submissionSteps}
      />
    </form>
  );
};

export default AdminInputForm;
