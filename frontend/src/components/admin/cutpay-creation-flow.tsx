'use client'

import { useCallback } from 'react'
import { useAtom } from 'jotai'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'

// Import our custom hooks and atoms
import {
  cutpayFlowStepAtom,
  extractedDataAtom,
  cutpayFormDataAtom,
  createdTransactionAtom,
  extractionLoadingAtom,
  documentUploadingAtom,
  creationLoadingAtom,
  finalDocumentUploadingAtom,
  resetCutpayFlowAtom,
  hasPolicyPdfAtom,
  canSubmitFormAtom
} from '@/lib/atoms/cutpay-flow'

import {
  useCalculateAmounts
} from '@/hooks/useCutPayFlow'

// Import step components
import { DocumentUploadStep } from './document-upload-step'
import { CutPayFormStep } from './cutpay-form-step'
import { FinalUploadStep } from './final-upload-step'

import { 
  CheckCircle, 
  Upload, 
  FileText, 
  Send,
  RotateCcw
} from 'lucide-react'

interface CutPayCreationFlowProps {
  onComplete?: (transactionId: number) => void
}

export function CutPayCreationFlow({ onComplete }: CutPayCreationFlowProps) {
  const [currentStep, setCurrentStep] = useAtom(cutpayFlowStepAtom)
  const [extractedData] = useAtom(extractedDataAtom)
  const [formData] = useAtom(cutpayFormDataAtom)
  const [createdTransaction] = useAtom(createdTransactionAtom)
  
  // Loading states
  const [isExtracting] = useAtom(extractionLoadingAtom)
  const [isUploading] = useAtom(documentUploadingAtom)
  const [isCreating] = useAtom(creationLoadingAtom)
  const [isFinalUploading] = useAtom(finalDocumentUploadingAtom)

  // Form validation atoms
  const [hasPolicyPdf] = useAtom(hasPolicyPdfAtom)
  const [canSubmit] = useAtom(canSubmitFormAtom)

  // Reset function
  const resetFlow = useAtom(resetCutpayFlowAtom)[1]

  // Hooks - kept for any future use or debugging
  const { calculateAmounts } = useCalculateAmounts()

  const steps = [
    {
      number: 1,
      title: 'Upload Documents',
      description: 'Upload policy PDF and extract data',
      icon: Upload,
      completed: currentStep > 1 || (hasPolicyPdf && extractedData),
      active: currentStep === 1
    },
    {
      number: 2,
      title: 'Transaction Details',
      description: 'Fill form and calculate amounts',
      icon: FileText,
      completed: currentStep > 2 || canSubmit,
      active: currentStep === 2
    },
    {
      number: 3,
      title: 'Final Upload',
      description: 'Create transaction and upload documents',
      icon: Send,
      completed: createdTransaction && !isFinalUploading,
      active: currentStep === 3
    }
  ]

  const getProgressPercentage = () => {
    if (currentStep === 1) {
      if (hasPolicyPdf && extractedData) return 33
      if (hasPolicyPdf) return 20
      return 10
    }
    if (currentStep === 2) {
      if (canSubmit) return 66
      return 50
    }
    if (currentStep === 3) {
      if (createdTransaction && !isFinalUploading) return 100
      return 80
    }
    return 0
  }

  const handleNext = useCallback(async () => {
    if (currentStep === 1) {
      // Validate step 1: Must have policy PDF and extracted data
      if (!hasPolicyPdf) {
        toast.error('Please upload a policy PDF document')
        return
      }
      if (!extractedData) {
        toast.error('Please wait for PDF extraction to complete')
        return
      }
      setCurrentStep(2)
    } else if (currentStep === 2) {
      // Validate step 2: Form must be complete and calculations done
      if (!canSubmit) {
        toast.error('Please complete all required form fields')
        return
      }
      
      // Trigger final calculations before moving to step 3
      calculateAmounts(formData)
      setCurrentStep(3)
    }
  }, [currentStep, hasPolicyPdf, extractedData, canSubmit, formData, calculateAmounts, setCurrentStep])

  const handlePrevious = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as 1 | 2 | 3)
    }
  }, [currentStep, setCurrentStep])

  const handleReset = useCallback(() => {
    resetFlow()
    toast.info('Flow reset - you can start over')
  }, [resetFlow])

  const isLoading = isExtracting || isUploading || isCreating || isFinalUploading

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold text-gray-900">Create New CutPay Transaction</h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Follow the step-by-step process to create a new cutpay transaction. Upload documents, 
          fill in the details, and complete the transaction.
        </p>
      </div>

      {/* Progress Steps */}
      <Card className="bg-white shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between mb-4">
            <CardTitle className="text-lg">Progress</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="text-gray-600 hover:text-gray-900"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
          </div>
          <Progress value={getProgressPercentage()} className="h-2" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            {steps.map((step, index) => {
              const StepIcon = step.icon
              return (
                <div key={step.number} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        step.completed
                          ? 'bg-green-500 text-white'
                          : step.active
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      {step.completed ? (
                        <CheckCircle className="h-6 w-6" />
                      ) : (
                        <StepIcon className="h-6 w-6" />
                      )}
                    </div>
                    <div className="text-center mt-2">
                      <p className={`text-sm font-medium ${
                        step.active ? 'text-blue-600' : 'text-gray-900'
                      }`}>
                        {step.title}
                      </p>
                      <p className="text-xs text-gray-500">{step.description}</p>
                    </div>
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`w-16 h-0.5 mx-4 ${
                      step.completed ? 'bg-green-500' : 'bg-gray-200'
                    }`} />
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Step Content */}
      <div className="min-h-[600px]">
        {currentStep === 1 && (
          <DocumentUploadStep onNext={handleNext} />
        )}

        {currentStep === 2 && (
          <CutPayFormStep onNext={handleNext} onPrevious={handlePrevious} />
        )}

        {currentStep === 3 && (
          <FinalUploadStep 
            onComplete={(transactionId) => onComplete?.(transactionId)} 
            onPrevious={handlePrevious} 
          />
        )}
      </div>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="bg-white p-8 max-w-md w-full mx-4">
            <CardContent className="text-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
              <div>
                <h3 className="text-lg font-medium">
                  {isExtracting && 'Extracting data from PDF...'}
                  {isUploading && 'Uploading documents...'}
                  {isCreating && 'Creating transaction...'}
                  {isFinalUploading && 'Uploading final documents...'}
                </h3>
                <p className="text-gray-600 text-sm mt-2">
                  Please wait while we process your request.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
