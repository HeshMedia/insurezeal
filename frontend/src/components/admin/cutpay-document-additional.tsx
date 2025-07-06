'use client'

import { useAtom } from 'jotai'
import { useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { FileText, Upload, CheckCircle, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { 
  uploadedDocumentsAtom, 
  documentUploadingAtom 
} from '@/lib/atoms/cutpay-flow'

const DOCUMENT_TYPES = [
  {
    key: 'kyc_documents' as const,
    title: 'KYC Documents',
    description: 'Identity proof documents (Aadhaar, PAN, etc.)',
    required: false
  },
  {
    key: 'rc_document' as const,
    title: 'Registration Certificate (RC)',
    description: 'Vehicle registration document',
    required: false
  },
  {
    key: 'previous_policy' as const,
    title: 'Previous Policy',
    description: 'Previous insurance policy document',
    required: false
  }
]

export function CutPayDocumentAdditional() {
  const [uploadedDocuments, setUploadedDocuments] = useAtom(uploadedDocumentsAtom)
  const [isUploading, setIsUploading] = useAtom(documentUploadingAtom)
  const fileInputRefs = useRef<{[key: string]: HTMLInputElement | null}>({})

  const handleFileUpload = (documentType: string, file: File) => {
    if (!file) return

    if (file.type !== 'application/pdf') {
      toast.error('Please upload PDF files only')
      return
    }

    if (file.size > 50 * 1024 * 1024) { // 50MB limit
      toast.error('File size must be less than 50MB')
      return
    }

    setIsUploading(true)
    
    // Simulate upload delay
    setTimeout(() => {
      // Create StoredDocument object
      const storedDoc = {
        id: Date.now().toString(),
        file,
        type: documentType as 'policy_pdf' | 'kyc_documents' | 'rc_document' | 'previous_policy',
        name: file.name,
        size: file.size,
        uploadedAt: new Date().toISOString(),
        url: URL.createObjectURL(file), // For preview
        storageKey: `${documentType}_${Date.now()}`
      }
      
      // Remove existing document of same type and add new one
      setUploadedDocuments(prev => [
        ...prev.filter(doc => doc.type !== documentType),
        storedDoc
      ])
      
      toast.success(`${DOCUMENT_TYPES.find(dt => dt.key === documentType)?.title} uploaded successfully`)
      setIsUploading(false)
    }, 1000)
  }

  const handleFileChange = (documentType: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      handleFileUpload(documentType, file)
    }
  }

  const handleRemoveFile = (documentType: string) => {
    // Remove document of specified type
    setUploadedDocuments(prev => prev.filter(doc => doc.type !== documentType))
    
    // Reset file input
    const input = fileInputRefs.current[documentType]
    if (input) {
      input.value = ''
    }
    
    toast.success('Document removed')
  }

  const handleUploadClick = (documentType: string) => {
    fileInputRefs.current[documentType]?.click()
  }

  const getTotalUploaded = () => {
    return DOCUMENT_TYPES.filter(dt => 
      uploadedDocuments.some(doc => doc.type === dt.key)
    ).length
  }

  return (
    <div className="space-y-6">
      {/* Instructions */}
      <Alert>
        <FileText className="h-4 w-4" />
        <AlertDescription>
          Upload additional supporting documents. These documents are optional but recommended 
          for complete transaction records. You can skip this step and add documents later if needed.
        </AlertDescription>
      </Alert>

      {/* Progress Summary */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-blue-900">Upload Progress</h3>
              <p className="text-sm text-blue-700">
                {getTotalUploaded()} of {DOCUMENT_TYPES.length} optional documents uploaded
              </p>
            </div>
            <div className="text-2xl font-bold text-blue-600">
              {getTotalUploaded()}/{DOCUMENT_TYPES.length}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Document Upload Cards */}
      <div className="grid gap-4">
        {DOCUMENT_TYPES.map((docType) => {
          const uploadedFile = uploadedDocuments.find(doc => doc.type === docType.key)
          
          return (
            <Card key={docType.key} className={uploadedFile ? 'border-green-200 bg-green-50' : ''}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-lg">
                  <div className="flex items-center gap-2">
                    {uploadedFile ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <FileText className="h-5 w-5 text-gray-400" />
                    )}
                    {docType.title}
                    {docType.required && (
                      <span className="text-red-500 text-sm">*</span>
                    )}
                  </div>
                  {uploadedFile && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveFile(docType.key)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-100"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">{docType.description}</p>

                {/* Hidden File Input */}
                <input
                  ref={(el) => { fileInputRefs.current[docType.key] = el }}
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange(docType.key)}
                  className="hidden"
                  disabled={isUploading}
                />

                {!uploadedFile ? (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    {isUploading ? (
                      <div className="space-y-2">
                        <Loader2 className="h-8 w-8 text-blue-600 animate-spin mx-auto" />
                        <p className="text-sm text-gray-600">Uploading...</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <Upload className="h-8 w-8 text-gray-400 mx-auto" />
                        <div>
                          <Button
                            onClick={() => handleUploadClick(docType.key)}
                            variant="outline"
                            size="sm"
                          >
                            Choose PDF File
                          </Button>
                          <p className="text-xs text-gray-500 mt-1">
                            Max 50MB • PDF only
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-white border border-green-200 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <FileText className="h-8 w-8 text-green-600" />
                      <div className="flex-1">
                        <p className="font-medium text-green-900">{uploadedFile.file.name}</p>
                        <p className="text-sm text-green-700">
                          {(uploadedFile.file.size / 1024 / 1024).toFixed(2)} MB • Uploaded successfully
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Next Step Info */}
      <Alert>
        <CheckCircle className="h-4 w-4" />
        <AlertDescription>
          You can proceed to the next step at any time. Additional documents can be uploaded later 
          during the final upload phase or after transaction creation.
        </AlertDescription>
      </Alert>
    </div>
  )
}
