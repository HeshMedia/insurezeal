"use client"

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Maximize2, 
  Minimize2, 
  FileText, 
  Upload, 
  X, 
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Download
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ComprehensiveCutPayForm } from './comprehensive-cutpay-form'
import { CutPayTransaction } from '@/types/admin.types'

interface DocumentViewerProps {
  fileUrl?: string
  fileName?: string
  className?: string
}

function DocumentViewer({ fileUrl, fileName, className }: DocumentViewerProps) {
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3))
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.5))
  const handleRotate = () => setRotation(prev => (prev + 90) % 360)
  const handleReset = () => {
    setZoom(1)
    setRotation(0)
  }

  if (!fileUrl) {
    return (
      <div className={cn("flex items-center justify-center h-full bg-muted/20 rounded-lg border-2 border-dashed", className)}>
        <div className="text-center p-8">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-lg font-medium text-muted-foreground mb-2">No document uploaded</p>
          <p className="text-sm text-muted-foreground">Upload a policy document to view it here</p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Document Viewer Header */}
      <div className="flex items-center justify-between p-3 border-b bg-muted/5">
        <div className="flex items-center space-x-2">
          <FileText className="h-4 w-4" />
          <span className="text-sm font-medium truncate max-w-[200px]">
            {fileName || 'Document'}
          </span>
          <Badge variant="secondary" className="text-xs">PDF</Badge>
        </div>
        
        <div className="flex items-center space-x-1">
          <Button variant="ghost" size="sm" onClick={handleZoomOut}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs font-mono min-w-[60px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <Button variant="ghost" size="sm" onClick={handleZoomIn}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Separator orientation="vertical" className="h-4" />
          <Button variant="ghost" size="sm" onClick={handleRotate}>
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleReset}>
            <span className="text-xs">Reset</span>
          </Button>
          <Separator orientation="vertical" className="h-4" />
          <Button variant="ghost" size="sm" asChild>
            <a href={fileUrl} download={fileName} target="_blank" rel="noopener noreferrer">
              <Download className="h-4 w-4" />
            </a>
          </Button>
        </div>
      </div>

      {/* Document Content */}
      <div className="flex-1 overflow-auto bg-gray-100">
        <div className="flex justify-center p-4">
          <iframe
            src={`${fileUrl}#toolbar=0&navpanes=0&scrollbar=1`}
            className="border border-gray-300 bg-white shadow-lg"
            style={{
              width: `${zoom * 100}%`,
              height: `${zoom * 800}px`,
              transform: `rotate(${rotation}deg)`,
              transformOrigin: 'center center'
            }}
            title={fileName || 'Policy Document'}
          />
        </div>
      </div>
    </div>
  )
}

interface SplitScreenCutPayFormProps {
  initialData?: CutPayTransaction
  onSuccess?: (transaction: CutPayTransaction) => void
  mode?: 'create' | 'edit'
}

export function SplitScreenCutPayForm({ 
  initialData, 
  onSuccess, 
  mode = 'create' 
}: SplitScreenCutPayFormProps) {
  const [isDocumentViewOpen, setIsDocumentViewOpen] = useState(false)
  const [uploadedDocument, setUploadedDocument] = useState<{
    url: string
    name: string
  } | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Handle manual document selection for viewing
  const handleDocumentSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.type === 'application/pdf') {
      const url = URL.createObjectURL(file)
      setUploadedDocument({
        url,
        name: file.name
      })
      setIsDocumentViewOpen(true)
    }
  }

  const toggleDocumentView = () => {
    setIsDocumentViewOpen(!isDocumentViewOpen)
  }

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
  }

  const closeDocumentView = () => {
    setIsDocumentViewOpen(false)
    setIsFullscreen(false)
  }

  // Clean up object URLs when component unmounts
  React.useEffect(() => {
    return () => {
      if (uploadedDocument?.url.startsWith('blob:')) {
        URL.revokeObjectURL(uploadedDocument.url)
      }
    }
  }, [uploadedDocument])

  return (
    <div className="h-full flex flex-col">
      {/* Header Controls */}
      <div className="flex items-center justify-between p-4 border-b bg-background">
        <div className="flex items-center space-x-2">
          <h2 className="text-xl font-semibold">
            {mode === 'create' ? 'Create CutPay Transaction' : 'Edit CutPay Transaction'}
          </h2>
          {uploadedDocument && (
            <Badge variant="outline" className="ml-2">
              Document Loaded
            </Badge>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {/* Document Selection for Viewing */}
          <div className="relative">
            <input
              type="file"
              id="document-viewer-upload"
              accept=".pdf"
              onChange={handleDocumentSelection}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <Button variant="outline" size="sm" className="gap-2">
              <Upload className="h-4 w-4" />
              Load Document for Viewing
            </Button>
          </div>

          {uploadedDocument && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={toggleDocumentView}
                className="gap-2"
              >
                {isDocumentViewOpen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                {isDocumentViewOpen ? 'Hide Document' : 'Show Document'}
              </Button>
              
              {isDocumentViewOpen && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleFullscreen}
                  className="gap-2"
                >
                  {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                  {isFullscreen ? 'Split View' : 'Fullscreen'}
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Document Viewer - Fullscreen Mode */}
        {isFullscreen && isDocumentViewOpen && (
          <div className="fixed inset-0 z-50 bg-background">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center space-x-2">
                <FileText className="h-5 w-5" />
                <span className="font-medium">Document Viewer</span>
              </div>
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm" onClick={toggleFullscreen}>
                  <Minimize2 className="h-4 w-4 mr-2" />
                  Exit Fullscreen
                </Button>
                <Button variant="outline" size="sm" onClick={closeDocumentView}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <DocumentViewer 
              fileUrl={uploadedDocument?.url}
              fileName={uploadedDocument?.name}
              className="h-[calc(100vh-73px)]"
            />
          </div>
        )}

        {/* Split View Layout */}
        {!isFullscreen && (
          <>
            {/* Form Section */}
            <div className={cn(
              "flex-1 overflow-auto",
              isDocumentViewOpen ? "w-1/2" : "w-full"
            )}>
              <div className="p-6">
                <ComprehensiveCutPayForm
                  initialData={initialData}
                  onSuccess={onSuccess}
                  mode={mode}
                />
              </div>
            </div>

            {/* Document Viewer Section */}
            {isDocumentViewOpen && (
              <>
                <Separator orientation="vertical" />
                <div className="w-1/2 flex flex-col">
                  <div className="flex items-center justify-between p-3 border-b">
                    <span className="font-medium">Document Viewer</span>
                    <Button variant="ghost" size="sm" onClick={closeDocumentView}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <DocumentViewer 
                    fileUrl={uploadedDocument?.url}
                    fileName={uploadedDocument?.name}
                    className="flex-1"
                  />
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Instructions */}
      {!uploadedDocument && (
        <Alert className="m-4">
          <Upload className="h-4 w-4" />
          <AlertDescription>
            Load a policy document using the &ldquo;Load Document for Viewing&rdquo; button to enable the split-screen document viewer. 
            This is separate from the document upload in the form and is purely for reference while filling out the transaction details.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
