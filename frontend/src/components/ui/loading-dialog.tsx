import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

interface LoadingDialogProps {
  open: boolean;
  title?: string;
  description?: string;
  steps?: Array<{
    id: string;
    label: string;
    status: 'pending' | 'active' | 'completed' | 'failed';
  }>;
}

export function LoadingDialog({ 
  open, 
  title = "Processing...", 
  description, 
  steps 
}: LoadingDialogProps) {
  return (
    <Dialog open={open}>
      <DialogContent 
        className="sm:max-w-md" 
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex flex-col items-center justify-center py-6">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mb-4" />
          
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {title}
          </h3>
          
          {description && (
            <p className="text-sm text-gray-600 text-center mb-4">
              {description}
            </p>
          )}

          {steps && steps.length > 0 && (
            <div className="w-full space-y-3 mt-4">
              {steps.map((step) => (
                <div key={step.id} className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    {step.status === 'completed' && (
                      <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                    {step.status === 'active' && (
                      <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                        <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                      </div>
                    )}
                    {step.status === 'failed' && (
                      <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </div>
                    )}
                    {step.status === 'pending' && (
                      <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center">
                        <div className="w-2 h-2 bg-gray-400 rounded-full" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${
                      step.status === 'completed' ? 'text-green-700' : 
                      step.status === 'active' ? 'text-blue-700' : 
                      step.status === 'failed' ? 'text-red-700' : 
                      'text-gray-500'
                    }`}>
                      {step.label}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
