"use client"

import React, { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Upload, FileCheck, Calculator, Save } from 'lucide-react'
import { 
  useCreateCutPay, 
  useUpdateCutPay
} from '@/hooks/adminQuery'
import { 
  useCalculateAmounts,
  useExtractPdfForCreation
} from '@/hooks/useCutPayFlow'
import { useBrokersInsurersList } from '@/hooks/superadminQuery'
import { Insurer } from '@/types/superadmin.types'
import { useAtom } from 'jotai'
import { calculatedAmountsAtom, extractedDataAtom } from '@/lib/atoms/cutpay-flow'
import { 
  CreateCutPayRequest, 
  UpdateCutPayRequest, 
  CutPayTransaction
} from '@/types/admin.types'

// =========================================================================
// VALIDATION SCHEMA - ALIGNED WITH NEW API
// =========================================================================
const cutPaySchema = z.object({
  // Document Upload
  policy_pdf_file: z.instanceof(File).optional(),
  kyc_documents: z.array(z.instanceof(File)).optional(),
  rc_document: z.instanceof(File).optional(),
  previous_policy: z.instanceof(File).optional(),
  
  // PDF Extracted Fields (read-only display, can be manually corrected)
  policy_number: z.string().optional(),
  customer_name: z.string().optional(),
  gross_premium: z.number().optional(),
  net_premium: z.number().optional(),
  od_premium: z.number().optional(),
  tp_premium: z.number().optional(),
  gst_amount: z.number().optional(),
  registration_no: z.string().optional(),
  make_model: z.string().optional(),
  plan_type: z.string().optional(),
  
  // Admin Manual Input Fields
  reporting_month: z.string().min(1, "Reporting month is required"),
  booking_date: z.string().min(1, "Booking date is required"),
  agent_code: z.string().min(1, "Agent code is required"),
  code_type: z.enum(["Direct", "Broker"]),
  
  // Commission Configuration
  incoming_grid_percent: z.number().min(0).max(100),
  agent_commission_given_percent: z.number().min(0).max(100),
  extra_grid: z.number().min(0).max(100).optional(),
  commissionable_premium: z.number().min(0).optional(),
  
  // Payment Configuration
  payment_by: z.enum(["Agent", "InsureZeal"]),
  payment_method: z.string().optional(),
  payout_on: z.enum(["OD", "NP", "OD+TP"]),
  agent_extra_percent: z.number().min(0).max(100).optional(),
  payment_by_office: z.enum(["InsureZeal", "Agent"]),
  
  // Relationship Selection
  insurer_code: z.string().min(1, "Please select an insurer"),
  broker_code: z.string().optional(),
  admin_child_id: z.number().optional(),
  
  // Notes
  notes: z.string().optional(),
})

type CutPayFormData = z.infer<typeof cutPaySchema>

interface ComprehensiveCutPayFormProps {
  initialData?: CutPayTransaction
  onSuccess?: (transaction: CutPayTransaction) => void
  mode?: 'create' | 'edit'
  onDocumentUpload?: (file: File) => void
  onDocumentProcessed?: (documentUrl?: string, documentName?: string) => void
}

// main component
export function ComprehensiveCutPayForm({ 
  initialData, 
  onSuccess, 
  mode = 'create'
}: ComprehensiveCutPayFormProps) {
  const [step, setStep] = useState(1)
  const [extractedData, setExtractedData] = useAtom(extractedDataAtom)
  const [isExtracting, setIsExtracting] = useState(false)
  const [additionalDocuments, setAdditionalDocuments] = useState<{
    kyc_documents: File[]
    rc_document: File | null
    previous_policy: File | null
  }>({
    kyc_documents: [],
    rc_document: null,
    previous_policy: null
  })
  const [selectedDocumentForView, setSelectedDocumentForView] = useState<{
    file: File | null
    type: 'policy_pdf' | 'kyc' | 'rc' | 'previous_policy'
    name: string
  } | null>(null)
  
  // Form setup
  const form = useForm<CutPayFormData>({
    resolver: zodResolver(cutPaySchema),
    defaultValues: initialData ? {
      // Map transaction data to form data
      agent_code: initialData.agent_code || undefined,
      insurer_code: '', // We need to derive this from insurer_id or use a different approach
      broker_code: '', // We need to derive this from broker_id or use a different approach
      booking_date: initialData.booking_date?.split('T')[0], // Convert to date string
      reporting_month: initialData.reporting_month || undefined,
      code_type: (initialData.code_type as "Direct" | "Broker") || "Direct",
      payment_by: (initialData.payment_by as "Agent" | "InsureZeal") || "Agent",
      payment_method: initialData.payment_method || undefined,
      payout_on: (initialData.payout_on as "OD" | "NP" | "OD+TP") || "OD",
      payment_by_office: (initialData.payment_by_office as "Agent" | "InsureZeal") || "Agent",
      incoming_grid_percent: initialData.incoming_grid_percent || 0,
      agent_commission_given_percent: initialData.agent_commission_given_percent || 0,
      extra_grid: initialData.extra_grid || 0,
      commissionable_premium: initialData.commissionable_premium || 0,
      agent_extra_percent: initialData.agent_extra_percent || 0,
      admin_child_id: initialData.child_id_request_id ? parseInt(initialData.child_id_request_id) : undefined,
      gross_premium: initialData.gross_premium || 0,
      net_premium: initialData.net_premium || 0,
      od_premium: initialData.od_premium || 0,
      tp_premium: initialData.tp_premium || 0,
      policy_number: initialData.policy_number || undefined,
      customer_name: initialData.customer_name || undefined,
      notes: initialData.notes || undefined,
    } : {},
  })
  
  // Hooks
  const createMutation = useCreateCutPay()
  const updateMutation = useUpdateCutPay()
  const { data: dropdownData } = useBrokersInsurersList()
  const { calculateAmounts } = useCalculateAmounts()
  const [calculations] = useAtom(calculatedAmountsAtom)
  const extractPdfMutation = useExtractPdfForCreation()
  
  // Extract insurers from combined data
  const insurers = dropdownData?.insurers || []
  
  // Note: brokers and form watching variables are prepared for future features
  
  // Watch form fields for real-time calculation
  const watchedFields = form.watch([
    'gross_premium', 'net_premium', 'od_premium', 'tp_premium',
    'incoming_grid_percent', 'agent_commission_given_percent', 
    'extra_grid', 'commissionable_premium', 'agent_extra_percent',
    'payment_by', 'payout_on'
  ])
  
  // Auto-calculate when relevant fields change
  useEffect(() => {
    const [
      gross_premium, net_premium, , ,
      incoming_grid_percent, agent_commission_given_percent,
      extra_grid, commissionable_premium, agent_extra_percent,
      payment_by, payout_on
    ] = watchedFields
    
    if (gross_premium && net_premium && incoming_grid_percent && agent_commission_given_percent && payment_by) {
      calculateAmounts({
        incoming_grid_percent,
        agent_commission_given_percent,
        extra_grid,
        commissionable_premium,
        agent_extra_percent,
        payment_by,
        payout_on
      })
    }
  }, [watchedFields, calculateAmounts])
  
  // Future: Add broker selection when needed
  // const selectedBroker = brokers.find(b => b.broker_code === brokerCode)
  // const selectedInsurer = insurers.find(i => i.insurer_code === insurerCode)
  
  // File upload and extraction
  const handleFileUpload = async (file: File) => {
    if (!file) return
    
    setIsExtracting(true)
    try {
      // Use the proper extraction hook
      const result = await extractPdfMutation.mutateAsync(file)
      
      if (result.extraction_status === 'success' && result.extracted_data) {
        const extractedData = result.extracted_data
        
        // Store the extracted data
        setExtractedData(extractedData)
        
        // Store the file and extracted data in localStorage AND IndexedDB for later use
        const fileData = {
          name: file.name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified
        }
        
        // Store in localStorage for quick access
        localStorage.setItem('cutpay_policy_file', JSON.stringify(fileData))
        localStorage.setItem('cutpay_extracted_data', JSON.stringify(extractedData))
        
        // Store all documents in IndexedDB for later upload
        try {
          const fileBuffer = await file.arrayBuffer()
          const fileBlob = new Blob([fileBuffer], { type: file.type })
          
          const dbRequest = indexedDB.open('CutPayDB', 1)
          dbRequest.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result
            if (!db.objectStoreNames.contains('files')) {
              db.createObjectStore('files', { keyPath: 'id' })
            }
          }
          dbRequest.onsuccess = (event) => {
            const db = (event.target as IDBOpenDBRequest).result
            const transaction = db.transaction(['files'], 'readwrite')
            const store = transaction.objectStore('files')
            store.put({
              id: 'policy_pdf',
              file: fileBlob,
              metadata: fileData,
              timestamp: Date.now(),
              type: 'policy_pdf'
            })
          }
        } catch (error) {
          console.warn('Failed to store file in IndexedDB:', error)
        }
        
        // Auto-populate form with extracted data - with proper type checking
        Object.entries(extractedData).forEach(([key, value]) => {
          if (value !== null && value !== undefined && key in form.getValues()) {
            // Type-safe form value setting
            const typedKey = key as keyof CutPayFormData
            
            // Only set if the types are compatible
            if (typeof value === 'string' || typeof value === 'number') {
              form.setValue(typedKey, value as string | number)
            }
          }
        })
        
        console.log('Extraction successful:', {
          extraction_time: result.extraction_time,
          confidence_scores: result.confidence_scores,
          errors: result.errors
        })
        
      } else {
        throw new Error(`Extraction failed: ${result.extraction_status}`)
      }
      
    } catch (error) {
      console.error('Extraction failed:', error)
      // Show user-friendly error message
      alert(`PDF extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsExtracting(false)
    }
  }
  
  // Handle additional document uploads
  const handleAdditionalDocumentUpload = async (
    file: File,
    docType: 'kyc' | 'rc' | 'previous_policy'
  ) => {
    try {
      // Store file in state
      if (docType === 'kyc') {
        setAdditionalDocuments(prev => ({
          ...prev,
          kyc_documents: [...prev.kyc_documents, file]
        }))
        form.setValue('kyc_documents', [...(form.getValues('kyc_documents') || []), file])
      } else if (docType === 'rc') {
        setAdditionalDocuments(prev => ({ ...prev, rc_document: file }))
        form.setValue('rc_document', file)
      } else if (docType === 'previous_policy') {
        setAdditionalDocuments(prev => ({ ...prev, previous_policy: file }))
        form.setValue('previous_policy', file)
      }
      
      // Store in IndexedDB
      const fileBuffer = await file.arrayBuffer()
      const fileBlob = new Blob([fileBuffer], { type: file.type })
      
      const dbRequest = indexedDB.open('CutPayDB', 1)
      dbRequest.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        const transaction = db.transaction(['files'], 'readwrite')
        const store = transaction.objectStore('files')
        
        const docId = docType === 'kyc' 
          ? `kyc_${Date.now()}` 
          : docType === 'rc' 
            ? 'rc_document' 
            : 'previous_policy'
            
        store.put({
          id: docId,
          file: fileBlob,
          metadata: {
            name: file.name,
            size: file.size,
            type: file.type,
            lastModified: file.lastModified
          },
          timestamp: Date.now(),
          type: docType
        })
      }
    } catch (error) {
      console.error(`Failed to upload ${docType} document:`, error)
    }
  }
  
  // Document viewer function
  const openDocumentViewer = (file: File | null, type: 'policy_pdf' | 'kyc' | 'rc' | 'previous_policy', name: string) => {
    if (file) {
      setSelectedDocumentForView({ file, type, name })
    }
  }
  
  // Get stored policy PDF for viewing
  const getStoredPolicyPdf = (): File | null => {
    const storedFile = form.getValues('policy_pdf_file')
    return storedFile || null
  }
  
  // Form submission
  const onSubmit = async (data: CutPayFormData) => {
    try {
      const payload: CreateCutPayRequest | UpdateCutPayRequest = {
        // Organize data according to new API structure
        extracted_data: extractedData,
        admin_input: {
          reporting_month: data.reporting_month,
          booking_date: data.booking_date,
          agent_code: data.agent_code,
          code_type: data.code_type,
          incoming_grid_percent: data.incoming_grid_percent,
          agent_commission_given_percent: data.agent_commission_given_percent,
          extra_grid: data.extra_grid,
          commissionable_premium: data.commissionable_premium,
          payment_by: data.payment_by,
          payment_method: data.payment_method,
          payout_on: data.payout_on,
          agent_extra_percent: data.agent_extra_percent,
          payment_by_office: data.payment_by_office,
          insurer_code: data.insurer_code,
          broker_code: data.broker_code,
          admin_child_id: data.admin_child_id,
        },
        calculations,
        notes: data.notes,
        status: "completed" // CutPay transactions are always completed
      }
      
      let result: CutPayTransaction
      if (mode === 'create') {
        result = await createMutation.mutateAsync(payload as CreateCutPayRequest)
        
        // After creating transaction, upload all documents
        if (result.id) {
          // Upload policy PDF
          const policyFile = getStoredPolicyPdf()
          if (policyFile) {
            // Upload using your document upload API
            console.log('Uploading policy PDF for transaction:', result.id)
          }
          
          // Upload additional documents
          if (additionalDocuments.rc_document) {
            console.log('Uploading RC document for transaction:', result.id)
          }
          
          if (additionalDocuments.previous_policy) {
            console.log('Uploading previous policy for transaction:', result.id)
          }
          
          if (additionalDocuments.kyc_documents.length > 0) {
            console.log('Uploading KYC documents for transaction:', result.id)
          }
        }
      } else {
        result = await updateMutation.mutateAsync({
          cutpayId: initialData!.id,
          data: payload as UpdateCutPayRequest
        })
      }
      
      onSuccess?.(result)
      
    } catch (error) {
      console.error('Form submission failed:', error)
    }
  }
  
  const isLoading = createMutation.isPending || updateMutation.isPending
  
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Progress Steps */}
      <div className="flex items-center justify-center space-x-4 mb-8">
        {[
          { step: 1, title: "Policy Upload", icon: Upload },
          { step: 2, title: "Additional Documents", icon: FileCheck },
          { step: 3, title: "Admin Configuration", icon: Calculator },
          { step: 4, title: "Review & Submit", icon: Save },
        ].map(({ step: stepNum, title, icon: Icon }) => (
          <div key={stepNum} className="flex items-center">
            <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
              step >= stepNum ? 'bg-primary text-white' : 'bg-gray-200 text-gray-500'
            }`}>
              <Icon className="w-5 h-5" />
            </div>
            <span className={`ml-2 ${step >= stepNum ? 'text-primary' : 'text-gray-500'}`}>
              {title}
            </span>
            {stepNum < 4 && <div className="w-12 h-1 bg-gray-200 mx-4" />}
          </div>
        ))}
      </div>
      
      <form onSubmit={(e) => {
        e.preventDefault()
        const formData = form.getValues() as CutPayFormData
        onSubmit(formData)
      }} className="space-y-6">
        {/* Step 1: Document Upload & Extraction */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Document Upload & AI Extraction
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="policy_pdf">Policy PDF</Label>
                <Input
                  id="policy_pdf"
                  type="file"
                  accept=".pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      form.setValue('policy_pdf_file', file)
                      handleFileUpload(file)
                    }
                  }}
                />
              </div>
              
              {isExtracting && (
                <Alert>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <AlertDescription>
                    Extracting data from PDF using AI/OCR...
                  </AlertDescription>
                </Alert>
              )}
              
              {extractedData && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Extracted Data (Read-only)</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Policy Number</Label>
                      <Input value={extractedData.policy_number || ''} readOnly />
                    </div>
                    <div>
                      <Label>Customer Name</Label>
                      <Input value={extractedData.customer_name || ''} readOnly />
                    </div>
                    <div>
                      <Label>Gross Premium</Label>
                      <Input value={extractedData.gross_premium || ''} readOnly />
                    </div>
                    <div>
                      <Label>Net Premium</Label>
                      <Input value={extractedData.net_premium || ''} readOnly />
                    </div>
                  </CardContent>
                </Card>
              )}
              
              <Button 
                type="button" 
                onClick={() => setStep(2)}
                disabled={!extractedData}
                className="w-full"
              >
                Continue to Additional Documents
              </Button>
            </CardContent>
          </Card>
        )}
        
        {/* Step 2: Additional Documents */}
        {step === 2 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Document Upload Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  Additional Documents
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* KYC Documents */}
                <div>
                  <Label htmlFor="kyc_documents">KYC Documents (Multiple files allowed)</Label>
                  <Input
                    id="kyc_documents"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files || [])
                      files.forEach(file => handleAdditionalDocumentUpload(file, 'kyc'))
                    }}
                  />
                  {additionalDocuments.kyc_documents.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {additionalDocuments.kyc_documents.map((file, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <span className="text-sm">{file.name}</span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openDocumentViewer(file, 'kyc', file.name)}
                          >
                            View
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* RC Document */}
                <div>
                  <Label htmlFor="rc_document">Registration Certificate (RC)</Label>
                  <Input
                    id="rc_document"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleAdditionalDocumentUpload(file, 'rc')
                    }}
                  />
                  {additionalDocuments.rc_document && (
                    <div className="mt-2 flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="text-sm">{additionalDocuments.rc_document.name}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openDocumentViewer(additionalDocuments.rc_document, 'rc', additionalDocuments.rc_document!.name)}
                      >
                        View
                      </Button>
                    </div>
                  )}
                </div>
                
                {/* Previous Policy */}
                <div>
                  <Label htmlFor="previous_policy">Previous Policy PDF</Label>
                  <Input
                    id="previous_policy"
                    type="file"
                    accept=".pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleAdditionalDocumentUpload(file, 'previous_policy')
                    }}
                  />
                  {additionalDocuments.previous_policy && (
                    <div className="mt-2 flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="text-sm">{additionalDocuments.previous_policy.name}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openDocumentViewer(additionalDocuments.previous_policy, 'previous_policy', additionalDocuments.previous_policy!.name)}
                      >
                        View
                      </Button>
                    </div>
                  )}
                </div>
                
                <div className="flex gap-2 pt-4">
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => setStep(1)}
                    className="flex-1"
                  >
                    Previous
                  </Button>
                  <Button 
                    type="button" 
                    onClick={() => setStep(3)}
                    className="flex-1"
                  >
                    Continue to Configuration
                  </Button>
                </div>
              </CardContent>
            </Card>
            
            {/* Document Viewer Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileCheck className="w-5 h-5" />
                  Document Viewer
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const file = getStoredPolicyPdf()
                        if (file) openDocumentViewer(file, 'policy_pdf', 'Policy PDF')
                      }}
                      disabled={!getStoredPolicyPdf()}
                    >
                      View Policy PDF
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (additionalDocuments.rc_document) {
                          openDocumentViewer(additionalDocuments.rc_document, 'rc', 'RC Document')
                        }
                      }}
                      disabled={!additionalDocuments.rc_document}
                    >
                      View RC
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (additionalDocuments.previous_policy) {
                          openDocumentViewer(additionalDocuments.previous_policy, 'previous_policy', 'Previous Policy')
                        }
                      }}
                      disabled={!additionalDocuments.previous_policy}
                    >
                      View Previous Policy
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (additionalDocuments.kyc_documents.length > 0) {
                          openDocumentViewer(additionalDocuments.kyc_documents[0], 'kyc', 'KYC Document')
                        }
                      }}
                      disabled={additionalDocuments.kyc_documents.length === 0}
                    >
                      View KYC
                    </Button>
                  </div>
                  
                  {selectedDocumentForView && (
                    <div className="border rounded-lg p-4 mt-4">
                      <h4 className="font-semibold mb-2">{selectedDocumentForView.name}</h4>
                      <div className="bg-gray-100 p-4 rounded text-center min-h-[200px] flex items-center justify-center">
                        <div className="text-gray-600">
                          <FileCheck className="w-12 h-12 mx-auto mb-2" />
                          <p>Document preview would appear here</p>
                          <p className="text-sm">Type: {selectedDocumentForView.type}</p>
                          <Button
                            size="sm"
                            className="mt-2"
                            onClick={() => {
                              if (selectedDocumentForView.file) {
                                const url = URL.createObjectURL(selectedDocumentForView.file)
                                window.open(url, '_blank')
                              }
                            }}
                          >
                            Open in New Tab
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        
        {/* Step 3: Admin Configuration */}
        {step === 3 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Admin Input Section */}
            <Card>
              <CardHeader>
                <CardTitle>Admin Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="reporting_month">Reporting Month</Label>
                    <Input
                      id="reporting_month"
                      placeholder="JUN'25"
                      {...form.register('reporting_month')}
                    />
                  </div>
                  <div>
                    <Label htmlFor="booking_date">Booking Date</Label>
                    <Input
                      id="booking_date"
                      type="date"
                      {...form.register('booking_date')}
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="agent_code">Agent Code</Label>
                  <Input
                    id="agent_code"
                    placeholder="AG001"
                    {...form.register('agent_code')}
                  />
                </div>
                
                <div>
                  <Label htmlFor="code_type">Code Type</Label>
                  <Select onValueChange={(value) => form.setValue('code_type', value as "Direct" | "Broker")}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select code type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Direct">Direct</SelectItem>
                      <SelectItem value="Broker">Broker</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <Separator />
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="incoming_grid_percent">Incoming Grid %</Label>
                    <Input
                      id="incoming_grid_percent"
                      type="number"
                      step="0.01"
                      placeholder="15.00"
                      {...form.register('incoming_grid_percent', { valueAsNumber: true })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="agent_commission_given_percent">Agent Commission %</Label>
                    <Input
                      id="agent_commission_given_percent"
                      type="number"
                      step="0.01"
                      placeholder="12.00"
                      {...form.register('agent_commission_given_percent', { valueAsNumber: true })}
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="payment_by">Payment By</Label>
                  <Select onValueChange={(value) => form.setValue('payment_by', value as "Agent" | "InsureZeal")}>
                    <SelectTrigger>
                      <SelectValue placeholder="Who handles payment" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Agent">Agent</SelectItem>
                      <SelectItem value="InsureZeal">InsureZeal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="insurer_code">Insurer</Label>
                  <Select onValueChange={(value) => form.setValue('insurer_code', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select insurer" />
                    </SelectTrigger>
                    <SelectContent>
                      {insurers?.map((insurer: Insurer) => (
                        <SelectItem key={insurer.insurer_code} value={insurer.insurer_code}>
                          {insurer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
            
            {/* Real-time Calculations */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="w-5 h-5" />
                  Real-time Calculations
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!calculations ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : calculations ? (
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span>Receivable from Broker:</span>
                      <Badge variant="outline">
                        ₹{calculations.receivable_from_broker?.toLocaleString() || 0}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Receivable (with GST):</span>
                      <Badge variant="outline">
                        ₹{calculations.total_receivable_from_broker_with_gst?.toLocaleString() || 0}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>CutPay Amount:</span>
                      <Badge variant="default">
                        ₹{calculations.cut_pay_amount?.toLocaleString() || 0}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Agent Payout:</span>
                      <Badge variant="secondary">
                        ₹{calculations.total_agent_po_amt?.toLocaleString() || 0}
                      </Badge>
                    </div>
                  </div>
                ) : (
                  <Alert>
                    <AlertDescription>
                      Enter premium and commission details to see calculations
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </div>
        )}
        
        {/* Form Actions */}
        <div className="flex justify-between pt-6">
          {step > 1 && step !== 2 && (
            <Button type="button" variant="outline" onClick={() => setStep(step - 1)}>
              Previous
            </Button>
          )}
          
          {step < 3 ? (
            <div /> // Placeholder for alignment
          ) : (
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {mode === 'create' ? 'Create Transaction' : 'Update Transaction'}
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}
