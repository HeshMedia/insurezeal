'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAtom } from 'jotai'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  FileText,
  Eye,
  EyeOff,
  Calculator,
  User,
  Car,
  Building,
  CreditCard,
  Save,
  ArrowLeft,
  ArrowRight,
  Info,
  Database
} from 'lucide-react'

// Import APIs
import { useAgentList } from '@/hooks/adminQuery'
import { useBrokerList, useInsurerList } from '@/hooks/superadminQuery'
import { useCreateCutPay, useUploadCutPayDocument } from '@/hooks/cutpayQuery'

// Import atoms
import {
  pdfExtractionDataAtom,
  policyPdfUrlAtom,
  additionalDocumentsUrlsAtom,
  cutpayCalculationResultAtom
} from '@/lib/atoms/cutpay'

// Import IndexedDB utilities
import { getFileFromIndexedDB, arrayBufferToFile } from '@/lib/utils/indexeddb'

// Import types
import { CreateCutPayRequest, ExtractedPolicyData, AdminInputData, CalculationData } from '@/types/cutpay.types'

// Import toast for notifications
import { toast } from 'sonner'

interface AdminInputFormProps {
  onNext?: () => void
  onPrev?: () => void
}

const AdminInputForm: React.FC<AdminInputFormProps> = ({ onNext, onPrev }) => {
  const [odPayoutPercent, setOdPayoutPercent] = useState<number | null>(null)
  const [tpPayoutPercent, setTpPayoutPercent] = useState<number | null>(null)
  const [odIncomingGridPercent, setOdIncomingGridPercent] = useState<number | null>(null)
  const [tpIncomingGridPercent, setTpIncomingGridPercent] = useState<number | null>(null)
  const [incomingPoAmt, setIncomingPoAmt] = useState<number | null>(null)
  const [extractedData] = useAtom(pdfExtractionDataAtom)
  const [policyPdfUrl] = useAtom(policyPdfUrlAtom)
  const [additionalDocUrls, setAdditionalDocUrls] = useAtom(additionalDocumentsUrlsAtom)
  const [calculationResult] = useAtom(cutpayCalculationResultAtom)
  
  const [showDocumentViewer, setShowDocumentViewer] = useState(true)
  const [activeDocument, setActiveDocument] = useState<'policy' | 'kyc' | 'rc' | 'previous'>('policy')
  const [availableDocuments, setAvailableDocuments] = useState<Array<{key: string, label: string, available: boolean}>>([])
  
  // Loading states for transaction creation and document upload
  const [isCreatingTransaction, setIsCreatingTransaction] = useState(false)
  const [isUploadingDocuments, setIsUploadingDocuments] = useState(false)
  const [creationStep, setCreationStep] = useState('')
  
  // Query hooks for dropdown data
  const { data: agentsData } = useAgentList({ page_size: 1000 })
  const { data: insurersData } = useInsurerList()
  const { data: brokersData } = useBrokerList()
  
  // Create and upload mutations
  const createCutPayMutation = useCreateCutPay()
  const uploadDocumentMutation = useUploadCutPayDocument()
  
  // Form state matching the API structure
  const [formData, setFormData] = useState<CreateCutPayRequest>({
    policy_pdf_url: '',
    additional_documents: {},
    extracted_data: {
      policy_number: null,
      formatted_policy_number: null,
      major_categorisation: null,
      product_insurer_report: null,
      product_type: null,
      plan_type: null,
      customer_name: null,
      gross_premium: null,
      net_premium: null,
      od_premium: null,
      tp_premium: null,
      gst_amount: null,
      registration_no: null,
      make_model: null,
      model: null,
      vehicle_variant: null,
      gvw: null,
      rto: null,
      state: null,
      fuel_type: null,
      cc: null,
      age_year: null,
      ncb: null,
      discount_percent: null,
      business_type: null,
      seating_capacity: null,
      veh_wheels: null
    },
    admin_input: {
      reporting_month: null,
      booking_date: null,
      agent_code: null,
      code_type: null,
      incoming_grid_percent: null,
      agent_commission_given_percent: null,
      extra_grid: null,
      commissionable_premium: null,
      payment_by: null,
      payment_method: null,
      payout_on: null,
      agent_extra_percent: null,
      payment_by_office: null,
      insurer_code: null,
      broker_code: null,
      admin_child_id: null
    },
    calculations: {
      receivable_from_broker: null,
      extra_amount_receivable_from_broker: null,
      total_receivable_from_broker: null,
      total_receivable_from_broker_with_gst: null,
      cut_pay_amount: null,
      agent_po_amt: null,
      agent_extra_amount: null,
      total_agent_po_amt: null
    },
    claimed_by: null,
    already_given_to_agent: null,
    po_paid_to_agent: null,
    running_bal: null,
    match_status: null,
    invoice_number: null,
    notes: null
  })

  // Helper functions for updating nested state
  const updateExtractedData = useCallback((field: keyof ExtractedPolicyData, value: string | number | null) => {
    setFormData(prev => ({
      ...prev,
      extracted_data: {
        ...prev.extracted_data,
        [field]: value
      }
    }))
  }, [])

  const updateAdminInput = useCallback((field: keyof AdminInputData, value: string | number | null) => {
    setFormData(prev => ({
      ...prev,
      admin_input: {
        ...prev.admin_input,
        [field]: value
      }
    }))
  }, [])

  const updateCalculations = useCallback((field: keyof CalculationData, value: number | null) => {
    setFormData(prev => ({
      ...prev,
      calculations: {
        ...prev.calculations,
        [field]: value
      }
    }))
  }, [])

  const updateRootField = useCallback((field: keyof CreateCutPayRequest, value: string | number | null) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }, [])

  // Auto-calculation effect
  useEffect(() => {
    const payment_by = formData.admin_input?.payment_by
    const payout_on = formData.admin_input?.payout_on
    const agent_commission_given_percent = formData.admin_input?.agent_commission_given_percent
    const incoming_grid_percent = formData.admin_input?.incoming_grid_percent
    const extra_grid = formData.admin_input?.extra_grid
    const commissionable_premium = formData.admin_input?.commissionable_premium
    const agent_extra_percent = formData.admin_input?.agent_extra_percent

    const gross_premium = formData.extracted_data?.gross_premium
    const net_premium = formData.extracted_data?.net_premium
    const od_premium = formData.extracted_data?.od_premium
    const tp_premium = formData.extracted_data?.tp_premium

    let cutPay = 0
    let agentPo = 0
    let incomingPo = 0
    let receivableFromBroker = 0
    let extraAmountReceivableFromBroker = 0
    let agentExtraAmount = 0

    // Cut Pay Amount Calculation
    if (payment_by === 'agent') {
      cutPay = 0
    } else if (payment_by === 'insurezeal' && typeof gross_premium === 'number' && typeof net_premium === 'number' && typeof agent_commission_given_percent === 'number') {
      cutPay = gross_premium - (net_premium * (agent_commission_given_percent / 100))
    }

    // Agent PO and Incoming PO Calculation
    if (payment_by === 'agent') {
      if (payout_on === 'od_premium' && typeof od_premium === 'number' && typeof agent_commission_given_percent === 'number') {
        agentPo = od_premium * (agent_commission_given_percent / 100)
      } else if (payout_on === 'net_premium' && typeof net_premium === 'number' && typeof agent_commission_given_percent === 'number') {
        agentPo = net_premium * (agent_commission_given_percent / 100)
      } else if (payout_on === 'od+tp' && typeof od_premium === 'number' && typeof tp_premium === 'number' && typeof odPayoutPercent === 'number' && typeof tpPayoutPercent === 'number') {
        agentPo = (od_premium * (odPayoutPercent / 100)) + (tp_premium * (tpPayoutPercent / 100))
      }
      incomingPo = 0
    } else if (payment_by === 'insurezeal') {
      agentPo = 0
      if (payout_on === 'od_premium' && typeof od_premium === 'number' && typeof incoming_grid_percent === 'number') {
        incomingPo = od_premium * (incoming_grid_percent / 100)
      } else if (payout_on === 'net_premium' && typeof net_premium === 'number' && typeof incoming_grid_percent === 'number') {
        incomingPo = net_premium * (incoming_grid_percent / 100)
      } else if (payout_on === 'od+tp' && typeof od_premium === 'number' && typeof tp_premium === 'number' && typeof odIncomingGridPercent === 'number' && typeof tpIncomingGridPercent === 'number') {
        incomingPo = (od_premium * (odIncomingGridPercent / 100)) + (tp_premium * (tpIncomingGridPercent / 100))
      }
    }

    // Commission Calculations
    if (typeof gross_premium === 'number' && typeof incoming_grid_percent === 'number') {
      receivableFromBroker = gross_premium * (incoming_grid_percent / 100)
    }
    if (typeof commissionable_premium === 'number' && typeof extra_grid === 'number') {
      extraAmountReceivableFromBroker = commissionable_premium * (extra_grid / 100)
    }
    const totalReceivableFromBroker = receivableFromBroker + extraAmountReceivableFromBroker
    const totalReceivableFromBrokerWithGst = totalReceivableFromBroker * 1.18

    // Agent Extra Amount & Total PO
    if (typeof commissionable_premium === 'number' && typeof agent_extra_percent === 'number') {
      agentExtraAmount = commissionable_premium * (agent_extra_percent / 100)
    }
    const totalAgentPoAmt = agentPo + agentExtraAmount

    setIncomingPoAmt(incomingPo)
    
    // Update calculations
    setFormData(prev => ({
      ...prev,
      calculations: {
        ...prev.calculations,
        cut_pay_amount: cutPay,
        agent_po_amt: agentPo,
        receivable_from_broker: receivableFromBroker,
        extra_amount_receivable_from_broker: extraAmountReceivableFromBroker,
        total_receivable_from_broker: totalReceivableFromBroker,
        total_receivable_from_broker_with_gst: totalReceivableFromBrokerWithGst,
        agent_extra_amount: agentExtraAmount,
        total_agent_po_amt: totalAgentPoAmt,
      }
    }))
  }, [
    formData.admin_input?.payment_by,
    formData.admin_input?.payout_on,
    formData.extracted_data?.gross_premium,
    formData.extracted_data?.net_premium,
    formData.admin_input?.agent_commission_given_percent,
    formData.admin_input?.incoming_grid_percent,
    formData.extracted_data?.od_premium,
    formData.extracted_data?.tp_premium,
    formData.admin_input?.commissionable_premium,
    formData.admin_input?.extra_grid,
    formData.admin_input?.agent_extra_percent,
    odPayoutPercent,
    tpPayoutPercent,
    odIncomingGridPercent,
    tpIncomingGridPercent
  ])

  // Auto-fill extracted data when component mounts
  useEffect(() => {
    if (extractedData?.extracted_data && policyPdfUrl) {
      const extracted = extractedData.extracted_data
      setFormData(prev => ({
        ...prev,
        policy_pdf_url: policyPdfUrl,
        extracted_data: {
          ...prev.extracted_data,
          ...extracted
        }
      }))
    }
  }, [extractedData, policyPdfUrl])

  const handleCreateTransaction = async () => {
    try {
      setIsCreatingTransaction(true)
      setCreationStep('Creating new cutpay transaction...')

      // Validate required fields
      if (!formData.extracted_data?.gross_premium || !formData.extracted_data?.od_premium || !formData.extracted_data?.tp_premium) {
        throw new Error('Missing required premium fields')
      }

      if (!formData.admin_input?.payment_by || !formData.admin_input?.payout_on) {
        throw new Error('Missing required payment configuration')
      }

      // Prepare the create request with the correct nested structure
      const createRequest: CreateCutPayRequest = {
        policy_pdf_url: policyPdfUrl || 'policy_pdf',
        additional_documents: {},
        extracted_data: {
          ...formData.extracted_data
        },
        admin_input: {
          ...formData.admin_input,
          reporting_month: formData.admin_input.reporting_month 
            ? formData.admin_input.reporting_month.slice(0, 7)
            : null,
          booking_date: formData.admin_input.booking_date || null
        },
        calculations: {
          ...formData.calculations
        },
        claimed_by: formData.claimed_by,
        already_given_to_agent: formData.already_given_to_agent,
        po_paid_to_agent: formData.po_paid_to_agent,
        running_bal: formData.running_bal,
        match_status: formData.match_status,
        invoice_number: formData.invoice_number,
        notes: formData.notes
      };

      // Log the request for debugging
      console.log('Create request payload:', JSON.stringify(createRequest, null, 2));

      // Create the cutpay transaction
      const createdTransaction = await createCutPayMutation.mutateAsync(createRequest)
      
      if (!createdTransaction?.id) {
        throw new Error('Failed to create transaction - no ID returned')
      }

      toast.success('Transaction created successfully!')
      
      // Call onNext if provided
      if (onNext) {
        onNext()
      }

    } catch (error) {
      console.error('Error creating transaction:', error)
      
      const errorMessage = error instanceof Error 
        ? error.message
        : 'Failed to create transaction';
        
      toast.error(`Transaction creation failed: ${errorMessage}`)
      
      // Clear loading states
      setIsCreatingTransaction(false)
      setIsUploadingDocuments(false)
      setCreationStep('')
    }
  }

  return (
    <div className="space-y-6">
      {/* Loading Dialog */}
      <Dialog open={isCreatingTransaction || isUploadingDocuments} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LoadingSpinner size="sm" />
              Creating Transaction
            </DialogTitle>
            <DialogDescription>
              {creationStep}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center py-4">
            <div className="flex flex-col items-center space-y-3">
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-blue-600 animate-pulse" />
                <span className="text-sm text-gray-600">Creating new cutpay transaction...</span>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Admin Input & Data Review</h2>
          <p className="text-gray-600 mt-1">Review extracted data and fill in additional details</p>
        </div>
      </div>

      {/* Simple Form for now */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="gross_premium">Gross Premium</Label>
              <Input
                id="gross_premium"
                type="number"
                value={formData.extracted_data?.gross_premium || ''}
                onChange={(e) => updateExtractedData('gross_premium', parseFloat(e.target.value) || null)}
                placeholder="Enter gross premium"
              />
            </div>
            <div>
              <Label htmlFor="payment_by">Payment By</Label>
              <Select 
                value={formData.admin_input?.payment_by || ''}
                onValueChange={(value) => updateAdminInput('payment_by', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="agent">Agent</SelectItem>
                  <SelectItem value="insurezeal">Insurezeal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="admin_child_id">Admin Child ID</Label>
              <Input
                id="admin_child_id"
                type="text"
                value={formData.admin_input?.admin_child_id || ''}
                onChange={(e) => updateAdminInput('admin_child_id', e.target.value)}
                placeholder="Enter admin child ID"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-6 border-t">
        <Button
          variant="outline"
          onClick={onPrev}
          disabled={!onPrev}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Previous Step
        </Button>
        
        <div className="flex gap-3">
          <Button variant="outline" className="flex items-center gap-2">
            <Save className="h-4 w-4" />
            Save Draft
          </Button>
          <Button onClick={handleCreateTransaction} className="flex items-center gap-2">
            Create Transaction
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

export default AdminInputForm
