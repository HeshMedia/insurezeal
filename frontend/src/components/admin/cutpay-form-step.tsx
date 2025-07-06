'use client'

import { useCallback, useEffect, useMemo } from 'react'
import { useAtom } from 'jotai'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { 
  Eye, 
  EyeOff, 
  Calculator, 
  FileText, 
  User, 
  CreditCard, 
  Building,
  DollarSign,
  CalendarDays,
  StickyNote
} from 'lucide-react'

import {
  cutpayFormDataAtom,
  extractedDataAtom,
  calculatedAmountsAtom,
  uploadedDocumentsAtom,
  showDocumentViewerAtom,
  selectedDocumentForViewAtom,
  availableInsurersAtom,
  availableBrokersAtom,
  availableChildIdsAtom
} from '@/lib/atoms/cutpay-flow'
import { useCalculateAmounts, useInsurers, useBrokers, useFilteredChildIds } from '@/hooks/useCutPayFlow'
import type { CutPayFormData } from '@/lib/atoms/cutpay-flow'

interface CutPayFormStepProps {
  onNext: () => void
  onPrevious: () => void
}

export function CutPayFormStep({ onNext, onPrevious }: CutPayFormStepProps) {
  const [formData, setFormData] = useAtom(cutpayFormDataAtom)
  const [extractedData] = useAtom(extractedDataAtom)
  const [calculatedAmounts] = useAtom(calculatedAmountsAtom)
  const [uploadedDocuments] = useAtom(uploadedDocumentsAtom)
  const [showDocumentViewer, setShowDocumentViewer] = useAtom(showDocumentViewerAtom)
  const [selectedDocument, setSelectedDocument] = useAtom(selectedDocumentForViewAtom)
  const [availableInsurers] = useAtom(availableInsurersAtom)
  const [availableBrokers] = useAtom(availableBrokersAtom)
  const [availableChildIds] = useAtom(availableChildIdsAtom)

  const { calculateAmounts } = useCalculateAmounts()

  // Load dropdown data
  useInsurers()
  useBrokers()
  useFilteredChildIds(formData.insurer_id || undefined, formData.broker_id || undefined)

  // Payment method options
  const paymentMethods = useMemo(() => [
    { value: 'credit_card', label: 'Credit Card' },
    { value: 'cash', label: 'Cash' },
    { value: 'net_banking', label: 'Net Banking' },
    { value: 'upi', label: 'UPI' },
    { value: 'debit_card', label: 'Debit Card' },
    { value: 'cheque', label: 'Cheque' }
  ], [])

  // Update form data and trigger calculations
  const updateFormData = useCallback((updates: Partial<CutPayFormData>) => {
    const newFormData = { ...formData, ...updates }
    setFormData(newFormData)
    
    // Auto-calculate when relevant fields change
    const shouldCalculate = Object.keys(updates).some(key => 
      ['incoming_grid_percent', 'agent_commission_given_percent', 'payment_by', 'payout_on', 'od_payout_percent', 'tp_payout_percent'].includes(key)
    )
    
    if (shouldCalculate) {
      calculateAmounts(newFormData)
    }
  }, [formData, setFormData, calculateAmounts])

  // Auto-calculate when form loads
  useEffect(() => {
    if (extractedData && formData.incoming_grid_percent && formData.agent_commission_given_percent) {
      calculateAmounts(formData)
    }
  }, [extractedData, formData, calculateAmounts])

  // Validation
  const isFormValid = useMemo(() => {
    return !!(
      formData.reporting_month &&
      formData.booking_date &&
      formData.agent_code &&
      formData.incoming_grid_percent &&
      formData.agent_commission_given_percent &&
      (formData.insurer_id || formData.broker_id) &&
      formData.customer_phone &&
      formData.customer_email
    )
  }, [formData])

  const DocumentViewer = () => {
    if (!showDocumentViewer || !selectedDocument) return null

    const document = uploadedDocuments.find(doc => doc.type === selectedDocument)
    if (!document) return null

    return (
      <Card className="h-full">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Document Viewer</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDocumentViewer(false)}
            >
              <EyeOff className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex gap-2">
            {uploadedDocuments.map(doc => (
              <Button
                key={doc.type}
                variant={selectedDocument === doc.type ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedDocument(doc.type)}
              >
                {doc.type.replace('_', ' ').toUpperCase()}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-100 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-2">Document: {document.file.name}</p>
            {document.url && (
              <iframe
                src={document.url}
                className="w-full h-96 border rounded"
                title={`Preview of ${document.file.name}`}
              />
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={`grid gap-6 ${showDocumentViewer ? 'grid-cols-2' : 'grid-cols-1'}`}>
      {/* Form Section */}
      <div className="space-y-6">
        {/* Extracted Data Display */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Extracted Policy Data
            </CardTitle>
          </CardHeader>
          <CardContent>
            {extractedData ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-xs text-gray-500">Policy Number</Label>
                  <p className="font-medium">{extractedData.policy_number || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Customer Name</Label>
                  <p className="font-medium">{extractedData.customer_name || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Gross Premium</Label>
                  <p className="font-medium">₹{extractedData.gross_premium?.toLocaleString('en-IN') || '0'}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Net Premium</Label>
                  <p className="font-medium">₹{extractedData.net_premium?.toLocaleString('en-IN') || '0'}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Vehicle Registration</Label>
                  <p className="font-medium">{extractedData.registration_no || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Make & Model</Label>
                  <p className="font-medium">{extractedData.make_model || 'N/A'}</p>
                </div>
              </div>
            ) : (
              <p className="text-gray-500">No extracted data available</p>
            )}
          </CardContent>
        </Card>

        {/* Document Viewer Toggle */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                <span className="font-medium">View Documents</span>
              </div>
              <Switch
                checked={showDocumentViewer}
                onCheckedChange={setShowDocumentViewer}
              />
            </div>
          </CardContent>
        </Card>

        {/* Transaction Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Transaction Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="reporting_month">Reporting Month *</Label>
                <Input
                  id="reporting_month"
                  placeholder="JUN'25"
                  value={formData.reporting_month || ''}
                  onChange={(e) => updateFormData({ reporting_month: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="booking_date">Booking Date *</Label>
                <Input
                  id="booking_date"
                  type="date"
                  value={formData.booking_date || ''}
                  onChange={(e) => updateFormData({ booking_date: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="agent_code">Agent Code *</Label>
                <Input
                  id="agent_code"
                  placeholder="AG001"
                  value={formData.agent_code || ''}
                  onChange={(e) => updateFormData({ agent_code: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="code_type">Code Type *</Label>
                <Select
                  value={formData.code_type || 'Direct'}
                  onValueChange={(value: 'Direct' | 'Broker') => updateFormData({ code_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Direct">Direct Code</SelectItem>
                    <SelectItem value="Broker">Broker Code</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Relationship Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Relationship Selection
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {formData.code_type === 'Direct' ? (
                <div>
                  <Label htmlFor="insurer_id">Select Insurer *</Label>
                  <Select
                    value={formData.insurer_id?.toString() || ''}
                    onValueChange={(value) => updateFormData({ insurer_id: parseInt(value), broker_id: null })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose Insurer" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableInsurers.map(insurer => (
                        <SelectItem key={insurer.id} value={insurer.id.toString()}>
                          {insurer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div>
                  <Label htmlFor="broker_id">Select Broker *</Label>
                  <Select
                    value={formData.broker_id?.toString() || ''}
                    onValueChange={(value) => updateFormData({ broker_id: parseInt(value), insurer_id: null })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose Broker" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableBrokers.map(broker => (
                        <SelectItem key={broker.id} value={broker.id.toString()}>
                          {broker.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label htmlFor="admin_child_id">Available Child IDs</Label>
                <Select
                  value={formData.admin_child_id?.toString() || ''}
                  onValueChange={(value) => updateFormData({ admin_child_id: parseInt(value) })}
                  disabled={!availableChildIds.length}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose Child ID" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableChildIds.map(childId => (
                      <SelectItem key={childId.id} value={childId.id.toString()}>
                        {childId.name} {childId.code && `(${childId.code})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Commission Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Commission Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="incoming_grid_percent">Incoming Grid % *</Label>
                <Input
                  id="incoming_grid_percent"
                  type="number"
                  step="0.01"
                  placeholder="15.00"
                  value={formData.incoming_grid_percent || ''}
                  onChange={(e) => updateFormData({ incoming_grid_percent: parseFloat(e.target.value) })}
                />
              </div>
              <div>
                <Label htmlFor="agent_commission_given_percent">Agent Payout % *</Label>
                <Input
                  id="agent_commission_given_percent"
                  type="number"
                  step="0.01"
                  placeholder="12.00"
                  value={formData.agent_commission_given_percent || ''}
                  onChange={(e) => updateFormData({ agent_commission_given_percent: parseFloat(e.target.value) })}
                />
              </div>
              <div>
                <Label htmlFor="extra_grid">Extra Grid %</Label>
                <Input
                  id="extra_grid"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.extra_grid || ''}
                  onChange={(e) => updateFormData({ extra_grid: parseFloat(e.target.value) })}
                />
              </div>
              <div>
                <Label htmlFor="agent_extra_percent">Agent Extra %</Label>
                <Input
                  id="agent_extra_percent"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.agent_extra_percent || ''}
                  onChange={(e) => updateFormData({ agent_extra_percent: parseFloat(e.target.value) })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Payment Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="payment_by">Payment By *</Label>
                <Select
                  value={formData.payment_by || 'Agent'}
                  onValueChange={(value: 'Agent' | 'InsureZeal') => updateFormData({ payment_by: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Agent">Agent</SelectItem>
                    <SelectItem value="InsureZeal">InsureZeal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="payment_method">Payment Method</Label>
                <Select
                  value={formData.payment_method || 'cash'}
                  onValueChange={(value) => updateFormData({ payment_method: value as CutPayFormData['payment_method'] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentMethods.map(method => (
                      <SelectItem key={method.value} value={method.value}>
                        {method.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="payout_on">Payout On *</Label>
                <Select
                  value={formData.payout_on || 'OD'}
                  onValueChange={(value: 'OD' | 'NP' | 'OD+TP') => updateFormData({ payout_on: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OD">OD (Own Damage)</SelectItem>
                    <SelectItem value="NP">NP (Net Premium)</SelectItem>
                    <SelectItem value="OD+TP">OD + TP (Own Damage + Third Party)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formData.payout_on === 'OD+TP' && (
                <>
                  <div>
                    <Label htmlFor="od_payout_percent">OD Payout %</Label>
                    <Input
                      id="od_payout_percent"
                      type="number"
                      step="0.01"
                      placeholder="12.00"
                      value={formData.od_payout_percent || ''}
                      onChange={(e) => updateFormData({ od_payout_percent: parseFloat(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="tp_payout_percent">TP Payout %</Label>
                    <Input
                      id="tp_payout_percent"
                      type="number"
                      step="0.01"
                      placeholder="12.00"
                      value={formData.tp_payout_percent || ''}
                      onChange={(e) => updateFormData({ tp_payout_percent: parseFloat(e.target.value) })}
                    />
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Customer Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Customer Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="customer_phone">Customer Phone *</Label>
                <Input
                  id="customer_phone"
                  placeholder="+91 9876543210"
                  value={formData.customer_phone || ''}
                  onChange={(e) => updateFormData({ customer_phone: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="customer_email">Customer Email *</Label>
                <Input
                  id="customer_email"
                  type="email"
                  placeholder="customer@example.com"
                  value={formData.customer_email || ''}
                  onChange={(e) => updateFormData({ customer_email: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="amount_received">Amount Received</Label>
                <Input
                  id="amount_received"
                  type="number"
                  placeholder="0"
                  value={formData.amount_received || ''}
                  onChange={(e) => updateFormData({ amount_received: parseFloat(e.target.value) })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Calculated Amounts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Calculated Amounts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="flex justify-between p-3 bg-blue-50 rounded-lg">
                  <span className="font-medium">Cut Pay Amount:</span>
                  <Badge variant={formData.payment_by === 'Agent' ? 'secondary' : 'default'}>
                    ₹{calculatedAmounts.cut_pay_amount.toLocaleString('en-IN')}
                  </Badge>
                </div>
                <div className="flex justify-between p-3 bg-green-50 rounded-lg">
                  <span className="font-medium">Agent PO Amount:</span>
                  <Badge variant="outline">
                    ₹{calculatedAmounts.agent_po_amt.toLocaleString('en-IN')}
                  </Badge>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between p-3 bg-purple-50 rounded-lg">
                  <span className="font-medium">Total Receivable:</span>
                  <Badge variant="outline">
                    ₹{calculatedAmounts.total_receivable_from_broker.toLocaleString('en-IN')}
                  </Badge>
                </div>
                <div className="flex justify-between p-3 bg-orange-50 rounded-lg">
                  <span className="font-medium">Total Agent PO:</span>
                  <Badge variant="outline">
                    ₹{calculatedAmounts.total_agent_po_amt.toLocaleString('en-IN')}
                  </Badge>
                </div>
              </div>
            </div>
            
            {formData.payment_by === 'Agent' && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <strong>Note:</strong> Cut Pay amount is zero because Agent is selected as payment method.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <StickyNote className="h-5 w-5" />
              Additional Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Add any additional notes or comments..."
              value={formData.notes || ''}
              onChange={(e) => updateFormData({ notes: e.target.value })}
              rows={3}
            />
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between">
          <Button variant="outline" onClick={onPrevious}>
            Previous
          </Button>
          <Button
            onClick={onNext}
            disabled={!isFormValid}
            className="bg-green-500 hover:bg-green-600"
          >
            Create Transaction
          </Button>
        </div>
      </div>

      {/* Document Viewer */}
      {showDocumentViewer && (
        <div className="sticky top-6">
          <DocumentViewer />
        </div>
      )}
    </div>
  )
}
