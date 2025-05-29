'use client';

import * as React from 'react';
import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from 'next-themes';

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  const [mounted, setMounted] = React.useState(false);
  
  // Only show the UI once mounted on the client to prevent hydration mismatch
  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Return a placeholder with the same structure during SSR
    return <div style={{ visibility: 'hidden' }}>{children}</div>;
  }
  
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}