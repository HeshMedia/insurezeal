'use client'

import { useState, useEffect } from 'react'
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
import { useCutPayCalculation, useCreateCutPay, useUploadCutPayDocument } from '@/hooks/cutpayQuery'

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
// No additional types needed - using local interfaces

// Import toast for notifications
import { toast } from 'sonner'

// Define form state structure that matches the API - flattened structure
interface FormState {
  // Document URLs
  policy_pdf_url: string
  additional_documents: Record<string, unknown>
  
  // Extracted Policy Data (flattened)
  policy_number: string | null
  formatted_policy_number: string | null
  major_categorisation: string | null
  product_insurer_report: string | null
  product_type: string | null
  plan_type: string | null
  customer_name: string | null
  gross_premium: number | null
  net_premium: number | null
  od_premium: number | null
  tp_premium: number | null
  gst_amount: number | null
  registration_no: string | null
  make_model: string | null
  model: string | null
  vehicle_variant: string | null
  gvw: number | null
  rto: string | null
  state: string | null
  fuel_type: string | null
  cc: number | null
  age_year: number | null
  ncb: string | null
  discount_percent: number | null
  business_type: string | null
  seating_capacity: number | null
  veh_wheels: number | null
  
  // Admin Input Data (flattened)
  reporting_month: string | null
  booking_date: string | null
  agent_code: string | null
  code_type: string | null
  incoming_grid_percent: number | null
  agent_commission_given_percent: number | null
  extra_grid: number | null
  commissionable_premium: number | null
  payment_by: string | null
  payment_method: string | null
  payout_on: string | null
  agent_extra_percent: number | null
  payment_by_office: string | null
  insurer_code: string | null
  broker_code: string | null
  admin_child_id: string | null
  
  // Calculation Results (flattened)
  receivable_from_broker: number | null
  extra_amount_receivable_from_broker: number | null
  total_receivable_from_broker: number | null
  total_receivable_from_broker_with_gst: number | null
  cut_pay_amount: number | null
  agent_po_amt: number | null
  agent_extra_amount: number | null
  total_agent_po_amt: number | null
  
  // Additional Transaction Fields
  claimed_by: string | null
  already_given_to_agent: number | null
  po_paid_to_agent: number | null
  running_bal: number | null
  match_status: string | null
  invoice_number: string | null
  notes: string | null
}

// Define flat request type for API
interface FlatCreateCutPayRequest {
  policy_pdf_url: string
  additional_documents: Record<string, unknown>
  
  // All fields flattened at root level
  policy_number: string | null
  formatted_policy_number: string | null
  major_categorisation: string | null
  product_insurer_report: string | null
  product_type: string | null
  plan_type: string | null
  customer_name: string | null
  gross_premium: number | null
  net_premium: number | null
  od_premium: number | null
  tp_premium: number | null
  gst_amount: number | null
  registration_no: string | null
  make_model: string | null
  model: string | null
  vehicle_variant: string | null
  gvw: number | null
  rto: string | null
  state: string | null
  fuel_type: string | null
  cc: number | null
  age_year: number | null
  ncb: string | null
  discount_percent: number | null
  business_type: string | null
  seating_capacity: number | null
  veh_wheels: number | null
  reporting_month: string | null
  booking_date: string | null
  agent_code: string | null
  code_type: string | null
  incoming_grid_percent: number | null
  agent_commission_given_percent: number | null
  extra_grid: number | null
  commissionable_premium: number | null
  payment_by: string | null
  payment_method: string | null
  payout_on: string | null
  agent_extra_percent: number | null
  payment_by_office: string | null
  insurer_code: string | null
  broker_code: string | null
  admin_child_id: string | null
  insurer_id: number | null
  broker_id: number | null
  child_id_request_id: string | null
  insurer_name: string | null
  broker_name: string | null
  insurer_broker_code: string | null
  cluster: string | null
  receivable_from_broker: number | null
  extra_amount_receivable_from_broker: number | null
  total_receivable_from_broker: number | null
  total_receivable_from_broker_with_gst: number | null
  cut_pay_amount: number | null
  agent_po_amt: number | null
  agent_extra_amount: number | null
  total_agent_po_amt: number | null
  claimed_by: string | null
  already_given_to_agent: number | null
  po_paid_to_agent: number | null
  running_bal: number | null
  match_status: string | null
  invoice_number: string | null
  notes: string | null
}

// Define types for form field configurations
interface FormFieldOption {
  value: string
  label: string
}

interface FormFieldConditional {
  field: string
  value: string | number | null
}

interface FormField {
  key: string
  label: string
  type: string
  options?: string[] | FormFieldOption[]
  conditional?: FormFieldConditional
  conditionalOr?: FormFieldConditional[]
}

interface AdminInputFormProps {
  onNext?: () => void
  onPrev?: () => void
}

const AdminInputForm = ({ onNext, onPrev }: AdminInputFormProps) => {
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
  
  // Calculation mutation
  const cutpayCalculation = useCutPayCalculation()
  
  // Create and upload mutations
  const createCutPayMutation = useCreateCutPay()
  const uploadDocumentMutation = useUploadCutPayDocument()
  
  // Remove separate paymentSource state and use formData.payment_method
  // const [paymentSource, setPaymentSource] = useState<string>('')

  // Form state that matches the API structure - flattened
  const [formData, setFormData] = useState<FormState>({
    // Document URLs
    policy_pdf_url: '',
    additional_documents: {},
    
    // Extracted Policy Data (flattened)
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
    veh_wheels: null,
    
    // Admin Input Data (flattened)
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
    admin_child_id: null,
    
    // Calculation Results (flattened)
    receivable_from_broker: null,
    extra_amount_receivable_from_broker: null,
    total_receivable_from_broker: null,
    total_receivable_from_broker_with_gst: null,
    cut_pay_amount: null,
    agent_po_amt: null,
    agent_extra_amount: null,
    total_agent_po_amt: null,
    
    // Additional Transaction Fields
    claimed_by: null,
    already_given_to_agent: null,
    po_paid_to_agent: null,
    running_bal: null,
    match_status: null,
    invoice_number: null,
    notes: null
  })

  useEffect(() => {
    // Extract values from formData to avoid dependency on entire object
    const payment_by = formData.payment_by;
    const payout_on = formData.payout_on;
    const gross_premium = formData.gross_premium;
    const net_premium = formData.net_premium;
    const agent_commission_given_percent = formData.agent_commission_given_percent;
    const incoming_grid_percent = formData.incoming_grid_percent;
    const od_premium = formData.od_premium;
    const tp_premium = formData.tp_premium;
    const commissionable_premium = formData.commissionable_premium;
    const extra_grid = formData.extra_grid;
    const agent_extra_percent = formData.agent_extra_percent;

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
    setFormData(prev => ({
      ...prev,
      cut_pay_amount: cutPay,
      agent_po_amt: agentPo,
      receivable_from_broker: receivableFromBroker,
      extra_amount_receivable_from_broker: extraAmountReceivableFromBroker,
      total_receivable_from_broker: totalReceivableFromBroker,
      total_receivable_from_broker_with_gst: totalReceivableFromBrokerWithGst,
      agent_extra_amount: agentExtraAmount,
      total_agent_po_amt: totalAgentPoAmt,
    }))

 
  }, [
    formData.payment_by,
    formData.payout_on,
    formData.gross_premium,
    formData.net_premium,
    formData.agent_commission_given_percent,
    formData.incoming_grid_percent,
    formData.od_premium,
    formData.tp_premium,
    formData.commissionable_premium,
    formData.extra_grid,
    formData.agent_extra_percent,
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
        // Auto-fill extracted fields
        policy_number: extracted.policy_number || null,
        formatted_policy_number: extracted.formatted_policy_number || null,
        major_categorisation: extracted.major_categorisation || null,
        product_insurer_report: extracted.product_insurer_report || null,
        product_type: extracted.product_type || null,
        plan_type: extracted.plan_type || null,
        customer_name: extracted.customer_name || null,
        gross_premium: extracted.gross_premium || null,
        net_premium: extracted.net_premium || null,
        od_premium: extracted.od_premium || null,
        tp_premium: extracted.tp_premium || null,
        gst_amount: extracted.gst_amount || null,
        registration_no: extracted.registration_no || null,
        make_model: extracted.make_model || null,
        model: extracted.model || null,
        vehicle_variant: extracted.vehicle_variant || null,
        gvw: extracted.gvw || null,
        rto: extracted.rto || null,
        state: extracted.state || null,
        fuel_type: extracted.fuel_type || null,
        cc: extracted.cc || null,
        age_year: extracted.age_year || null,
        ncb: extracted.ncb || null,
        discount_percent: extracted.discount_percent || null,
        business_type: extracted.business_type || null,
        seating_capacity: extracted.seating_capacity || null,
        veh_wheels: extracted.veh_wheels || null
      }))
    }
  }, [extractedData, policyPdfUrl])

  // Load additional documents from IndexedDB and create URLs
  useEffect(() => {
    const loadDocumentsFromIndexedDB = async () => {
      try {
        const [kycDoc, rcDoc, previousDoc] = await Promise.all([
          getFileFromIndexedDB('kyc_documents'),
          getFileFromIndexedDB('rc_document'),
          getFileFromIndexedDB('previous_policy')
        ])

        const urls = {
          kyc_documents: null as string | null,
          rc_document: null as string | null,
          previous_policy: null as string | null
        }
        const docs = []

        // Create blob URLs for available documents
        if (kycDoc) {
          const file = arrayBufferToFile(kycDoc.content, kycDoc.name, kycDoc.type)
          urls.kyc_documents = URL.createObjectURL(file)
          docs.push({ key: 'kyc', label: 'KYC Documents', available: true })
        } else {
          docs.push({ key: 'kyc', label: 'KYC Documents', available: false })
        }

        if (rcDoc) {
          const file = arrayBufferToFile(rcDoc.content, rcDoc.name, rcDoc.type)
          urls.rc_document = URL.createObjectURL(file)
          docs.push({ key: 'rc', label: 'RC Document', available: true })
        } else {
          docs.push({ key: 'rc', label: 'RC Document', available: false })
        }

        if (previousDoc) {
          const file = arrayBufferToFile(previousDoc.content, previousDoc.name, previousDoc.type)
          urls.previous_policy = URL.createObjectURL(file)
          docs.push({ key: 'previous', label: 'Previous Policy', available: true })
        } else {
          docs.push({ key: 'previous', label: 'Previous Policy', available: false })
        }

        // Add policy document
        docs.unshift({ key: 'policy', label: 'Policy PDF', available: !!policyPdfUrl })

        setAdditionalDocUrls(urls)
        setAvailableDocuments(docs)

      } catch (error) {
        console.error('Error loading documents from IndexedDB:', error)
      }
    }

    loadDocumentsFromIndexedDB()
  }, [policyPdfUrl, setAdditionalDocUrls])

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      // Cleanup function will be called on unmount
      const currentUrls = additionalDocUrls
      if (currentUrls.kyc_documents) URL.revokeObjectURL(currentUrls.kyc_documents)
      if (currentUrls.rc_document) URL.revokeObjectURL(currentUrls.rc_document)
      if (currentUrls.previous_policy) URL.revokeObjectURL(currentUrls.previous_policy)
    }
  }, [additionalDocUrls])

  const handleInputChange = (field: keyof FormState, value: string | number | null) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleCreateTransaction = async () => {
    try {
      setIsCreatingTransaction(true)
      setCreationStep('Creating new cutpay transaction...')

      // Validate required fields
      if (!formData.gross_premium || !formData.od_premium || !formData.tp_premium) {
        throw new Error('Missing required premium fields')
      }

      if (!formData.payment_by || !formData.payout_on) {
        throw new Error('Missing required payment configuration')
      }

      // Ensure date formats are correct
      const reportingMonth = formData.reporting_month 
        ? formData.reporting_month.slice(0, 7) // Ensure YYYY-MM format
        : null;
      
      const bookingDate = formData.booking_date 
        ? formData.booking_date // Should already be in YYYY-MM-DD format from date input
        : null;

      // Prepare the create request with flattened structure (matching your working payload)
      const createRequest: FlatCreateCutPayRequest = {
        policy_pdf_url: policyPdfUrl || 'policy_pdf',
        additional_documents: {},
        // Flatten all fields at the root level
        policy_number: formData.policy_number || null,
        formatted_policy_number: formData.formatted_policy_number || null,
        major_categorisation: formData.major_categorisation || null,
        product_insurer_report: formData.product_insurer_report || null,
        product_type: formData.product_type || null,
        plan_type: formData.plan_type || null,
        customer_name: formData.customer_name || null,
        gross_premium: formData.gross_premium || null,
        net_premium: formData.net_premium || null,
        od_premium: formData.od_premium || null,
        tp_premium: formData.tp_premium || null,
        gst_amount: formData.gst_amount || null,
        registration_no: formData.registration_no || null,
        make_model: formData.make_model || null,
        model: formData.model || null,
        vehicle_variant: formData.vehicle_variant || null,
        gvw: formData.gvw || null,
        rto: formData.rto || null,
        state: formData.state || null,
        fuel_type: formData.fuel_type || null,
        cc: formData.cc || null,
        age_year: formData.age_year || null,
        ncb: formData.ncb || null,
        discount_percent: formData.discount_percent || null,
        business_type: formData.business_type || null,
        seating_capacity: formData.seating_capacity || null,
        veh_wheels: formData.veh_wheels || null,
        reporting_month: reportingMonth,
        booking_date: bookingDate,
        agent_code: formData.agent_code || null,
        code_type: formData.code_type || null,
        incoming_grid_percent: formData.incoming_grid_percent || null,
        agent_commission_given_percent: formData.agent_commission_given_percent || null,
        extra_grid: formData.extra_grid || null,
        commissionable_premium: formData.commissionable_premium || null,
        payment_by: formData.payment_by || null,
        payment_method: formData.payment_method || null,
        payout_on: formData.payout_on || null,
        agent_extra_percent: formData.agent_extra_percent || null,
        payment_by_office: formData.payment_by_office || null,
        insurer_code: formData.insurer_code || null,
        broker_code: formData.broker_code || null,
        admin_child_id: formData.admin_child_id || null,
        // Additional fields that might be expected by the API
        insurer_id: null,
        broker_id: null,
        child_id_request_id: null,
        insurer_name: null,
        broker_name: null,
        insurer_broker_code: null,
        cluster: null,
        // Calculation fields
        receivable_from_broker: formData.receivable_from_broker || null,
        extra_amount_receivable_from_broker: formData.extra_amount_receivable_from_broker || null,
        total_receivable_from_broker: formData.total_receivable_from_broker || null,
        total_receivable_from_broker_with_gst: formData.total_receivable_from_broker_with_gst || null,
        cut_pay_amount: formData.cut_pay_amount || null,
        agent_po_amt: formData.agent_po_amt || null,
        agent_extra_amount: formData.agent_extra_amount || null,
        total_agent_po_amt: formData.total_agent_po_amt || null,
        // Additional transaction fields
        claimed_by: formData.claimed_by || null,
        already_given_to_agent: formData.already_given_to_agent || null,
        po_paid_to_agent: formData.po_paid_to_agent || null,
        running_bal: formData.running_bal || null,
        match_status: formData.match_status || null,
        invoice_number: formData.invoice_number || null,
        notes: formData.notes || null
      };

      // Log the request for debugging
      console.log('Create request payload:', JSON.stringify(createRequest, null, 2));

      // Create the cutpay transaction
      let createdTransaction
      try {
        createdTransaction = await createCutPayMutation.mutateAsync(createRequest)
        
        if (!createdTransaction?.id) {
          throw new Error('Failed to create transaction - no ID returned')
        }

        toast.success('Transaction created successfully!')
      } catch (apiError) {
        console.error('API Error Details:', apiError)
        throw apiError
      }
      
      // Now upload documents
      setIsUploadingDocuments(true)
      setCreationStep('Uploading documents to database...')

      const cutpayId = createdTransaction.id
      const documentsToUpload = []

      // Get policy PDF from atom
      if (policyPdfUrl) {
        try {
          const response = await fetch(policyPdfUrl)
          const blob = await response.blob()
          const policyFile = new File([blob], 'policy.pdf', { type: 'application/pdf' })
          documentsToUpload.push({ file: policyFile, type: 'policy_pdf' })
        } catch (error) {
          console.error('Error converting policy PDF URL to file:', error)
        }
      }

      // Get additional documents from IndexedDB
      try {
        const [kycDoc, rcDoc, previousDoc] = await Promise.all([
          getFileFromIndexedDB('kyc_documents'),
          getFileFromIndexedDB('rc_document'),
          getFileFromIndexedDB('previous_policy')
        ])

        if (kycDoc) {
          const file = arrayBufferToFile(kycDoc.content, kycDoc.name, kycDoc.type)
          documentsToUpload.push({ file, type: 'kyc_documents' })
        }

        if (rcDoc) {
          const file = arrayBufferToFile(rcDoc.content, rcDoc.name, rcDoc.type)
          documentsToUpload.push({ file, type: 'rc_document' })
        }

        if (previousDoc) {
          const file = arrayBufferToFile(previousDoc.content, previousDoc.name, previousDoc.type)
          documentsToUpload.push({ file, type: 'previous_policy' })
        }
      } catch (error) {
        console.error('Error retrieving documents from IndexedDB:', error)
      }

      // Upload all documents
      const uploadPromises = documentsToUpload.map(({ file, type }) =>
        uploadDocumentMutation.mutateAsync({
          cutpayId,
          file,
          documentType: type
        })
      )

      await Promise.all(uploadPromises)
      
      toast.success('Documents uploaded successfully!')
      
      // Clear loading states
      setIsCreatingTransaction(false)
      setIsUploadingDocuments(false)
      setCreationStep('')

      // Call onNext if provided
      if (onNext) {
        onNext()
      }

    } catch (error) {
      console.error('Error creating transaction:', error)
      
      // Enhanced error logging for debugging
      if (error instanceof Error) {
        console.error('Error details:', error.message)
        if ('response' in error) {
          const response = (error as { response?: { data?: unknown; status?: number } }).response
          console.error('API Response Status:', response?.status)
          console.error('API Response Data:', JSON.stringify(response?.data, null, 2))
        }
      } else {
        console.error('Error (not Error instance):', JSON.stringify(error, null, 2))
      }
      
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

  const getDocumentUrl = (docType: string) => {
    switch (docType) {
      case 'policy':
        return policyPdfUrl
      case 'kyc':
        return additionalDocUrls.kyc_documents
      case 'rc':
        return additionalDocUrls.rc_document
      case 'previous':
        return additionalDocUrls.previous_policy
      default:
        return null
    }
  }

  const formSections = [
    {
      title: 'Policy Information',
      icon: FileText,
      color: 'border-blue-500',
      bgColor: 'bg-blue-100',
      textColor: 'text-blue-600',
      fields: [
        { key: 'policy_number', label: 'Policy Number', type: 'text' },
        { key: 'formatted_policy_number', label: 'Formatted Policy Number', type: 'text' },
        { key: 'major_categorisation', label: 'Major Categorisation', type: 'text' },
        { key: 'product_insurer_report', label: 'Product Insurer Report', type: 'text' },
        { key: 'product_type', label: 'Product Type', type: 'text' },
        { key: 'plan_type', label: 'Plan Type', type: 'text' }
      ]
    },
    {
      title: 'Customer Information',
      icon: User,
      color: 'border-green-500',
      bgColor: 'bg-green-100',
      textColor: 'text-green-600',
      fields: [
        { key: 'customer_name', label: 'Customer Name', type: 'text' },
        { key: 'business_type', label: 'Business Type', type: 'text' }
      ]
    },
    {
      title: 'Premium Details',
      icon: CreditCard,
      color: 'border-purple-500',
      bgColor: 'bg-purple-100',
      textColor: 'text-purple-600',
      fields: [
        { key: 'gross_premium', label: 'Gross Premium', type: 'number' },
        { key: 'net_premium', label: 'Net Premium', type: 'number' },
        { key: 'od_premium', label: 'OD Premium', type: 'number' },
        { key: 'tp_premium', label: 'TP Premium', type: 'number' },
        { key: 'gst_amount', label: 'GST Amount', type: 'number' },
        { key: 'commissionable_premium', label: 'Commissionable Premium', type: 'number' },
        { key: 'discount_percent', label: 'Discount Percent', type: 'number' }
      ]
    },
    {
      title: 'Vehicle Information',
      icon: Car,
      color: 'border-orange-500',
      bgColor: 'bg-orange-100',
      textColor: 'text-orange-600',
      fields: [
        { key: 'registration_no', label: 'Registration Number', type: 'text' },
        { key: 'make_model', label: 'Make & Model', type: 'text' },
        { key: 'model', label: 'Model', type: 'text' },
        { key: 'vehicle_variant', label: 'Vehicle Variant', type: 'text' },
        { key: 'gvw', label: 'GVW', type: 'number' },
        { key: 'rto', label: 'RTO', type: 'text' },
        { key: 'state', label: 'State', type: 'text' },
        { key: 'fuel_type', label: 'Fuel Type', type: 'text' },
        { key: 'cc', label: 'CC', type: 'number' },
        { key: 'age_year', label: 'Age/Year', type: 'number' },
        { key: 'ncb', label: 'NCB', type: 'text' },
        { key: 'seating_capacity', label: 'Seating Capacity', type: 'number' },
        { key: 'veh_wheels', label: 'Vehicle Wheels', type: 'number' }
      ]
    },
    {
      title: 'Admin Input',
      icon: Building,
      color: 'border-indigo-500',
      bgColor: 'bg-indigo-100',
      textColor: 'text-indigo-600',
      fields: [
        { key: 'reporting_month', label: 'Reporting Month', type: 'month' },
        { key: 'booking_date', label: 'Booking Date', type: 'date' },
        { key: 'agent_code', label: 'Agent Code', type: 'text' },
        { key: 'code_type', label: 'Code Type', type: 'select', options: ['DIRECT', 'BROKER'] },
        { key: 'incoming_grid_percent', label: 'Incoming Grid %', type: 'number' },
        { key: 'agent_commission_given_percent', label: 'Agent Commission Given %', type: 'number' },
        { key: 'extra_grid', label: 'Extra Grid', type: 'number' },
        { key: 'payment_by', label: 'Payment By', type: 'select', options: ['agent', 'insurezeal'] },
        { key: 'payment_method', label: 'Payment Method', type: 'select', options: ['CASH', 'CHEQUE', 'ONLINE', 'UPI', 'NEFT', 'RTGS'], conditional: { field: 'payment_by', value: 'insurezeal' } },
        { key: 'payout_on', label: 'Payout On', type: 'select', options: ['od_premium', 'net_premium', 'od+tp'] },
        { key: 'agent_extra_percent', label: 'Agent Extra %', type: 'number' },
        { key: 'payment_by_office', label: 'Payment By Office', type: 'text' },
        { key: 'broker_code', label: 'Broker Code', type: 'broker_select', conditional: { field: 'code_type', value: 'BROKER' } },
        { key: 'insurer_code', label: 'Insurer Code', type: 'insurer_select', conditionalOr: [{ field: 'code_type', value: 'DIRECT' }, { field: 'code_type', value: 'BROKER' }] },
        { key: 'admin_child_id', label: 'Admin Child ID', type: 'text' }
      ]
    },
    {
      title: 'Calculations',
      icon: Calculator,
      color: 'border-red-500',
      bgColor: 'bg-red-100',
      textColor: 'text-red-600',
      fields: [
        { key: 'receivable_from_broker', label: 'Receivable from Broker', type: 'number' },
        { key: 'extra_amount_receivable_from_broker', label: 'Extra Amount Receivable from Broker', type: 'number' },
        { key: 'total_receivable_from_broker', label: 'Total Receivable from Broker', type: 'number' },
        { key: 'total_receivable_from_broker_with_gst', label: 'Total Receivable from Broker with GST', type: 'number' },
        { key: 'cut_pay_amount', label: 'Cut Pay Amount', type: 'number' },
        { key: 'agent_po_amt', label: 'Agent PO Amount', type: 'number' },
        { key: 'agent_extra_amount', label: 'Agent Extra Amount', type: 'number' },
        { key: 'total_agent_po_amt', label: 'Total Agent PO Amount', type: 'number' },
        { key: 'incoming_po_amt', label: 'Incoming PO Amount', type: 'number' },
        { key: 'claimed_by', label: 'Claimed By', type: 'text' },
        { key: 'already_given_to_agent', label: 'Already Given to Agent', type: 'number' },
        { key: 'po_paid_to_agent', label: 'PO Paid to Agent', type: 'number' },
        { key: 'running_bal', label: 'Running Balance', type: 'number' },
        { key: 'match_status', label: 'Match Status', type: 'select', options: ['MATCHED', 'UNMATCHED', 'PARTIAL_MATCH', 'PENDING'] },
        { key: 'invoice_number', label: 'Invoice Number', type: 'text' }
      ]
    }
  ]

  return (
    <div className="space-y-6">
      {/* Loading Dialog */}
      <Dialog open={isCreatingTransaction || isUploadingDocuments} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LoadingSpinner size="sm" />
              {isCreatingTransaction ? 'Creating Transaction' : 'Uploading Documents'}
            </DialogTitle>
            <DialogDescription>
              {creationStep}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center py-4">
            <div className="flex flex-col items-center space-y-3">
              {isCreatingTransaction && (
                <div className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-blue-600 animate-pulse" />
                  <span className="text-sm text-gray-600">Creating new cutpay transaction...</span>
                </div>
              )}
              {isUploadingDocuments && (
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-green-600 animate-pulse" />
                  <span className="text-sm text-gray-600">Uploading documents to database...</span>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* Header with toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Admin Input & Data Review</h2>
          <p className="text-gray-600 mt-1">Review extracted data and fill in additional details</p>
        </div>
        <Button
          variant="outline"
          onClick={() => setShowDocumentViewer(!showDocumentViewer)}
          className="flex items-center gap-2"
        >
          {showDocumentViewer ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          {showDocumentViewer ? 'Hide Documents' : 'Show Documents'}
        </Button>
      </div>

      <div className={`grid gap-6 ${showDocumentViewer ? 'lg:grid-cols-2' : 'lg:grid-cols-1'}`}>
        {/* Form Section */}
        <div 
          className={`space-y-6 ${showDocumentViewer ? 'max-h-[112vh] overflow-y-auto pr-2' : ''}`}
          style={showDocumentViewer ? {
            scrollbarWidth: 'thin',
            scrollbarColor: '#d1d5db #f3f4f6'
          } : {}}
        >
          {formSections.map((section, sectionIndex) => (
            <motion.div
              key={section.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: sectionIndex * 0.1 }}
            >
              <Card className={`border-l-4 ${section.color}`}>
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg ${section.bgColor}`}>
                      <section.icon className={`h-5 w-5 ${section.textColor}`} />
                    </div>
                    {section.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {section.fields.map((field) => {
                      // Check if field should be conditionally rendered
                      if (field.conditional && formData[field.conditional.field as keyof FormState] !== field.conditional.value) {
                        return null
                      }
                      
                      // Check conditionalOr (show field if ANY of the conditions match)
                      if (field.conditionalOr) {
                        const shouldShow = field.conditionalOr.some(condition => 
                          formData[condition.field as keyof FormState] === condition.value
                        )
                        if (!shouldShow) {
                          return null
                        }
                      }
                      
                      const renderField = (field: FormField) => {
                        if (field.type === 'select') {
                          if (field.key === 'payout_on') {
                            return (
                              <div>
                                <Select onValueChange={(value) => handleInputChange('payout_on', value)} value={formData.payout_on || ''}>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select Payout On" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="od_premium">OD Premium</SelectItem>
                                    <SelectItem value="net_premium">Net Premium</SelectItem>
                                    <SelectItem value="od+tp">OD+TP</SelectItem>
                                  </SelectContent>
                                </Select>
    
                                {formData.payout_on === 'od+tp' && (
                                  <div className="grid grid-cols-2 gap-4 mt-4">
                                    {formData.payment_by === 'agent' ? (
                                      <>
                                        <div>
                                          <Label htmlFor="od_payout_percent">OD Payout %</Label>
                                          <Input id="od_payout_percent" type="number" onChange={(e) => setOdPayoutPercent(Number(e.target.value))} />
                                        </div>
                                        <div>
                                          <Label htmlFor="tp_payout_percent">TP Payout %</Label>
                                          <Input id="tp_payout_percent" type="number" onChange={(e) => setTpPayoutPercent(Number(e.target.value))} />
                                        </div>
                                      </>
                                    ) : formData.payment_by === 'insurezeal' ? (
                                      <>
                                        <div>
                                          <Label htmlFor="od_incoming_grid_percent">OD Incoming Grid %</Label>
                                          <Input id="od_incoming_grid_percent" type="number" onChange={(e) => setOdIncomingGridPercent(Number(e.target.value))} />
                                        </div>
                                        <div>
                                          <Label htmlFor="tp_incoming_grid_percent">TP Incoming Grid %</Label>
                                          <Input id="tp_incoming_grid_percent" type="number" onChange={(e) => setTpIncomingGridPercent(Number(e.target.value))} />
                                        </div>
                                      </>
                                    ) : null}
                                  </div>
                                )}
                              </div>
                            );
                          } else {
                            return (
                              <Select
                                value={formData[field.key as keyof FormState] as string || ''}
                                onValueChange={(value) => handleInputChange(field.key as keyof FormState, value)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder={`Select ${field.label}`} />
                                </SelectTrigger>
                                <SelectContent>
                                  {field.options?.map((option: string | FormFieldOption) => {
                                    const value = typeof option === 'string' ? option : option.value;
                                    const label = typeof option === 'string' ? option : option.label;
                                    return (
                                      <SelectItem key={value} value={value}>
                                        {label}
                                      </SelectItem>
                                    );
                                  })}
                                </SelectContent>
                              </Select>
                            );
                          }
                        } else if (field.type === 'agent_select') {
                          return (
                            <Select
                              value={formData[field.key as keyof FormState] as string || ''}
                              onValueChange={(value) => handleInputChange(field.key as keyof FormState, value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select Agent" />
                              </SelectTrigger>
                              <SelectContent>
                                {agentsData?.agents?.map((agent) => (
                                  <SelectItem key={agent.id} value={agent.agent_code || ''}>
                                    {agent.agent_code} - {`${agent.first_name || ''} ${agent.last_name || ''}`.trim() || agent.email}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          );
                        } else if (field.type === 'insurer_select') {
                          return (
                            <Select
                              value={formData[field.key as keyof FormState] as string || ''}
                              onValueChange={(value) => handleInputChange(field.key as keyof FormState, value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select Insurer" />
                              </SelectTrigger>
                              <SelectContent>
                                {insurersData?.map((insurer) => (
                                  <SelectItem key={insurer.insurer_code} value={insurer.insurer_code}>
                                    {insurer.insurer_code} - {insurer.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          );
                        } else if (field.type === 'broker_select') {
                          return (
                            <Select
                              value={formData[field.key as keyof FormState] as string || ''}
                              onValueChange={(value) => handleInputChange(field.key as keyof FormState, value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select Broker" />
                              </SelectTrigger>
                              <SelectContent>
                                {brokersData?.map((broker) => (
                                  <SelectItem key={broker.broker_code} value={broker.broker_code}>
                                    {broker.broker_code} - {broker.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          );
                        } else if (field.key === 'incoming_po_amt') {
                          return (
                            <Input
                              id="incoming_po_amt"
                              type="number"
                              value={incomingPoAmt ?? ''}
                              readOnly
                              className="w-full"
                              title="Incoming PO Amount is auto-calculated based on Payout On selection when Payment By is Insurezeal"
                            />
                          );
                        } else {
                          const calculatedFieldsConfig: { [key: string]: string } = {
                            receivable_from_broker: 'Auto-calculated: Gross Premium × (Incoming Grid % / 100)',
                            extra_amount_receivable_from_broker: 'Auto-calculated: Commissionable Premium × (Extra Grid / 100)',
                            total_receivable_from_broker: 'Auto-calculated: Receivable from Broker + Extra Amount Receivable',
                            total_receivable_from_broker_with_gst: 'Auto-calculated: Total Receivable from Broker × 1.18',
                            cut_pay_amount: formData.payment_by === 'agent'
                              ? 'Automatically set to 0 when Payment By is Agent'
                              : 'Auto-calculated: Gross Premium - (Net Premium * Agent Payout %)',
                            agent_po_amt: 'Auto-calculated based on Payout On selection',
                            agent_extra_amount: 'Auto-calculated: Commissionable Premium × (Agent Extra % / 100)',
                            total_agent_po_amt: 'Auto-calculated: Agent PO Amount + Agent Extra Amount',
                            incoming_po_amt: 'Auto-calculated based on Payout On selection when Payment By is Insurezeal'
                          };
                          const isCalculated = Object.keys(calculatedFieldsConfig).includes(field.key);

                          const rawValue = formData[field.key as keyof FormState];
                          const value = typeof rawValue === 'object' && rawValue !== null ? '' : (rawValue ?? '');

                          return (
                            <Input
                              id={field.key}
                              type={field.type}
                              value={value}
                              onChange={(e) => {
                                let value: string | number = e.target.value;
                                
                                // Handle different input types
                                if (field.type === 'number') {
                                  value = parseFloat(value) || 0;
                                } else if (field.type === 'date') {
                                  // Ensure date is in YYYY-MM-DD format
                                  value = value;
                                } else if (field.type === 'month') {
                                  // Ensure month is in YYYY-MM format  
                                  value = value;
                                }
                                
                                handleInputChange(field.key as keyof FormState, value);
                              }}
                              placeholder={`Enter ${field.label}`}
                              className="w-full"
                              disabled={isCalculated}
                              title={isCalculated ? calculatedFieldsConfig[field.key] : ''}
                            />
                          );
                        }
                      };

                      return (
                        <div key={field.key} className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Label htmlFor={field.key} className="text-sm font-medium">
                              {field.label}
                            </Label>
                            {extractedData?.extracted_data?.[field.key as keyof typeof extractedData.extracted_data] && (
                              <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
                                Auto-filled
                              </Badge>
                            )}
                            {field.key === 'cut_pay_amount' && formData.payment_by === 'agent' && (
                              <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-700">
                                Auto-zero
                              </Badge>
                            )}
                            {[
                              'receivable_from_broker',
                              'extra_amount_receivable_from_broker',
                              'total_receivable_from_broker',
                              'total_receivable_from_broker_with_gst',
                              'agent_extra_amount',
                              'total_agent_po_amt',
                              'agent_po_amt',
                              'cut_pay_amount',
                              'incoming_po_amt'
                            ].includes(field.key) && !(field.key === 'cut_pay_amount' && formData.payment_by === 'agent') && (
                              <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">
                                Auto-calculated
                              </Badge>
                            )}
                          </div>
                          {renderField(field)}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}

          {/* Notes Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5" />
                Additional Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Input id="cut_pay_amount" type="number" value={formData.cut_pay_amount || ''} readOnly />
              <Textarea
                value={formData.notes as string || ''}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                placeholder="Enter any additional notes or comments..."
                rows={4}
              />
            </CardContent>
          </Card>

          {/* Calculation Summary */}
          {(formData.payment_by && formData.payout_on) && (
            <Card className="border-l-4 border-yellow-500">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-yellow-100">
                    <Calculator className="h-5 w-5 text-yellow-600" />
                  </div>
                  Calculation Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="font-medium text-gray-700">
                    Payment Mode: <span className="text-blue-600">{formData.payment_by}</span>
                  </div>
                  <div className="font-medium text-gray-700">
                    Payout Basis: <span className="text-blue-600">{formData.payout_on}</span>
                  </div>
                  {cutpayCalculation.isPending && (
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <div className="text-gray-600 text-sm">Calculating amounts...</div>
                    </div>
                  )}
                  {cutpayCalculation.isError && (
                    <div className="bg-red-50 p-3 rounded-lg">
                      <div className="text-red-800 font-medium">Calculation Error:</div>
                      <div className="text-red-700 text-xs mt-1">
                        {cutpayCalculation.error?.message || 'Failed to calculate amounts'}
                      </div>
                    </div>
                  )}
                  {calculationResult && (
                    <div className="bg-green-50 p-3 rounded-lg">
                      <div className="text-green-800 font-medium">API Calculation Complete:</div>
                      <div className="text-green-700 text-xs mt-1 space-y-1">
                        <div>• Agent PO Amount: ₹{calculationResult.agent_po_amt?.toLocaleString()}</div>
                        <div>• Cut Pay Amount: ₹{calculationResult.cut_pay_amount?.toLocaleString()}</div>
                        <div>• Total Agent PO Amount: ₹{calculationResult.total_agent_po_amt?.toLocaleString()}</div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Document Viewer Section */}
        <AnimatePresence>
          {showDocumentViewer && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-4"
            >
              <Card className="sticky top-4">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Document Viewer
                  </CardTitle>
                  
                  {/* Document Selection Dropdown */}
                  <div className="mt-4">
                    <Label htmlFor="document-select" className="text-sm font-medium mb-2 block">
                      Select Document to View
                    </Label>
                    <Select 
                      value={activeDocument} 
                      onValueChange={(value) => setActiveDocument(value as 'policy' | 'kyc' | 'rc' | 'previous')}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a document" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableDocuments.map((doc) => (
                          <SelectItem 
                            key={doc.key} 
                            value={doc.key}
                            disabled={!doc.available}
                          >
                            <div className="flex items-center justify-between w-full">
                              <span>{doc.label}</span>
                              {!doc.available && (
                                <Badge variant="secondary" className="ml-2 text-xs">
                                  N/A
                                </Badge>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="h-[600px] border rounded-lg overflow-hidden bg-gray-50">
                    {getDocumentUrl(activeDocument) ? (
                      <iframe
                        src={getDocumentUrl(activeDocument)!}
                        className="w-full h-full"
                        title={`${activeDocument} document`}
                      />
                    ) : (
                      <div className="h-full flex items-center justify-center text-gray-500">
                        <div className="text-center">
                          <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                          <p>No document available</p>
                          <p className="text-sm mt-1">
                            {availableDocuments.find(doc => doc.key === activeDocument)?.available === false 
                              ? 'This document was not uploaded in previous steps' 
                              : 'Document loading...'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

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

export default AdminInputForm;