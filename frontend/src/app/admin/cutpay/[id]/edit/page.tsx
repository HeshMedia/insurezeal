'use client'

import { useRouter, useSearchParams, useParams } from 'next/navigation'
import { DashboardWrapper } from '@/components/dashboard-wrapper'
import { useCutPayById, useCutPayByPolicy } from '@/hooks/cutpayQuery'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import InputForm from '@/components/forms/input-form'
import { useSetAtom } from 'jotai'
import { pdfExtractionDataAtom, cutpayCalculationResultAtom, policyPdfUrlAtom, additionalDocumentsUrlsAtom } from '@/lib/atoms/cutpay'
import { useEffect, useMemo } from 'react'
import Loading from '@/app/loading'
import { prepareCutpayPrefill } from '@/lib/utils/cutpay-prefill'
import type { PolicyDetailsResponse } from '@/types/cutpay.types'

export default function CutPayEditPage() {
  const router = useRouter()
  const search = useSearchParams()
  const params = useParams()
  const rawId = params?.['id']
  const idParam = Array.isArray(rawId) ? rawId[0] : rawId
  const policyParam = search.get('policy') || ''
  const quarterParam = search.get('q')
  const yearParam = search.get('y')
  const parsedQuarter = quarterParam ? Number.parseInt(quarterParam, 10) : NaN
  const parsedYear = yearParam ? Number.parseInt(yearParam, 10) : NaN
  const quarter = Number.isNaN(parsedQuarter) ? undefined : parsedQuarter
  const year = Number.isNaN(parsedYear) ? undefined : parsedYear
  const cutpayId = idParam ? Number.parseInt(idParam, 10) : Number.NaN
  const hasValidId = Number.isFinite(cutpayId)

  const { data: cutpayById, isLoading: isLoadingById } = useCutPayById(hasValidId ? cutpayId : 0, hasValidId)

  const cutpayByIdRecord = useMemo(() => {
    if (!cutpayById) return null
    return cutpayById as unknown as Record<string, unknown>
  }, [cutpayById])

  const recordPolicyNumber = typeof cutpayByIdRecord?.['policy_number'] === 'string'
    ? (cutpayByIdRecord['policy_number'] as string)
    : ''
  const recordQuarter = cutpayByIdRecord?.['quarter']
  const recordYear = cutpayByIdRecord?.['year']

  const effectivePolicyNumber = policyParam || recordPolicyNumber
  const effectiveQuarter = quarter ?? (typeof recordQuarter === 'number' ? recordQuarter : undefined)
  const effectiveYear = year ?? (typeof recordYear === 'number' ? recordYear : undefined)
  const shouldFetchByPolicy = Boolean(
    effectivePolicyNumber &&
    effectiveQuarter !== undefined &&
    effectiveYear !== undefined
  )

  const { data: policyData, isLoading } = useCutPayByPolicy(
    shouldFetchByPolicy ? effectivePolicyNumber : undefined,
    effectiveQuarter,
    effectiveYear,
    shouldFetchByPolicy
  )
  const setPdfExtractionData = useSetAtom(pdfExtractionDataAtom)
  const setCalculationResult = useSetAtom(cutpayCalculationResultAtom)
  const setPolicyPdfUrl = useSetAtom(policyPdfUrlAtom)
  const setAdditionalDocUrls = useSetAtom(additionalDocumentsUrlsAtom)

  const fallbackPolicyData = useMemo<PolicyDetailsResponse | null>(() => {
    if (!cutpayByIdRecord) return null

    return {
      policy_number: effectivePolicyNumber,
      quarter: effectiveQuarter ?? 0,
      year: effectiveYear ?? 0,
      quarter_sheet_name: typeof cutpayByIdRecord['quarter_sheet_name'] === 'string'
        ? (cutpayByIdRecord['quarter_sheet_name'] as string)
        : '',
      database_record: cutpayByIdRecord,
      google_sheets_data: {},
      broker_name: undefined,
      insurer_name: undefined,
      found_in_database: true,
      found_in_sheets: false,
      quarter_sheet_exists: false,
      metadata: undefined,
    }
  }, [cutpayByIdRecord, effectivePolicyNumber, effectiveQuarter, effectiveYear])

  const sourcePolicyData = useMemo(() => {
    if (policyData && policyData.database_record) {
      return policyData
    }
    return fallbackPolicyData
  }, [policyData, fallbackPolicyData])

  const prefillPayload = useMemo(() => {
    if (!sourcePolicyData || !sourcePolicyData.database_record) return null
    return prepareCutpayPrefill(sourcePolicyData)
  }, [sourcePolicyData])

  useEffect(() => {
    if (!prefillPayload) {
      setPdfExtractionData(null)
      setCalculationResult(null)
      setPolicyPdfUrl(null)
      setAdditionalDocUrls({ kyc_documents: null, rc_document: null, previous_policy: null })
      return
    }

    setPdfExtractionData(prefillPayload.pdfExtractionData)
    setCalculationResult(prefillPayload.calculationResult)
    setPolicyPdfUrl(prefillPayload.policyPdfUrl)
    setAdditionalDocUrls(prefillPayload.additionalDocumentUrls)
  }, [prefillPayload, setPdfExtractionData, setCalculationResult, setPolicyPdfUrl, setAdditionalDocUrls])

  const handlePrev = () => {
    router.back()
  }

  const isStillLoading = (shouldFetchByPolicy && isLoading) || (!prefillPayload && isLoadingById)

  if (isStillLoading) {
    return (
      <DashboardWrapper requiredRole="admin">
            <Loading />
      </DashboardWrapper>
    )
  }

  if (!prefillPayload || !prefillPayload.formValues) {
    return (
      <DashboardWrapper requiredRole="admin">
        <div className=" mx-auto p-6">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center space-y-4">
              <h1 className="text-2xl font-bold text-gray-900">Transaction Not Found</h1>
              <p className="text-gray-600">The requested transaction could not be found.</p>
              <Button onClick={() => router.back()}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go Back
              </Button>
            </div>
          </div>
        </div>
      </DashboardWrapper>
    )
  }

  return (
    <DashboardWrapper requiredRole="admin">
      <div className=" space-y-6 p-6 overflow-y-hidden">
  <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" onClick={handlePrev}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Transaction
          </Button>
        </div>

        <InputForm
          onPrev={handlePrev}
          editId={hasValidId ? cutpayId : undefined}
          policyNumber={effectivePolicyNumber}
          quarter={effectiveQuarter}
          year={effectiveYear}
          initialPrefill={prefillPayload?.formValues ?? null}
          initialDbRecord={prefillPayload?.combinedRecord}
        />
      </div>
    </DashboardWrapper>
  )
}
