"use client";

import { useState, useCallback } from "react";
import { useAtom } from "jotai";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Upload,
  FileText,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Database,
  Cloud,
  X,
} from "lucide-react";

// Import atoms and utilities
import {
  policyPdfFileAtom,
  policyPdfUrlAtom,
  pdfExtractionDataAtom,
  cutpayLoadingStatesAtom,
  cutpaySuccessStatesAtom,
  cutpayErrorAtom,
  cutpayFormCompletionAtom,
} from "@/lib/atoms/cutpay";

import { saveToIndexedDB } from "@/lib/utils/indexeddb";
import { useCheckPolicyNumberDuplicate } from "@/hooks/policyQuery";

interface PolicyPdfUploadProps {
  onNext: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useExtractionHook: () => { mutateAsync: (file: File) => Promise<any> };
}

const PolicyPdfUpload = ({
  onNext,
  useExtractionHook,
}: PolicyPdfUploadProps) => {
  const [file, setFile] = useAtom(policyPdfFileAtom);
  const [pdfUrl, setPdfUrl] = useAtom(policyPdfUrlAtom);
  const [extractionData, setExtractionData] = useAtom(pdfExtractionDataAtom);
  const [loadingStates, setLoadingStates] = useAtom(cutpayLoadingStatesAtom);
  const [successStates, setSuccessStates] = useAtom(cutpaySuccessStatesAtom);
  const [error, setError] = useAtom(cutpayErrorAtom);
  const [, setFormCompletion] = useAtom(cutpayFormCompletionAtom);

  const [uploadProgress] = useState(0);
  const [isDragActive, setIsDragActive] = useState(false);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);

  const extractPdfMutation = useExtractionHook();
  const checkDuplicateMutation = useCheckPolicyNumberDuplicate();

  // ... rest of the component remains exactly the same as your original code
  const handleFileUpload = useCallback(
    async (selectedFile: File) => {
      try {
        setError(null);
        setLoadingStates((prev) => ({ ...prev, uploadingToIndexedDB: true }));

        // Validate file
        if (selectedFile.type !== "application/pdf") {
          throw new Error("Please select a valid PDF file");
        }

        if (selectedFile.size > 10 * 1024 * 1024) {
          // 10MB limit
          throw new Error("File size must be less than 10MB");
        }

        // Store in IndexedDB
        console.log("📄 Storing PDF in IndexedDB:", selectedFile.name);
        await saveToIndexedDB(selectedFile, "policy_pdf");

        // Create object URL for preview
        const url = URL.createObjectURL(selectedFile);

        // Update state
        setFile(selectedFile);
        setPdfUrl(url);
        setLoadingStates((prev) => ({
          ...prev,
          uploadingToIndexedDB: false,
          extracting: true,
        }));

        // Extract PDF data
        console.log("🔍 Starting PDF extraction...");
        const result = await extractPdfMutation.mutateAsync(selectedFile);

        // Check if extraction was successful
        if (result.extraction_status !== "success" || !result.extracted_data) {
          console.warn(
            "⚠️ PDF extraction completed with warnings:",
            result.errors
          );
          // Still set the data but show a warning
          if (result.errors && result.errors.length > 0) {
            setError(
              `Extraction completed with warnings: ${result.errors.join(", ")}`
            );
          }
        }

        setExtractionData(result);
        setSuccessStates((prev) => ({ ...prev, pdfExtracted: true }));
        setLoadingStates((prev) => ({ ...prev, extracting: false }));

        console.log("✅ PDF extraction completed:", result);
      } catch (err) {
        console.error("❌ Error during PDF upload/extraction:", err);
        setError(err instanceof Error ? err.message : "Upload failed");
        setLoadingStates((prev) => ({
          ...prev,
          uploadingToIndexedDB: false,
          extracting: false,
        }));
      }
    },
    [
      setFile,
      setPdfUrl,
      setError,
      setLoadingStates,
      setExtractionData,
      setSuccessStates,
      extractPdfMutation,
    ]
  );

  const handleFileSelect = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf";
    input.onchange = (e) => {
      const selectedFile = (e.target as HTMLInputElement).files?.[0];
      if (selectedFile) {
        handleFileUpload(selectedFile);
      }
    };
    input.click();
  }, [handleFileUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragActive(false);

      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) {
        handleFileUpload(droppedFile);
      }
    },
    [handleFileUpload]
  );

  const handleRemoveFile = useCallback(() => {
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
    }
    setFile(null);
    setPdfUrl(null);
    setExtractionData(null);
    setSuccessStates((prev) => ({ ...prev, pdfExtracted: false }));
    setError(null);
  }, [
    pdfUrl,
    setFile,
    setPdfUrl,
    setExtractionData,
    setSuccessStates,
    setError,
  ]);

  const handleContinue = useCallback(async () => {
    if (
      successStates.pdfExtracted &&
      extractionData &&
      extractionData.extracted_data
    ) {
      const extractedPolicyNumber: string | undefined =
        extractionData.extracted_data?.policy_number ??
        extractionData.extracted_data?.formatted_policy_number ??
        undefined;

      if (extractedPolicyNumber) {
        try {
          setCheckingDuplicate(true);
          const result = await checkDuplicateMutation.mutateAsync({
            policy_number: extractedPolicyNumber,
          });
          if (result?.is_duplicate) {
            setError(
              result?.message ||
                "Duplicate policy number detected. Please verify before proceeding."
            );
            setCheckingDuplicate(false);
            return;
          }
        } catch {
          setError(
            "Could not verify duplicates right now. Please try again in a moment."
          );
          setCheckingDuplicate(false);
          return;
        }
        setCheckingDuplicate(false);
      }

      setFormCompletion((prev) => ({ ...prev, step1Complete: true }));
      onNext();
    }
  }, [successStates.pdfExtracted, extractionData, setFormCompletion, onNext, checkDuplicateMutation, setError]);

  const isLoading =
    loadingStates.uploadingToIndexedDB || loadingStates.extracting;
  const isCompleted =
    successStates.pdfExtracted &&
    extractionData &&
    extractionData.extracted_data;

  return (
    <div className="space-y-6">
      

      {/* Error Display */}
      {error && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
        >
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </motion.div>
      )}

      {/* Upload Area */}
      <Card className="border-2 border-dashed transition-all duration-300 hover:border-blue-300">
        <CardContent className="p-8">
          {file ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6"
            >
              {/* File Info */}
              <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <FileText className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{file.name}</p>
                    <p className="text-sm text-gray-500">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {isCompleted && (
                    <Badge
                      variant="secondary"
                      className="bg-green-100 text-green-700"
                    >
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Extracted
                    </Badge>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRemoveFile}
                    disabled={isLoading}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Extraction Progress */}
              {isLoading && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">
                      {loadingStates.uploadingToIndexedDB
                        ? "Storing document..."
                        : "Extracting data..."}
                    </span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-2" />
                  <div className="flex items-center justify-center space-x-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Processing your document</span>
                  </div>
                </div>
              )}

              {/* Success State */}
              {isCompleted && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  <Alert className="border-green-200 bg-green-50">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                      <strong>Data extracted successfully!</strong>
                      {extractionData?.extraction_status === "success"
                        ? " Key information has been extracted from your policy document."
                        : " Extraction completed with some issues."}
                    </AlertDescription>
                  </Alert>

                  {/* Extracted Data Preview */}
                  {extractionData && (
                    <Card className="bg-gray-50">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center space-x-2">
                          <Database className="h-4 w-4" />
                          <span>Extracted Information Preview</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="font-medium text-gray-600">
                              Policy Number:
                            </span>
                            <p className="text-gray-900">
                              {extractionData.extracted_data?.policy_number ||
                                "Not found"}
                            </p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-600">
                              Registration Number:
                            </span>
                            <p className="text-gray-900">
                              {extractionData.extracted_data
                                ?.registration_number || "Not found"}
                            </p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-600">
                              Gross Premium:
                            </span>
                            <p className="text-gray-900">
                              ₹
                              {extractionData.extracted_data?.gross_premium ||
                                "Not found"}
                            </p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-600">
                              Customer Name:
                            </span>
                            <p className="text-gray-900">
                              {extractionData.extracted_data?.customer_name ||
                                "Not found"}
                            </p>
                          </div>
                          {extractionData.extracted_data?.make_model && (
                            <div>
                              <span className="font-medium text-gray-600">
                                Vehicle Make/Model:
                              </span>
                              <p className="text-gray-900">
                                {extractionData.extracted_data.make_model}
                              </p>
                            </div>
                          )}
                          {extractionData.extracted_data?.product_type && (
                            <div>
                              <span className="font-medium text-gray-600">
                                Product Type:
                              </span>
                              <p className="text-gray-900">
                                {extractionData.extracted_data.product_type}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Show extraction confidence if available */}
                        {extractionData.confidence_scores &&
                          Object.keys(extractionData.confidence_scores).length >
                            0 && (
                            <div className="mt-3 pt-3 border-t border-gray-200">
                              <span className="text-xs text-gray-500">
                                Extraction Confidence:{" "}
                                {Math.round(
                                  Object.values(
                                    extractionData?.confidence_scores || {}
                                  ).reduce((a, b) => a + b, 0) /
                                    Object.values(
                                      extractionData?.confidence_scores || {}
                                    ).length
                                )}
                                %
                              </span>
                            </div>
                          )}
                      </CardContent>
                    </Card>
                  )}
                </motion.div>
              )}
            </motion.div>
          ) : (
            <div
              className={`text-center space-y-4 transition-all duration-300 ${
                isDragActive ? "scale-105" : ""
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                <Upload className="h-8 w-8 text-blue-600" />
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Drop your policy PDF here
                </h3>
                <p className="text-muted-foreground mb-4">
                  or click to browse and select a file
                </p>

                <Button
                  onClick={handleFileSelect}
                  disabled={isLoading}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Cloud className="h-4 w-4 mr-2" />
                  Select PDF File
                </Button>
              </div>

              <div className="text-xs text-muted-foreground space-y-1">
                <p>• Supported format: PDF</p>
                <p>• Maximum file size: 10MB</p>
                <p>• Data extraction powered by AI</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Button */}
      {isCompleted && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-end"
        >
          <Button
            onClick={handleContinue}
            disabled={!isCompleted || checkingDuplicate}
            className="min-w-[160px] bg-green-600 hover:bg-green-700"
          >
            {checkingDuplicate ? (
              <span className="flex items-center">
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Checking duplicates...
              </span>
            ) : (
              "Continue to Documents"
            )}
          </Button>
        </motion.div>
      )}

      {/* Status Footer */}
      <div className="flex items-center justify-center space-x-2 pt-4 text-xs text-muted-foreground">
        <Database className="h-3 w-3" />
        <span>Documents are stored locally in your browser for security</span>
      </div>
    </div>
  );
};

export default PolicyPdfUpload;
