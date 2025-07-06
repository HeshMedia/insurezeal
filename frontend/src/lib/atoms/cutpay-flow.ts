import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import { ExtractedPolicyData } from '@/types/admin.types'

// ========================================================================
// CUT PAY CREATION FLOW ATOMS - SIMPLIFIED
// ========================================================================

// Current step in the creation flow (1: Upload Policy PDF, 2: Upload Additional Documents, 3: Form & Calculations)
export const cutpayFlowStepAtom = atom<1 | 2 | 3>(1)

// ========================================================================
// STEP 1: Document Upload & Extraction
// ========================================================================

// Uploaded documents storage (IndexedDB via localStorage)
export interface StoredDocument {
  id: string
  file: File
  type: 'policy_pdf' | 'kyc_documents' | 'rc_document' | 'previous_policy'
  name: string
  size: number
  uploadedAt: string
  url?: string // For preview
}

export const uploadedDocumentsAtom = atomWithStorage<StoredDocument[]>('cutpay-uploaded-docs', [])

// PDF extraction state (Step 1: API call result)
export const extractedDataAtom = atomWithStorage<ExtractedPolicyData | null>('cutpay-extracted-data', null)
export const extractionLoadingAtom = atom(false)
export const extractionErrorAtom = atom<string | null>(null)

// Document upload loading state (Step 2: IndexedDB storage)
export const documentUploadingAtom = atom(false)

// ========================================================================
// STEP 3: Form Data & User Input (injected from extracted data)
// ========================================================================

// Admin input data for the form
export interface CutPayFormData {
  // Admin Manual Input Fields
  reporting_month: string
  booking_date: string
  agent_code: string
  code_type: 'Direct' | 'Broker'
  incoming_grid_percent: number
  agent_commission_given_percent: number
  extra_grid: number
  commissionable_premium: number
  payment_by: 'Agent' | 'InsureZeal'
  payment_method: 'credit_card' | 'cash' | 'net_banking' | 'upi' | 'debit_card' | 'cheque'
  payout_on: 'OD' | 'NP' | 'OD+TP'
  agent_extra_percent: number
  payment_by_office: string
  
  // Separate OD and TP percentages for OD+TP payout
  od_payout_percent?: number
  tp_payout_percent?: number
  
  // Relationship IDs
  insurer_id: number | null
  broker_id: number | null
  admin_child_id: number | null
  
  // Customer details
  customer_phone: string
  customer_email: string
  
  // Additional fields
  amount_received: number
  notes: string
}

export const cutpayFormDataAtom = atomWithStorage<Partial<CutPayFormData>>('cutpay-form-data', {
  payment_by: 'Agent',
  payout_on: 'OD',
  code_type: 'Direct',
  payment_method: 'cash'
})

// ========================================================================
// Calculated Values (Auto-computed based on form inputs)
// ========================================================================

export interface CalculatedAmounts {
  receivable_from_broker: number
  extra_amount_receivable_from_broker: number
  total_receivable_from_broker: number
  total_receivable_from_broker_with_gst: number
  cut_pay_amount: number
  agent_po_amt: number
  agent_extra_amount: number
  total_agent_po_amt: number
}

export const calculatedAmountsAtom = atom<CalculatedAmounts>({
  receivable_from_broker: 0,
  extra_amount_receivable_from_broker: 0,
  total_receivable_from_broker: 0,
  total_receivable_from_broker_with_gst: 0,
  cut_pay_amount: 0,
  agent_po_amt: 0,
  agent_extra_amount: 0,
  total_agent_po_amt: 0
})

// ========================================================================
// Computed Atoms for UI logic
// ========================================================================

// Check if policy PDF is uploaded
export const hasPolicyPdfAtom = atom((get) => {
  const documents = get(uploadedDocumentsAtom) || []
  return documents.some(doc => doc.type === 'policy_pdf')
})

// Check if all required documents are uploaded
export const allDocumentsUploadedAtom = atom((get) => {
  const documents = get(uploadedDocumentsAtom) || []
  const requiredTypes: Array<'policy_pdf' | 'kyc_documents' | 'rc_document' | 'previous_policy'> = 
    ['policy_pdf', 'kyc_documents', 'rc_document', 'previous_policy']
  return requiredTypes.every(type => 
    documents.some(doc => doc.type === type)
  )
})

// Check if form is valid for submission
export const canSubmitFormAtom = atom((get) => {
  const formData = get(cutpayFormDataAtom)
  const extractedData = get(extractedDataAtom)
  const documents = get(allDocumentsUploadedAtom)
  
  return !!(
    documents &&
    extractedData &&
    formData.reporting_month &&
    formData.booking_date &&
    formData.agent_code &&
    formData.incoming_grid_percent &&
    formData.agent_commission_given_percent
  )
})

// ========================================================================
// Reset Function for starting new transaction
// ========================================================================

export const resetCutpayFlowAtom = atom(null, (get, set) => {
  set(cutpayFlowStepAtom, 1)
  set(uploadedDocumentsAtom, [])
  set(extractedDataAtom, null)
  set(extractionLoadingAtom, false)
  set(extractionErrorAtom, null)
  set(documentUploadingAtom, false)
  set(cutpayFormDataAtom, {
    payment_by: 'Agent',
    payout_on: 'OD',
    code_type: 'Direct',
    payment_method: 'cash'
  })
  set(calculatedAmountsAtom, {
    receivable_from_broker: 0,
    extra_amount_receivable_from_broker: 0,
    total_receivable_from_broker: 0,
    total_receivable_from_broker_with_gst: 0,
    cut_pay_amount: 0,
    agent_po_amt: 0,
    agent_extra_amount: 0,
    total_agent_po_amt: 0
  })
  
  // Clear localStorage
  localStorage.removeItem('cutpay-uploaded-docs')
  localStorage.removeItem('cutpay-extracted-data')
  localStorage.removeItem('cutpay-form-data')
})
