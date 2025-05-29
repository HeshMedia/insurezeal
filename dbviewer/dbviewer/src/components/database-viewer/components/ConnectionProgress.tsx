'use client';

import { Progress } from '@/components/ui/progress';

interface ConnectionProgressProps {
  connectionStep: string;
  connectionProgress: number;
}

export function ConnectionProgress({ connectionStep, connectionProgress }: ConnectionProgressProps) {
  if (connectionProgress === 0) return null;
  
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span>{connectionStep}</span>
        <span>{connectionProgress}%</span>
      </div>
      <Progress value={connectionProgress} className="w-full" />
    </div>
  );
}