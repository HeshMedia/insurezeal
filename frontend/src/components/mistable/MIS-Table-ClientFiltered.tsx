/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
// components/mistable/MIS-Table-ClientFiltered.tsx - Google Sheets Client-Side Filtering

"use client";

import { QuarterSheetSelect } from './QuarterSelector';
import { exportRowsToCsv, exportRowsToXlsx } from '@/lib/utils/export-file';
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
  type ColumnDef,
  type CellContext
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
  RotateCcw,
  FilterX,
  FileSpreadsheet,
  Maximize2,
  Minimize2,
  BarChart3,
  Table as TableIcon
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
import { BalanceSheet } from './BalanceSheet';
import { 
  multiSelectStateAtom,
  SelectedCell
} from '@/lib/atoms/google-sheets-mis';
import { 
  DataTableProps 
} from './table-component.types';

// Generic pending updates atom factory
const createPendingUpdatesAtom = (key: string) => 
  atomWithStorage<Record<string, Record<string, unknown>>>(`pendingUpdates_${key}`, {});

function DataTableClientFiltered<T>({ 
  config, 
  onPendingChangesCount, 
  clientFiltering: propClientFiltering,
  availableSheets = [],
  selectedSheet,
  onSheetChange,
  loading: externalLoading
}: DataTableProps<T> & { loading?: boolean }) {
  // State management
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; columnId: string } | null>(null);
  const [multiSelectState, setMultiSelectState] = useAtom(multiSelectStateAtom);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showBalanceSheet, setShowBalanceSheet] = useState(false);
  
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
    filteredData = [],
    paginatedData = { data: [], totalRecords: 0, totalPages: 0, currentPage: 1, pageSize: 50 },
    filters = { columnFilters: {} },
    handleGlobalSearch = () => {},
    handleSort = () => {},
    handleColumnFilter = () => {},
    getColumnUniqueValues = () => [],
    getColumnFilter = () => null,
    handleClearAllFilters = () => {},
    isFiltered = false,
    totalRecords = 0,
    filteredRecords = 0
  } = clientFiltering || {};

  
  // Helper to create filterable header
  const createFilterableHeader = (title: string, columnId: string) => {
    const FilterableHeader = () => (
      <FilterableColumnHeader
        title={title}
        columnId={columnId}
        onSort={(colId) => handleSort(colId as never)}
        onFilter={(colId, filter) => {
          console.log('🔍 Filter applied:', { columnId: colId, filter });
          
          if (!filter) {
            // Clear filter
            handleColumnFilter(colId as never, new Set(), false);
          } else {
            switch (filter.type) {
              case 'values':
                const stringValues = (filter.values || []).map((v: unknown) => String(v));
                const valueSet = new Set<string>(stringValues);
                handleColumnFilter(colId as never, valueSet, true);
                break;
              case 'search':
                // Use column search functionality
                if (clientFiltering?.handleColumnSearch && filter.search) {
                  clientFiltering.handleColumnSearch(colId as never, filter.search);
                }
                break;
              case 'date_range':
                if (clientFiltering?.handleDateRangeFilter && filter.dateRange?.start && filter.dateRange?.end) {
                  // Type assertion to bypass the intersection type issue
                  (clientFiltering.handleDateRangeFilter as (colId: string, start: Date, end: Date) => void)(
                    colId, 
                    new Date(filter.dateRange.start), 
                    new Date(filter.dateRange.end)
                  );
                }
                break;
              case 'number_range':
                if (clientFiltering?.handleNumberRangeFilter && filter.numberRange?.min !== undefined && filter.numberRange?.max !== undefined) {
                  clientFiltering.handleNumberRangeFilter(colId, filter.numberRange.min, filter.numberRange.max);
                }
                break;
            }
          }
        }}
        getUniqueValues={() => getColumnUniqueValues(columnId as never)}
        currentSort={null}
        currentFilter={getColumnFilter ? (() => {
          const filter = getColumnFilter(columnId as never);
          if (filter instanceof Set && filter.size > 0) {
            return { type: 'values' as const, values: Array.from(filter) };
          }
          return undefined;
        })() : undefined}
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
            cell: (cellContext: CellContext<T, unknown>) => {
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
                
                const safeValue = String(value);
                
                switch (colConfig.kind) {
                  case 'currency':
                    const numValue = Number(value);
                    return `₹${isNaN(numValue) ? safeValue : numValue.toLocaleString()}`;
                  case 'badge':
                    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">{safeValue}</span>;
                  case 'number':
                    const num = Number(value);
                    return isNaN(num) ? safeValue : num.toLocaleString();
                  case 'date':
                    const date = new Date(safeValue);
                    return isNaN(date.getTime()) ? safeValue : date.toLocaleDateString();
                  default:
                    return safeValue;
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
    data: filteredData as T[], // Use filteredData instead of paginatedData to show all records
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
  
  // Debug: Log column information
  console.log(`🎯 Table rendering with ${columns.length} columns`, {
    configColumnsLength: config.columns.length,
    actualColumnsLength: columns.length,
    tableColumnsLength: table.getAllColumns().length,
    visibleColumnsLength: table.getVisibleLeafColumns().length,
    dataLength: filteredData.length,
    usingData: 'filteredData (all records)'
  });
  
  // Bulk save functionality
  const handleSaveChanges = useCallback(async () => {
    if (Object.keys(pendingUpdates).length === 0) {
      toast.info("No changes to save.");
      return;
    }

    const promise = (async () => {
      const payload = config.saveAdapter.toUpdates(pendingUpdates);
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

const computeExportRows = useCallback(() => {
  // Choose dataset for export:
  // Option A: export filtered view
  const dataset = filteredData as any[];

  // Optional: map/omit columns based on config.columns visibility
  const visibleIds = table.getVisibleLeafColumns().map((c) => c.id);
  const rows = dataset.map((row) => {
    const out: Record<string, any> = {};
    visibleIds.forEach((id) => {
      out[id] = (row as any)[id];
    });
    return out;
  });
  return rows;
}, [filteredData, table]);

const handleExportCSV = useCallback(() => {
  const rows = computeExportRows();
  // Optional: custom headers order from visibleIds
  const headers = table.getVisibleLeafColumns().map((c) => c.id);
  exportRowsToCsv(rows, `${config.title || 'export'}.csv`, headers);
}, [computeExportRows, table, config.title]);

const handleExportXLSX = useCallback(() => {
  const rows = computeExportRows();
  exportRowsToXlsx(rows, `${config.title || 'export'}.xlsx`, (config.title || 'Sheet'));
}, [computeExportRows, config.title]);

const handleToggleFullscreen = useCallback(() => {
  setIsFullscreen(prev => !prev);
}, []);

const handleToggleBalanceSheet = useCallback(() => {
  setShowBalanceSheet(prev => !prev);
}, []);

  
  // Keyboard navigation for cell selection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Handle Escape key for fullscreen mode
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
        return;
      }

      // Only handle if no input/textarea is focused and cells are selected
      const activeElement = document.activeElement;
      const isInputFocused = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA';
      
      if (isInputFocused || multiSelectState.selectedCells.length === 0) return;

      const currentSelection = multiSelectState.selectedCells;
      if (currentSelection.length === 0) return;

      // Get the current active cell (last selected)
      const activeCell = currentSelection[currentSelection.length - 1];
      const allRows = table.getRowModel().rows;
      const allColumns = table.getAllColumns();
      
      let newRowIndex = activeCell.rowIndex;
      let newColIndex = activeCell.columnIndex;
      
      // Handle arrow key navigation
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          newRowIndex = Math.max(0, activeCell.rowIndex - 1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          newRowIndex = Math.min(allRows.length - 1, activeCell.rowIndex + 1);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          newColIndex = Math.max(0, activeCell.columnIndex - 1);
          break;
        case 'ArrowRight':
          e.preventDefault();
          newColIndex = Math.min(allColumns.length - 1, activeCell.columnIndex + 1);
          break;
        case 'Escape':
          e.preventDefault();
          // Clear selection on Escape
          setMultiSelectState(prev => ({ ...prev, selectedCells: [] }));
          return;
        default:
          // Handle typing on selected cells (printable characters)
          if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            // Start editing the active cell and apply to all selected cells
            const targetRow = allRows[activeCell.rowIndex];
            const targetColumn = allColumns[activeCell.columnIndex];
            if (targetRow && targetColumn) {
              setEditingCell({ rowIndex: activeCell.rowIndex, columnId: targetColumn.id });
              
              // Apply the typed character to all selected cells
              setTimeout(() => {
                currentSelection.forEach(cell => {
                  updateDataById(cell.recordId, cell.fieldName, e.key);
                });
              }, 0);
            }
          }
          return;
      }

      // Create new cell data for the target position
      const targetRow = allRows[newRowIndex];
      const targetColumn = allColumns[newColIndex];
      
      if (targetRow && targetColumn) {
        const targetRecordId = config.idAccessor(targetRow.original);
        const targetValue = (targetRow.original as any)[targetColumn.id];
        const newCellData = {
          recordId: targetRecordId,
          fieldName: targetColumn.id,
          rowIndex: newRowIndex,
          columnIndex: newColIndex,
          currentValue: String(targetValue || '')
        };

        if (e.shiftKey) {
          // Shift+Arrow: Extend selection
          if (multiSelectState.selectionStart) {
            const start = multiSelectState.selectionStart;
            const end = newCellData;
            
            const startRow = Math.min(start.rowIndex, end.rowIndex);
            const endRow = Math.max(start.rowIndex, end.rowIndex);
            const startCol = Math.min(start.columnIndex, end.columnIndex);
            const endCol = Math.max(start.columnIndex, end.columnIndex);
            
            const rangeSelection: SelectedCell[] = [];
            
            for (let rowIdx = startRow; rowIdx <= endRow; rowIdx++) {
              for (let colIdx = startCol; colIdx <= endCol; colIdx++) {
                const row = allRows[rowIdx];
                const column = allColumns[colIdx];
                if (row && column) {
                  const recordId = config.idAccessor(row.original);
                  const value = (row.original as any)[column.id];
                  rangeSelection.push({
                    recordId,
                    fieldName: column.id,
                    rowIndex: rowIdx,
                    columnIndex: colIdx,
                    currentValue: String(value || '')
                  });
                }
              }
            }
            
            setMultiSelectState(prev => ({
              ...prev,
              selectedCells: rangeSelection
            }));
          }
        } else {
          // Arrow without Shift: Move selection
          setMultiSelectState(prev => ({
            ...prev,
            selectedCells: [newCellData],
            selectionStart: newCellData
          }));
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [multiSelectState, table, config.idAccessor, setMultiSelectState, setEditingCell, updateDataById, isFullscreen, setIsFullscreen]);

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
      "h-full flex flex-col bg-white rounded-lg shadow-sm border border-gray-200",
      (multiSelectState.isSelecting || multiSelectState.isDragFilling) && "select-none", // Prevent text selection during drag
      isFullscreen && "fixed inset-0 z-50 rounded-none border-0 shadow-none",
      config.className
    )}>
    {/* Header */}
<div className="bg-white border-b border-gray-200">
  {/* Toggle Button - Fixed Position */}
  <div className="px-6 py-3 border-b border-gray-100 bg-gray-50">
    <div className="flex justify-center">
      <div className="inline-flex items-center bg-white rounded-lg p-1 shadow-sm border border-gray-200">
        <Button
          variant={!showBalanceSheet ? "default" : "ghost"}
          onClick={() => !showBalanceSheet || handleToggleBalanceSheet()}
          className={cn(
            "h-8 px-3 text-sm font-medium rounded-md transition-all",
            !showBalanceSheet ? "bg-blue-600 text-white shadow-sm" : "text-gray-600 hover:text-gray-900"
          )}
        >
          <TableIcon className="mr-2 h-4 w-4" />
          MIS Table
        </Button>
        <Button
          variant={showBalanceSheet ? "default" : "ghost"}
          onClick={() => showBalanceSheet || handleToggleBalanceSheet()}
          className={cn(
            "h-8 px-3 text-sm font-medium rounded-md transition-all",
            showBalanceSheet ? "bg-blue-600 text-white shadow-sm" : "text-gray-600 hover:text-gray-900"
          )}
        >
          <BarChart3 className="mr-2 h-4 w-4" />
          Balance Sheet
        </Button>
      </div>
    </div>
  </div>

  <div className="px-6 py-3">
    <div className="flex items-center justify-between gap-4 flex-wrap">
      {/* Left cluster: title + meta */}
      {!showBalanceSheet && (
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-blue-100 rounded-lg shrink-0">
            <Database className="h-5 w-5 text-blue-600" />
          </div>
          <div className="min-w-0">
            {config.title && (
              <h1 className="text-base font-semibold text-gray-900 truncate">
                {config.title}
              </h1>
            )}
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-xs text-gray-500">
                {totalRecords} records • {filteredRecords} filtered
              </span>
              {pendingChangesCount > 0 && (
                <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-100 rounded-md">
                  <div className="w-1.5 h-1.5 bg-amber-500 rounded-full"></div>
                  <span className="text-amber-700 text-xs font-medium">
                    {pendingChangesCount} pending
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Middle cluster: quarter dropdown + export buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        {!showBalanceSheet && availableSheets && availableSheets.length > 0 && (
          <QuarterSheetSelect
            availableSheets={availableSheets}
            selectedSheet={selectedSheet}
            onSheetChange={onSheetChange}
            loading={externalLoading || loading.masterSheetData}
            className="h-9"
          />
        )}

        {!showBalanceSheet && (
          <>
            <Button
              variant="secondary"
              onClick={handleExportCSV}
              className="h-9 px-3 text-sm font-medium"
              title="Export all filtered rows to CSV"
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Export CSV
            </Button>

            <Button
              variant="secondary"
              onClick={handleExportXLSX}
              className="h-9 px-3 text-sm font-medium"
              title="Export all filtered rows to Excel (.xlsx)"
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Export Excel
            </Button>
          </>
        )}
      </div>

      {/* Right cluster: actions */}
      {!showBalanceSheet && (
        <div className="flex items-center gap-2">
          {isFiltered && (
            <Button
              variant="ghost"
              onClick={handleClearAllFilters}
              className="h-9 px-3 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100"
            >
              <FilterX className="mr-2 h-4 w-4" />
              Clear Filters
            </Button>
          )}

          {config.enableBulkEdit && (
            <>
              {pendingChangesCount > 0 && (
                <Button
                  variant="ghost"
                  onClick={handleClearChanges}
                  className="h-9 px-3 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Clear Changes
                </Button>
              )}

              <Button
                onClick={handleSaveChanges}
                disabled={pendingChangesCount === 0}
                variant={pendingChangesCount > 0 ? "default" : "secondary"}
                className={cn(
                  "h-9 px-4 text-sm font-medium transition-colors",
                  pendingChangesCount > 0
                    ? "bg-blue-600 hover:bg-blue-700 text-white"
                    : "bg-gray-200 text-gray-500 cursor-not-allowed"
                )}
              >
                <Save className="mr-2 h-4 w-4" />
                Save Changes
                {pendingChangesCount > 0 && (
                  <span className="ml-2 bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                    {pendingChangesCount}
                  </span>
                )}
              </Button>
            </>
          )}

          <Button
            variant="ghost"
            onClick={handleToggleFullscreen}
            className="h-9 px-3 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100"
            title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      )}
    </div>
  </div>
</div>

{/* Search and Filter Controls */}
{!showBalanceSheet && (
  <div className="bg-gray-50 border-b border-gray-200">
    <div className="px-6 py-2.5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Compact search bar */}
        <div className="flex-1 min-w-[220px] max-w-[520px]">
          <GlobalSearchBar
            value={filters.globalSearch || ""}
            onChange={handleGlobalSearch}
            placeholder={config.searchPlaceholder || "Search across all fields..."}
          />
        </div>

        {isFiltered && (
          <FilterSummary
            stats={{
              totalRecords,
              totalFilteredRecords: filteredRecords,
              activeFilters:
                Object.keys(filters.columnFilters).length +
                (filters.globalSearch ? 1 : 0),
            }}
            onClearAll={handleClearAllFilters}
          />
        )}
      </div>
    </div>
  </div>
)}


      {/* Content */}
      {showBalanceSheet ? (
        <div className="flex-1">
          <BalanceSheet />
        </div>
      ) : (
        <div className="flex-1 relative overflow-auto">
          <div className="min-w-max">
            <Table className="w-full bg-white border-collapse">
              <TableHeader className="sticky top-0 z-10">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={`header-group-${headerGroup.id}`} className="border-b border-gray-200 bg-gray-50">
                    {headerGroup.headers.map((header) => (
                      <TableHead 
                        key={`header-${header.id}`} 
                        className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-50 border-r border-gray-200 last:border-r-0"
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
                      "transition-colors duration-200 border-b border-gray-100 hover:bg-gray-50",
                      index % 2 === 0 ? "bg-white" : "bg-gray-50/30"
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
            <div className="h-12 flex justify-center items-center bg-white border-t border-gray-200">
              <div className="text-sm text-gray-600">
                Showing {paginatedData.data.length} of {filteredRecords} records
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DataTableClientFiltered;