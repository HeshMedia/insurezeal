'use client'

import { useAtom } from 'jotai'
import { useCallback, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { FileText, Upload, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { 
  uploadedDocumentsAtom, 
  extractedDataAtom, 
  isExtractingPdfAtom 
} from '@/lib/atoms/cutpay-flow'
import { useExtractPdfForCreation } from '@/hooks/adminQuery'

export function CutPayDocumentUpload() {
  const [uploadedDocuments, setUploadedDocuments] = useAtom(uploadedDocumentsAtom)
  const [extractedData, setExtractedData] = useAtom(extractedDataAtom)
  const [isExtracting, setIsExtracting] = useAtom(isExtractingPdfAtom)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const extractMutation = useExtractPdfForCreation()

  const handleFileUpload = useCallback(async (file: File) => {
    if (!file) return

    if (file.type !== 'application/pdf') {
      toast.error('Please upload a PDF file only')
      return
    }

    if (file.size > 50 * 1024 * 1024) { // 50MB limit
      toast.error('File size must be less than 50MB')
      return
    }

    try {
      setIsExtracting(true)
      
      // Store the file locally
      const newDocument = {
        id: Date.now().toString(),
        type: 'policy_pdf' as const,
        file: file,
        name: file.name,
        size: file.size,
        uploadedAt: new Date().toISOString(),
        url: URL.createObjectURL(file)
      }
      
      setUploadedDocuments(prev => [
        ...prev.filter(doc => doc.type !== 'policy_pdf'), // Remove any existing policy PDF
        newDocument
      ])

      toast.success('Document uploaded successfully. Extracting data...')

      // Extract data from PDF
      const response = await extractMutation.mutateAsync(file)
      
      if (response && response.extracted_data) {
        setExtractedData(response.extracted_data)
        
        if (response.extraction_status === 'success') {
          toast.success('PDF data extracted successfully!')
        } else {
          toast.warning('PDF extracted with some warnings. Please review the data.')
        }

        if (response.errors && response.errors.length > 0) {
          console.warn('Extraction errors:', response.errors)
        }
      } else {
        toast.error('No data could be extracted from the PDF')
        setExtractedData(null)
      }

    } catch (error) {
      console.error('PDF extraction failed:', error)
      toast.error('Failed to extract PDF data. Please try again.')
      setExtractedData(null)
    } finally {
      setIsExtracting(false)
    }
  }, [extractMutation, setUploadedDocuments, setExtractedData, setIsExtracting])

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      handleFileUpload(file)
    }
  }

  const handleRemoveFile = () => {
    setUploadedDocuments(prev => prev.filter(doc => doc.type !== 'policy_pdf'))
    setExtractedData(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const policyPdf = uploadedDocuments.find(doc => doc.type === 'policy_pdf')

  return (
    <div className="space-y-6">
      {/* Instructions */}
      <Alert>
        <FileText className="h-4 w-4" />
        <AlertDescription>
          Upload the main policy PDF document. Our AI will automatically extract key information 
          including policy details, premium amounts, and customer information.
        </AlertDescription>
      </Alert>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        onChange={handleFileChange}
        className="hidden"
        disabled={isExtracting}
      />

      {/* Upload Area */}
      {!policyPdf ? (
        <Card>
          <CardContent className="p-6">
            <div
              className={`
                border-2 border-dashed rounded-lg p-8 text-center transition-all
                ${isExtracting 
                  ? 'border-gray-200 bg-gray-50 pointer-events-none opacity-50' 
                  : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                }
              `}
            >
              {isExtracting ? (
                <div className="space-y-4">
                  <Loader2 className="h-12 w-12 text-blue-600 animate-spin mx-auto" />
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      Extracting PDF Data...
                    </h3>
                    <p className="text-gray-600">
                      Please wait while we process your document and extract the policy information.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <Upload className="h-12 w-12 text-gray-400 mx-auto" />
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      Upload Policy PDF
                    </h3>
                    <p className="text-gray-600 mb-4">
                      Upload your policy PDF file to extract key information automatically
                    </p>
                    <Button onClick={handleUploadClick} className="mb-2">
                      Choose PDF File
                    </Button>
                    <p className="text-sm text-gray-500">
                      Maximum file size: 50MB. Only PDF files are accepted.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        // File uploaded and data extracted
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-6">
            <div className="flex items-start space-x-4">
              <CheckCircle className="h-6 w-6 text-green-600 mt-1" />
              <div className="flex-1">
                <h3 className="text-lg font-medium text-green-900 mb-2">
                  Policy Document Uploaded Successfully
                </h3>
                <div className="space-y-2">
                  <p className="text-green-800">
                    <strong>File:</strong> {policyPdf.file.name}
                  </p>
                  <p className="text-green-800">
                    <strong>Size:</strong> {(policyPdf.file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  {extractedData && (
                    <div className="mt-4 p-4 bg-white rounded-lg border">
                      <h4 className="font-medium text-gray-900 mb-2">Extracted Information:</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                        {extractedData.policy_number && (
                          <p><strong>Policy Number:</strong> {extractedData.policy_number}</p>
                        )}
                        {extractedData.customer_name && (
                          <p><strong>Customer:</strong> {extractedData.customer_name}</p>
                        )}
                        {extractedData.gross_premium && (
                          <p><strong>Gross Premium:</strong> ₹{extractedData.gross_premium.toLocaleString()}</p>
                        )}
                        {extractedData.net_premium && (
                          <p><strong>Net Premium:</strong> ₹{extractedData.net_premium.toLocaleString()}</p>
                        )}
                        {extractedData.registration_no && (
                          <p><strong>Vehicle Reg:</strong> {extractedData.registration_no}</p>
                        )}
                        {extractedData.make_model && (
                          <p><strong>Vehicle:</strong> {extractedData.make_model}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleRemoveFile}
                  className="mt-4 text-red-600 border-red-300 hover:bg-red-50"
                >
                  Remove & Upload Different File
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Extraction Status */}
      {extractMutation.isError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to extract data from the PDF. Please try uploading a different file or contact support.
          </AlertDescription>
        </Alert>
      )}

      {/* Next Step Info */}
      {extractedData && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            Great! Your policy data has been extracted. Click &quot;Next&quot; to proceed with uploading additional documents.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
