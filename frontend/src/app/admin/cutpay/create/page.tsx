'use client'

import { useAtom } from 'jotai'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
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
  cutpayCreationStepAtom,
  cutpayLoadingStatesAtom,
  cutpayErrorAtom,
  cutpayFormCompletionAtom
} from '@/lib/atoms/cutpay'

// Import components
import PolicyPdfUpload from '@/components/forms/policy-pdf-upload'
import AdditionalDocumentsUpload, { DocumentTypeConfig } from '@/components/forms/additional-documents-upload'
import InputForm from '@/components/forms/input-form'

// Import IndexedDB utilities
import { debugIndexedDB } from '@/lib/utils/indexeddb'

// Import hooks
import { useExtractPdf } from '@/hooks/cutpayQuery'

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

const CreateCutPayPage = () => {
  const [currentStep, setCurrentStep] = useAtom(cutpayCreationStepAtom)
  const [loadingStates] = useAtom(cutpayLoadingStatesAtom)
  const [error] = useAtom(cutpayErrorAtom)
  const [formCompletion] = useAtom(cutpayFormCompletionAtom)

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
        console.log('✅ IndexedDB will be initialized automatically when needed')
        
        // Debug: check current contents
        await debugIndexedDB()
      } catch (error) {
        console.error('❌ Failed to debug IndexedDB:', error)
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
      title: 'Admin Input',
      description: 'Enter administrative details and calculations',
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
        return <PolicyPdfUpload onNext={handleNextStep} useExtractionHook={useExtractPdf} />
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
            onPrev={handlePreviousStep}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen ">
      <div className=" mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Create New CutPay Transaction</h1>
          <p className="text-muted-foreground">Follow the steps below to create a new cutpay transaction</p>
        </div>

        {/* Progress Section */}
        <Card className="mb-8 border-gray-200 shadow-l bg-white/80 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between mb-4">
              <CardTitle className="text-xl">Progress</CardTitle>
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                Step {currentStep} of {steps.length}
              </Badge>
            </div>
            <Progress 
              value={progressPercentage} 
              className="h-3 bg-gray-100"
            />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {steps.map((step, index) => (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`p-4 rounded-lg border-2 transition-all duration-300 ${
                    step.isActive 
                      ? 'border-blue-500 bg-blue-50 shadow-md' 
                      : step.isComplete 
                        ? 'border-green-500 bg-green-50' 
                        : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex items-center space-x-3 mb-2">
                    <div className={`p-2 rounded-full ${
                      step.isActive 
                        ? 'bg-blue-500 text-white' 
                        : step.isComplete 
                          ? 'bg-green-500 text-white' 
                          : 'bg-gray-300 text-gray-600'
                    }`}>
                      {step.isComplete ? (
                        <CheckCircle className="h-5 w-5" />
                      ) : (
                        <step.icon className="h-5 w-5" />
                      )}
                    </div>
                    <div>
                      <h3 className={`font-semibold ${
                        step.isActive ? 'text-blue-900' : step.isComplete ? 'text-green-900' : 'text-gray-700'
                      }`}>
                        {step.title}
                      </h3>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Error Display */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6"
            >
              <Card className="border-red-200 bg-red-50">
                <CardContent className="pt-6">
                  <div className="flex items-center space-x-2 text-red-700">
                    <AlertCircle className="h-5 w-5" />
                    <span className="font-medium">Error occurred:</span>
                    <span>{error}</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Content */}
        <Card className="border-none shadow-xl bg-white/90 backdrop-blur-sm">
          <CardHeader className="border-b bg-gradient-to-r from-blue-500/10 to-indigo-500/10">
            <CardTitle className="flex items-center space-x-2">
              <span>Step {currentStep}: {steps[currentStep - 1]?.title}</span>
              {(loadingStates.extracting || loadingStates.uploadingToIndexedDB) && (
                <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
              )}
            </CardTitle>
            <CardDescription>{steps[currentStep - 1]?.description}</CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                {renderStepContent()}
              </motion.div>
            </AnimatePresence>
          </CardContent>
        </Card>

        {/* Loading Overlay */}
        <AnimatePresence>
          {(loadingStates.extracting || loadingStates.uploadingToIndexedDB) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center"
            >
              <Card className="w-96 border-none shadow-2xl">
                <CardContent className="pt-6">
                  <div className="text-center space-y-4">
                    <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        Hold tight! We&apos;re extracting data
                      </h3>
                      <p className="text-muted-foreground">
                        {loadingStates.extracting && "Analyzing your policy document..."}
                        {loadingStates.uploadingToIndexedDB && "Storing documents locally..."}
                      </p>
                    </div>
                    <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
                      <Database className="h-4 w-4" />
                      <span>Processing in progress</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default CreateCutPayPage
