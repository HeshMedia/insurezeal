'use client';

import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Copy, CheckCircle } from 'lucide-react';
import { ErrorResponse } from '../types/types';
import { useCopyToClipboard } from '../hooks/useCopyTOClipboard';

interface ErrorDisplayProps {
  errorInfo: ErrorResponse | null;
}

export function ErrorDisplay({ errorInfo }: ErrorDisplayProps) {
  const { copiedItem, copyToClipboard } = useCopyToClipboard();
  
  if (!errorInfo) return null;
  
  return (
    <div className="space-y-4">
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <div className="space-y-2">
            <div className="font-medium">{errorInfo.error}</div>
            {errorInfo.details && (
              <div className="text-sm opacity-90">{errorInfo.details}</div>
            )}
            {errorInfo.suggestion && (
              <div className="text-sm font-medium">💡 {errorInfo.suggestion}</div>
            )}
          </div>
        </AlertDescription>
      </Alert>

      {errorInfo.troubleshooting?.suggestions && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Troubleshooting Suggestions</CardTitle>
            <p className="text-sm text-muted-foreground">
              Session: {errorInfo.troubleshooting.user} - {errorInfo.troubleshooting.timestamp}
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {errorInfo.troubleshooting.suggestions.map((suggestion, index) => (
                <div key={index} className="flex items-start gap-2 p-2 bg-muted rounded">
                  <span className="text-sm font-medium text-muted-foreground mt-0.5">
                    {index + 1}.
                  </span>
                  <span className="text-sm flex-1">{suggestion}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(suggestion, index)}
                    className="h-6 w-6 p-0"
                  >
                    {copiedItem === index ? (
                      <CheckCircle className="h-3 w-3 text-green-600" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}