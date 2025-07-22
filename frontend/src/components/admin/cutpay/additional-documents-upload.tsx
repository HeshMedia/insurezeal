import { useRef, useState } from 'react'
import { useAtom } from 'jotai'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  X,
  AlertCircle,
  Database,
  ArrowRight,
  ArrowLeft,
  File,
  Shield,
  Car
} from 'lucide-react'

// Import atoms
import {
  additionalDocumentsAtom,
  cutpayLoadingStatesAtom,
  cutpaySuccessStatesAtom,
  cutpayErrorAtom,
  cutpayFormCompletionAtom
} from '@/lib/atoms/cutpay'

// Import centralized IndexedDB utilities
import { saveToIndexedDB, removeFromIndexedDB } from '@/lib/utils/indexeddb'

interface AdditionalDocumentsUploadProps {
  onNext: () => void
  onPrev: () => void
}

const documentTypes = [
  {
    key: 'kyc_documents' as const,
    title: 'KYC Documents',
    description: 'Know Your Customer documents',
    icon: Shield,
    color: 'bg-green-100 text-green-600',
    borderColor: 'border-green-200',
    bgColor: 'bg-green-50'
  },
  {
    key: 'rc_document' as const,
    title: 'Registration Certificate',
    description: 'Vehicle registration certificate',
    icon: Car,
    color: 'bg-blue-100 text-blue-600',
    borderColor: 'border-blue-200',
    bgColor: 'bg-blue-50'
  },
  {
    key: 'previous_policy' as const,
    title: 'Previous Policy',
    description: 'Previous insurance policy document',
    icon: FileText,
    color: 'bg-purple-100 text-purple-600',
    borderColor: 'border-purple-200',
    bgColor: 'bg-purple-50'
  }
]

const AdditionalDocumentsUpload = ({ onNext, onPrev }: AdditionalDocumentsUploadProps) => {
  const [dragActiveFor, setDragActiveFor] = useState<string | null>(null)
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({})
  
  // Atoms
  const [documents, setDocuments] = useAtom(additionalDocumentsAtom)
  const [loadingStates, setLoadingStates] = useAtom(cutpayLoadingStatesAtom)
  const [successStates, setSuccessStates] = useAtom(cutpaySuccessStatesAtom)
  const [, setError] = useAtom(cutpayErrorAtom)
  const [, setFormCompletion] = useAtom(cutpayFormCompletionAtom)

  const handleFileSelect = async (file: File, documentType: keyof typeof documents) => {
    if (file.type !== 'application/pdf') {
      setError(`Please select a valid PDF file for ${documentType}`)
      return
    }
    
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      setError('File size must be less than 10MB')
      return
    }

    try {
      console.log(`📄 ${documentType} selected:`, file.name, `(${(file.size / 1024 / 1024).toFixed(2)}MB)`)
      
      // Store in IndexedDB
      setLoadingStates(prev => ({ ...prev, uploadingDocuments: true }))
      await saveToIndexedDB(file, documentType)
      
      // Update local state
      setDocuments(prev => ({ ...prev, [documentType]: file }))
      setError(null)
      
      console.log(`✅ Successfully stored ${documentType} in IndexedDB`)
      setLoadingStates(prev => ({ ...prev, uploadingDocuments: false }))
      
    } catch (error) {
      console.error(`❌ Error storing ${documentType}:`, error)
      setError(error instanceof Error ? error.message : 'Failed to store document')
      setLoadingStates(prev => ({ ...prev, uploadingDocuments: false }))
    }
  }

  const handleDrop = (e: React.DragEvent, documentType: keyof typeof documents) => {
    e.preventDefault()
    setDragActiveFor(null)
    
    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileSelect(files[0], documentType)
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>, documentType: keyof typeof documents) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFileSelect(files[0], documentType)
    }
  }

  const removeFile = async (documentType: keyof typeof documents) => {
    try {
      // Delete from IndexedDB
      await removeFromIndexedDB(documentType)
      
      // Update local state
      setDocuments(prev => ({ ...prev, [documentType]: null }))
      const inputRef = fileInputRefs.current[documentType]
      if (inputRef) {
        inputRef.value = ''
      }
      console.log(`🗑️ Removed ${documentType} from both state and IndexedDB`)
    } catch (error) {
      console.error(`❌ Error removing ${documentType}:`, error)
      // Still update local state even if IndexedDB deletion fails
      setDocuments(prev => ({ ...prev, [documentType]: null }))
      const inputRef = fileInputRefs.current[documentType]
      if (inputRef) {
        inputRef.value = ''
      }
    }
  }

  const uploadedCount = Object.values(documents).filter(Boolean).length
  const allDocumentsUploaded = uploadedCount === documentTypes.length

  const handleCompleteStep = () => {
    if (uploadedCount > 0) {
      setSuccessStates(prev => ({ ...prev, documentsUploaded: true }))
      setFormCompletion(prev => ({ ...prev, step2Complete: true }))
      console.log(`🎉 Step 2 completed! Uploaded ${uploadedCount}/${documentTypes.length} documents`)
      onNext()
    } else {
      setError('Please upload at least one document to continue')
    }
  }



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

      {/* Document Upload Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {documentTypes.map((docType) => {
          const file = documents[docType.key]
          const isUploaded = !!file
          
          return (
            <Card
              key={docType.key}
              className={`transition-all duration-300 ${
                dragActiveFor === docType.key 
                  ? `${docType.borderColor} shadow-lg` 
                  : isUploaded 
                    ? 'border-green-300 shadow-md' 
                    : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <CardHeader className={`${isUploaded ? 'bg-green-50' : docType.bgColor}`}>
                <CardTitle className="flex items-center space-x-2 text-sm">
                  <div className={`p-2 rounded-lg ${isUploaded ? 'bg-green-100 text-green-600' : docType.color}`}>
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
                        ? 'border-green-300 bg-green-50'
                        : 'border-gray-300 hover:border-gray-400 bg-gray-50'
                  }`}
                  onDragEnter={(e) => {
                    e.preventDefault()
                    setDragActiveFor(docType.key)
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault()
                    setDragActiveFor(null)
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
                        <p className="font-medium text-sm text-gray-900">{file.name}</p>
                        <p className="text-xs text-gray-500">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeFile(docType.key)}
                        className="mt-2"
                      >
                        <X className="h-3 w-3 mr-1" />
                        Remove
                      </Button>
                    </motion.div>
                  ) : (
                    <div className="text-center space-y-2">
                      <Upload className="h-6 w-6 text-gray-400 mx-auto" />
                      <div>
                        <p className="text-sm font-medium text-gray-700">Drop PDF here</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRefs.current[docType.key]?.click()}
                          className="mt-2"
                        >
                          Browse
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                
                <Input
                  ref={(el) => { fileInputRefs.current[docType.key] = el }}
                  type="file"
                  accept=".pdf"
                  onChange={(e) => handleFileInput(e, docType.key)}
                  className="hidden"
                />
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Success State */}
      {successStates.documentsUploaded && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              <strong>Documents uploaded successfully!</strong> All selected documents have been stored locally.
            </AlertDescription>
          </Alert>
        </motion.div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-between pt-6">
        <div className="flex space-x-2">
          <Button
            variant="outline"
            onClick={onPrev}
            disabled={loadingStates.uploadingDocuments}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Previous Step
          </Button>
        </div>
        
        <Button
          onClick={handleCompleteStep}
          disabled={uploadedCount === 0 || loadingStates.uploadingDocuments}
          className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
        >
          {loadingStates.uploadingDocuments ? (
            <>
              <Database className="h-4 w-4 mr-2 animate-pulse" />
              Storing...
            </>
          ) : (
            <>
              Continue
              <ArrowRight className="h-4 w-4 ml-2" />
            </>
          )}
        </Button>
      </div>

      {/* Upload Tips */}
      <Card className="bg-amber-50 border-amber-200">
        <CardContent className="pt-4">
          <div className="flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div className="space-y-1">
              <h4 className="font-medium text-amber-900">Upload Tips</h4>
              <ul className="text-sm text-amber-700 space-y-1">
                <li>• All documents are optional but recommended for complete records</li>
                <li>• Upload at least one document to proceed to the next step</li>
                <li>• Documents are stored locally in your browser for privacy</li>
                <li>• You can always add more documents later</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default AdditionalDocumentsUpload
