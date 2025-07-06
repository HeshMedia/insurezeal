"use client"

import { useState, useRef, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  PanelLeftClose, 
  PanelLeftOpen, 
  FileText, 
  Download, 
  ZoomIn, 
  ZoomOut, 
  RotateCw,
  Eye,
  X,
  Upload,
  Maximize2,
  Minimize2
} from "lucide-react"
import { cn } from "@/lib/utils"

interface CutPaySplitViewProps {
  // Form Component (right side)
  formComponent: React.ReactNode
  // Document props
  documentUrl?: string | null
  documentType?: string
  // Layout props
  defaultLayout?: 'split' | 'form-only' | 'doc-only'
  onLayoutChange?: (layout: 'split' | 'form-only' | 'doc-only') => void
  // Document management
  onDocumentUpload?: (file: File) => void
  onDocumentExtract?: () => void
  isExtracting?: boolean
  className?: string
}

export function CutPaySplitView({
  formComponent,
  documentUrl,
  documentType = 'policy_pdf',
  defaultLayout = 'split',
  onLayoutChange,
  onDocumentUpload,
  onDocumentExtract,
  isExtracting = false,
  className
}: CutPaySplitViewProps) {
  const [layout, setLayout] = useState<'split' | 'form-only' | 'doc-only'>(defaultLayout)
  const [documentZoom, setDocumentZoom] = useState(100)
  const [documentRotation, setDocumentRotation] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleLayoutChange = useCallback((newLayout: 'split' | 'form-only' | 'doc-only') => {
    setLayout(newLayout)
    onLayoutChange?.(newLayout)
  }, [onLayoutChange])

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.type === 'application/pdf') {
      onDocumentUpload?.(file)
    }
    // Reset input value
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [onDocumentUpload])

  const handleZoomIn = () => setDocumentZoom(prev => Math.min(prev + 25, 200))
  const handleZoomOut = () => setDocumentZoom(prev => Math.max(prev - 25, 50))
  const handleRotate = () => setDocumentRotation(prev => (prev + 90) % 360)
  const toggleFullscreen = () => setIsFullscreen(prev => !prev)

  // Layout classes
  const containerClasses = cn(
    "flex h-full",
    isFullscreen && "fixed inset-0 z-50 bg-white",
    className
  )

  const formSectionClasses = cn(
    "flex-1 flex flex-col",
    layout === 'doc-only' && "hidden",
    layout === 'split' && "w-1/2",
    layout === 'form-only' && "w-full"
  )

  const documentSectionClasses = cn(
    "flex-1 flex flex-col border-l border-gray-200",
    layout === 'form-only' && "hidden",
    layout === 'split' && "w-1/2",
    layout === 'doc-only' && "w-full border-l-0"
  )

  return (
    <div className={containerClasses}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Form Section */}
      <div className={formSectionClasses}>
        {/* Form Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold">CutPay Form</h2>
          </div>
          
          {/* Layout Controls */}
          <div className="flex items-center gap-2">
            {documentUrl && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleLayoutChange(layout === 'split' ? 'form-only' : 'split')}
                  className="h-8 px-2"
                >
                  {layout === 'split' ? (
                    <PanelLeftClose className="h-4 w-4" />
                  ) : (
                    <PanelLeftOpen className="h-4 w-4" />
                  )}
                </Button>
                <Separator orientation="vertical" className="h-6" />
              </>
            )}
            
            <Button
              variant="outline"
              size="sm"
              onClick={toggleFullscreen}
              className="h-8 px-2"
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
            
            {isFullscreen && (
              <Button
                variant="outline"
                size="sm"
                onClick={toggleFullscreen}
                className="h-8 px-2"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Form Content */}
        <ScrollArea className="flex-1">
          <div className="p-4">
            {formComponent}
          </div>
        </ScrollArea>
      </div>

      {/* Document Section */}
      <div className={documentSectionClasses}>
        {/* Document Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-green-600" />
            <h2 className="text-lg font-semibold">Document Viewer</h2>
            {documentType && (
              <Badge variant="secondary" className="text-xs">
                {documentType.replace('_', ' ').toUpperCase()}
              </Badge>
            )}
          </div>

          {/* Document Controls */}
          <div className="flex items-center gap-2">
            {!documentUrl && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="h-8 px-2"
              >
                <Upload className="h-4 w-4 mr-1" />
                Upload PDF
              </Button>
            )}

            {documentUrl && (
              <>
                {/* Zoom Controls */}
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleZoomOut}
                    disabled={documentZoom <= 50}
                    className="h-8 px-2"
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium min-w-[3rem] text-center">
                    {documentZoom}%
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleZoomIn}
                    disabled={documentZoom >= 200}
                    className="h-8 px-2"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                </div>

                <Separator orientation="vertical" className="h-6" />

                {/* Rotation Control */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRotate}
                  className="h-8 px-2"
                >
                  <RotateCw className="h-4 w-4" />
                </Button>

                {/* Download */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(documentUrl, '_blank')}
                  className="h-8 px-2"
                >
                  <Download className="h-4 w-4" />
                </Button>

                <Separator orientation="vertical" className="h-6" />

                {/* Extract Button */}
                {onDocumentExtract && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={onDocumentExtract}
                    disabled={isExtracting}
                    className="h-8 px-3 bg-blue-600 hover:bg-blue-700"
                  >
                    {isExtracting ? (
                      <>
                        <div className="animate-spin h-3 w-3 border border-white border-t-transparent rounded-full mr-2" />
                        Extracting...
                      </>
                    ) : (
                      <>
                        <FileText className="h-4 w-4 mr-1" />
                        Extract Data
                      </>
                    )}
                  </Button>
                )}

                {/* Layout Controls */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleLayoutChange(layout === 'split' ? 'doc-only' : 'split')}
                  className="h-8 px-2"
                >
                  {layout === 'split' ? (
                    <PanelLeftClose className="h-4 w-4" />
                  ) : (
                    <PanelLeftOpen className="h-4 w-4" />
                  )}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Document Content */}
        <div className="flex-1 bg-gray-100">
          {documentUrl ? (
            <div className="h-full flex items-center justify-center">
              <div 
                className="w-full h-full flex items-center justify-center"
                style={{
                  transform: `scale(${documentZoom / 100}) rotate(${documentRotation}deg)`,
                  transformOrigin: 'center center'
                }}
              >
                <iframe
                  src={`${documentUrl}#toolbar=1&navpanes=1&scrollbar=1`}
                  className="w-full h-full border-0 rounded"
                  style={{
                    minHeight: '600px',
                    maxWidth: '100%'
                  }}
                  title="Policy Document"
                />
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-500">
              <FileText className="h-16 w-16 mb-4 text-gray-300" />
              <h3 className="text-lg font-medium mb-2">No Document Uploaded</h3>
              <p className="text-sm text-center mb-4 max-w-sm">
                Upload a policy PDF to view it side-by-side with the form for easy data entry and verification.
              </p>
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="gap-2"
              >
                <Upload className="h-4 w-4" />
                Upload Policy PDF
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Status Bar (when extracting) */}
      {isExtracting && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10">
          <Card className="shadow-lg">
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full" />
                <span className="text-sm font-medium">Extracting data from PDF...</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

// Enhanced CutPay Create/Edit Page with Split View
export function CutPaySplitViewPage({
  cutpayId,
  mode = 'create'
}: {
  cutpayId?: number
  mode?: 'create' | 'edit'
}) {
  const [documentUrl] = useState<string | null>(null)
  const [isExtracting, setIsExtracting] = useState(false)

  const handleDocumentUpload = async (file: File) => {
    try {
      // TODO: Implement actual upload logic
      // const uploadResponse = await uploadDocument(cutpayId, file)
      // setDocumentUrl(uploadResponse.document_url)
      console.log('Uploading document:', file.name)
    } catch (error) {
      console.error('Document upload failed:', error)
    }
  }

  const handleDocumentExtract = async () => {
    if (!cutpayId) return
    
    setIsExtracting(true)
    try {
      // TODO: Implement actual extraction logic
      // await extractPdfData(cutpayId)
      console.log('Extracting PDF data...')
      
      // Simulate extraction time
      setTimeout(() => {
        setIsExtracting(false)
      }, 3000)
    } catch (error) {
      console.error('PDF extraction failed:', error)
      setIsExtracting(false)
    }
  }

  // TODO: Replace with actual form component
  const formComponent = (
    <Card>
      <CardHeader>
        <CardTitle>CutPay {mode === 'create' ? 'Creation' : 'Edit'} Form</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-gray-600">
            This is where the actual CutPay form component will be rendered.
            The form can be the existing comprehensive form or any other form component.
          </p>
          <div className="h-96 bg-gray-50 rounded border-2 border-dashed border-gray-300 flex items-center justify-center">
            <span className="text-gray-500">CutPay Form Component Placeholder</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="h-screen">
      <CutPaySplitView
        formComponent={formComponent}
        documentUrl={documentUrl}
        documentType="policy_pdf"
        onDocumentUpload={handleDocumentUpload}
        onDocumentExtract={cutpayId ? handleDocumentExtract : undefined}
        isExtracting={isExtracting}
      />
    </div>
  )
}
