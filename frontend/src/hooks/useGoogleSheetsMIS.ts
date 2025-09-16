/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
import { googleSheetsMISRawDataAtom } from "@/lib/atoms/google-sheets-filter";
import { 
  googleSheetsMISDataStateAtom,
  googleSheetsMISLoadingStateAtom,
  googleSheetsMISErrorStateAtom,
  googleSheetsMISFiltersStateAtom,
  googleSheetsConnectionStateAtom,
  googleSheetsSetLoadingStateAtom,
  googleSheetsSetErrorStateAtom,
  googleSheetsSetDataStateAtom,
  googleSheetsSetConnectionStateAtom,
  getSheetDataAtom,
  setSheetDataAtom,
  googleSheetsSetFiltersStateAtom
} from "@/lib/atoms/google-sheets-mis";
import { googleSheetsMISService } from "@/lib/services/google-sheets-mis.service";
import { MasterSheetListParams, MasterSheetStats, BulkUpdateRequest } from "@/types/mis.types";
import { useAtom } from "jotai";
import { useCallback, useEffect, useState } from "react";
import { useClientSideFiltering } from "./useClientSideFiltering";

/**
 * Hook for managing Google Sheets MIS data and operations with client-side filtering
 */
export function useGoogleSheetsMIS() {
  const [dataState] = useAtom(googleSheetsMISDataStateAtom);
  const [loadingState] = useAtom(googleSheetsMISLoadingStateAtom);
  const [errorState] = useAtom(googleSheetsMISErrorStateAtom);
  const [filtersState] = useAtom(googleSheetsMISFiltersStateAtom);
  const [connectionState] = useAtom(googleSheetsConnectionStateAtom);
  const [, setRawData] = useAtom(googleSheetsMISRawDataAtom);
  
  const [, setLoading] = useAtom(googleSheetsSetLoadingStateAtom);
  const [, setError] = useAtom(googleSheetsSetErrorStateAtom);
  const [, setData] = useAtom(googleSheetsSetDataStateAtom);
  const [, setConnection] = useAtom(googleSheetsSetConnectionStateAtom);
  const [, setFiltersState] = useAtom(googleSheetsSetFiltersStateAtom);

  // State management atoms
  const [getSheetData] = useAtom(getSheetDataAtom);
  const [, setSheetData] = useAtom(setSheetDataAtom);

  // Get client-side filtering capabilities
  const clientFiltering = useClientSideFiltering();

  const service = googleSheetsMISService;

  /**
   * Test connection to Google Sheets
   */
  const testConnection = useCallback(async () => {
    setConnection({ authStatus: 'authenticating' });
    setLoading({ sheetInfo: true });
    setError({ sheetInfo: null });

    try {
      const result = await service.testConnection();
      
      if (result.success) {
        setConnection({ 
          isConnected: true, 
          authStatus: 'authenticated',
          connectionError: null 
        });
      } else {
        setConnection({ 
          isConnected: false, 
          authStatus: 'failed',
          connectionError: result.error || 'Connection failed'
        });
        setError({ sheetInfo: result.error || 'Connection failed' });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setConnection({ 
        isConnected: false, 
        authStatus: 'failed',
        connectionError: errorMessage 
      });
      setError({ sheetInfo: errorMessage });
    } finally {
      setLoading({ sheetInfo: false });
    }
  }, [setConnection, setLoading, setError, service]);

  /**
   * Fetch all master sheet data for client-side filtering with proper dimensions
   */
  const fetchAllMasterSheetData = useCallback(async () => {
    // Check if we already have data for 'all' sheets
    const existingData = getSheetData('all');
    if (existingData && existingData.data.length > 0) {
      console.log(`📋 Using existing data for all sheets: (${existingData.data.length} records)`);
      
      // Set raw data for client-side filtering
      setRawData(existingData.data);
      
      // Update legacy data state for backward compatibility
      setData({
        masterSheetRecords: existingData.data,
        totalRecords: existingData.data.length,
        totalPages: 1,
        currentPage: 1,
        pageSize: existingData.data.length,
        stats: null,
        fields: existingData.data.length > 0 ? Object.keys(existingData.data[0]) : [],
        lastUpdated: existingData.lastFetched,
        sheetName: null,
        sheetId: null
      });

      return existingData.data;
    }

    setLoading({ masterSheetData: true });
    setError({ masterSheetData: null });

    try {
      console.log('🚀 Fetching all quarterly sheet data with proper sheet dimensions...');
      
      const allRecords = await service.fetchAllQuarterlySheetData();
      
      console.log(`✅ Successfully fetched ${allRecords.length} records for client-side filtering`);
      
      // Store in state management as 'all' sheet
      setSheetData({ sheetName: 'all', data: allRecords });
      
      // Set raw data for client-side filtering
      setRawData(allRecords);
      
      // Update legacy data state for backward compatibility
      setData({
        masterSheetRecords: allRecords,
        totalRecords: allRecords.length,
        totalPages: 1,
        currentPage: 1,
        pageSize: allRecords.length,
        stats: null,
        fields: allRecords.length > 0 ? Object.keys(allRecords[0]) : [],
        lastUpdated: new Date(),
        sheetName: null,
        sheetId: null
      });

      return allRecords;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Error fetching all master sheet data:', errorMessage);
      setError({ masterSheetData: errorMessage });
      throw error;
    } finally {
      setLoading({ masterSheetData: false });
    }
  }, [setLoading, setError, setData, setRawData, service, getSheetData, setSheetData]);

  /**
   * Fetch data from a specific sheet by name
   */
  const fetchSheetData = useCallback(async (sheetName: string) => {
    // Check if we already have data for this sheet
    const existingData = getSheetData(sheetName);
    if (existingData && existingData.data.length > 0) {
      console.log(`📋 Using existing data for sheet: ${sheetName} (${existingData.data.length} records)`);
      
      // Set raw data for client-side filtering
      setRawData(existingData.data);
      
      // Update legacy data state for backward compatibility
      setData({
        masterSheetRecords: existingData.data,
        totalRecords: existingData.data.length,
        totalPages: 1,
        currentPage: 1,
        pageSize: existingData.data.length,
        stats: null,
        fields: existingData.data.length > 0 ? Object.keys(existingData.data[0]) : [],
        lastUpdated: existingData.lastFetched,
        sheetName: sheetName,
        sheetId: null
      });

      return existingData.data;
    }

    setLoading({ masterSheetData: true });
    setError({ masterSheetData: null });

    try {
      console.log(`🚀 Fetching data from sheet: ${sheetName}`);
      
      const sheetRecords = await service.fetchSheetData(sheetName);
      
      console.log(`✅ Successfully fetched ${sheetRecords.length} records from sheet "${sheetName}"`);
      
      // Store in state management
      setSheetData({ sheetName, data: sheetRecords });
      
      // Set raw data for client-side filtering
      setRawData(sheetRecords);
      
      // Update legacy data state for backward compatibility
      setData({
        masterSheetRecords: sheetRecords,
        totalRecords: sheetRecords.length,
        totalPages: 1,
        currentPage: 1,
        pageSize: sheetRecords.length,
        stats: null,
        fields: sheetRecords.length > 0 ? Object.keys(sheetRecords[0]) : [],
        lastUpdated: new Date(),
        sheetName: sheetName,
        sheetId: null
      });

      return sheetRecords;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Error fetching data from sheet "${sheetName}":`, errorMessage);
      setError({ masterSheetData: errorMessage });
      throw error;
    } finally {
      setLoading({ masterSheetData: false });
    }
  }, [setLoading, setError, setData, setRawData, service, getSheetData, setSheetData]);


  /**
   * Fetch master sheet fields (headers)
   */
  const fetchMasterSheetFields = useCallback(async () => {
    setLoading({ masterSheetFields: true });
    setError({ masterSheetFields: null });

    try {
      const fields = await service.fetchMasterSheetFields();
      setData({ fields });
      return fields;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError({ masterSheetFields: errorMessage });
      throw error;
    } finally {
      setLoading({ masterSheetFields: false });
    }
  }, [setLoading, setError, setData, service]);

  /**
   * Bulk update multiple cells in a specific sheet with optimistic updates
   */
  const bulkUpdateSheetData = useCallback(async (sheetName: string, updates: BulkUpdateRequest) => {
    setLoading({ masterSheetData: true });
    setError({ masterSheetData: null });

    // Get current raw data for optimistic updates and potential rollback
    const currentRawData = [...(clientFiltering.rawData || [])];
    
    try {
      console.log(`🔄 Starting bulk update on sheet: ${sheetName}`);
      console.log('📋 Updates payload:', updates);
      
      // Apply optimistic updates to local state immediately
      if (updates && updates.updates) {
        const updatesList = updates.updates;
        
        if (Array.isArray(updatesList)) {
          const optimisticData = [...currentRawData];
          
          // Apply each update to the local data
          updatesList.forEach(update => {
            const recordIndex = optimisticData.findIndex(record => {
              // Find record by Policy number (the main identifier)
              const recordId = record['Policy number'] || '';
              return String(recordId) === String(update.record_id);
            });
            
            if (recordIndex !== -1) {
              optimisticData[recordIndex] = {
                ...optimisticData[recordIndex],
                [update.field_name]: update.new_value
              };
            }
          });
          
          // Update the raw data immediately for optimistic UI
          setRawData(optimisticData);
          console.log('✨ Applied optimistic updates to local state');
        }
      }
      
      // Now perform the actual API call
      const response = await service.bulkUpdateSheetData(sheetName, updates);
      
      console.log(`✅ Bulk update completed: ${response.successful_updates} successful, ${response.failed_updates} failed`);
      
      // If there were failures, we might want to refresh to ensure data consistency
      // Only refresh if there were significant failures (more than 10% failed)
      const failureRate = response.total_updates > 0 ? response.failed_updates / response.total_updates : 0;
      if (failureRate > 0.1) {
        console.log('⚠️ High failure rate detected, refreshing data for consistency...');
        await fetchSheetData(sheetName);
      }

      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Error during bulk update on sheet "${sheetName}":`, errorMessage);
      setError({ masterSheetData: errorMessage });
      throw error;
    } finally {
      setLoading({ masterSheetData: false });
    }
  }, [setLoading, setError, service, fetchSheetData, clientFiltering.rawData, setRawData]);

  /**
   * Export master sheet data
   */
  const exportMasterSheet = useCallback(async () => {
    setLoading({ exporting: true });
    setError({ exporting: null });

    try {
      // TODO: Implement export functionality when service method is available
      // const blob = await service.exportMasterSheet(params);
      
      console.warn('Export functionality not yet implemented in service');
      throw new Error('Export functionality not yet implemented');
      
      // Create download link
      // const url = URL.createObjectURL(blob);
      // const link = document.createElement('a');
      // link.href = url;
      // link.download = `master-sheet-export.${params.format || 'csv'}`;
      // document.body.appendChild(link);
      // link.click();
      // document.body.removeChild(link);
      // URL.revokeObjectURL(url);
      
      // return blob;
      return null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError({ exporting: errorMessage });
      throw error;
    } finally {
      setLoading({ exporting: false });
    }
  }, [setLoading, setError, service]);

  /**
   * Get sheet information
   */
  const getSheetInfo = useCallback(async () => {
    setLoading({ sheetInfo: true });
    setError({ sheetInfo: null });

    try {
      const info = await service.getSheetInfo();
      
      // Update sheet name if available
      if (info.sheets && info.sheets.length > 0) {
        setData({ sheetName: info.sheets[0].properties.title });
      }
      
      return info;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError({ sheetInfo: errorMessage });
      throw error;
    } finally {
      setLoading({ sheetInfo: false });
    }
  }, [setLoading, setError, setData, service]);

  /**
   * Refresh all data
   */
  const refreshAllData = useCallback(async () => {
    try {
      await Promise.all([
        fetchAllMasterSheetData(),
        fetchMasterSheetFields(),
      ]);
    } catch (error) {
      console.error('Error refreshing data:', error);
      throw error;
    }
  }, [fetchAllMasterSheetData, fetchMasterSheetFields]);

  /**
   * Update filters
   */
  const updateFilters = useCallback((newFilters: Partial<MasterSheetListParams>) => {
    setFiltersState(newFilters);
  }, [setFiltersState]);

  /**
   * Clear all errors
   */
  const clearErrors = useCallback(() => {
    setError({
      masterSheetData: null,
      masterSheetStats: null,
      masterSheetFields: null,
      exporting: null,
      bulkUpdating: null,
      sheetInfo: null,
    });
  }, [setError]);

  // Auto-connect on mount if not connected
  useEffect(() => {
    if (!connectionState.isConnected && connectionState.authStatus === 'idle') {
      testConnection();
    }
  }, [connectionState.isConnected, connectionState.authStatus]);

  // Auto-refresh data based on refresh interval
  useEffect(() => {
    if (!connectionState.isConnected || !filtersState.refreshInterval) {
      return;
    }

    const interval = setInterval(() => {
      if (!loadingState.masterSheetData) {
        // Call fetchAllQuarterlySheetData without dependency to prevent infinite loops
        service.fetchAllQuarterlySheetData().then((allRecords: any) => {
          setRawData(allRecords);
          clientFiltering.loadData(allRecords);
          setData({
            masterSheetRecords: allRecords,
            totalRecords: allRecords.length,
            totalPages: 1,
            currentPage: 1,
            pageSize: allRecords.length,
            stats: null,
            fields: allRecords.length > 0 ? Object.keys(allRecords[0]) : [],
            lastUpdated: new Date(),
            sheetName: null,
            sheetId: null
          });
        }).catch((error: any) => {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          setError({ masterSheetData: errorMessage });
        });
      }
    }, filtersState.refreshInterval);

    return () => clearInterval(interval);
  }, [
    connectionState.isConnected,
    filtersState.refreshInterval,
    loadingState.masterSheetData,
  ]);

  return {
    // State
    data: dataState,
    loading: loadingState,
    errors: errorState,
    filters: filtersState,
    connection: connectionState,
    
    // Client-side filtering capabilities
    clientFiltering,
    
    // Actions
    testConnection,
    fetchAllMasterSheetData,
    fetchSheetData,
    bulkUpdateSheetData,
    fetchMasterSheetFields,
    exportMasterSheet,
    getSheetInfo,
    refreshAllData,
    updateFilters,
    clearErrors,
    
    // Computed values
    isReady: connectionState.isConnected && connectionState.authStatus === 'authenticated',
    hasData: dataState.masterSheetRecords.length > 0,
    isLoading: Object.values(loadingState).some(Boolean),
    hasErrors: Object.values(errorState).some(Boolean),
  };
}

/**
 * Hook for managing pending updates (if needed for bulk updates later)
 */
export function useGoogleSheetsPendingUpdates() {
  // This can be implemented later when bulk update functionality is needed
  // For now, just return empty implementation
  return {
    pendingUpdates: {},
    addUpdate: () => {},
    removeUpdate: () => {},
    clearAll: () => {},
    hasPending: false,
    count: 0,
  };
}

/**
 * Hook for managing Balance Sheet / Summary Statistics data
 */
export function useBalanceSheetStats() {
  const [data, setData] = useState<MasterSheetStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const service = googleSheetsMISService;

  /**
   * Fetch balance sheet statistics
   */
  const fetchBalanceSheetStats = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await service.fetchBalanceSheetStats();
      setData(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch balance sheet data';
      setError(errorMessage);
      console.error('Balance sheet fetch error:', error);
    } finally {
      setLoading(false);
    }
  }, [service]);

  /**
   * Refresh data
   */
  const refresh = useCallback(() => {
    fetchBalanceSheetStats();
  }, [fetchBalanceSheetStats]);

  return {
    data,
    loading,
    error,
    fetchBalanceSheetStats,
    refresh,
    isReady: data !== null && !loading,
  };
}