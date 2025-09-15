// components/mistable/MIS-Table-ClientFiltered.tsx - Google Sheets Client-Side Filtering
"use client";

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
  type ColumnDef
} from '@tanstack/react-table';
import { useAtom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import { Button } from '@/components/ui/button';
import { FilterableColumnHeader, GlobalSearchBar, FilterSummary } from './FilterableColumnHeader';
import { useGoogleSheetsMIS } from '@/hooks/useGoogleSheetsMIS';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { 
  Database, 
  Save, 
  RotateCcw 
} from 'lucide-react';
import { 
  Table, 
  TableHeader, 
  TableBody, 
  TableHead, 
  TableRow, 
  TableCell 
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { GenericEditableCell } from './editable-cell';
import { MasterSheetRecord } from '@/types/mis.types';

// Types for DataTable configuration
interface DataTableProps<T> {
  config: {
    title?: string;
    className?: string;
    columns: any[];
    pageSize?: number;
    enableSearch?: boolean;
    enableBulkEdit?: boolean;
    searchPlaceholder?: string;
    idAccessor: (row: T) => string;
    dataSource: any;
    saveAdapter: any;
    defaultSort?: any[];
  };
  onPendingChangesCount?: (count: number) => void;
  clientFiltering?: any; // Accept client filtering from parent
}

// Generic pending updates atom factory
const createPendingUpdatesAtom = (key: string) => 
  atomWithStorage<Record<string, Record<string, unknown>>>(`pendingUpdates_${key}`, {});

function DataTableClientFiltered<T>({ config, onPendingChangesCount, clientFiltering: propClientFiltering }: DataTableProps<T>) {
  // State management
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; columnId: string } | null>(null);
  
  // Create unique atom key
  const atomKey = config.title?.replace(/\s+/g, '_').toLowerCase() || 
    config.columns.map(c => c.id).join('-').substring(0, 50);
  const pendingUpdatesAtom = useMemo(() => createPendingUpdatesAtom(atomKey), [atomKey]);
  const [pendingUpdates, setPendingUpdates] = useAtom(pendingUpdatesAtom);
  
  // Use the client filtering passed from parent or fallback to hook
  const {
    clientFiltering: hookClientFiltering,
    fetchAllMasterSheetData, 
    loading, 
    errors,
    isReady 
  } = useGoogleSheetsMIS();
  
  const clientFiltering = propClientFiltering || hookClientFiltering;

  // Load all data on component mount only if no prop client filtering is provided
  useEffect(() => {
    if (isReady && !propClientFiltering) {
      fetchAllMasterSheetData().catch(console.error);
    }
  }, [isReady, fetchAllMasterSheetData, propClientFiltering]);

  // Get filtered and sorted data from client-side filtering
  const {
    filteredData,
    paginatedData,
    filteredStats,
    filters,
    handleGlobalSearch,
    handleSort,
    handleColumnFilter,
    getColumnUniqueValues,
    getColumnFilter,
    handleClearAllFilters,
    isFiltered,
    totalRecords,
    filteredRecords
  } = clientFiltering;

  // Helper to create filterable header
  const createFilterableHeader = (title: string, columnId: string) => {
    const FilterableHeader = () => (
      <FilterableColumnHeader
        title={title}
        columnId={columnId}
        onSort={(colId, direction) => handleSort(colId as keyof MasterSheetRecord)}
        onFilter={(colId, filter) => {
          console.log('🔍 Filter applied:', { columnId: colId, filter });
          
          if (!filter) {
            // Clear filter
            handleColumnFilter(colId as keyof MasterSheetRecord, new Set(), false);
          } else {
            switch (filter.type) {
              case 'values':
                const stringValues = (filter.values || []).map((v: any) => String(v));
                const valueSet = new Set<string>(stringValues);
                handleColumnFilter(colId as keyof MasterSheetRecord, valueSet, true);
                break;
              case 'search':
                // Use column search functionality
                if (clientFiltering.handleColumnSearch) {
                  clientFiltering.handleColumnSearch(colId as keyof MasterSheetRecord, filter.search);
                }
                break;
              case 'date_range':
                if (clientFiltering.handleDateRangeFilter) {
                  clientFiltering.handleDateRangeFilter(colId, filter.dateRange.start, filter.dateRange.end);
                }
                break;
              case 'number_range':
                if (clientFiltering.handleNumberRangeFilter) {
                  clientFiltering.handleNumberRangeFilter(colId, filter.numberRange.min, filter.numberRange.max);
                }
                break;
            }
          }
        }}
        getUniqueValues={() => getColumnUniqueValues(columnId as keyof MasterSheetRecord)}
        currentSort={null}
        currentFilter={getColumnFilter ? getColumnFilter(columnId as keyof MasterSheetRecord) : null}
      />
    );
    FilterableHeader.displayName = `FilterableHeader-${title}`;
    return FilterableHeader;
  };
  
  // Column definitions using TanStack Table
  const columnHelper = createColumnHelper<T>();
  const columns = useMemo(() => 
    config.columns
      .filter(colConfig => {
        // Apply conditional hiding
        if (colConfig.hidden) {
          return !colConfig.hidden(filteredData[0], filteredData);
        }
        return true;
      })
      .map((colConfig): ColumnDef<T, any> => 
        columnHelper.accessor(
          // Use column ID directly as field accessor
          colConfig.accessor || ((row: T) => (row as any)[colConfig.id]),
          {
            id: colConfig.id,
            header: createFilterableHeader(colConfig.header, colConfig.id),
            enableSorting: true,
            size: colConfig.width,
            cell: (cellContext) => {
              if (colConfig.editable && config.enableBulkEdit) {
                return <GenericEditableCell {...cellContext} columnConfig={colConfig} />;
              }
              
              // Read-only cell
              const value = cellContext.getValue();
              if (colConfig.formatter) {
                return (
                  <div className="px-4 py-2">
                    {colConfig.formatter(value, cellContext.row.original)}
                  </div>
                );
              }
              
              // Default rendering based on kind
              const renderValue = () => {
                if (value === null || value === undefined || value === '') {
                  return <span className="text-gray-400">N/A</span>;
                }
                
                switch (colConfig.kind) {
                  case 'currency':
                    return `₹${Number(value).toLocaleString()}`;
                  case 'badge':
                    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">{value}</span>;
                  case 'number':
                    return typeof value === 'number' ? value.toLocaleString() : value;
                  case 'date':
                    return new Date(value).toLocaleDateString();
                  default:
                    return String(value);
                }
              };
              
              return (
                <div className="px-4 py-2 font-medium text-gray-900">
                  {renderValue()}
                </div>
              );
            }
          }
        )
      ), [config.columns, config.enableBulkEdit, filteredData]);
  
  // Cell update function
  const updateDataById = useCallback((recordId: string, fieldId: string, value: unknown) => {
    setPendingUpdates(prev => ({
      ...prev,
      [recordId]: {
        ...prev[recordId],
        [fieldId]: String(value)
      }
    }));
  }, [setPendingUpdates]);
  
  const table = useReactTable({
    data: paginatedData.data as T[],
    columns,
    getCoreRowModel: getCoreRowModel(),
    enableSortingRemoval: false,
    meta: {
      updateDataById,
      editingCell,
      setEditingCell,
      pendingUpdates: pendingUpdates as any,
      idAccessor: config.idAccessor
    } as any
  });
  
  // Bulk save functionality
  const handleSaveChanges = useCallback(async () => {
    if (Object.keys(pendingUpdates).length === 0) {
      toast.info("No changes to save.");
      return;
    }

    const promise = (async () => {
      const payload = config.saveAdapter.toUpdates(pendingUpdates, config.columns);
      const mutateFn = config.saveAdapter.mutate();
      const result = await mutateFn(payload);
      setPendingUpdates({});
      return result;
    })();

    toast.promise(promise, {
      loading: 'Saving changes...',
      success: (res) => `${res.successful_updates || 'Changes'} saved successfully!`,
      error: (err) => `Failed to save: ${err.message}`,
    });
  }, [pendingUpdates, config.saveAdapter, config.columns, setPendingUpdates]);

  const handleClearChanges = useCallback(() => {
    setPendingUpdates({});
    toast.success("All pending changes cleared");
  }, [setPendingUpdates]);

  const pendingChangesCount = Object.keys(pendingUpdates).length;

  useEffect(() => {
    onPendingChangesCount?.(pendingChangesCount);
  }, [pendingChangesCount, onPendingChangesCount]);

  // Loading state
  if (loading.masterSheetData) {
    return (
      <div className="space-y-6 p-8 bg-gradient-to-br from-slate-50 to-blue-50 rounded-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg animate-pulse"></div>
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={`loading-skeleton-${i}`} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (errors.masterSheetData) {
    return (
      <div className="flex items-center justify-center min-h-[400px] bg-gradient-to-br from-red-50 to-orange-50 rounded-2xl">
        <div className="text-center p-8 bg-white rounded-xl shadow-lg border border-red-100">
          <div className="text-red-600 text-xl font-bold mb-2">⚠️ Error Loading Data</div>
          <div className="text-red-500 text-sm">{errors.masterSheetData}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "h-full flex flex-col bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 rounded-2xl shadow-2xl border border-white/20 backdrop-blur-sm",
      config.className
    )}>
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-lg border-b border-gray-200/50 rounded-t-2xl">
        <div className="px-8 py-6">
          <div className="flex items-center justify-between">
            {/* Left Section */}
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl shadow-lg">
                <Database className="h-6 w-6 text-white" />
              </div>
              <div>
                {config.title && (
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                    {config.title}
                  </h1>
                )}
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-sm text-gray-600 font-medium">
                    {totalRecords} records • {filteredRecords} filtered
                  </span>
                  {pendingChangesCount > 0 && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-amber-400 to-orange-400 rounded-full shadow-md">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                      <span className="text-white text-sm font-semibold">
                        {pendingChangesCount} pending changes
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Action Buttons */}
            {config.enableBulkEdit && (
              <div className="flex items-center gap-4">
                {pendingChangesCount > 0 && (
                  <Button
                    variant="outline"
                    onClick={handleClearChanges}
                    className="bg-white/50 border-gray-300 hover:bg-red-50 hover:border-red-300 hover:text-red-600 transition-all duration-200 shadow-md"
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Clear Changes
                  </Button>
                )}
                
                <Button
                  onClick={handleSaveChanges}
                  disabled={pendingChangesCount === 0}
                  size="lg"
                  className={cn(
                    "font-bold px-8 py-3 rounded-xl shadow-xl transition-all duration-300 transform",
                    pendingChangesCount > 0
                      ? "bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-green-200 hover:scale-105 ring-4 ring-green-200"
                      : "bg-gradient-to-r from-gray-300 to-gray-400 text-gray-600 cursor-not-allowed"
                  )}
                >
                  <Save className="mr-3 h-5 w-5" />
                  Save All Changes
                  {pendingChangesCount > 0 && (
                    <span className="ml-2 px-2 py-1 bg-white/20 rounded-full text-sm">
                      {pendingChangesCount}
                    </span>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Search and Filter Controls */}
      <div className="bg-gradient-to-r from-white via-blue-50 to-indigo-50 border-b border-gray-200/50">
        <div className="px-8 py-6">
          <div className="flex items-center justify-between gap-4">
            <GlobalSearchBar
              value={filters.globalSearch || ''}
              onChange={handleGlobalSearch}
              placeholder={config.searchPlaceholder || "Search across all fields..."}
            />
            
            {isFiltered && (
              <div className="flex items-center gap-4">
                <FilterSummary 
                  stats={{
                    totalRecords,
                    totalFilteredRecords: filteredRecords,
                    activeFilters: Object.keys(filters.columnFilters).length + (filters.globalSearch ? 1 : 0)
                  }}
                  onClearAll={handleClearAllFilters}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 relative overflow-auto scrollbar-thin scrollbar-thumb-blue-400 scrollbar-track-blue-100">
        <div className="min-w-max">
          <Table className="w-full bg-white border-collapse">
            <TableHeader className="sticky top-0 z-10">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={`header-group-${headerGroup.id}`} className="border-b-2 border-gray-300">
                  {headerGroup.headers.map((header) => (
                    <TableHead 
                      key={`header-${header.id}`} 
                      className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider whitespace-nowrap bg-gray-50 border-r border-gray-300 last:border-r-0"
                      style={{ width: header.getSize() }}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody className="bg-white">
              {table.getRowModel().rows.map((row, index) => (
                <TableRow 
                  key={`${config.idAccessor(row.original)}-${index}`} 
                  className={cn(
                    "transition-colors duration-200 border-b border-gray-200 hover:bg-blue-50",
                    index % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell 
                      key={`cell-${cell.id}-${config.idAccessor(row.original)}`} 
                      className="p-0 whitespace-nowrap text-sm text-slate-800 border-r border-gray-200 last:border-r-0"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {/* Results summary */}
          <div className="h-16 flex justify-center items-center bg-white border-t-2 border-gray-300">
            <div className="flex items-center gap-2 bg-green-50 px-6 py-3 rounded-lg border border-green-200">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm font-medium text-slate-700">
                Showing {paginatedData.data.length} of {filteredRecords} records
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DataTableClientFiltered;