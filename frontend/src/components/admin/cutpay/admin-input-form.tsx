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
  Info
} from 'lucide-react'

// Import atoms
import {
  pdfExtractionDataAtom,
  policyPdfUrlAtom,
  additionalDocumentsUrlsAtom
} from '@/lib/atoms/cutpay'

// Import IndexedDB utilities
import { getFileFromIndexedDB, arrayBufferToFile } from '@/lib/utils/indexeddb'

// Import types
import { CreateCutPayRequest } from '@/types/cutpay.types'

interface AdminInputFormProps {
  onNext?: () => void
  onPrev?: () => void
}

const AdminInputForm = ({ onNext, onPrev }: AdminInputFormProps) => {
  const [extractedData] = useAtom(pdfExtractionDataAtom)
  const [policyPdfUrl] = useAtom(policyPdfUrlAtom)
  const [additionalDocUrls, setAdditionalDocUrls] = useAtom(additionalDocumentsUrlsAtom)
  
  const [showDocumentViewer, setShowDocumentViewer] = useState(true)
  const [activeDocument, setActiveDocument] = useState<'policy' | 'kyc' | 'rc' | 'previous'>('policy')
  const [availableDocuments, setAvailableDocuments] = useState<Array<{key: string, label: string, available: boolean}>>([])
  const [formData, setFormData] = useState<CreateCutPayRequest>({
    policy_pdf_url: '',
    // Initialize all fields to null/empty
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
    receivable_from_broker: null,
    extra_amount_receivable_from_broker: null,
    total_receivable_from_broker: null,
    total_receivable_from_broker_with_gst: null,
    cut_pay_amount: null,
    agent_po_amt: null,
    agent_extra_amount: null,
    total_agent_po_amt: null,
    claimed_by: null,
    already_given_to_agent: null,
    po_paid_to_agent: null,
    running_bal: null,
    match_status: null,
    invoice_number: null,
    notes: null
  })

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

  const handleInputChange = (field: keyof CreateCutPayRequest, value: string | number | null) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
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
        { key: 'reporting_month', label: 'Reporting Month', type: 'text' },
        { key: 'booking_date', label: 'Booking Date', type: 'date' },
        { key: 'agent_code', label: 'Agent Code', type: 'text' },
        { key: 'code_type', label: 'Code Type', type: 'text' },
        { key: 'incoming_grid_percent', label: 'Incoming Grid %', type: 'number' },
        { key: 'agent_commission_given_percent', label: 'Agent Commission Given %', type: 'number' },
        { key: 'extra_grid', label: 'Extra Grid', type: 'number' },
        { key: 'payment_by', label: 'Payment By', type: 'text' },
        { key: 'payment_method', label: 'Payment Method', type: 'text' },
        { key: 'payout_on', label: 'Payout On', type: 'text' },
        { key: 'agent_extra_percent', label: 'Agent Extra %', type: 'number' },
        { key: 'payment_by_office', label: 'Payment By Office', type: 'text' },
        { key: 'insurer_code', label: 'Insurer Code', type: 'text' },
        { key: 'broker_code', label: 'Broker Code', type: 'text' },
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
                    {section.fields.map((field) => (
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
                        </div>
                        
                        {field.type === 'select' ? (
                          <Select
                            value={formData[field.key as keyof CreateCutPayRequest] as string || ''}
                            onValueChange={(value) => handleInputChange(field.key as keyof CreateCutPayRequest, value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={`Select ${field.label}`} />
                            </SelectTrigger>
                            <SelectContent>
                              {field.options?.map((option) => (
                                <SelectItem key={option} value={option}>
                                  {option}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            id={field.key}
                            type={field.type}
                            value={formData[field.key as keyof CreateCutPayRequest] as string || ''}
                            onChange={(e) => {
                              const value = field.type === 'number' 
                                ? (e.target.value ? parseFloat(e.target.value) : null)
                                : e.target.value || null
                              handleInputChange(field.key as keyof CreateCutPayRequest, value)
                            }}
                            placeholder={`Enter ${field.label}`}
                            className="w-full"
                          />
                        )}
                      </div>
                    ))}
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
              <Textarea
                value={formData.notes as string || ''}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                placeholder="Enter any additional notes or comments..."
                rows={4}
              />
            </CardContent>
          </Card>
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
          <Button onClick={onNext} className="flex items-center gap-2">
            Create Transaction
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

export default AdminInputForm
