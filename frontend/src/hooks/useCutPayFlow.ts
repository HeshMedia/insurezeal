import { useMutation } from '@tanstack/react-query'
import { useAtom, useSetAtom } from 'jotai'
import { adminApi } from '@/lib/api/admin'
import { 
  extractedDataAtom, 
  extractionLoadingAtom, 
  extractionErrorAtom,
  documentUploadingAtom,
  cutpayFormDataAtom,
  calculatedAmountsAtom,
  uploadedDocumentsAtom,
  cutpayFlowStepAtom
} from '@/lib/atoms/cutpay-flow'
import type { StoredDocument, CutPayFormData, CalculatedAmounts } from '@/lib/atoms/cutpay-flow'

// ========================================================================
// STEP 1: PDF EXTRACTION & UPLOAD
// ========================================================================

export const useExtractPdfForCreation = () => {
  const setExtractedData = useSetAtom(extractedDataAtom)
  const setExtractionLoading = useSetAtom(extractionLoadingAtom)
  const setExtractionError = useSetAtom(extractionErrorAtom)
  const setFlowStep = useSetAtom(cutpayFlowStepAtom)

  return useMutation({
    mutationFn: (file: File) => adminApi.cutpay.extractPdfForCreation(file),
    onMutate: () => {
      setExtractionLoading(true)
      setExtractionError(null)
    },
    onSuccess: (data) => {
      setExtractedData(data.extracted_data)
      setExtractionLoading(false)
      setFlowStep(2) // Move to step 2 after successful extraction
    },
    onError: (error: Error) => {
      setExtractionError(error.message)
      setExtractionLoading(false)
    }
  })
}

// ========================================================================
// STEP 2: ADDITIONAL DOCUMENTS STORAGE (IndexedDB only)
// ========================================================================

export const useStoreDocument = () => {
  const [uploadedDocuments, setUploadedDocuments] = useAtom(uploadedDocumentsAtom)
  const setDocumentUploading = useSetAtom(documentUploadingAtom)

  const storeDocument = (document: StoredDocument) => {
    setDocumentUploading(true)
    
    try {
      // Store in IndexedDB via atom (no API call)
      const existingIndex = uploadedDocuments.findIndex(doc => doc.type === document.type)
      
      if (existingIndex >= 0) {
        // Replace existing document of same type
        const updated = [...uploadedDocuments]
        updated[existingIndex] = document
        setUploadedDocuments(updated)
      } else {
        // Add new document
        setUploadedDocuments([...uploadedDocuments, document])
      }
      
      setDocumentUploading(false)
      return Promise.resolve(document)
    } catch (error) {
      setDocumentUploading(false)
      return Promise.reject(error)
    }
  }

  return { storeDocument, uploadedDocuments }
}

// ========================================================================
// STEP 3: FORM CALCULATIONS
// ========================================================================

export const useCalculateAmounts = () => {
  const [formData] = useAtom(cutpayFormDataAtom)
  const [extractedData] = useAtom(extractedDataAtom)
  const setCalculatedAmounts = useSetAtom(calculatedAmountsAtom)

  const calculateAmounts = (currentFormData?: Partial<CutPayFormData>) => {
    const data = { ...formData, ...currentFormData }
    const extracted = extractedData

    if (!extracted || !data.incoming_grid_percent || !data.agent_commission_given_percent) {
      return
    }

    const grossPremium = extracted.gross_premium || 0
    const netPremium = extracted.net_premium || 0
    const odPremium = extracted.od_premium || 0
    const tpPremium = extracted.tp_premium || 0

    // Calculate cut pay amount based on payment mode
    let cutPayAmount = 0
    if (data.payment_by === 'Agent') {
      cutPayAmount = 0 // Agent pays customer directly
    } else if (data.payment_by === 'InsureZeal') {
      cutPayAmount = grossPremium - (netPremium * (data.agent_commission_given_percent / 100))
    }

    // Calculate agent payout based on payout_on selection
    let agentPoAmount = 0
    if (data.payout_on === 'OD') {
      if (data.payment_by === 'Agent') {
        agentPoAmount = odPremium * (data.agent_commission_given_percent / 100)
      } else {
        agentPoAmount = odPremium * (data.incoming_grid_percent / 100)
      }
    } else if (data.payout_on === 'NP') {
      if (data.payment_by === 'Agent') {
        agentPoAmount = netPremium * (data.agent_commission_given_percent / 100)
      } else {
        agentPoAmount = netPremium * (data.incoming_grid_percent / 100)
      }
    } else if (data.payout_on === 'OD+TP') {
      const odPercent = data.od_payout_percent || data.agent_commission_given_percent
      const tpPercent = data.tp_payout_percent || data.agent_commission_given_percent
      
      if (data.payment_by === 'Agent') {
        agentPoAmount = (odPremium * (odPercent / 100)) + (tpPremium * (tpPercent / 100))
      } else {
        const odIncomingPercent = data.od_payout_percent || data.incoming_grid_percent
        const tpIncomingPercent = data.tp_payout_percent || data.incoming_grid_percent
        agentPoAmount = (odPremium * (odIncomingPercent / 100)) + (tpPremium * (tpIncomingPercent / 100))
      }
    }

    // Calculate additional amounts
    const agentExtraAmount = agentPoAmount * ((data.agent_extra_percent || 0) / 100)
    const totalAgentPoAmount = agentPoAmount + agentExtraAmount

    // Calculate broker receivables
    const receivableFromBroker = netPremium * (data.incoming_grid_percent / 100)
    const extraAmountReceivable = (data.extra_grid || 0) / 100 * netPremium
    const totalReceivableFromBroker = receivableFromBroker + extraAmountReceivable
    const totalReceivableWithGst = totalReceivableFromBroker * 1.18 // Adding 18% GST

    const calculated: CalculatedAmounts = {
      receivable_from_broker: receivableFromBroker,
      extra_amount_receivable_from_broker: extraAmountReceivable,
      total_receivable_from_broker: totalReceivableFromBroker,
      total_receivable_from_broker_with_gst: totalReceivableWithGst,
      cut_pay_amount: cutPayAmount,
      agent_po_amt: agentPoAmount,
      agent_extra_amount: agentExtraAmount,
      total_agent_po_amt: totalAgentPoAmount
    }

    setCalculatedAmounts(calculated)
    return calculated
  }

  return { calculateAmounts }
}