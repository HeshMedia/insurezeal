"use client";

import { useState, useRef } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Upload,
  Download,
  CheckCircle,
  AlertCircle,
  Clock,
  Eye,
  Loader2,
  LayoutDashboard,
  TableProperties,
  Info,
  FileUp,
  FileSearch,
  Plus,
  X,
} from "lucide-react";
import {
  useUniversalInsurersList,
  useUploadUniversalRecord,
  useDownloadUniversalTemplate,
  usePreviewUniversalRecord,
  useReconciliationSummary,
} from "@/hooks/universalQuery";
import {
  UniversalUploadResponse,
  UniversalPreviewResponse,
  UniversalUploadParams,
} from "@/types/universalrecords.types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { InsurerMappingDisplay } from "./insurer-mapping-display";

// Main Component
export function UniversalRecordManagement({
  className,
}: {
  className?: string;
}) {
  const [selectedInsurer, setSelectedInsurer] = useState<string>("");
  const [quarterYearPairs, setQuarterYearPairs] = useState<{quarter: string, year: string}[]>([]);
  const [tempQuarter, setTempQuarter] = useState<string>("");
  const [tempYear, setTempYear] = useState<string>("");
  const { data: insurersData, isLoading: isLoadingInsurers } =
    useUniversalInsurersList();

  return (
    <div
      className={cn(
        "min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-6",
        className
      )}
    >
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header Section */}
        <div className="text-center space-y-3">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
            Universal Record Management
          </h1>
          <p className="text-base md:text-lg text-slate-600 max-w-2xl mx-auto">
            Upload, reconcile, and manage data from various insurers with our
            streamlined platform.
          </p>
        </div>

        {/* Insurer Selection Card */}
        <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl text-slate-800">
              Configuration
            </CardTitle>
            <CardDescription className="text-slate-600">
              Choose an insurer and optionally select target quarters and years for upload.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Insurer Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Insurer *
                </label>
                <Select
                  onValueChange={setSelectedInsurer}
                  value={selectedInsurer}
                  disabled={isLoadingInsurers}
                >
                  <SelectTrigger className="w-full h-12 text-base border-slate-200 focus:border-slate-400 focus:ring-slate-400">
                    <SelectValue
                      placeholder={
                        isLoadingInsurers
                          ? "Loading insurers..."
                          : "Select an insurer"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {insurersData?.insurers.map((insurer) => (
                      <SelectItem
                        key={insurer}
                        value={insurer}
                        className="text-base py-3"
                      >
                        {insurer}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Quarter Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Target Quarters & Years (Optional)
                </label>
                
                {/* Add New Pair Section */}
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Select onValueChange={setTempQuarter} value={tempQuarter}>
                      <SelectTrigger className="flex-1 h-10 text-sm">
                        <SelectValue placeholder="Quarter" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Q1</SelectItem>
                        <SelectItem value="2">Q2</SelectItem>
                        <SelectItem value="3">Q3</SelectItem>
                        <SelectItem value="4">Q4</SelectItem>
                      </SelectContent>
                    </Select>
                 <Select onValueChange={setTempYear} value={tempYear}>
                  <SelectTrigger className="flex-1 h-10 text-sm">
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    {Array.from({ length: new Date().getFullYear() - 1999 }, (_, i) => {
                      const y = String(new Date().getFullYear() - i);
                      return <SelectItem key={y} value={y}>{y}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>

                    
                    <Button
                      size="sm"
                      onClick={() => {
                        if (tempQuarter && tempYear && !quarterYearPairs.some(p => p.quarter === tempQuarter && p.year === tempYear)) {
                          setQuarterYearPairs([...quarterYearPairs, { quarter: tempQuarter, year: tempYear }]);
                          setTempQuarter("");
                          setTempYear("");
                        }
                      }}
                      disabled={!tempQuarter || !tempYear || quarterYearPairs.some(p => p.quarter === tempQuarter && p.year === tempYear)}
                      className="h-10 px-3"
                      title={
                        !tempQuarter || !tempYear 
                          ? "Select both quarter and year"
                          : quarterYearPairs.some(p => p.quarter === tempQuarter && p.year === tempYear)
                          ? "This quarter-year pair is already added"
                          : "Add quarter-year pair"
                      }
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {/* Display Selected Pairs as Tags */}
                  {quarterYearPairs.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {quarterYearPairs.map((pair, index) => (
                        <Badge
                          key={index}
                          variant="secondary"
                          className="px-3 py-1 bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors"
                        >
                          Q{pair.quarter}-{pair.year}
                          <button
                            onClick={() => {
                              setQuarterYearPairs(quarterYearPairs.filter((_, i) => i !== index));
                            }}
                            className="ml-2 hover:text-blue-900"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                  
                  {quarterYearPairs.length === 0 && (
                    <div className="text-xs text-slate-500 space-y-1">
                      <p className="text-slate-400">Add quarter-year pairs to target specific periods</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Selection Summary */}
            {selectedInsurer && quarterYearPairs.length > 0 && (
              <Alert className="mt-4 border-blue-200 bg-blue-50">
                <Info className="h-5 w-5 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  <strong>Configuration:</strong> Will process {selectedInsurer} records for {quarterYearPairs.map(p => `Q${p.quarter}-${p.year}`).join(', ')}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Main Tabs */}
        <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
          <CardContent className="p-0">
            <Tabs defaultValue="upload" className="w-full">
              <div className="border-b bg-slate-50/50 px-6 py-2">
                <TabsList className="grid w-full max-w-2xl grid-cols-1 md:grid-cols-3 h-auto bg-slate-100 p-1">
                  <TabsTrigger
                    value="upload"
                    className="py-3 px-4 text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm"
                  >
                    <FileUp className="w-4 h-4 mr-2" />
                    File Upload
                  </TabsTrigger>
                  <TabsTrigger
                    value="dashboard"
                    disabled={!selectedInsurer}
                    className="py-3 px-4 text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm"
                  >
                    <LayoutDashboard className="w-4 h-4 mr-2" />
                    Dashboard
                  </TabsTrigger>
                  <TabsTrigger
                    value="mappings"
                    disabled={!selectedInsurer}
                    className="py-3 px-4 text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm"
                  >
                    <TableProperties className="w-4 h-4 mr-2" />
                    Mappings
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="p-6">
                <TabsContent value="upload" className="mt-0">
                  <FileUploadTab 
                    selectedInsurer={selectedInsurer} 
                    quarterYearPairs={quarterYearPairs}
                  />
                </TabsContent>
                <TabsContent value="dashboard" className="mt-0">
                  <ReconciliationDashboardTab
                    selectedInsurer={selectedInsurer}
                  />
                </TabsContent>
                <TabsContent value="mappings" className="mt-0">
                  <InsurerMappingsTab selectedInsurer={selectedInsurer} />
                </TabsContent>
              </div>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EmptyState({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: React.ElementType;
}) {
  return (
    <div className="text-center py-20 px-6">
      <div className="max-w-md mx-auto">
        <div className="w-20 h-20 mx-auto mb-6 bg-slate-100 rounded-full flex items-center justify-center">
          <Icon className="h-10 w-10 text-slate-400" />
        </div>
        <h3 className="text-xl font-semibold text-slate-900 mb-3">{title}</h3>
        <p className="text-slate-600 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

function FileUploadTab({ 
  selectedInsurer, 
  quarterYearPairs 
}: { 
  selectedInsurer: string;
  quarterYearPairs: {quarter: string, year: string}[];
}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] =
    useState<UniversalUploadResponse | null>(null);
  const [previewResult, setPreviewResult] =
    useState<UniversalPreviewResponse | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useUploadUniversalRecord();
  const downloadTemplateMutation = useDownloadUniversalTemplate();
  const previewMutation = usePreviewUniversalRecord();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (
        !file.name.toLowerCase().endsWith(".csv") &&
        !file.name.toLowerCase().endsWith(".xlsx")
      ) {
        toast.error("Please select a CSV or XLSX file");
        return;
      }
      setSelectedFile(file);
      setUploadResult(null);
      setPreviewResult(null);
    }
  };

  const handlePreview = async () => {
    if (!selectedFile || !selectedInsurer) return;
    try {
      const result = await previewMutation.mutateAsync({
        file: selectedFile,
        insurer_name: selectedInsurer,
        preview_rows: 10,
      });
      setPreviewResult(result);
      setShowPreview(true);
      toast.success("Preview generated successfully!");
    } catch (error: unknown) {
      toast.error(
        `Preview failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !selectedInsurer) return;
    try {
      const uploadParams: UniversalUploadParams = {
        file: selectedFile,
        insurer_name: selectedInsurer,
      };
      
      // Add quarters and years parameters if selected
      if (quarterYearPairs.length > 0) {
        uploadParams.quarters = quarterYearPairs.map(p => p.quarter).join(',');
        uploadParams.years = quarterYearPairs.map(p => p.year).join(',');
      }
      
      const result = await uploadMutation.mutateAsync(uploadParams);
      setUploadResult(result);
      toast.success(result.message || "File processed successfully!");
    } catch (error: unknown) {
      toast.error(
        `Upload failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const blob = await downloadTemplateMutation.mutateAsync({
        insurer_name: selectedInsurer,
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${selectedInsurer}_template.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Template downloaded successfully!");
    } catch (error: unknown) {
      toast.error(
        `Download failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  };

  if (!selectedInsurer) {
    return (
      <EmptyState
        title="No Insurer Selected"
        description="Please select an insurer from the dropdown above to upload a file."
        icon={Info}
      />
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Step 1: Download Template */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-slate-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">
              1
            </div>
            <div>
              <CardTitle className="text-lg">
                Download Template (Optional)
              </CardTitle>
              <CardDescription className="mt-1">
                Download the standard template for {selectedInsurer} to ensure
                correct formatting.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <Button
            variant="outline"
            size="lg"
            className="w-full sm:w-auto h-12 text-base border-slate-300 hover:bg-slate-50"
            onClick={handleDownloadTemplate}
            disabled={downloadTemplateMutation.isPending}
          >
            {downloadTemplateMutation.isPending ? (
              <Loader2 className="h-5 w-5 mr-3 animate-spin" />
            ) : (
              <Download className="h-5 w-5 mr-3" />
            )}
            {downloadTemplateMutation.isPending
              ? "Downloading..."
              : `Download ${selectedInsurer} Template`}
          </Button>
        </CardContent>
      </Card>

      {/* Step 2: Upload File */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-slate-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">
              2
            </div>
            <div>
              <CardTitle className="text-lg">Upload File</CardTitle>
              <CardDescription className="mt-1">
                Select the CSV or XLSX file you want to process for{" "}
                {selectedInsurer}.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div
            className="group relative flex flex-col justify-center items-center w-full px-8 py-12 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer transition-all duration-200 hover:border-slate-400 hover:bg-slate-50/50"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx"
              onChange={handleFileSelect}
              className="hidden"
            />
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-slate-100 rounded-full flex items-center justify-center group-hover:bg-slate-200 transition-colors">
                <Upload className="h-8 w-8 text-slate-500" />
              </div>
              <div>
                <p className="text-lg font-medium text-slate-700">
                  Click to upload or drag and drop
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  CSV or XLSX files only
                </p>
              </div>
              {selectedFile && (
                <Badge
                  variant="secondary"
                  className="mt-4 px-4 py-2 text-sm font-medium bg-slate-100 text-slate-700"
                >
                  {selectedFile.name}
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Step 3: Preview & Process */}
      {selectedFile && (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="bg-slate-50/50">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-slate-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                3
              </div>
              <div>
                <CardTitle className="text-lg">Preview & Process</CardTitle>
                <CardDescription className="mt-1">
                  Preview the file to check mappings or proceed directly to
                  upload and process.
                  {quarterYearPairs.length > 0 && (
                    <span className="block mt-2 text-blue-600 font-medium">
                      Target: {quarterYearPairs.map(p => `Q${p.quarter}-${p.year}`).join(', ')}
                    </span>
                  )}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <Alert className="border-amber-200 bg-amber-50">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              <AlertDescription className="text-amber-800">
                <strong>Important:</strong> This operation will update existing
                records and cannot be undone. Please ensure your data is
                accurate.
              </AlertDescription>
            </Alert>

            <div className="flex flex-col sm:flex-row gap-4">
              <Dialog open={showPreview} onOpenChange={setShowPreview}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={handlePreview}
                    disabled={previewMutation.isPending}
                    className="flex-1 h-12 text-base border-slate-300 hover:bg-slate-50"
                  >
                    {previewMutation.isPending ? (
                      <Loader2 className="h-5 w-5 mr-3 animate-spin" />
                    ) : (
                      <Eye className="h-5 w-5 mr-3" />
                    )}
                    {previewMutation.isPending
                      ? "Generating Preview..."
                      : "Preview Data"}
                  </Button>
                </DialogTrigger>
                <PreviewDialogContent result={previewResult} />
              </Dialog>

              <Button
                size="lg"
                onClick={handleUpload}
                disabled={uploadMutation.isPending}
                className="flex-1 h-12 text-base bg-slate-900 hover:bg-slate-800"
              >
                {uploadMutation.isPending ? (
                  <Loader2 className="h-5 w-5 mr-3 animate-spin" />
                ) : (
                  <FileUp className="h-5 w-5 mr-3" />
                )}
                {uploadMutation.isPending
                  ? "Processing..."
                  : "Upload & Process"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {uploadMutation.isSuccess && uploadResult && (
        <UploadResultDisplay result={uploadResult} />
      )}
    </div>
  );
}

function UploadResultDisplay({ result }: { result: UniversalUploadResponse }) {
  const { report, processing_time_seconds } = result;
  const { stats, change_details } = report;

  return (
    <Card className="border-green-200 shadow-lg">
      <CardHeader className="bg-green-50">
        <CardTitle className="flex items-center gap-3 text-green-900">
          <CheckCircle className="h-6 w-6 text-green-600" />
          Processing Complete
        </CardTitle>
        <CardDescription className="text-green-700">
          Report for {report.insurer_name} from file{" "}
          {report.file_info.filename as string}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6 space-y-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Records"
            value={stats.total_records_processed}
            variant="default"
          />
          <StatCard
            title="Records Added"
            value={stats.total_records_added}
            variant="success"
          />
          <StatCard
            title="Records Updated"
            value={stats.total_records_updated}
            variant="info"
          />
          <StatCard
            title="Records Skipped"
            value={stats.total_records_skipped}
            variant="warning"
          />
        </div>

        <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
          <Clock className="h-5 w-5 text-slate-600" />
          <span className="text-slate-700 font-medium">
            Processing completed in {processing_time_seconds.toFixed(2)} seconds
          </span>
        </div>

        {stats.error_details.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-semibold text-red-600 flex items-center gap-2 text-lg">
              <AlertCircle className="h-5 w-5" />
              Errors ({stats.total_errors})
            </h4>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-h-48 overflow-y-auto">
              {stats.error_details.map((error, index) => (
                <div
                  key={index}
                  className="text-sm text-red-700 py-2 border-b border-red-200 last:border-0"
                >
                  {error}
                </div>
              ))}
            </div>
          </div>
        )}

        {change_details.length > 0 && (
          <div className="space-y-4">
            <h4 className="font-semibold text-slate-900 text-lg">
              Change Details ({change_details.length} records)
            </h4>
            <div className="bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
              <div className="max-h-80 overflow-y-auto">
                {change_details.slice(0, 20).map((detail, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 border-b border-slate-200 last:border-0 hover:bg-white transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <Badge
                        variant={
                          detail.action === "updated"
                            ? "default"
                            : detail.action === "added"
                            ? "secondary"
                            : "outline"
                        }
                        className="min-w-fit"
                      >
                        {detail.action}
                      </Badge>
                      <div className="min-w-0">
                        <div
                          className="font-medium text-slate-900 truncate"
                          title={detail.policy_number}
                        >
                          {detail.policy_number}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          {detail.record_type}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-slate-600 font-medium">
                      {Object.keys(detail.changed_fields).length} fields changed
                    </div>
                  </div>
                ))}
              </div>
              {change_details.length > 20 && (
                <div className="text-center py-4 text-sm text-slate-500 bg-slate-100 border-t">
                  ... and {change_details.length - 20} more records
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PreviewDialogContent({
  result,
}: {
  result: UniversalPreviewResponse | null;
}) {
  if (!result) {
    return (
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Data Preview</DialogTitle>
        </DialogHeader>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DialogContent>
    );
  }

  return (
    <DialogContent className="sm:max-w-6xl max-h-[90vh]">
      <DialogHeader>
        <DialogTitle className="text-xl">
          Data Preview for {result.insurer_name}
        </DialogTitle>
        <CardDescription className="text-base">
          Showing first {result.preview_data.length} of {result.total_rows}{" "}
          total rows.
        </CardDescription>
      </DialogHeader>

      {result.unmapped_headers.length > 0 && (
        <Alert variant="destructive" className="my-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Unmapped Headers Found</AlertTitle>
          <AlertDescription>
            {result.unmapped_headers.join(", ")}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex-1 overflow-hidden rounded-lg border border-slate-200">
        <div className="max-h-[60vh] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-slate-50 z-10">
              <TableRow>
                {result.mapped_headers.map((h) => (
                  <TableHead
                    key={h}
                    className="font-semibold text-slate-700 py-3 px-4"
                  >
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.preview_data.map((row, rowIndex) => (
                <TableRow key={rowIndex} className="hover:bg-slate-50">
                  {result.mapped_headers.map((h) => (
                    <TableCell
                      key={`${rowIndex}-${h}`}
                      className="py-3 px-4 text-sm"
                    >
                      {String(row[h] ?? "")}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </DialogContent>
  );
}

function ReconciliationDashboardTab({
  selectedInsurer,
}: {
  selectedInsurer: string;
}) {
  const { data, isLoading, error } = useReconciliationSummary({
    insurer_name: selectedInsurer,
  });

  if (!selectedInsurer) {
    return (
      <EmptyState
        title="No Insurer Selected"
        description="Please select an insurer to view its reconciliation dashboard."
        icon={Info}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-24">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-slate-600 mx-auto" />
          <p className="text-slate-600">Loading reconciliation data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="max-w-2xl mx-auto">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    );
  }

  if (!data) {
    return (
      <EmptyState
        title="No Summary Data"
        description={`No reconciliation summary is available for ${selectedInsurer}.`}
        icon={FileSearch}
      />
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="bg-slate-50/50">
          <CardTitle className="text-xl text-slate-800">
            Overall Data Health
          </CardTitle>
          <CardDescription>
            Key metrics for data quality and coverage.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid gap-8 md:grid-cols-2">
            <ProgressCard
              title="System Data Coverage"
              description="Percentage of policies in the uploaded file that are also in our system."
              value={data.coverage_percentage}
            />
            <ProgressCard
              title="Data Variance"
              description="Percentage of data fields that do not match for overlapping policies."
              value={data.data_variance_percentage}
              isVariance
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Matches"
          value={data.total_matches}
          variant="success"
        />
        <StatCard
          title="Total Mismatches"
          value={data.total_mismatches}
          variant="error"
        />
        <StatCard
          title="Missing in System"
          value={data.total_missing_in_system}
          variant="warning"
        />
        <StatCard
          title="Missing in File"
          value={data.total_missing_in_universal}
          variant="info"
        />
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="bg-slate-50/50">
          <CardTitle className="text-xl text-slate-800">
            Top Mismatched Fields
          </CardTitle>
          <CardDescription>
            Fields with the highest number of discrepancies.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="font-semibold text-slate-700 py-4">
                    Field Name
                  </TableHead>
                  <TableHead className="text-right font-semibold text-slate-700 py-4">
                    Mismatch Count
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.top_mismatched_fields.map((field) => (
                  <TableRow
                    key={field.field_name}
                    className="hover:bg-slate-50"
                  >
                    <TableCell className="font-medium py-4">
                      {field.field_name}
                    </TableCell>
                    <TableCell className="text-right py-4 font-medium text-red-600">
                      {field.mismatch_count}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
// #endregion

// #region Insurer Mappings Tab
function InsurerMappingsTab({ selectedInsurer }: { selectedInsurer: string }) {
  if (!selectedInsurer) {
    return (
      <EmptyState
        title="No Insurer Selected"
        description="Please select an insurer to view its header mappings."
        icon={Info}
      />
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <InsurerMappingDisplay insurerName={selectedInsurer} />
    </div>
  );
}
// #endregion

// #region Helper Components
function StatCard({
  title,
  value,
  variant = "default",
}: {
  title: string;
  value: number | string;
  variant?: "default" | "success" | "error" | "warning" | "info";
}) {
  const variantStyles = {
    default: "border-slate-200 bg-white",
    success: "border-green-200 bg-green-50",
    error: "border-red-200 bg-red-50",
    warning: "border-amber-200 bg-amber-50",
    info: "border-blue-200 bg-blue-50",
  };

  const valueStyles = {
    default: "text-slate-900",
    success: "text-green-700",
    error: "text-red-700",
    warning: "text-amber-700",
    info: "text-blue-700",
  };

  return (
    <Card className={cn("shadow-sm", variantStyles[variant])}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-slate-600">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className={cn("text-3xl font-bold", valueStyles[variant])}>
          {value.toLocaleString()}
        </div>
      </CardContent>
    </Card>
  );
}

function ProgressCard({
  title,
  description,
  value,
  isVariance = false,
}: {
  title: string;
  description: string;
  value: number;
  isVariance?: boolean;
}) {
  const getColor = () => {
    if (isVariance) {
      if (value > 20) return "bg-red-500";
      if (value > 5) return "bg-amber-500";
      return "bg-green-500";
    }
    return "bg-slate-900";
  };

  const getTextColor = () => {
    if (isVariance) {
      if (value > 20) return "text-red-700";
      if (value > 5) return "text-amber-700";
      return "text-green-700";
    }
    return "text-slate-900";
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-baseline">
        <h4 className="text-lg font-semibold text-slate-900">{title}</h4>
        <span className={cn("text-2xl font-bold", getTextColor())}>
          {value.toFixed(1)}%
        </span>
      </div>
      <div className="space-y-2">
        <Progress value={value} className="h-3" />
        <div
          className={cn("w-full h-3 rounded-full", getColor())}
          style={{ width: `${value}%` }}
        />
      </div>
      <p className="text-sm text-slate-600 leading-relaxed">{description}</p>
    </div>
  );
}
// #endregion
