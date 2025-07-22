'use client'

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { FileText } from 'lucide-react';
import { useAtom } from 'jotai';
import { policyPdfUrlAtom, additionalDocumentsUrlsAtom } from '@/lib/atoms/cutpay';
import { getFromIndexedDB } from '@/lib/utils/indexeddb';

interface AdditionalDocUrls {
  kyc_documents: string | null;
  rc_document: string | null;
  previous_policy: string | null;
}

// Helper function to check if a file type is viewable
const isViewable = (fileType?: string): boolean => {
  if (!fileType) return false;
  return fileType.startsWith('image/') || fileType === 'application/pdf';
};

const DocumentViewer: React.FC = () => {
  const blobUrlsRef = useRef<string[]>([]);
  const [activeDocument, setActiveDocument] = useState<'policy' | 'kyc' | 'rc' | 'previous'>('policy');
  const [availableDocuments, setAvailableDocuments] = useState<Array<{key: string, label: string, available: boolean, type?: string, name?: string}>>([]);
  const [policyPdfUrl] = useAtom(policyPdfUrlAtom);
  const [additionalDocUrls, setAdditionalDocUrls] = useAtom(additionalDocumentsUrlsAtom);

  useEffect(() => {
    const loadDocuments = async () => {
      const docs = [];
      docs.push({ key: 'policy', label: 'Policy PDF', available: !!policyPdfUrl, type: 'application/pdf' });

      const kycDoc = await getFromIndexedDB('kyc_documents');
      docs.push({ key: 'kyc', label: 'KYC Documents', available: !!kycDoc, type: kycDoc?.type, name: kycDoc?.name });

      const rcDoc = await getFromIndexedDB('rc_document');
      docs.push({ key: 'rc', label: 'RC Document', available: !!rcDoc, type: rcDoc?.type, name: rcDoc?.name });

      const previousDoc = await getFromIndexedDB('previous_policy');
      docs.push({ key: 'previous', label: 'Previous Policy', available: !!previousDoc, type: previousDoc?.type, name: previousDoc?.name });

      setAvailableDocuments(docs);

      // Create blob URLs - new indexeddb-idb utility stores File objects directly
      const urls: AdditionalDocUrls = { kyc_documents: null, rc_document: null, previous_policy: null };
      if (kycDoc && kycDoc.content) urls.kyc_documents = URL.createObjectURL(kycDoc.content);
      if (rcDoc && rcDoc.content) urls.rc_document = URL.createObjectURL(rcDoc.content);
      if (previousDoc && previousDoc.content) urls.previous_policy = URL.createObjectURL(previousDoc.content);
      
      blobUrlsRef.current = Object.values(urls).filter(Boolean) as string[];
      setAdditionalDocUrls(urls);
    };

    loadDocuments();

    const urlsToRevoke = blobUrlsRef.current;
    return () => {
      urlsToRevoke.forEach(url => {
        if (url) URL.revokeObjectURL(url);
      });
    };
  }, [policyPdfUrl, setAdditionalDocUrls]);

  const getDocumentUrl = (docType: string) => {
    switch (docType) {
      case 'policy':
        return policyPdfUrl;
      case 'kyc':
        return additionalDocUrls.kyc_documents;
      case 'rc':
        return additionalDocUrls.rc_document;
      case 'previous':
        return additionalDocUrls.previous_policy;
      default:
        return null;
    }
  };

  return (
    <Card className="sticky top-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Document Viewer
        </CardTitle>
        
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
          {(() => {
            const activeDocInfo = availableDocuments.find(doc => doc.key === activeDocument);
            const docUrl = getDocumentUrl(activeDocument);

            if (docUrl && activeDocInfo && isViewable(activeDocInfo.type)) {
              return (
                <iframe
                  src={docUrl}
                  className="w-full h-full"
                  title={`${activeDocument} document`}
                />
              );
            }

            if (docUrl && activeDocInfo) {
              return (
                <div className="h-full flex items-center justify-center text-gray-500">
                  <div className="text-center p-4">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="font-semibold text-lg">{activeDocInfo.name || 'File'}</p>
                    <p className="text-sm text-gray-600 mb-4">{activeDocInfo.type || 'Unknown file type'}</p>
                    <p className="mb-6">This file type cannot be previewed directly.</p>
                    <a
                      href={docUrl}
                      download={activeDocInfo.name || 'download'}
                      className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Download File
                    </a>
                  </div>
                </div>
              );
            }

            return (
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
            );
          })()}
        </div>
      </CardContent>
    </Card>
  );
};

export default DocumentViewer;
