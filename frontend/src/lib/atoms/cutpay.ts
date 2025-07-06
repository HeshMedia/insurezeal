import { atom } from 'jotai'
import { ExtractPdfResponse } from '@/types/cutpay.types'

// Cutpay creation flow state
export const cutpayCreationStepAtom = atom<number>(1)

// PDF extraction response data
export const pdfExtractionDataAtom = atom<ExtractPdfResponse | null>(null)

// Policy PDF file state
export const policyPdfFileAtom = atom<File | null>(null)

// Policy PDF URL after storing in IndexedDB
export const policyPdfUrlAtom = atom<string | null>(null)

// Additional documents state
export const additionalDocumentsAtom = atom<{
  kyc_documents: File | null
  rc_document: File | null
  previous_policy: File | null
}>({
  kyc_documents: null,
  rc_document: null,
  previous_policy: null,
})

// Additional documents URLs after storing in IndexedDB
export const additionalDocumentsUrlsAtom = atom<{
  kyc_documents: string | null
  rc_document: string | null
  previous_policy: string | null
}>({
  kyc_documents: null,
  rc_document: null,
  previous_policy: null,
})

// Loading states for different operations
export const cutpayLoadingStatesAtom = atom<{
  extracting: boolean
  uploadingToIndexedDB: boolean
  uploadingDocuments: boolean
}>({
  extracting: false,
  uploadingToIndexedDB: false,
  uploadingDocuments: false,
})

// Success states
export const cutpaySuccessStatesAtom = atom<{
  pdfExtracted: boolean
  documentsUploaded: boolean
}>({
  pdfExtracted: false,
  documentsUploaded: false,
})

// Error states
export const cutpayErrorAtom = atom<string | null>(null)

// Form completion state
export const cutpayFormCompletionAtom = atom<{
  step1Complete: boolean
  step2Complete: boolean
}>({
  step1Complete: false,
  step2Complete: false,
})

// Utility function to get all stored documents from IndexedDB
export const getAllStoredDocuments = async (): Promise<{
  kyc_documents: { name: string; size: number; type: string; content: ArrayBuffer } | null
  rc_document: { name: string; size: number; type: string; content: ArrayBuffer } | null
  previous_policy: { name: string; size: number; type: string; content: ArrayBuffer } | null
}> => {
  const getFileFromIndexedDB = async (key: string): Promise<{ name: string; size: number; type: string; content: ArrayBuffer } | null> => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('CutPayDB', 1)
      
      request.onerror = () => reject(new Error('Failed to open IndexedDB'))
      
      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        const transaction = db.transaction(['documents'], 'readonly')
        const store = transaction.objectStore('documents')
        
        const getRequest = store.get(key)
        getRequest.onsuccess = () => {
          const result = getRequest.result
          if (result) {
            resolve({
              name: result.name,
              size: result.size,
              type: result.type,
              content: result.content
            })
          } else {
            resolve(null)
          }
        }
        getRequest.onerror = () => reject(new Error('Failed to retrieve file'))
      }
    })
  }

  try {
    const [kycDoc, rcDoc, previousPolicy] = await Promise.all([
      getFileFromIndexedDB('kyc_documents'),
      getFileFromIndexedDB('rc_document'),
      getFileFromIndexedDB('previous_policy')
    ])

    return {
      kyc_documents: kycDoc,
      rc_document: rcDoc,
      previous_policy: previousPolicy
    }
  } catch (error) {
    console.error('Error retrieving documents from IndexedDB:', error)
    return {
      kyc_documents: null,
      rc_document: null,
      previous_policy: null
    }
  }
}