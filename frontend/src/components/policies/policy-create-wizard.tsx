"use client";

import { useState } from "react";
import PolicyPdfUpload from "@/components/forms/policy-pdf-upload";
import AdditionalDocumentsUpload, { DocumentTypeConfig } from "@/components/forms/additional-documents-upload";
import PolicyReviewForm from "./policy-review-form";
import { useExtractPdfData } from "@/hooks/policyQuery";
import { FileText } from "lucide-react";

const docTypes: DocumentTypeConfig[] = [
  {
    key: "kyc_documents",
    title: "KYC Documents",
    description: "Upload KYC PDF(s) if available",
    icon: FileText,
    color: "text-blue-600",
    borderColor: "border-blue-300",
    bgColor: "bg-blue-50",
  },
  {
    key: "rc_document",
    title: "RC Document",
    description: "Upload RC PDF if available",
    icon: FileText,
    color: "text-purple-600",
    borderColor: "border-purple-300",
    bgColor: "bg-purple-50",
  },
  {
    key: "previous_policy",
    title: "Previous Policy",
    description: "Upload previous policy PDF if available",
    icon: FileText,
    color: "text-amber-600",
    borderColor: "border-amber-300",
    bgColor: "bg-amber-50",
  },
];

const PolicyCreateWizard = () => {
  const [step, setStep] = useState(1);
  const [documents, setDocuments] = useState<{ [key: string]: File | null }>({
    kyc_documents: null,
    rc_document: null,
    previous_policy: null,
  });
  const extractHook = useExtractPdfData;

  return (
    <div className="space-y-6">
      {step === 1 && (
        <PolicyPdfUpload
          onNext={() => setStep(2)}
          useExtractionHook={extractHook}
        />
      )}
      {step === 2 && (
        <AdditionalDocumentsUpload
          documentTypes={docTypes}
          documents={documents}
          setDocuments={setDocuments}
          onPrev={() => setStep(1)}
          onNext={() => setStep(3)}
        />
      )}
      {step === 3 && (
        <PolicyReviewForm
          onPrev={() => setStep(2)}
          onSuccess={() => setStep(1)}
        />
      )}
    </div>
  );
};

export default PolicyCreateWizard;


