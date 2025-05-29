import { useState, useCallback } from 'react';

export function useCopyToClipboard() {
  const [copiedItem, setCopiedItem] = useState<number | null>(null);
  
  const copyToClipboard = useCallback(async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedItem(index);
      setTimeout(() => setCopiedItem(null), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  }, []);
  
  return { copiedItem, copyToClipboard };
}