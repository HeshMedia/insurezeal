'use client'

import { useCallback } from 'react'
import { useAtom } from 'jotai'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import { 
  CheckCircle, 
  FileText, 
  AlertCircle,
  LoaderCircle,
  Send,
  Eye
} from 'lucide-react'

import {
  cutpayFormDataAtom,
  extractedDataAtom,
  calculatedAmountsAtom,
  uploadedDocumentsAtom,
  createdTransactionAtom,
  creationLoadingAtom,
  finalDocumentUploadingAtom
} from '@/lib/atoms/cutpay-flow'
import { useCreateCutPayTransaction, useUploadDocumentsToTransaction } from '@/hooks/useCutPayFlow'

interface FinalUploadStepProps {
  onComplete: (transactionId: number) => void
  onPrevious: () => void
}

export function FinalUploadStep({ onComplete, onPrevious }: FinalUploadStepProps) {
  const [formData] = useAtom(cutpayFormDataAtom)
  const [extractedData] = useAtom(extractedDataAtom)
  const [calculatedAmounts] = useAtom(calculatedAmountsAtom)
  const [uploadedDocuments] = useAtom(uploadedDocumentsAtom)
  const [createdTransaction] = useAtom(createdTransactionAtom)
  const [isCreating] = useAtom(creationLoadingAtom)
  const [isFinalUploading] = useAtom(finalDocumentUploadingAtom)

  const createTransactionMutation = useCreateCutPayTransaction()
  const uploadDocumentsMutation = useUploadDocumentsToTransaction()

  const handleCreateTransaction = useCallback(async () => {
    try {
      const transaction = await createTransactionMutation.mutateAsync()
      toast.success('Transaction created successfully!')
      return transaction
    } catch (error) {
      toast.error('Failed to create transaction')
      console.error('Transaction creation failed:', error)
      throw error
    }
  }, [createTransactionMutation])

  const handleUploadDocuments = useCallback(async () => {
    if (!createdTransaction) {
      toast.error('No transaction found to upload documents to')
      return
    }

    try {
      await uploadDocumentsMutation.mutateAsync()
      toast.success('All documents uploaded successfully!')
      onComplete(createdTransaction.id)
    } catch (error) {
      toast.error('Failed to upload some documents')
      console.error('Document upload failed:', error)
    }
  }, [uploadDocumentsMutation, createdTransaction, onComplete])

  const handleCreateAndUpload = useCallback(async () => {
    try {
      // Step 1: Create transaction
      const transaction = await handleCreateTransaction()
      
      // Step 2: Upload documents to the created transaction
      if (transaction) {
        await handleUploadDocuments()
      }
    } catch (error) {
      console.error('Create and upload failed:', error)
    }
  }, [handleCreateTransaction, handleUploadDocuments])

  const isLoading = isCreating || isFinalUploading

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Transaction Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Policy Information */}
          {extractedData && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900">Policy Information</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Policy Number:</span>
                    <span className="font-medium">{extractedData.policy_number || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Customer:</span>
                    <span className="font-medium">{extractedData.customer_name || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Gross Premium:</span>
                    <span className="font-medium">₹{extractedData.gross_premium?.toLocaleString('en-IN') || '0'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Net Premium:</span>
                    <span className="font-medium">₹{extractedData.net_premium?.toLocaleString('en-IN') || '0'}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-medium text-gray-900">Transaction Details</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Agent Code:</span>
                    <span className="font-medium">{formData.agent_code || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Payment By:</span>
                    <Badge variant={formData.payment_by === 'Agent' ? 'secondary' : 'default'}>
                      {formData.payment_by || 'N/A'}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Payout On:</span>
                    <span className="font-medium">{formData.payout_on || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Code Type:</span>
                    <span className="font-medium">{formData.code_type || 'N/A'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Calculated Amounts */}
          <div className="border-t pt-4">
            <h4 className="font-medium text-gray-900 mb-3">Calculated Amounts</h4>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="flex justify-between p-3 bg-blue-50 rounded-lg">
                <span className="font-medium text-blue-900">Cut Pay Amount:</span>
                <Badge variant={formData.payment_by === 'Agent' ? 'secondary' : 'default'} className="text-blue-900">
                  ₹{calculatedAmounts.cut_pay_amount.toLocaleString('en-IN')}
                </Badge>
              </div>
              <div className="flex justify-between p-3 bg-green-50 rounded-lg">
                <span className="font-medium text-green-900">Agent PO Amount:</span>
                <Badge variant="outline" className="text-green-900">
                  ₹{calculatedAmounts.agent_po_amt.toLocaleString('en-IN')}
                </Badge>
              </div>
              <div className="flex justify-between p-3 bg-purple-50 rounded-lg">
                <span className="font-medium text-purple-900">Total Receivable:</span>
                <Badge variant="outline" className="text-purple-900">
                  ₹{calculatedAmounts.total_receivable_from_broker.toLocaleString('en-IN')}
                </Badge>
              </div>
              <div className="flex justify-between p-3 bg-orange-50 rounded-lg">
                <span className="font-medium text-orange-900">Total Agent PO:</span>
                <Badge variant="outline" className="text-orange-900">
                  ₹{calculatedAmounts.total_agent_po_amt.toLocaleString('en-IN')}
                </Badge>
              </div>
            </div>
          </div>

          {/* Document Status */}
          <div className="border-t pt-4">
            <h4 className="font-medium text-gray-900 mb-3">Document Status</h4>
            <div className="grid gap-2 md:grid-cols-2">
              {uploadedDocuments.map(doc => (
                <div key={doc.type} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm">{doc.type.replace('_', ' ').toUpperCase()}</span>
                  </div>
                  <span className="text-xs text-gray-500">{doc.file.name}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transaction Status */}
      {!createdTransaction && !isCreating && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Ready to Create Transaction
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-blue-900">Ready to Create Transaction</p>
                    <p className="text-sm text-blue-700 mt-1">
                      All information has been validated and documents are ready. Click the button below to create the transaction and upload all documents.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={onPrevious} disabled={isLoading}>
                  Previous
                </Button>
                <Button
                  onClick={handleCreateAndUpload}
                  disabled={isLoading}
                  className="bg-green-500 hover:bg-green-600"
                >
                  {isLoading ? (
                    <>
                      <LoaderCircle className="h-4 w-4 mr-2 animate-spin" />
                      {isCreating ? 'Creating Transaction...' : 'Uploading Documents...'}
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Create Transaction & Upload Documents
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Creation Progress */}
      {isLoading && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LoaderCircle className="h-5 w-5 animate-spin" />
              {isCreating ? 'Creating Transaction' : 'Uploading Documents'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progress</span>
                  <span>{isCreating ? '1/2' : '2/2'}</span>
                </div>
                <Progress value={isCreating ? 50 : 100} className="h-2" />
              </div>
              
              <div className="space-y-2">
                <div className={`flex items-center gap-2 ${isCreating ? 'text-blue-600' : 'text-green-600'}`}>
                  {isCreating ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4" />
                  )}
                  <span className="text-sm font-medium">
                    {isCreating ? 'Creating transaction...' : 'Transaction created successfully'}
                  </span>
                </div>
                
                <div className={`flex items-center gap-2 ${isFinalUploading ? 'text-blue-600' : createdTransaction ? 'text-green-600' : 'text-gray-400'}`}>
                  {isFinalUploading ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : createdTransaction ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <div className="h-4 w-4 rounded-full border-2 border-gray-300" />
                  )}
                  <span className="text-sm font-medium">
                    {isFinalUploading ? 'Uploading documents...' : createdTransaction && !isFinalUploading ? 'Documents uploaded successfully' : 'Waiting for transaction creation'}
                  </span>
                </div>
              </div>

              <p className="text-sm text-gray-600">
                Please wait while we process your request. Do not close this window.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Success State */}
      {createdTransaction && !isLoading && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Transaction Created Successfully
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-green-900">Transaction #{createdTransaction.id} Created</p>
                    <p className="text-sm text-green-700 mt-1">
                      Your cutpay transaction has been created successfully and all documents have been uploaded.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-between">
                <Button
                  variant="outline"
                  onClick={() => window.location.href = `/admin/cutpay/${createdTransaction.id}`}
                  className="flex items-center gap-2"
                >
                  <Eye className="h-4 w-4" />
                  View Transaction
                </Button>
                <Button
                  onClick={() => onComplete(createdTransaction.id)}
                  className="bg-green-500 hover:bg-green-600"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Complete
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
