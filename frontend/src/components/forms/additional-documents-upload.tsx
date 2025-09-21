import { useRef, useState, SetStateAction } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  CheckCircle,
  X,
  AlertCircle,
  Database,
  ArrowRight,
  ArrowLeft,
  File,
  LucideIcon,
} from "lucide-react";

// Import centralized IndexedDB utilities
import { saveToIndexedDB, removeFromIndexedDB } from "@/lib/utils/indexeddb";

export interface DocumentTypeConfig {
  key: string;
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
  borderColor: string;
  bgColor: string;
}

interface AdditionalDocumentsUploadProps<T extends Record<string, File | null>> {
  documentTypes: DocumentTypeConfig[];
  documents: T;
  setDocuments: (update: SetStateAction<T>) => void;
  onNext: () => void;
  onPrev: () => void;
}

const AdditionalDocumentsUpload = <T extends Record<string, File | null>>({
  documentTypes,
  documents,
  setDocuments,
  onNext,
  onPrev,
}: AdditionalDocumentsUploadProps<T>) => {
  const [dragActiveFor, setDragActiveFor] = useState<string | null>(null);
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = async (file: File, documentTypeKey: string) => {
    if (file.type !== "application/pdf") {
      setError(`Please select a valid PDF file for ${documentTypeKey}`);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      // 10MB limit
      setError("File size must be less than 10MB");
      return;
    }

    try {
      console.log(
        `📄 ${documentTypeKey} selected:`,
        file.name,
        `(${(file.size / 1024 / 1024).toFixed(2)}MB)`
      );

      setIsLoading(true);
      await saveToIndexedDB(file, documentTypeKey);

      setDocuments((prev) => ({ ...prev, [documentTypeKey]: file }));
      setError(null);

      console.log(`✅ Successfully stored ${documentTypeKey} in IndexedDB`);
    } catch (err) {
      console.error(`❌ Error storing ${documentTypeKey}:`, err);
      setError(err instanceof Error ? err.message : "Failed to store document");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent, documentTypeKey: string) => {
    e.preventDefault();
    setDragActiveFor(null);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0], documentTypeKey);
    }
  };

  const handleFileInput = (
    e: React.ChangeEvent<HTMLInputElement>,
    documentTypeKey: string
  ) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0], documentTypeKey);
    }
  };

  const removeFile = async (documentTypeKey: string) => {
    try {
      setIsLoading(true);
      // Delete from IndexedDB
      await removeFromIndexedDB(documentTypeKey);

      // Update local state
      setDocuments((prev) => ({ ...prev, [documentTypeKey]: null }));
      const inputRef = fileInputRefs.current[documentTypeKey];
      if (inputRef) {
        inputRef.value = "";
      }
      console.log(`🗑️ Removed ${documentTypeKey} from both state and IndexedDB`);
    } catch (err) {
      console.error(`❌ Error removing ${documentTypeKey}:`, err);
      // Still update local state even if IndexedDB deletion fails
      setDocuments((prev) => ({ ...prev, [documentTypeKey]: null }));
      const inputRef = fileInputRefs.current[documentTypeKey];
      if (inputRef) {
        inputRef.value = "";
      }
    } finally {
      setIsLoading(false);
    }
  };

  const uploadedCount = Object.values(documents).filter(Boolean).length;
  const allDocumentsUploaded = uploadedCount === documentTypes.length;

  const handleCompleteStep = () => {
    console.log(
      `🎉 Step 2 completed! Uploaded ${uploadedCount}/${documentTypes.length} documents`
    );
    onNext();
  };

  return (
    <div className="space-y-6">
      {/* Progress Overview */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Document Upload Progress</span>
            <Badge variant={allDocumentsUploaded ? "default" : "secondary"}>
              {uploadedCount}/{documentTypes.length} uploaded
            </Badge>
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Error Display */}
      {error && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
        >
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </motion.div>
      )}

      {/* Document Upload Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {documentTypes.map((docType) => {
          const file = documents[docType.key as keyof T];
          const isUploaded = !!file;

          return (
            <Card
              key={docType.key}
              className={`transition-all duration-300 ${
                dragActiveFor === docType.key
                  ? `${docType.borderColor} shadow-lg`
                  : isUploaded
                  ? "border-green-300 shadow-md"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <CardHeader className={`${isUploaded ? "bg-green-50" : docType.bgColor}`}>
                <CardTitle className="flex items-center space-x-2 text-sm">
                  <div
                    className={`p-2 rounded-lg ${
                      isUploaded ? "bg-green-100 text-green-600" : docType.color
                    }`}
                  >
                    {isUploaded ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <docType.icon className="h-4 w-4" />
                    )}
                  </div>
                  <span>{docType.title}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground mb-4">
                  {docType.description}
                </p>

                {/* Upload Area */}
                <div
                  className={`border-2 border-dashed rounded-lg p-4 transition-all duration-300 ${
                    dragActiveFor === docType.key
                      ? `${docType.borderColor} ${docType.bgColor}`
                      : isUploaded
                      ? "border-green-300 bg-green-50"
                      : "border-gray-300 hover:border-gray-400 bg-gray-50"
                  }`}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    setDragActiveFor(docType.key);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    setDragActiveFor(null);
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDrop(e, docType.key)}
                >
                  {isUploaded && file ? (
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="text-center space-y-2"
                    >
                      <File className="h-8 w-8 text-green-600 mx-auto" />
                      <div>
                        <p className="font-medium text-sm text-gray-900">
                          {file.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeFile(docType.key)}
                        className="mt-2"
                        disabled={isLoading}
                      >
                        <X className="h-3 w-3 mr-1" />
                        Remove
                      </Button>
                    </motion.div>
                  ) : (
                    <div className="text-center space-y-2">
                      <Upload className="h-6 w-6 text-gray-400 mx-auto" />
                      <div>
                        <p className="text-sm font-medium text-gray-700">
                          Drop PDF here
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            fileInputRefs.current[docType.key]?.click()
                          }
                          className="mt-2"
                          disabled={isLoading}
                        >
                          Browse
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <Input
                  ref={(el) => {
                    fileInputRefs.current[docType.key] = el;
                  }}
                  type="file"
                  accept=".pdf"
                  onChange={(e) => handleFileInput(e, docType.key)}
                  className="hidden"
                />
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between pt-6">
        <div className="flex space-x-2">
          <Button
            variant="outline"
            onClick={onPrev}
            disabled={isLoading}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Previous Step
          </Button>
        </div>

        <Button
          onClick={handleCompleteStep}
          className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Database className="h-4 w-4 mr-2 animate-pulse" />
              Storing...
            </>
          ) : (
            <>
              {uploadedCount > 0 ? "Continue" : "Skip"}
              <ArrowRight className="h-4 w-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default AdditionalDocumentsUpload;
