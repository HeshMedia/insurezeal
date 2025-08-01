'use client'

import { useAtom } from 'jotai'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { 
  FileText, 
  Upload, 
  CheckCircle, 
  Loader2,
  AlertCircle,
  FileCheck,
  Database,
  User,
  Car,
  Shield
} from 'lucide-react'

// Import atoms
import {
  policyCreationStepAtom,
  policyLoadingStatesAtom,
  policyErrorAtom,
  policyFormCompletionAtom
} from '@/lib/atoms/policy'

// Import components
import PolicyPdfUpload from '@/components/forms/policy-pdf-upload'
import AdditionalDocumentsUpload, { DocumentTypeConfig } from '@/components/forms/additional-documents-upload'
import InputForm from '@/components/forms/input-form'

// Import IndexedDB utilities
import { debugIndexedDB } from '@/lib/utils/indexeddb'

// Import hooks
import { useExtractPdfData } from '@/hooks/policyQuery'

// Define document types for additional documents
const ADDITIONAL_DOCUMENT_TYPES: DocumentTypeConfig[] = [
  {
    key: 'kyc',
    title: 'KYC Document',
    description: 'Upload KYC verification document (Aadhar, PAN, etc.)',
    icon: User,
    color: 'bg-blue-100 text-blue-600',
    borderColor: 'border-blue-300',
    bgColor: 'bg-blue-50'
  },
  {
    key: 'rc',
    title: 'RC Document',
    description: 'Upload Registration Certificate document',
    icon: Car,
    color: 'bg-green-100 text-green-600',
    borderColor: 'border-green-300',
    bgColor: 'bg-green-50'
  },
  {
    key: 'previousPolicy',
    title: 'Previous Policy',
    description: 'Upload previous insurance policy document',
    icon: Shield,
    color: 'bg-purple-100 text-purple-600',
    borderColor: 'border-purple-300',
    bgColor: 'bg-purple-50'
  }
]

// Define the documents type
type AdditionalDocuments = {
  kyc: File | null;
  rc: File | null;
  previousPolicy: File | null;
}

const CreatePolicyPage = () => {
  const [currentStep, setCurrentStep] = useAtom(policyCreationStepAtom)
  const [loadingStates] = useAtom(policyLoadingStatesAtom)
  const [error] = useAtom(policyErrorAtom)
  const [formCompletion] = useAtom(policyFormCompletionAtom)

  // State for additional documents
  const [additionalDocuments, setAdditionalDocuments] = useState<AdditionalDocuments>({
    kyc: null,
    rc: null,
    previousPolicy: null
  })

  // Debug IndexedDB when component mounts
  useEffect(() => {
    const initDB = async () => {
      try {
        console.log('📊 Policy Creation - Debugging IndexedDB state...')
        await debugIndexedDB()
      } catch (error) {
        console.error('❌ Policy Creation - Failed to debug IndexedDB:', error)
      }
    }
    
    initDB()
  }, [])

  const steps = [
    {
      id: 1,
      title: 'Policy PDF Upload',
      description: 'Upload policy document and extract data',
      icon: FileText,
      isComplete: formCompletion.step1Complete,
      isActive: currentStep === 1
    },
    {
      id: 2,
      title: 'Additional Documents',
      description: 'Upload KYC, RC, and previous policy documents',
      icon: Upload,
      isComplete: formCompletion.step2Complete,
      isActive: currentStep === 2
    },
    {
      id: 3,
      title: 'Policy Details',
      description: 'Review and confirm policy information',
      icon: FileCheck,
      isComplete: false,
      isActive: currentStep === 3
    }
  ]

  const progressPercentage = (currentStep / steps.length) * 100

  const handleNextStep = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <PolicyPdfUpload 
            onNext={handleNextStep}
            useExtractionHook={useExtractPdfData}
          />
        )
      case 2:
        return (
          <AdditionalDocumentsUpload
            documentTypes={ADDITIONAL_DOCUMENT_TYPES}
            documents={additionalDocuments}
            setDocuments={setAdditionalDocuments}
            onNext={handleNextStep}
            onPrev={handlePreviousStep}
          />
        )
      case 3:
        return (
          <InputForm 
            formType="policy"
            onPrev={handlePreviousStep}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-center gap-3 mb-4"
          >
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-lg">
              <Database className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Create New Policy
            </h1>
          </motion.div>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            Upload your policy document, add supporting documents, and review the details to create a new policy record.
          </p>
        </div>

        {/* Progress Bar */}
        <div className="max-w-4xl mx-auto mb-8">
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">Progress</span>
              <span className="text-sm font-medium text-gray-700">{Math.round(progressPercentage)}%</span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>

          {/* Steps */}
          <div className="flex justify-between">
            {steps.map((step, index) => (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex flex-col items-center flex-1"
              >
                <div className={`
                  w-12 h-12 rounded-full flex items-center justify-center mb-2 transition-all duration-300
                  ${step.isComplete 
                    ? 'bg-green-500 text-white shadow-lg' 
                    : step.isActive 
                      ? 'bg-blue-500 text-white shadow-lg animate-pulse' 
                      : 'bg-gray-200 text-gray-400'
                  }
                `}>
                  {step.isComplete ? (
                    <CheckCircle className="w-6 h-6" />
                  ) : step.isActive && (loadingStates.extracting || loadingStates.uploadingToIndexedDB) ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <step.icon className="w-6 h-6" />
                  )}
                </div>
                <div className="text-center">
                  <p className={`font-medium text-sm ${step.isActive ? 'text-blue-600' : 'text-gray-600'}`}>
                    {step.title}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {step.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Error Display */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="max-w-4xl mx-auto mb-6"
            >
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                <div>
                  <p className="text-red-800 font-medium">Error</p>
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Content */}
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
          className="max-w-[90vw] mx-auto"
        >
          <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader className="text-center border-b bg-gradient-to-r from-blue-50 to-indigo-50">
              <CardTitle className="text-2xl font-bold text-gray-800 flex items-center justify-center gap-2">
                {(() => {
                  const StepIcon = steps[currentStep - 1]?.icon
                  return StepIcon ? <StepIcon className="w-6 h-6" /> : null
                })()}
                {steps[currentStep - 1]?.title}
              </CardTitle>
              <CardDescription className="text-gray-600 text-base">
                {steps[currentStep - 1]?.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-8">
              {renderStepContent()}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}

export default CreatePolicyPage
