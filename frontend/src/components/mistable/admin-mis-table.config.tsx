// admin-mis-table.config.tsx - React component with Google Sheets client-side filtering
import React, { useEffect, useState, useMemo } from 'react';
import DataTableClientFiltered from './MIS-Table-ClientFiltered';
import { useGoogleSheetsMIS } from '@/hooks/useGoogleSheetsMIS';

// Simple type definitions to avoid import issues
interface ColumnConfig {
  id: string;
  header: string;
  kind: 'text' | 'number' | 'date' | 'select' | 'badge' | 'readonly' | 'currency';
  accessor?: (row: any) => any;
  editable?: boolean;
  enableSorting?: boolean;
  width?: number;
  options?: { value: string; label: string }[];
  formatter?: (value: any, row?: any) => string;
  required?: boolean;
  hidden?: (row: any, allData: any[]) => boolean;
}

interface TableConfig<T> {
  title?: string;
  className?: string;
  columns: ColumnConfig[];
  pageSize?: number;
  enableSearch?: boolean;
  enableBulkEdit?: boolean;
  searchPlaceholder?: string;
  idAccessor: (row: T) => string;
  dataSource: any;
  saveAdapter: any;
  defaultSort?: any[];
}

const useBulkUpdateMasterSheet = () => ({
  mutateAsync: async (data: any) => ({ success: true })
});

// Simple MasterSheetRecord type to avoid import issues
type MasterSheetRecord = Record<string, any>;

// Extract all field paths from the MasterSheetRecord type
export type MasterSheetFieldPath = string;

export interface MasterSheetColumnConfig extends ColumnConfig {
  key: MasterSheetFieldPath;
  section: 'basic' | 'customer' | 'vehicle' | 'financial' | 'payment' | 'tracking' | 'administrative';
  tag?: 'readonly' | 'editable' | 'calculated' | 'status';
}

// Dynamic column configuration generator
export const generateDynamicColumns = (sampleData: any[]): MasterSheetColumnConfig[] => {
  if (!sampleData || sampleData.length === 0) {
    return [];
  }

  // Get all keys from the first row
  const allKeys = Object.keys(sampleData[0]);
  
  // Generate columns for all keys without categorization
  return allKeys.map((key, index) => {
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
    formatter: (value: any) => `${value}`
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
    formatter: (value: any) => {
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
export function MasterSheetTableWrapper({ userRole = 'admin' }: { userRole?: 'admin' }) {
  // Call hooks inside the wrapper like original
  const bulkUpdateMutation = useBulkUpdateMasterSheet();
  const [hasLoadedData, setHasLoadedData] = useState(false);
  
  // Use Google Sheets MIS hook for fetching all data
  const { 
    clientFiltering,
    fetchAllMasterSheetData,
    isReady,
    loading,
    errors
  } = useGoogleSheetsMIS();

  // Load all data when component mounts - only once
  useEffect(() => {
    if (isReady && !hasLoadedData && !loading.masterSheetData) {
      setHasLoadedData(true);
      fetchAllMasterSheetData().catch(console.error);
    }
  }, [isReady, hasLoadedData, loading.masterSheetData]);

  // Use client-side filtered data for Google Sheets-style filtering
  const dataSource = {
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
  const saveAdapter = {
    toUpdates: (pendingUpdates: Record<string, Record<string, unknown>>, columns: any[]) => {
      return {
        updates: Object.entries(pendingUpdates).map(([id, changes]) => ({
          id,
          ...changes
        }))
      };
    },
    mutate: () => bulkUpdateMutation.mutateAsync
  };

  // Generate dynamic columns from actual data
  const dynamicColumns = useMemo(() => {
    if (clientFiltering.paginatedData.data && clientFiltering.paginatedData.data.length > 0) {
      return generateDynamicColumns(clientFiltering.paginatedData.data);
    }
    return masterSheetColumnConfigs; // Fallback to static configs
  }, [clientFiltering.paginatedData.data]);

  const adminTableConfig: TableConfig<MasterSheetRecord> = {
    title: "Master Sheet Data - Google Sheets Integration",
    className: "h-full",
    columns: dynamicColumns.map((config: MasterSheetColumnConfig) => ({
      ...config,
      accessor: (row: MasterSheetRecord) => (row as any)[config.key]
    })),
    pageSize: 1000, // Load more records at once for better client-side filtering
    enableSearch: true,
    enableBulkEdit: true,
    searchPlaceholder: "Search policies, customers, agents, etc...",
    idAccessor: (row: MasterSheetRecord) => row['Policy number'] || '',
    dataSource,
    saveAdapter,
    defaultSort: [
      { id: 'Policy number', desc: false }
    ]
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <DataTableClientFiltered 
        config={adminTableConfig}
        onPendingChangesCount={(count: number) => {
          console.log(`${count} pending changes`);
        }}
        clientFiltering={clientFiltering}
      />
    </div>
  );
}