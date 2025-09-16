// admin-mis-table.config.tsx - React component with Google Sheets client-side filtering
import React, { useEffect, useState, useMemo } from 'react';
import DataTableClientFiltered from './MIS-Table-ClientFiltered';
import { useGoogleSheetsMIS } from '@/hooks/useGoogleSheetsMIS';
import { ColumnConfig, TableConfig, DataSource, SaveAdapter } from './table-component.types';
import { BulkUpdateRequest } from '@/types/mis.types';
import { QuarterlySheetRecord } from '@/types/admin-mis.types';


// Extract all field paths from the MasterSheetRecord type
export type MasterSheetFieldPath = string;

export interface MasterSheetColumnConfig extends ColumnConfig {
  key: MasterSheetFieldPath;
  section: 'basic' | 'customer' | 'vehicle' | 'financial' | 'payment' | 'tracking' | 'administrative';
  tag?: 'readonly' | 'editable' | 'calculated' | 'status';
}

// Dynamic column configuration generator
export const generateDynamicColumns = (sampleData: unknown[]): MasterSheetColumnConfig[] => {
  if (!sampleData || sampleData.length === 0) {
    return [];
  }

  // Get all unique keys from ALL rows to ensure we capture all columns
  const allKeysSet = new Set<string>();
  sampleData.forEach(row => {
    if (row && typeof row === 'object') {
      Object.keys(row as Record<string, unknown>).forEach(key => allKeysSet.add(key));
    }
  });
  
  const allKeys = Array.from(allKeysSet);
  
  // Generate columns for all keys without categorization
  return allKeys.map((key) => {
    return {
      key: key,
      id: key,
      header: key.replace(/[_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), // Clean header name
      kind: 'text', // Default to text for all columns
      section: 'basic', // Default section for all columns
      tag: 'editable',
      editable: true,
      enableSorting: true,
      width: key.length > 20 ? 200 : undefined, // Wider columns for long headers
    } as MasterSheetColumnConfig;
  });
};

// Define all master sheet columns with clean configuration (Admin only)
export const masterSheetColumnConfigs: MasterSheetColumnConfig[] = [
  // ✅ Basic Policy Information
  { 
    key: 'Policy number', 
    id: 'Policy number',
    header: 'Policy Number', 
    kind: 'readonly', 
    section: 'basic', 
    tag: 'readonly',
    editable: false,
    enableSorting: true,
    formatter: (value: unknown) => `${value}`
  },
  { 
    key: "Reporting Month (mmm'yy)", 
    id: "Reporting Month (mmm'yy)",
    header: 'Reporting Month',
    kind: 'text', 
    section: 'basic', 
    tag: 'editable',
    editable: true,
    enableSorting: true
  },
  { 
    key: "Child ID/ User ID [Provided by Insure Zeal]", 
    id: "Child ID/ User ID [Provided by Insure Zeal]",
    header: 'Child ID/User ID', 
    kind: 'readonly', 
    section: 'basic', 
    tag: 'readonly',
    editable: false,
    enableSorting: true
  },
  { 
    key: "Insurer /broker code", 
    id: "Insurer /broker code",
    header: 'Insurer/Broker Code', 
    kind: 'text', 
    section: 'basic', 
    tag: 'editable',
    editable: true,
    enableSorting: true
  },
  { 
    key: "Policy Start Date", 
    id: "Policy Start Date",
    header: 'Policy Start Date', 
    kind: 'date', 
    section: 'basic', 
    tag: 'editable',
    editable: true,
    enableSorting: true
  },
  { 
    key: "Policy End Date", 
    id: "Policy End Date",
    header: 'Policy End Date', 
    kind: 'date', 
    section: 'basic', 
    tag: 'editable',
    editable: true,
    enableSorting: true
  },
  { 
    key: "Booking Date(Click to select Date)", 
    id: "Booking Date(Click to select Date)",
    header: 'Booking Date', 
    kind: 'date', 
    section: 'basic', 
    tag: 'editable',
    editable: true,
    enableSorting: true
  },
  { 
    key: 'Broker Name', 
    id: 'Broker Name',
    header: 'Broker Name', 
    kind: 'text', 
    section: 'basic', 
    tag: 'editable',
    editable: true,
    enableSorting: true
  },
  { 
    key: 'Insurer name', 
    id: 'Insurer name',
    header: 'Insurer Name', 
    kind: 'text', 
    section: 'basic', 
    tag: 'editable',
    editable: true,
    enableSorting: true
  },
  { 
    key: 'Major Categorisation( Motor/Life/ Health)', 
    id: 'Major Categorisation( Motor/Life/ Health)',
    header: 'Major Categorisation', 
    kind: 'select', 
    section: 'basic', 
    tag: 'editable',
    editable: true,
    options: [
      { value: 'Motor', label: 'Motor' },
      { value: 'Life', label: 'Life' },
      { value: 'Health', label: 'Health' }
    ]
  },
  { 
    key: "Product (Insurer Report)", 
    id: "Product (Insurer Report)",
    header: 'Product (Insurer Report)', 
    kind: 'text', 
    section: 'basic', 
    tag: 'editable',
    editable: true,
    enableSorting: true
  },
  { 
    key: 'Product Type', 
    id: 'Product Type',
    header: 'Product Type', 
    kind: 'select', 
    section: 'basic', 
    tag: 'editable',
    editable: true,
    options: [
      { value: 'Private Car', label: 'Private Car' },
      { value: 'Individual', label: 'Individual' },
      { value: 'Bike', label: 'Bike' },
      { value: 'GCV', label: 'GCV' },
      { value: 'PCV', label: 'PCV' },
      { value: 'Misc D', label: 'Misc D' }
    ]
  },
  { 
    key: "Plan type (Comp/STP/SAOD)", 
    id: "Plan type (Comp/STP/SAOD)",
    header: 'Plan Type', 
    kind: 'select', 
    section: 'basic', 
    tag: 'editable',
    editable: true,
    options: [
      { value: 'Comp', label: 'Comprehensive' },
      { value: 'STP', label: 'STP' },
      { value: 'SAOD', label: 'SAOD' }
    ]
  },
  { 
    key: 'Agent Code', 
    id: 'Agent Code',
    header: 'Agent Code', 
    kind: 'text', 
    section: 'basic', 
    tag: 'editable',
    editable: true,
    enableSorting: true
  },

  // ✅ Financial Information
  { 
    key: 'Gross premium', 
    id: 'Gross premium',
    header: 'Gross Premium', 
    kind: 'currency', 
    section: 'financial', 
    tag: 'editable',
    editable: true,
    enableSorting: true
  },
  { 
    key: "GST Amount", 
    id: "GST Amount",
    header: 'GST Amount', 
    kind: 'currency', 
    section: 'financial', 
    tag: 'editable',
    editable: true,
    enableSorting: true
  },
  { 
    key: 'Net premium', 
    id: 'Net premium',
    header: 'Net Premium', 
    kind: 'currency', 
    section: 'financial', 
    tag: 'editable',
    editable: true,
    enableSorting: true
  },
  // Adding key columns for better filtering
  { 
    key: 'Customer Name', 
    id: 'Customer Name',
    header: 'Customer Name', 
    kind: 'text', 
    section: 'customer', 
    tag: 'editable',
    editable: true,
    enableSorting: true
  },
  { 
    key: 'Customer Number', 
    id: 'Customer Number',
    header: 'Customer Phone', 
    kind: 'text', 
    section: 'customer', 
    tag: 'editable',
    editable: true,
    enableSorting: true
  },
  { 
    key: 'Registration.no', 
    id: 'Registration.no',
    header: 'Registration No.', 
    kind: 'text', 
    section: 'vehicle', 
    tag: 'editable',
    editable: true
  },
  { 
    key: 'Invoice Status', 
    id: 'Invoice Status',
    header: 'Invoice Status', 
    kind: 'select', 
    section: 'administrative', 
    tag: 'status',
    editable: true,
    options: [
      { value: 'Pending', label: 'Pending' },
      { value: 'pending payment', label: 'Pending Payment' },
      { value: 'Completed', label: 'Completed' },
      { value: 'Cancelled', label: 'Cancelled' }
    ],
    formatter: (value: unknown) => {
      const colorMap = {
        'Pending': 'bg-yellow-100 text-yellow-800',
        'pending payment': 'bg-yellow-100 text-yellow-800',
        'Completed': 'bg-green-100 text-green-800',
        'Cancelled': 'bg-red-100 text-red-800'
      };
      const colorClass = colorMap[value as keyof typeof colorMap] || 'bg-gray-100 text-gray-800';
      return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}">${value}</span>`;
    }
  },
];

// Create a wrapper component that calls the hooks (like policy form pattern)
export function MasterSheetTableWrapper() {
  // Call hooks inside the wrapper like original
  const [hasLoadedData, setHasLoadedData] = useState(false);
  const [sheetInfo, setSheetInfo] = useState<{ sheets: Array<{ properties: { title: string } }> } | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [availableSheets, setAvailableSheets] = useState<string[]>([]);
  
  // Use Google Sheets MIS hook for fetching all data
  const { 
    clientFiltering,
    fetchSheetData,
    bulkUpdateSheetData,
    getSheetInfo,
    isReady,
    loading,
    errors
  } = useGoogleSheetsMIS();

  // Load sheet info when component mounts
  useEffect(() => {
    if (isReady && !sheetInfo) {
      getSheetInfo()
        .then((info) => {
          console.log('📊 Sheet info loaded:', info);
          setSheetInfo(info);
          if (info?.sheets) {
            const sheetNames = info.sheets.map((sheet: { properties: { title: string } }) => sheet.properties.title);
            setAvailableSheets(sheetNames);
            console.log('📋 Available sheets:', sheetNames);
            
            // Helper function to identify quarter sheets
            const isQuarterSheet = (sheetName: string) => {
              const quarterPatterns = [
                /q[1-4]/i,           // Q1, Q2, Q3, Q4
                /quarter/i,          // Quarter
                /qtr/i,              // Qtr
                /\d{4}.*q[1-4]/i,    // 2024Q1, 2024-Q1, etc.
                /[1-4].*quarter/i,   // 1st Quarter, 2nd Quarter, etc.
                /jan.*mar|apr.*jun|jul.*sep|oct.*dec/i, // Month ranges for quarters
                /fy\d{2}/i,          // FY24, FY2024 (Financial Year quarters)
              ];
              return quarterPatterns.some(pattern => pattern.test(sheetName));
            };

            // Filter for quarter sheets only
            const quarterSheets = sheetNames.filter(isQuarterSheet);
            console.log('📊 Quarter sheets found:', quarterSheets);
            
            // Auto-select the first quarter sheet if none selected, otherwise first available sheet
            if (!selectedSheet && sheetNames.length > 0) {
              const sheetToSelect = quarterSheets.length > 0 ? quarterSheets[0] : sheetNames[0];
              setSelectedSheet(sheetToSelect);
              console.log('🎯 Auto-selected sheet:', sheetToSelect);
            }
          }
        })
        .catch((error) => {
          console.error('❌ Failed to fetch sheet info:', error);
        });
    }
  }, [isReady, getSheetInfo, sheetInfo, selectedSheet]);

  // Load data when component mounts or when sheet changes
  useEffect(() => {
    if (isReady && !loading.masterSheetData && selectedSheet) {
      if (!hasLoadedData) {
        // Initial load - load from the selected sheet
        setHasLoadedData(true);
        console.log(`🚀 Initial data load from sheet: ${selectedSheet}`);
        fetchSheetData(selectedSheet).catch(console.error);
      }
    }
  }, [isReady, hasLoadedData, loading.masterSheetData, selectedSheet, fetchSheetData]);

  // Handle sheet change
  const handleSheetChange = async (sheetName: string) => {
    console.log('📄 Switching to sheet:', sheetName);
    setSelectedSheet(sheetName);
    
    try {
      // Fetch data from the specific sheet
      console.log(`🔄 Loading data from sheet: ${sheetName}`);
      await fetchSheetData(sheetName);
      console.log(`✅ Successfully loaded data from sheet: ${sheetName}`);
    } catch (error) {
      console.error(`❌ Failed to load data from sheet "${sheetName}":`, error);
      // Show error to user but don't prevent sheet selection
    }
  };

  // Use client-side filtered data for Google Sheets-style filtering
  const dataSource: DataSource = {
    useList: () => ({
      data: { pages: [{ records: clientFiltering.paginatedData.data || [] }] },
      error: errors.masterSheetData ? new Error(errors.masterSheetData) : null,
      fetchNextPage: () => {},
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: loading.masterSheetData
    })
  };

  // Save adapter for bulk updates
  const saveAdapter: SaveAdapter = {
    toUpdates: (pendingUpdates: Record<string, Record<string, unknown>>) => {
      // Flatten all field updates into individual update requests
      const allUpdates: { id: string; [key: string]: unknown }[] = [];
      
      console.log('📝 Processing pending updates:', pendingUpdates);
      
      Object.entries(pendingUpdates).forEach(([recordId, changes]) => {
        Object.entries(changes as Record<string, unknown>).forEach(([fieldName, newValue]) => {
          allUpdates.push({
            id: `${recordId}_${fieldName}`,
            record_id: recordId,
            field_name: fieldName,
            new_value: String(newValue)
          });
        });
      });

      console.log('🔄 Transformed updates:', allUpdates);
      return { updates: allUpdates };
    },
    mutate: () => async (payload: unknown): Promise<{ successful_updates?: number; [key: string]: unknown }> => {
      if (!selectedSheet) {
        throw new Error('No sheet selected for updates');
      }
      
      console.log(`🔄 Saving changes to sheet: ${selectedSheet}`, payload);
      const result = await bulkUpdateSheetData(selectedSheet, payload as BulkUpdateRequest);
      
      // Convert BulkUpdateResponse to expected format
      return {
        successful_updates: result.successful_updates,
        total_updates: result.total_updates,
        failed_updates: result.failed_updates,
        message: result.message,
        results: result.results,
        processing_time_seconds: result.processing_time_seconds
      };
    }
  };

  // Generate dynamic columns from raw data (not paginated) to get all column headers
  const dynamicColumns = useMemo(() => {
    if (clientFiltering.rawData && clientFiltering.rawData.length > 0) {
      return generateDynamicColumns(clientFiltering.rawData);
    }
    return masterSheetColumnConfigs; // Fallback to static configs
  }, [clientFiltering.rawData]);

  const adminTableConfig: TableConfig<QuarterlySheetRecord> = {
    title: selectedSheet 
      ? `Master Sheet Data - ${selectedSheet}` 
      : "Master Sheet Data - Google Sheets Integration",
    className: "h-full",
    columns: dynamicColumns.map((config: MasterSheetColumnConfig) => ({
      ...config,
      accessor: (row: unknown) => {
        const record = row as QuarterlySheetRecord;
        return record[config.key as keyof QuarterlySheetRecord];
      }
    })),
    pageSize: 1000, // Load more records at once for better client-side filtering
    enableSearch: true,
    enableBulkEdit: true,
    searchPlaceholder: selectedSheet 
      ? `Search in ${selectedSheet}...` 
      : "Search policies, customers, agents, etc...",
    idAccessor: (row: QuarterlySheetRecord) => {
      const policyNumber = row['Policy number'];
      return typeof policyNumber === 'string' ? policyNumber : String(policyNumber || '');
    },
    dataSource,
    saveAdapter,
    defaultSort: [
      { id: 'Policy number', desc: false }
    ]
  };

  return (
    <div className="h-full flex flex-col bg-white">
      <DataTableClientFiltered 
        config={adminTableConfig}
        onPendingChangesCount={(count: number) => {
          console.log(`${count} pending changes`);
        }}
        clientFiltering={clientFiltering}
        availableSheets={availableSheets}
        selectedSheet={selectedSheet}
        onSheetChange={handleSheetChange}
        loading={loading.masterSheetData || loading.sheetInfo}
      />
    </div>
  );
}