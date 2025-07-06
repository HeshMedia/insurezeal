"use client"

import React from 'react'
import { useAtom } from 'jotai'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FileText, Upload, Calculator, Check } from 'lucide-react'
import { 
  cutpayFlowStepAtom,
  uploadedDocumentsAtom,
  extractedDataAtom,
  hasPolicyPdfAtom
} from '@/lib/atoms/cutpay-flow'

// Step Components
import { CutPayDocumentUpload } from './cutpay-document-upload'
import { CutPayAdditionalDocuments } from './cutpay-additional-documents'
import { CutPaySimpleForm } from './cutpay-simple-form'

export function CutPayStepperForm() {
  const [currentStep, setCurrentStep] = useAtom(cutpayFlowStepAtom)
  const [uploadedDocuments] = useAtom(uploadedDocumentsAtom)
  const [extractedData] = useAtom(extractedDataAtom)
  const [hasPolicyPdf] = useAtom(hasPolicyPdfAtom)

  const steps = [
    {
      id: 1,
      title: 'Upload Policy PDF',
      description: 'Upload and extract policy document',
      icon: FileText,
      completed: !!extractedData
    },
    {
      id: 2,
      title: 'Additional Documents',
      description: 'Upload KYC, RC, and previous policy',
      icon: Upload,
      completed: uploadedDocuments.length >= 2 // Policy + at least 1 additional
    },
    {
      id: 3,
      title: 'Transaction Details',
      description: 'Fill form and calculate amounts',
      icon: Calculator,
      completed: false
    }
  ]

  const canProceedToStep2 = hasPolicyPdf && extractedData
  const canProceedToStep3 = uploadedDocuments.length >= 2

  const nextStep = () => {
    if (currentStep < 3) {
      setCurrentStep((currentStep + 1) as 1 | 2 | 3)
    }
  }

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as 1 | 2 | 3)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Step Indicator */}
      <Card>
        <CardHeader>
          <CardTitle>Create Cut Pay Transaction</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            {steps.map((step, index) => {
              const Icon = step.icon
              const isActive = currentStep === step.id
              const isCompleted = step.completed
              
              return (
                <div key={step.id} className="flex items-center">
                  <div className={`
                    flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all
                    ${isActive 
                      ? 'border-blue-600 bg-blue-600 text-white' 
                      : isCompleted 
                        ? 'border-green-600 bg-green-600 text-white'
                        : 'border-gray-300 text-gray-400'
                    }
                  `}>
                    {isCompleted ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      <Icon className="h-5 w-5" />
                    )}
                  </div>
                  <div className="ml-3">
                    <p className={`text-sm font-medium ${isActive ? 'text-blue-600' : 'text-gray-500'}`}>
                      {step.title}
                    </p>
                    <p className="text-xs text-gray-400">{step.description}</p>
                  </div>
                  {index < steps.length - 1 && (
                    <div className="mx-4 flex-1 h-px bg-gray-200" />
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Step Content */}
      <div className="space-y-6">
        {currentStep === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="h-5 w-5" />
                <span>Step 1: Upload Policy PDF</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CutPayDocumentUpload />
              
              <div className="flex justify-end mt-6">
                <Button 
                  onClick={nextStep}
                  disabled={!canProceedToStep2}
                  className="min-w-24"
                >
                  Next
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Upload className="h-5 w-5" />
                <span>Step 2: Additional Documents</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CutPayAdditionalDocuments />
              
              <div className="flex justify-between mt-6">
                <Button variant="outline" onClick={prevStep}>
                  Previous
                </Button>
                <Button 
                  onClick={nextStep}
                  disabled={!canProceedToStep3}
                  className="min-w-24"
                >
                  Next
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Calculator className="h-5 w-5" />
                <span>Step 3: Transaction Details</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CutPaySimpleForm />
              
              <div className="flex justify-between mt-6">
                <Button variant="outline" onClick={prevStep}>
                  Previous
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Debug Info (remove in production) */}
      <Card className="border-dashed border-gray-300">
        <CardContent className="p-4">
          <p className="text-sm text-gray-500">
            Debug: Step {currentStep} | Documents: {uploadedDocuments.length} | 
            Has Policy: {hasPolicyPdf ? 'Yes' : 'No'} | 
            Extracted Data: {extractedData ? 'Yes' : 'No'}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
