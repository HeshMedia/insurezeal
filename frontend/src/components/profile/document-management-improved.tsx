'use client'

import React, { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { 
  Upload, 
  FileText, 
  Download, 
  Trash2, 
  Eye, 
  Plus,
  CheckCircle,
  AlertCircle,
  Clock,
  CreditCard,
  GraduationCap,
  BriefcaseIcon,
  Camera,
  Building,
  Receipt,
  BookOpen,
  Home,
  DollarSign,
  Shield
} from 'lucide-react'
import { UserProfile } from '@/types/profile.types'
import { toast } from 'sonner'

interface DocumentManagementProps {
  profile: UserProfile
}

interface Document {
  id: string
  name: string
  filename: string
  type: string
  status: 'approved' | 'pending' | 'rejected'
  uploadedAt: string
  size: string
  url?: string
}

interface UploadProgress {
  isUploading: boolean
  progress: number
  fileName: string
}

interface DocumentType {
  id: string
  name: string
  description: string
  icon: React.ReactNode
  required: boolean
  category: 'identity' | 'financial' | 'professional' | 'address'
}

const documentTypes: DocumentType[] = [
  // Identity Documents
  {
    id: 'aadhaar',
    name: 'Aadhaar Card',
    description: 'Government issued Aadhaar card',
    icon: <CreditCard className="w-5 h-5" />,
    required: true,
    category: 'identity'
  },
  {
    id: 'pan',
    name: 'PAN Card',
    description: 'Permanent Account Number card',
    icon: <CreditCard className="w-5 h-5" />,
    required: true,
    category: 'identity'
  },
  {
    id: 'passport_photo',
    name: 'Passport Photo',
    description: 'Recent passport size photograph',
    icon: <Camera className="w-5 h-5" />,
    required: true,
    category: 'identity'
  },
  
  // Educational Documents
  {
    id: 'educational_certificate',
    name: 'Educational Certificate',
    description: 'Degree, diploma, or certification',
    icon: <GraduationCap className="w-5 h-5" />,
    required: false,
    category: 'professional'
  },
  {
    id: 'training_certificate',
    name: 'Training Certificate',
    description: 'Professional training or course certificate',
    icon: <BookOpen className="w-5 h-5" />,
    required: false,
    category: 'professional'
  },
  
  // Professional Documents
  {
    id: 'experience_certificate',
    name: 'Experience Certificate',
    description: 'Previous company experience letter',
    icon: <BriefcaseIcon className="w-5 h-5" />,
    required: false,
    category: 'professional'
  },
  {
    id: 'irdai_license',
    name: 'IRDAI License',
    description: 'Insurance Regulatory and Development Authority license',
    icon: <Shield className="w-5 h-5" />,
    required: true,
    category: 'professional'
  },
  
  // Financial Documents
  {
    id: 'bank_passbook',
    name: 'Bank Passbook',
    description: 'Bank account passbook or statement',
    icon: <Building className="w-5 h-5" />,
    required: false,
    category: 'financial'
  },
  {
    id: 'cancelled_cheque',
    name: 'Cancelled Cheque',
    description: 'Cancelled cheque for bank verification',
    icon: <Receipt className="w-5 h-5" />,
    required: false,
    category: 'financial'
  },
  {
    id: 'income_proof',
    name: 'Income Proof',
    description: 'Salary slip, ITR, or income certificate',
    icon: <DollarSign className="w-5 h-5" />,
    required: false,
    category: 'financial'
  },
  
  // Address Documents
  {
    id: 'residence_proof',
    name: 'Residence Proof',
    description: 'Utility bill, rent agreement, or address proof',
    icon: <Home className="w-5 h-5" />,
    required: true,
    category: 'address'
  }
]

const categoryLabels = {
  identity: 'Identity Documents',
  financial: 'Financial Documents',
  professional: 'Professional Documents',
  address: 'Address Documents'
}

export function DocumentManagement({}: DocumentManagementProps) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({ isUploading: false, progress: 0, fileName: '' })
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [selectedDocType, setSelectedDocType] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const simulateUpload = async (file: File, docType: string): Promise<void> => {
    setUploadProgress({ isUploading: true, progress: 0, fileName: file.name })
    
    // Simulate upload progress
    for (let progress = 0; progress <= 100; progress += 10) {
      await new Promise(resolve => setTimeout(resolve, 200))
      setUploadProgress(prev => ({ ...prev, progress }))
    }

    // Add document to list (replace if exists)
    const newDoc: Document = {
      id: Date.now().toString(),
      name: documentTypes.find(dt => dt.id === docType)?.name || 'Document',
      filename: file.name,
      type: docType,
      status: 'pending',
      uploadedAt: new Date().toISOString().split('T')[0],
      size: (file.size / (1024 * 1024)).toFixed(1) + ' MB',
      url: URL.createObjectURL(file)
    }
    
    // Remove existing document of same type
    setDocuments(prev => prev.filter(doc => doc.type !== docType))
    // Add new document
    setDocuments(prev => [...prev, newDoc])
    
    setUploadProgress({ isUploading: false, progress: 0, fileName: '' })
    setShowUploadDialog(false)
    setSelectedDocType('')
    toast.success('Document uploaded successfully!')
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !selectedDocType) return

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size should be less than 5MB')
      return
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf']
    if (!allowedTypes.includes(file.type)) {
      toast.error('Only JPG, PNG, and PDF files are allowed')
      return
    }    try {
      await simulateUpload(file, selectedDocType)
    } catch {
      toast.error('Failed to upload document')
      setUploadProgress({ isUploading: false, progress: 0, fileName: '' })
    } finally {
      if (event.target) {
        event.target.value = ''
      }
    }
  }
  const handleDeleteDocument = async (docId: string) => {
    try {
      await new Promise(resolve => setTimeout(resolve, 1000))
      setDocuments(prev => prev.filter(doc => doc.id !== docId))
      toast.success('Document deleted successfully!')
    } catch {
      toast.error('Failed to delete document')
    }
  }

  const handleViewDocument = (doc: Document) => {
    if (doc.url) {
      window.open(doc.url, '_blank')
    } else {
      toast.error('Document preview not available')
    }
  }

  const handleDownloadDocument = (doc: Document) => {
    if (doc.url) {
      const link = document.createElement('a')
      link.href = doc.url
      link.download = doc.filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } else {
      toast.error('Document download not available')
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'rejected':
        return <AlertCircle className="w-4 h-4 text-red-500" />
      default:
        return <Clock className="w-4 h-4 text-yellow-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
      case 'rejected':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
      default:
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
    }
  }

  const getDocumentsByCategory = () => {
    const categories: Record<string, Document[]> = {}
    Object.keys(categoryLabels).forEach(category => {
      categories[category] = documents.filter(doc => {
        const docType = documentTypes.find(dt => dt.id === doc.type)
        return docType?.category === category
      })
    })
    return categories
  }

  const getCompletionStats = () => {
    const required = documentTypes.filter(dt => dt.required)
    const uploaded = documents.filter(doc => 
      required.some(req => req.id === doc.type)
    )
    return {
      completed: uploaded.length,
      total: required.length,
      percentage: Math.round((uploaded.length / required.length) * 100)
    }
  }

  const stats = getCompletionStats()
  const documentsByCategory = getDocumentsByCategory()

  return (
    <div className="space-y-6">
      {/* Header with Progress */}
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Documents</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Upload and manage your verification documents
          </p>
          
          {/* Progress Bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Required Documents Progress
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {stats.completed} / {stats.total} completed
              </span>
            </div>
            <Progress value={stats.percentage} className="h-2" />
          </div>
        </div>
        
        <Button 
          onClick={() => setShowUploadDialog(true)}
          className="ml-4"
          disabled={uploadProgress.isUploading}
        >
          <Plus className="w-4 h-4 mr-2" />
          Upload Document
        </Button>
      </div>

      {/* Document Categories */}
      {Object.entries(categoryLabels).map(([category, label]) => {
        const categoryDocs = documentsByCategory[category]
        const categoryTypes = documentTypes.filter(dt => dt.category === category)
        
        return (
          <Card key={category}>
            <CardContent className="p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                {label}
                <Badge variant="secondary" className="text-xs">
                  {categoryDocs.length} / {categoryTypes.length}
                </Badge>
              </h3>
              
              {categoryDocs.length > 0 ? (
                <div className="space-y-3">
                  {categoryDocs.map((doc) => {
                    const docType = documentTypes.find(dt => dt.id === doc.type)
                    return (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                      >
                        <div className="flex items-center gap-4 flex-1">
                          <div className="flex-shrink-0 text-blue-600 dark:text-blue-400">
                            {docType?.icon || <FileText className="w-5 h-5" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {doc.name}
                              </h4>
                              <Badge 
                                variant="secondary" 
                                className={`text-xs ${getStatusColor(doc.status)}`}
                              >
                                <div className="flex items-center gap-1">
                                  {getStatusIcon(doc.status)}
                                  {doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}
                                </div>
                              </Badge>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {doc.filename} • {doc.size} • Uploaded on {doc.uploadedAt}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-8 w-8 p-0"
                            onClick={() => handleViewDocument(doc)}
                            title="View document"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-8 w-8 p-0"
                            onClick={() => handleDownloadDocument(doc)}
                            title="Download document"
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Document</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete &quot;{doc.name}&quot;? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteDocument(doc.id)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No {label.toLowerCase()} uploaded yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>
              Select document type and upload your file
            </DialogDescription>
          </DialogHeader>
          
          {uploadProgress.isUploading ? (
            <div className="space-y-4 py-4">
              <div className="text-center">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Uploading {uploadProgress.fileName}...
                </p>
                <Progress value={uploadProgress.progress} className="w-full" />
                <p className="text-xs text-gray-500 mt-1">
                  {uploadProgress.progress}%
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              {/* Document Type Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Document Type
                </label>
                <Select value={selectedDocType} onValueChange={setSelectedDocType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select document type" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(categoryLabels).map(([category, label]) => (
                      <div key={category}>
                        <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          {label}
                        </div>
                        {documentTypes
                          .filter(dt => dt.category === category)
                          .map((docType) => (
                            <SelectItem key={docType.id} value={docType.id}>
                              <div className="flex items-center gap-2">
                                {docType.icon}
                                <div>
                                  <div className="flex items-center gap-2">
                                    {docType.name}
                                    {docType.required && <span className="text-red-500 text-xs">*</span>}
                                  </div>
                                  <div className="text-xs text-gray-500">{docType.description}</div>
                                </div>
                              </div>
                            </SelectItem>
                          ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* File Upload Area */}
              {selectedDocType && (
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center hover:border-blue-400 dark:hover:border-blue-500 transition-colors relative">
                  <Upload className="w-8 h-8 text-gray-400 mx-auto mb-4" />
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    PDF, JPG, PNG up to 5MB
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf"
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </div>
              )}
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowUploadDialog(false)
                    setSelectedDocType('')
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1"
                  disabled={!selectedDocType}
                >
                  Choose File
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Empty State */}
      {documents.length === 0 && (
        <Card>
          <CardContent className="p-8">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                <FileText className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No documents uploaded yet
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                Start by uploading your required documents to complete your profile
              </p>
              <Button onClick={() => setShowUploadDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Upload First Document
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
