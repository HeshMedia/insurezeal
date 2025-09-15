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
  googleSheetsSetConnectionStateAtom
} from "@/lib/atoms/google-sheets-mis";
import { googleSheetsMISService } from "@/lib/services/google-sheets-mis.service";
import { MasterSheetExportParams, MasterSheetListParams } from "@/types/mis.types";
import { useAtom } from "jotai";
import { useCallback, useEffect } from "react";
import { useClientSideFiltering } from "./useClientSideFiltering";

/**
 * Hook for managing Google Sheets MIS data and operations with client-side filtering
 */
export function useGoogleSheetsMIS() {
  const [dataState, setDataState] = useAtom(googleSheetsMISDataStateAtom);
  const [loadingState, setLoadingState] = useAtom(googleSheetsMISLoadingStateAtom);
  const [errorState, setErrorState] = useAtom(googleSheetsMISErrorStateAtom);
  const [filtersState, setFiltersState] = useAtom(googleSheetsMISFiltersStateAtom);
  const [connectionState, setConnectionState] = useAtom(googleSheetsConnectionStateAtom);
  const [, setRawData] = useAtom(googleSheetsMISRawDataAtom);
  
  const [, setLoading] = useAtom(googleSheetsSetLoadingStateAtom);
  const [, setError] = useAtom(googleSheetsSetErrorStateAtom);
  const [, setData] = useAtom(googleSheetsSetDataStateAtom);
  const [, setConnection] = useAtom(googleSheetsSetConnectionStateAtom);

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
    setLoading({ masterSheetData: true });
    setError({ masterSheetData: null });

    try {
      console.log('🚀 Fetching all quarterly sheet data with proper sheet dimensions...');
      
      const allRecords = await service.fetchAllQuarterlySheetData();
      
      console.log(`✅ Successfully fetched ${allRecords.length} records for client-side filtering`);
      
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
  }, [setLoading, setError, setData, setRawData, service]);

  /**
   * Fetch master sheet statistics
   */
  const fetchMasterSheetStats = useCallback(async () => {
    setLoading({ masterSheetStats: true });
    setError({ masterSheetStats: null });

    try {
      // Stats are calculated within fetchMasterSheetData, so just return empty stats for now
      console.log('Stats not implemented as separate method');
      setData({ stats: { total_records: 0, total_policies: 0, total_cutpay_transactions: 0, total_gross_premium: 0, total_net_premium: 0, total_cutpay_amount: 0, top_agents: [], top_insurers: [], monthly_summary: [] } });
      return {};
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError({ masterSheetStats: errorMessage });
      throw error;
    } finally {
      setLoading({ masterSheetStats: false });
    }
  }, [setLoading, setError, setData, service]);

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
   * Export master sheet data
   */
  const exportMasterSheet = useCallback(async (params: MasterSheetExportParams) => {
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
        fetchMasterSheetStats(),
        fetchMasterSheetFields(),
      ]);
    } catch (error) {
      console.error('Error refreshing data:', error);
      throw error;
    }
  }, [fetchAllMasterSheetData, fetchMasterSheetStats, fetchMasterSheetFields]);

  /**
   * Update filters
   */
  const updateFilters = useCallback((newFilters: Partial<MasterSheetListParams>) => {
    setFiltersState(prev => ({ ...prev, ...newFilters }));
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
    fetchMasterSheetStats,
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