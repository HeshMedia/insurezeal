"use client"

import { useAtom } from 'jotai'
import { useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { FileText, Upload, CheckCircle, X, Eye } from 'lucide-react'
import { toast } from 'sonner'
import { uploadedDocumentsAtom } from '@/lib/atoms/cutpay-flow'

const DOCUMENT_TYPES = [
  { key: 'kyc_documents', title: 'KYC Documents', accept: '.pdf,.jpg,.jpeg,.png' },
  { key: 'rc_document', title: 'RC Document', accept: '.pdf,.jpg,.jpeg,.png' },
  { key: 'previous_policy', title: 'Previous Policy', accept: '.pdf,.jpg,.jpeg,.png' }
] as const

export function CutPayAdditionalDocuments() {
  const [uploadedDocuments, setUploadedDocuments] = useAtom(uploadedDocumentsAtom)
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({})

  const handleFileUpload = useCallback(async (file: File, documentType: string) => {
    if (!file) return

    // Validate file type
    const acceptedTypes = ['.pdf', '.jpg', '.jpeg', '.png']
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!acceptedTypes.includes(fileExtension)) {
      toast.error('Please upload PDF, JPG, or PNG files only')
      return
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      toast.error('File size must be less than 10MB')
      return
    }

    try {
      // Store the file in IndexedDB (just locally for now)
      const newDocument = {
        id: Date.now().toString(),
        file,
        type: documentType as 'kyc_documents' | 'rc_document' | 'previous_policy',
        name: file.name,
        size: file.size,
        uploadedAt: new Date().toISOString(),
        url: URL.createObjectURL(file) // For preview
      }
      
      // Remove existing document of same type and add new one
      setUploadedDocuments(prev => [
        ...prev.filter(doc => doc.type !== documentType),
        newDocument
      ])
      
      toast.success(`${DOCUMENT_TYPES.find(dt => dt.key === documentType)?.title} uploaded successfully`)
    } catch (error) {
      console.error('File upload failed:', error)
      toast.error('Failed to upload file. Please try again.')
    }
  }, [setUploadedDocuments])

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, documentType: string) => {
    const file = event.target.files?.[0]
    if (file) {
      handleFileUpload(file, documentType)
    }
  }

  const handleRemoveFile = (documentType: string) => {
    setUploadedDocuments(prev => prev.filter(doc => doc.type !== documentType))
    if (fileInputRefs.current[documentType]) {
      fileInputRefs.current[documentType]!.value = ''
    }
  }

  const handleUploadClick = (documentType: string) => {
    fileInputRefs.current[documentType]?.click()
  }

  const handleViewDocument = (doc: { url?: string }) => {
    if (doc.url) {
      window.open(doc.url, '_blank')
    }
  }

  // Check which documents are uploaded
  const getUploadedDocument = (docType: string) => {
    return uploadedDocuments.find(doc => doc.type === docType)
  }

  return (
    <div className="space-y-6">
      {/* Instructions */}
      <Alert>
        <FileText className="h-4 w-4" />
        <AlertDescription>
          Upload additional documents required for the cut pay transaction. 
          All documents will be stored locally until final submission.
        </AlertDescription>
      </Alert>

      {/* Document Upload Grid */}
      <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-3">
        {DOCUMENT_TYPES.map((docType) => {
          const uploadedFile = getUploadedDocument(docType.key)
          
          return (
            <Card key={docType.key} className={uploadedFile ? 'border-green-200 bg-green-50' : ''}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">{docType.title}</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Hidden File Input */}
                <input
                  ref={(ref) => { fileInputRefs.current[docType.key] = ref }}
                  type="file"
                  accept={docType.accept}
                  onChange={(e) => handleFileChange(e, docType.key)}
                  className="hidden"
                />

                {!uploadedFile ? (
                  /* Upload Area */
                  <div
                    className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-gray-400 hover:bg-gray-50 transition-all"
                    onClick={() => handleUploadClick(docType.key)}
                  >
                    <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm font-medium text-gray-700 mb-1">
                      Click to upload
                    </p>
                    <p className="text-xs text-gray-500">
                      PDF, JPG, PNG up to 10MB
                    </p>
                  </div>
                ) : (
                  /* Uploaded File Display */
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="text-sm font-medium text-green-900">Uploaded</span>
                    </div>
                    
                    <div className="p-3 bg-white rounded border">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {uploadedFile.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>

                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewDocument(uploadedFile)}
                        className="flex-1"
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemoveFile(docType.key)}
                        className="text-red-600 border-red-300 hover:bg-red-50"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUploadClick(docType.key)}
                      className="w-full"
                    >
                      Replace File
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Upload Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Upload Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="text-sm text-gray-600">
              Documents uploaded: {uploadedDocuments.filter(doc => doc.type !== 'policy_pdf').length} of 3
            </p>
            <div className="flex flex-wrap gap-2">
              {DOCUMENT_TYPES.map((docType) => {
                const isUploaded = uploadedDocuments.some(doc => doc.type === docType.key)
                return (
                  <div
                    key={docType.key}
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      isUploaded
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {docType.title} {isUploaded ? '✓' : '○'}
                  </div>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
