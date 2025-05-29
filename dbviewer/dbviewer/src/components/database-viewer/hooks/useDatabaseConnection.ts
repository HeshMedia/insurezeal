import { useState, useCallback } from 'react';
import { DatabaseInfo, ErrorResponse } from '../types/types';

export function useDatabaseConnection() {
  const [databaseUrl, setDatabaseUrl] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [databaseInfo, setDatabaseInfo] = useState<DatabaseInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [connectionProgress, setConnectionProgress] = useState(0);
  const [connectionStep, setConnectionStep] = useState('');
  const [errorInfo, setErrorInfo] = useState<ErrorResponse | null>(null);
  const [selectedTable, setSelectedTable] = useState<string>('');
  
  const simulateProgress = useCallback(() => {
    setConnectionProgress(0);
    setConnectionStep('Initializing connection...');
    
    const steps = [
      { progress: 20, step: 'Parsing connection string...' },
      { progress: 40, step: 'Attempting SSL connection...' },
      { progress: 60, step: 'Trying alternative connection methods...' },
      { progress: 80, step: 'Fetching database schema...' },
      { progress: 90, step: 'Loading table data...' },
      { progress: 100, step: 'Complete!' }
    ];

    steps.forEach((stepInfo, index) => {
      setTimeout(() => {
        setConnectionProgress(stepInfo.progress);
        setConnectionStep(stepInfo.step);
      }, (index + 1) * 1000);
    });
  }, []);

  const fetchDatabaseData = useCallback(async () => {
    if (!databaseUrl.trim()) {
      setErrorInfo({
        error: 'Please enter a PostgreSQL database URL',
        suggestion: 'Enter a connection string in the format: postgresql://username:password@host:port/database'
      });
      return;
    }

    if (!databaseUrl.includes('postgresql://') && !databaseUrl.includes('postgres://')) {
      setErrorInfo({
        error: 'Please enter a valid PostgreSQL URL (postgresql:// or postgres://)',
        suggestion: 'The URL should start with postgresql:// or postgres://'
      });
      return;
    }

    setLoading(true);
    setErrorInfo(null);
    setConnectionProgress(0);
    setConnectionStep('Starting connection...');
    
    // Start progress simulation
    simulateProgress();

    try {
      const response = await fetch('/api/database', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ databaseUrl }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrorInfo(data);
        setDatabaseInfo(null);
      } else {
        setDatabaseInfo(data);
        setErrorInfo(null);
        if (data.tables.length > 0) {
          setSelectedTable(data.tables[0].name);
        }
        setConnectionProgress(100);
        setConnectionStep('Successfully connected!');
      }
    } catch (err) {
      setErrorInfo({
        error: 'Network Error',
        details: err instanceof Error ? err.message : 'Failed to connect to the server',
        suggestion: 'Check your internet connection and try again'
      });
      setDatabaseInfo(null);
      setConnectionProgress(0);
      setConnectionStep('Connection failed');
    } finally {
      setLoading(false);
      setTimeout(() => {
        setConnectionProgress(0);
        setConnectionStep('');
      }, 3000);
    }
  }, [databaseUrl, simulateProgress]);

  const handleRefresh = useCallback(() => {
    if (databaseUrl) {
      fetchDatabaseData();
    }
  }, [databaseUrl, fetchDatabaseData]);
  
  const maskUrl = useCallback((url: string) => {
    if (!showPassword && url.includes('@')) {
      return url.replace(/:([^:@]+)@/, ':****@');
    }
    return url;
  }, [showPassword]);

  return {
    databaseUrl,
    setDatabaseUrl,
    showPassword,
    setShowPassword,
    databaseInfo,
    loading,
    connectionProgress,
    connectionStep,
    errorInfo, 
    selectedTable,
    setSelectedTable,
    fetchDatabaseData,
    handleRefresh,
    maskUrl
  };
}