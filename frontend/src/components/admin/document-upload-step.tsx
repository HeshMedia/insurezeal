'use client'

import { useCallback, useState } from 'react'
import { useAtom } from 'jotai'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FileText, Upload, CheckCircle, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { 
  uploadedDocumentsAtom,
  extractedDataAtom,
  extractionLoadingAtom,
  hasPolicyPdfAtom,
  allDocumentsUploadedAtom
} from '@/lib/atoms/cutpay-flow'
import { CutPayDocumentUpload } from './cutpay-document-upload'
import { CutPayDocumentAdditional } from './cutpay-document-additional'

interface DocumentUploadStepProps {
  onNext: () => void
}

export function DocumentUploadStep({ onNext }: DocumentUploadStepProps) {
  const [uploadedDocuments] = useAtom(uploadedDocumentsAtom)
  const [extractedData] = useAtom(extractedDataAtom)
  const [isExtracting] = useAtom(extractionLoadingAtom)
  const [hasPolicyPdf] = useAtom(hasPolicyPdfAtom)
  const [allDocsUploaded] = useAtom(allDocumentsUploadedAtom)
  const [activeTab, setActiveTab] = useState<'policy' | 'additional'>('policy')

  const getProgress = () => {
    if (!hasPolicyPdf) return 0
    if (!extractedData) return 30
    if (!allDocsUploaded) return 60
    return 100
  }

  const canProceed = hasPolicyPdf && extractedData && !isExtracting

  const handleNext = useCallback(() => {
    if (!canProceed) {
      if (!hasPolicyPdf) {
        toast.error('Please upload a policy PDF document')
        return
      }
      if (!extractedData) {
        toast.error('Please wait for PDF extraction to complete')
        return
      }
    }
    onNext()
  }, [canProceed, hasPolicyPdf, extractedData, onNext])

  const handlePolicyComplete = () => {
    if (hasPolicyPdf && extractedData) {
      setActiveTab('additional')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-blue-600" />
            Step 1: Upload Documents
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-gray-600">
                Upload your policy document and supporting files. The system will automatically extract policy information.
              </p>
              <div className="text-sm text-gray-500">
                {uploadedDocuments.length} document{uploadedDocuments.length !== 1 ? 's' : ''} uploaded
              </div>
            </div>
            <Progress value={getProgress()} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Step Progress */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className={hasPolicyPdf ? 'border-green-200 bg-green-50' : 'border-gray-200'}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              {hasPolicyPdf ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
              )}
              <div>
                <p className="font-medium">Policy PDF</p>
                <p className="text-sm text-gray-600">Required document</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={extractedData ? 'border-green-200 bg-green-50' : 'border-gray-200'}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              {extractedData ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : isExtracting ? (
                <div className="h-5 w-5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
              ) : (
                <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
              )}
              <div>
                <p className="font-medium">Data Extraction</p>
                <p className="text-sm text-gray-600">
                  {isExtracting ? 'Processing...' : 'Automatic extraction'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={allDocsUploaded ? 'border-green-200 bg-green-50' : 'border-gray-200'}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              {allDocsUploaded ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
              )}
              <div>
                <p className="font-medium">Additional Docs</p>
                <p className="text-sm text-gray-600">Optional documents</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upload Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'policy' | 'additional')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="policy" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Policy Document
            {hasPolicyPdf && <CheckCircle className="h-4 w-4 text-green-600" />}
          </TabsTrigger>
          <TabsTrigger 
            value="additional" 
            disabled={!hasPolicyPdf || !extractedData}
            className="flex items-center gap-2"
          >
            <Upload className="h-4 w-4" />
            Additional Documents
            {allDocsUploaded && <CheckCircle className="h-4 w-4 text-green-600" />}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="policy" className="mt-6">
          <CutPayDocumentUpload />
          {hasPolicyPdf && extractedData && (
            <Alert className="mt-4">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>Policy document uploaded and data extracted successfully!</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePolicyComplete}
                  className="ml-4"
                >
                  Upload Additional Documents
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="additional" className="mt-6">
          <CutPayDocumentAdditional />
        </TabsContent>
      </Tabs>

      {/* Extracted Data Preview */}
      {extractedData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Extracted Data Preview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-600">Policy Number</p>
                <p className="text-lg">{extractedData.policy_number || 'Not extracted'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Customer Name</p>
                <p className="text-lg">{extractedData.customer_name || 'Not extracted'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Gross Premium</p>
                <p className="text-lg">₹{extractedData.gross_premium?.toLocaleString() || 'Not extracted'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Insurance Type</p>
                <p className="text-lg">{extractedData.major_categorisation || 'Not extracted'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Vehicle Registration</p>
                <p className="text-lg">{extractedData.registration_no || 'Not extracted'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Net Premium</p>
                <p className="text-lg">₹{extractedData.net_premium?.toLocaleString() || 'Not extracted'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex justify-end">
        <Button
          onClick={handleNext}
          disabled={!canProceed}
          className="bg-green-600 hover:bg-green-700"
        >
          Next: Fill Transaction Details
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  )
}
