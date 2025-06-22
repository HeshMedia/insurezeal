'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { 
  Upload, 
  Download, 
  FileText, 
  CheckCircle, 
  AlertCircle,
  Clock,
  TrendingUp,
  Database
} from 'lucide-react'
import { useUploadUniversalRecord, useDownloadUniversalRecordTemplate } from '@/hooks/adminQuery'
import { UniversalRecordUploadResponse } from '@/types/admin.types'
import { toast } from 'sonner'

interface UniversalRecordManagementProps {
  className?: string
}

export function UniversalRecordManagement({ className }: UniversalRecordManagementProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadResult, setUploadResult] = useState<UniversalRecordUploadResponse | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  const uploadMutation = useUploadUniversalRecord()
  const downloadTemplateMutation = useDownloadUniversalRecordTemplate()

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      if (!file.name.toLowerCase().endsWith('.csv')) {
        toast.error('Please select a CSV file')
        return
      }
      setSelectedFile(file)
      setUploadResult(null)
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select a file first')
      return
    }

    setIsUploading(true)
    try {
      const result = await uploadMutation.mutateAsync(selectedFile)
      setUploadResult(result)
      toast.success('Universal record processed successfully!')
    } catch (error: any) {
      toast.error(`Upload failed: ${error.message}`)
    } finally {
      setIsUploading(false)
    }
  }

  const handleDownloadTemplate = async () => {
    try {
      const blob = await downloadTemplateMutation.mutateAsync()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'universal_record_template.csv'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success('Template downloaded successfully!')
    } catch (error: any) {
      toast.error(`Download failed: ${error.message}`)
    }
  }

  const renderUploadResult = () => {
    if (!uploadResult) return null

    const { report, processing_time_seconds } = uploadResult

    return (
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Processing Complete
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{report.total_records_processed}</div>
              <div className="text-sm text-gray-600">Total Records</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{report.policies_updated}</div>
              <div className="text-sm text-gray-600">Policies Updated</div>
            </div>
            <div className="text-center p-4 bg-emerald-50 rounded-lg">
              <div className="text-2xl font-bold text-emerald-600">{report.policies_added}</div>
              <div className="text-sm text-gray-600">Policies Added</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{report.cutpay_updated}</div>
              <div className="text-sm text-gray-600">CutPay Updated</div>
            </div>
            <div className="text-center p-4 bg-indigo-50 rounded-lg">
              <div className="text-2xl font-bold text-indigo-600">{report.cutpay_added}</div>
              <div className="text-sm text-gray-600">CutPay Added</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-600">{report.no_changes}</div>
              <div className="text-sm text-gray-600">No Changes</div>
            </div>
          </div>

          {/* Processing Time */}
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Clock className="h-4 w-4" />
            Processing completed in {processing_time_seconds.toFixed(2)} seconds
          </div>

          {/* Errors */}
          {report.errors.length > 0 && (
            <div>
              <h4 className="font-semibold text-red-600 mb-2 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Errors ({report.errors.length})
              </h4>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-h-40 overflow-y-auto">
                {report.errors.map((error, index) => (
                  <div key={index} className="text-sm text-red-700 py-1">
                    {error}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Processing Summary */}
          {report.processing_summary.length > 0 && (
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">
                Processing Summary ({report.processing_summary.length} records)
              </h4>
              <div className="bg-gray-50 border rounded-lg p-4 max-h-60 overflow-y-auto">
                {report.processing_summary.slice(0, 10).map((summary, index) => (
                  <div key={index} className="flex items-center justify-between py-2 border-b border-gray-200 last:border-0">
                    <div className="flex items-center gap-3">
                      <Badge variant={summary.action === 'updated' ? 'default' : summary.action === 'added' ? 'secondary' : 'outline'}>
                        {summary.action}
                      </Badge>
                      <span className="font-medium text-sm">{summary.policy_number}</span>
                      <span className="text-xs text-gray-500">{summary.record_type}</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {summary.updated_fields.length} fields
                    </div>
                  </div>
                ))}
                {report.processing_summary.length > 10 && (
                  <div className="text-center py-2 text-sm text-gray-500">
                    ... and {report.processing_summary.length - 10} more records
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-blue-600" />
            Universal Record Management
          </CardTitle>
          <p className="text-sm text-gray-600">
            Upload CSV files to reconcile policy and cut pay data from external systems
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Template Download */}
          <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8 text-blue-600" />
              <div>
                <h3 className="font-semibold text-blue-900">CSV Template</h3>
                <p className="text-sm text-blue-700">Download the template to see required format</p>
              </div>
            </div>
            <Button 
              variant="outline" 
              onClick={handleDownloadTemplate}
              disabled={downloadTemplateMutation.isPending}
            >
              <Download className="h-4 w-4 mr-2" />
              {downloadTemplateMutation.isPending ? 'Downloading...' : 'Download Template'}
            </Button>
          </div>

          <Separator />

          {/* File Upload */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Universal Record CSV File
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                {selectedFile && (
                  <Badge variant="outline" className="shrink-0">
                    {selectedFile.name}
                  </Badge>
                )}
              </div>
            </div>

            {selectedFile && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Important:</strong> Universal record processing will update existing policies and cut pay transactions 
                  where differences are found. This operation cannot be undone. Please ensure your CSV data is accurate.
                </AlertDescription>
              </Alert>
            )}

            <Button 
              onClick={handleUpload}
              disabled={!selectedFile || isUploading}
              className="w-full"
            >
              <Upload className="h-4 w-4 mr-2" />
              {isUploading ? 'Processing...' : 'Upload & Process Records'}
            </Button>

            {isUploading && (
              <div className="space-y-2">
                <Progress value={undefined} className="w-full" />
                <p className="text-sm text-center text-gray-600">
                  Processing universal records... This may take a few moments.
                </p>
              </div>
            )}
          </div>

          {/* Upload Result */}
          {renderUploadResult()}
        </CardContent>
      </Card>
    </div>
  )
}
