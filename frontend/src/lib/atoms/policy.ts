import { atom } from 'jotai'
import { ExtractPdfDataResponse, Policy } from '@/types/policy.types'

// Policy creation flow state
export const policyCreationStepAtom = atom<number>(1)

// PDF extraction response data
export const policyPdfExtractionDataAtom = atom<ExtractPdfDataResponse | null>(null)

// Policy PDF file state
export const policyPdfFileAtom = atom<File | null>(null)

// Policy PDF URL after storing in IndexedDB
export const policyPdfUrlAtom = atom<string | null>(null)

// Additional documents state
export const policyAdditionalDocumentsAtom = atom<{
  kyc: File | null
  rc: File | null
  previousPolicy: File | null
}>({
  kyc: null,
  rc: null,
  previousPolicy: null,
})

// Additional documents URLs after storing in IndexedDB
export const policyAdditionalDocumentsUrlsAtom = atom<{
  kyc: string | null
  rc: string | null
  previousPolicy: string | null
}>({
  kyc: null,
  rc: null,
  previousPolicy: null,
})

// Loading states for different operations
export const policyLoadingStatesAtom = atom<{
  extracting: boolean
  uploadingToIndexedDB: boolean
  uploadingDocuments: boolean
}>({
  extracting: false,
  uploadingToIndexedDB: false,
  uploadingDocuments: false,
})

// Success states
export const policySuccessStatesAtom = atom<{
  pdfExtracted: boolean
  documentsUploaded: boolean
}>({
  pdfExtracted: false,
  documentsUploaded: false,
})

// Error state
export const policyErrorAtom = atom<string | null>(null)

// Form completion states
export const policyFormCompletionAtom = atom<{
  step1Complete: boolean
  step2Complete: boolean
}>({
  step1Complete: false,
  step2Complete: false,
})

// Created policy transaction after successful submission
export const createdPolicyAtom = atom<Policy | null>(null)
