'use client'

import { useParams } from 'next/navigation'
import { DashboardWrapper } from '@/components/dashboard-wrapper'
import { CutPaySplitView } from '@/components/admin/cutpay-split-view'
import { useCutPayById, useUploadDocument, useExtractPdf } from '@/hooks/adminQuery'
import { LoadingSpinner } from '@/components/ui/loader'
import { CutPayTransaction } from '@/types/admin.types'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'

// Simple form component for editing (you can replace this with the actual form)
function CutPayEditForm({ cutpayData }: { cutpayData: CutPayTransaction | null }) {
  const getValue = (value: unknown): string => {
    if (value === null || value === undefined) return ''
    return String(value)
  }

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg border">
        <h2 className="text-lg font-semibold mb-4">Edit CutPay Transaction</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Policy Number
            </label>
            <input
              type="text"
              defaultValue={getValue(cutpayData?.policy_number)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Enter policy number"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Agent Code
            </label>
            <input
              type="text"
              defaultValue={getValue(cutpayData?.agent_code)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Enter agent code"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Gross Premium
            </label>
            <input
              type="number"
              defaultValue={getValue(cutpayData?.gross_premium)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Net Premium
            </label>
            <input
              type="number"
              defaultValue={getValue(cutpayData?.net_premium)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Customer Name
            </label>
            <input
              type="text"
              defaultValue={getValue(cutpayData?.customer_name)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Enter customer name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Insurance Company
            </label>
            <input
              type="text"
              defaultValue={getValue(cutpayData?.insurer_name)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Enter insurance company"
            />
          </div>
        </div>
        
        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes
          </label>
          <textarea
            rows={3}
            defaultValue={getValue(cutpayData?.notes)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            placeholder="Enter any additional notes..."
          />
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button className="px-4 py-2 text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200">
            Cancel
          </button>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
            Save Changes
          </button>
        </div>
      </div>

      {/* Additional sections can be added here */}
      <div className="bg-white p-6 rounded-lg border">
        <h3 className="text-md font-medium mb-3">Commission Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cut Pay Amount
            </label>
            <input
              type="number"
              defaultValue={getValue(cutpayData?.cut_pay_amount)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Agent Commission %
            </label>
            <input
              type="number"
              defaultValue={getValue(cutpayData?.agent_commission_given_percent)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment By
            </label>
            <select
              defaultValue={getValue(cutpayData?.payment_by)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">Select payment by</option>
              <option value="Agent">Agent</option>
              <option value="InsureZeal">InsureZeal</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CutPayEditPage() {
  const params = useParams()
  const cutpayId = parseInt(params.id as string)
  
  const { data: cutpayData, isLoading } = useCutPayById(cutpayId)
  const uploadMutation = useUploadDocument()
  const extractMutation = useExtractPdf()
  
  const [documentUrl, setDocumentUrl] = useState<string | null>(null)

  // Set document URL from cutpay data when loaded
  useEffect(() => {
    if (cutpayData?.policy_pdf_url) {
      setDocumentUrl(cutpayData.policy_pdf_url)
    }
  }, [cutpayData])

  const handleDocumentUpload = async (file: File) => {
    try {
      const response = await uploadMutation.mutateAsync({
        cutpayId,
        file,
        document_type: 'policy_pdf'
      })
      setDocumentUrl(response.document_url)
      toast.success('Document uploaded successfully')
    } catch (error) {
      toast.error('Failed to upload document')
      console.error('Document upload failed:', error)
    }
  }

  const handleDocumentExtract = async () => {
    if (!documentUrl) {
      toast.error('Please upload a document first')
      return
    }

    try {
      // Create a file object from the URL for extraction
      const response = await fetch(documentUrl)
      const blob = await response.blob()
      const file = new File([blob], 'policy.pdf', { type: 'application/pdf' })
      
      await extractMutation.mutateAsync({
        cutpayId,
        file
      })
      toast.success('PDF data extracted successfully')
    } catch (error) {
      toast.error('Failed to extract PDF data')
      console.error('PDF extraction failed:', error)
    }
  }

  if (isLoading) {
    return (
      <DashboardWrapper requiredRole="admin">
        <div className="flex items-center justify-center min-h-[400px]">
          <LoadingSpinner />
        </div>
      </DashboardWrapper>
    )
  }

  const formComponent = <CutPayEditForm cutpayData={cutpayData || null} />

  return (
    <DashboardWrapper requiredRole="admin">
      <div className="h-[calc(100vh-4rem)]">
        <CutPaySplitView
          formComponent={formComponent}
          documentUrl={documentUrl}
          documentType="policy_pdf"
          onDocumentUpload={handleDocumentUpload}
          onDocumentExtract={handleDocumentExtract}
          isExtracting={extractMutation.isPending}
        />
      </div>
    </DashboardWrapper>
  )
}
