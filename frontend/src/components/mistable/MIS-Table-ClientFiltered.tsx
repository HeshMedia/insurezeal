/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */

"use client";


import { useAuth } from '@/hooks/useAuth'; // or wherever your auth hook is

import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
  type ColumnDef,
  type CellContext,
} from "@tanstack/react-table";
import { useAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import { QuarterSheetSelect } from "./QuarterSelector";
import { MisToolbar } from "./ToolbarActions";
import { FilterableColumnHeader, FilterSummary } from "./FilterableColumnHeader";
import { useGoogleSheetsMIS, useBalanceSheetStats } from "@/hooks/useGoogleSheetsMIS";
import { exportRowsToCsv, exportRowsToXlsx } from "@/lib/utils/export-file";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { GenericEditableCell } from "./editable-cell";
import { BalanceSheet } from "./BalanceSheet";
import { BrokerSheet } from "./BrokerSheet";

import {
  multiSelectStateAtom,
  unifiedViewModeAtom,
  SelectedCell,
} from "@/lib/atoms/google-sheets-mis";

import {
  Database,
  BarChart3,
  Table as TableIcon,
  Building2,
  Search,
  Maximize2,
  Minimize2,
  FilterX,
} from "lucide-react";

import { DataTableProps } from "./table-component.types";
import { SuperAdminCharts } from '../superadmin/superadmin-charts';

// ---------- Local storage atoms ----------
const createPendingUpdatesAtom = (key: string) =>
  atomWithStorage<Record<string, Record<string, unknown>>>(`pendingUpdates_${key}`, {});

const createColumnSizingAtom = (key: string) =>
  atomWithStorage<Record<string, number>>(`columnSizing_${key}`, {});


// ---------- Main component ----------
function DataTableClientFiltered<T>({
  config,
  onPendingChangesCount,
  clientFiltering: propClientFiltering,
  availableSheets = [],
  selectedSheet,
  onSheetChange,
  loading: externalLoading,
}: DataTableProps<T> & { loading?: boolean }) {
  // Core state
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; columnId: string } | null>(null);
  const [multiSelectState, setMultiSelectState] = useAtom(multiSelectStateAtom);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewMode, setViewMode] = useAtom(unifiedViewModeAtom);
  const [sharedSearch, setSharedSearch] = useState("");
  const { userRole } = useAuth(); // Adjust based on your auth hook structure
  const isSuperAdmin = userRole === 'superadmin';
  // Resize indicator
  const [resizeIndicator, setResizeIndicator] = useState<{
    isActive: boolean;
    columnId: string;
    position: number;
  } | null>(null);

  // Stats for secondary views
  const { data: balanceSheetData, loading: balanceSheetLoading } = useBalanceSheetStats();

  // Storage keys
  const baseAtomKey =
    config.title?.replace(/\s+/g, "_").toLowerCase() ||
    config.columns.map((c) => c.id).join("-").substring(0, 50);

  const pendingUpdatesKey = selectedSheet ? `${baseAtomKey}_${selectedSheet}` : baseAtomKey;
  const pendingUpdatesAtom = useMemo(() => createPendingUpdatesAtom(pendingUpdatesKey), [pendingUpdatesKey]);
  const [pendingUpdates, setPendingUpdates] = useAtom(pendingUpdatesAtom);

  // Keep column sizing shared across quarters for consistency
  const columnSizingKey = `global_mis_table_column_widths`;
  const columnSizingAtom = useMemo(() => createColumnSizingAtom(columnSizingKey), []);
  const [columnSizing, setColumnSizing] = useAtom(columnSizingAtom);

  const handleResetColumnDimensions = useCallback(() => {
    setColumnSizing({});
    toast.success("Column dimensions reset to default");
  }, [setColumnSizing]);

  useEffect(() => {
    onPendingChangesCount?.(Object.values(pendingUpdates).reduce((t, r) => t + Object.keys(r).length, 0));
  }, [pendingUpdates, onPendingChangesCount]);

  // Data hook for master sheet (client-side filtering)
  const {
    clientFiltering: hookClientFiltering,
    fetchAllMasterSheetData,
    loading,
    errors,
    isReady,
    hasData,
  } = useGoogleSheetsMIS();

  const clientFiltering = propClientFiltering || hookClientFiltering;

  // Fetch all data once if needed
  useEffect(() => {
    if (isReady && !propClientFiltering && !hasData) {
      fetchAllMasterSheetData().catch(console.error);
    }
  }, [isReady, fetchAllMasterSheetData, propClientFiltering, hasData]);

  // Client filtering API
  const clientFilteringData = (clientFiltering || {}) as any;
  const {
    filteredData = [],
    paginatedData = { data: [], totalRecords: 0, totalPages: 0, currentPage: 1, pageSize: 50 },
    filters = { columnFilters: {}, globalSearch: "" },
    handleSort = () => {},
    handleColumnFilter = () => {},
    getColumnUniqueValues = () => [],
    getColumnFilter = () => null,
    handleClearAllFilters = () => {},
    isFiltered = false,
    totalRecords = 0,
    filteredRecords = 0,
  } = clientFilteringData;

  // Route shared search to active view
  useEffect(() => {
    if (viewMode === "mis-table" && sharedSearch !== undefined) {
      const handleGlobalSearch = clientFiltering?.handleGlobalSearch;
      if (handleGlobalSearch) {
        handleGlobalSearch(sharedSearch);
      }
    }
    // Note: BalanceSheet and BrokerSheet have their own internal search functionality
  }, [sharedSearch, viewMode]); // Removed clientFiltering from dependencies to prevent infinite loop

  // Column resize handler (with indicator)
  const createCustomResizeHandler = useCallback((header: any) => {
    return (event: React.MouseEvent) => {
      const tableContainer = (event.currentTarget as HTMLElement).closest(".relative.overflow-auto");
      if (!tableContainer) return;

      const containerRect = (tableContainer as HTMLElement).getBoundingClientRect();
      const startX = (event as React.MouseEvent).clientX;
      const relativeStartX = startX - containerRect.left;
      const columnId = header.id;

      setResizeIndicator({ isActive: true, columnId, position: relativeStartX });

      const handleMouseMove = (e: MouseEvent) => {
        const deltaX = e.clientX - startX;
        const newPosition = relativeStartX + deltaX;
        const constrainedPosition = Math.max(0, Math.min(newPosition, containerRect.width));
        setResizeIndicator((prev) => (prev ? { ...prev, position: constrainedPosition } : null));
      };
      const handleMouseUp = () => {
        setResizeIndicator(null);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);

      header.getResizeHandler()(event);
    };
  }, []);

  // Bulk column selection for editing
  const handleColumnSelection = useCallback(
    (columnId: string) => {
      const allRows = filteredData;
      if (allRows.length === 0) {
        toast.error("No data available to select");
        return;
      }

      const columnIndex = config.columns.findIndex((col) => col.id === columnId);
      if (columnIndex === -1) {
        toast.error("Column not found");
        return;
      }

      const columnSelections: SelectedCell[] = (allRows as unknown[]).map((row: unknown, index: number) => {
        const typedRow = row as T;
        const rowId = config.idAccessor(typedRow);
        return {
          recordId: rowId,
          fieldName: columnId,
          rowIndex: index,
          columnIndex,
          currentValue: String((typedRow as Record<string, unknown>)[columnId] || ""),
        };
      });

      setMultiSelectState({
        selectedCells: columnSelections,
        isSelecting: false,
        selectionStart: columnSelections[0] || null,
        dragFillSource: null,
        isDragFilling: false,
      });

      setEditingCell({
        rowIndex: 0,
        columnId: columnId,
      });

      toast.success(`Selected ${columnSelections.length} cells in column "${columnId}" for bulk editing`);
    },
    [filteredData, config.idAccessor, config.columns, setMultiSelectState, setEditingCell]
  );

  // Header with filterable columns
  const columnHelper = createColumnHelper<T>();
  const columns = useMemo(
    () =>
      config.columns
        .filter((colConfig) => {
          if (colConfig.hidden) {
            return !colConfig.hidden(filteredData[0] as T, filteredData as T[]);
          }
          return true;
        })
        .map(
          (colConfig): ColumnDef<T, any> =>
            columnHelper.accessor(colConfig.accessor || ((row: T) => (row as any)[colConfig.id]), {
              id: colConfig.id,
              header: (() => {
                const FilterableHeader = () => (
                  <FilterableColumnHeader
                    title={colConfig.header}
                    columnId={colConfig.id}
                    onHeaderClick={handleColumnSelection}
                    onSort={(colId) => handleSort(colId as never)}
                    onFilter={(colId, filter) => {
                      if (!filter) {
                        handleColumnFilter(colId as never, new Set(), false);
                      } else {
                        switch (filter.type) {
                          case "values": {
                            const stringValues = (filter.values || []).map((v: unknown) => String(v));
                            const valueSet = new Set<string>(stringValues);
                            handleColumnFilter(colId as never, valueSet, true);
                            break;
                          }
                          case "search": {
                            if ((clientFiltering as any)?.handleColumnSearch && filter.search) {
                              (clientFiltering as any).handleColumnSearch(colId as never, filter.search);
                            }
                            break;
                          }
                          case "date_range": {
                            if ((clientFiltering as any)?.handleDateRangeFilter && filter.dateRange?.start && filter.dateRange?.end) {
                              ((clientFiltering as any).handleDateRangeFilter as (colId: string, start: Date, end: Date) => void)(
                                colId,
                                new Date(filter.dateRange.start),
                                new Date(filter.dateRange.end)
                              );
                            }
                            break;
                          }
                          case "number_range": {
                            if (
                              (clientFiltering as any)?.handleNumberRangeFilter &&
                              filter.numberRange?.min !== undefined &&
                              filter.numberRange?.max !== undefined
                            ) {
                              (clientFiltering as any).handleNumberRangeFilter(colId, filter.numberRange.min, filter.numberRange.max);
                            }
                            break;
                          }
                        }
                      }
                    }}
                    getUniqueValues={() => getColumnUniqueValues(colConfig.id as never)}
                    currentSort={null}
                    currentFilter={
                      getColumnFilter
                        ? (() => {
                            const filter = getColumnFilter(colConfig.id as never);
                            if (filter instanceof Set && filter.size > 0) {
                              return { type: "values" as const, values: Array.from(filter) };
                            }
                            return undefined;
                          })()
                        : undefined
                    }
                  />
                );
                FilterableHeader.displayName = `FilterableHeader-${colConfig.header}`;
                return FilterableHeader;
              })(),
              enableSorting: true,
              enableResizing: true,
              size: columnSizing[colConfig.id] || colConfig.width || 150,
              cell: (cellContext: CellContext<T, unknown>) => {
                if (colConfig.editable && config.enableBulkEdit) {
                  return <GenericEditableCell {...cellContext} columnConfig={colConfig as any} />;
                }

                const value = cellContext.getValue();
                if (colConfig.formatter) {
                  return <div className="px-4 py-2">{colConfig.formatter(value as any, cellContext.row.original)}</div>;
                }

                const renderValue = () => {
                  if (value === null || value === undefined || value === "") return <span className="text-gray-400">N/A</span>;
                  const safeValue = String(value);
                  switch (colConfig.kind) {
                    case "currency": {
                      const numValue = Number(value);
                      return <span className="numeric">{`₹${isNaN(numValue) ? safeValue : numValue.toLocaleString()}`}</span>;
                    }
                    case "badge": {
                      return (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {safeValue}
                        </span>
                      );
                    }
                    case "number": {
                      const num = Number(value);
                      return <span className="numeric">{isNaN(num) ? safeValue : num.toLocaleString()}</span>;
                    }
                    case "date": {
                      const date = new Date(safeValue);
                      return isNaN(date.getTime()) ? safeValue : date.toLocaleDateString();
                    }
                    default:
                      return safeValue;
                  }
                };

                return <div className="px-4 py-2 font-medium text-gray-900">{renderValue()}</div>;
              },
            })
        ),
    [config.columns, config.enableBulkEdit, filteredData, columnSizing, clientFiltering, handleColumnSelection, handleSort, handleColumnFilter, getColumnUniqueValues, getColumnFilter]
  );

  // Table instance
  const table = useReactTable({
    data: filteredData as T[],
    columns,
    getCoreRowModel: getCoreRowModel(),
    enableSortingRemoval: false,
    enableColumnResizing: true,
    columnResizeMode: "onEnd" as const,
    state: { columnSizing },
    onColumnSizingChange: setColumnSizing,
    defaultColumn: {
      size: 150,
      minSize: 120,
      maxSize: 500,
    },
    meta: {
      updateDataById: (recordId: string, fieldId: string, value: unknown) => {
        setPendingUpdates((prev) => ({
          ...prev,
          [recordId]: {
            ...prev[recordId],
            [fieldId]: String(value),
          },
        }));
      },
      editingCell,
      setEditingCell,
      pendingUpdates: pendingUpdates as any,
      idAccessor: config.idAccessor,
    } as any,
  });

  // Bulk save
  const handleSaveChanges = useCallback(async () => {
    if (Object.keys(pendingUpdates).length === 0) {
      toast.info("No changes to save.");
      return;
    }
    const promise = (async () => {
      const payload = config.saveAdapter.toUpdates(
        pendingUpdates as Record<string, Record<string, string | number | boolean | null>>
      );
      const mutateFn = config.saveAdapter.mutate();
      const result = await mutateFn(payload);
      setPendingUpdates({});
      return result;
    })();

    toast.promise(promise, {
      loading: "Saving changes...",
      success: (res) => `${(res as any).successful_updates || "Changes"} saved successfully!`,
      error: (err) => `Failed to save: ${err.message}`,
    });
  }, [pendingUpdates, config.saveAdapter, setPendingUpdates]);

  const handleClearChanges = useCallback(() => {
    setPendingUpdates({});
    toast.success("All pending changes cleared");
  }, [setPendingUpdates]);

  const computeExportRows = useCallback(() => {
    const dataset = filteredData as any[];
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
    const headers = table.getVisibleLeafColumns().map((c) => c.id);
    exportRowsToCsv(rows, `${config.title || "export"}.csv`, headers);
  }, [computeExportRows, table, config.title]);

  const handleExportXLSX = useCallback(() => {
    const rows = computeExportRows();
    exportRowsToXlsx(rows, `${config.title || "export"}.xlsx`, config.title || "Sheet");
  }, [computeExportRows, config.title]);

  // Keyboard nav (unchanged)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
        return;
      }
      const activeElement = document.activeElement;
      const isInputFocused = activeElement?.tagName === "INPUT" || activeElement?.tagName === "TEXTAREA";
      if (isInputFocused || multiSelectState.selectedCells.length === 0) return;

      const currentSelection = multiSelectState.selectedCells;
      if (currentSelection.length === 0) return;

      const activeCell = currentSelection[currentSelection.length - 1];
      const allRows = table.getRowModel().rows;
      const allColumns = table.getAllColumns();

      let newRowIndex = activeCell.rowIndex;
      let newColIndex = activeCell.columnIndex;

      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          newRowIndex = Math.max(0, activeCell.rowIndex - 1);
          break;
        case "ArrowDown":
          e.preventDefault();
          newRowIndex = Math.min(allRows.length - 1, activeCell.rowIndex + 1);
          break;
        case "ArrowLeft":
          e.preventDefault();
          newColIndex = Math.max(0, activeCell.columnIndex - 1);
          break;
        case "ArrowRight":
          e.preventDefault();
          newColIndex = Math.min(allColumns.length - 1, activeCell.columnIndex + 1);
          break;
        case "Escape":
          e.preventDefault();
          setMultiSelectState((prev) => ({ ...prev, selectedCells: [] }));
          return;
        default:
          if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            const targetRow = allRows[activeCell.rowIndex];
            const targetColumn = allColumns[activeCell.columnIndex];
            if (targetRow && targetColumn) {
              setEditingCell({ rowIndex: activeCell.rowIndex, columnId: targetColumn.id });
              setTimeout(() => {
                currentSelection.forEach((cell) => {
                  (table.options.meta as any)?.updateDataById(cell.recordId, cell.fieldName, e.key);
                });
              }, 0);
            }
          }
          return;
      }

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
          currentValue: String(targetValue || ""),
        };

        if (e.shiftKey) {
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
                    currentValue: String(value || ""),
                  });
                }
              }
            }
            setMultiSelectState((prev) => ({ ...prev, selectedCells: rangeSelection }));
          }
        } else {
          setMultiSelectState((prev) => ({
            ...prev,
            selectedCells: [newCellData],
            selectionStart: newCellData,
          }));
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [multiSelectState, table, config.idAccessor, setMultiSelectState, setEditingCell, isFullscreen, setIsFullscreen]);

  // Loading
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

  // Error
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

  // UI
  return (
    <div
      className={cn(
        "h-full flex flex-col rounded-xl border bg-background shadow-sm max-w-9xl",
        (multiSelectState.isSelecting || multiSelectState.isDragFilling) && "select-none",
        isFullscreen && "fixed inset-0 z-50 rounded-none border-0 shadow-none",
        config.className
      )}
    >
      {/* Header: view toggle + fullscreen + shared search */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-3 border-b border-gray-100 bg-gray-50">
  <div className="flex items-center gap-3">
    <div className={cn(
  "flex items-center gap-2 min-w-0 flex-1",
  viewMode === "super-admin-reports" && "invisible"
)}>
  <div className="relative max-w-[360px] w-full">
    <Input
      value={sharedSearch}
      onChange={(e) => setSharedSearch(e.target.value)}
      placeholder={
        viewMode === "mis-table"
          ? config.searchPlaceholder || "Search across all fields..."
          : viewMode === "balance-sheet"
          ? "Search agent code…"
          : "Search broker name…"
      }
      className="h-9 pr-8"
    />
    <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
      <Search className="h-4 w-4 text-muted-foreground" />
    </div>
  </div>
  {sharedSearch && (
    <Button
      variant="ghost"
      onClick={() => setSharedSearch("")}
      className="h-9 px-2"
      title="Clear search"
    >
      <FilterX className="h-4 w-4" />
    </Button>
  )}
</div>

    {/* CENTER: View toggle */}
    {/* CENTER: View toggle */}
<div className="flex-1 flex items-center justify-center">
  <div className="inline-flex items-center bg-white rounded-lg p-1 shadow-sm border border-gray-200">
    <Button
      variant={viewMode === "mis-table" ? "default" : "ghost"}
      onClick={() => setViewMode("mis-table")}
      className={cn(
        "h-8 px-3 text-sm font-medium rounded-md transition-all",
        viewMode === "mis-table" ? "bg-blue-600 text-white shadow-sm" : "text-gray-600 hover:text-gray-900"
      )}
    >
      <TableIcon className="mr-2 h-4 w-4" />
      MIS Table
    </Button>
    <Button
      variant={viewMode === "balance-sheet" ? "default" : "ghost"}
      onClick={() => setViewMode("balance-sheet")}
      className={cn(
        "h-8 px-3 text-sm font-medium rounded-md transition-all",
        viewMode === "balance-sheet" ? "bg-blue-600 text-white shadow-sm" : "text-gray-600 hover:text-gray-900"
      )}
    >
      <BarChart3 className="mr-2 h-4 w-4" />
      Balance Sheet
    </Button>
    <Button
      variant={viewMode === "broker-sheet" ? "default" : "ghost"}
      onClick={() => setViewMode("broker-sheet")}
      className={cn(
        "h-8 px-3 text-sm font-medium rounded-md transition-all",
        viewMode === "broker-sheet" ? "bg-blue-600 text-white shadow-sm" : "text-gray-600 hover:text-gray-900"
      )}
    >
      <Building2 className="mr-2 h-4 w-4" />
      Broker Sheet
    </Button>
    {/* Super Admin Reports - Only show for super admin users */}
    {isSuperAdmin && (
      <Button
        variant={viewMode === "super-admin-reports" ? "default" : "ghost"}
        onClick={() => setViewMode("super-admin-reports")}
        className={cn(
          "h-8 px-3 text-sm font-medium rounded-md transition-all",
          viewMode === "super-admin-reports" ? "bg-blue-600 text-white shadow-sm" : "text-gray-600 hover:text-gray-900"
        )}
      >
        <Database className="mr-2 h-4 w-4" />
        Reports
      </Button>
    )}
  </div>
</div>


    {/* RIGHT: Fullscreen */}
    <div className="flex items-center justify-end flex-1">
      <Button
        type="button"
        variant="ghost"
        onClick={() => setIsFullscreen((p) => !p)}
        title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        className="h-8 w-8 ml-auto"
      >
        {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
      </Button>
    </div>
  </div>
</div>


        {/* Title/meta + quarter + toolbar (MIS only) */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {viewMode === "mis-table" && (
            <div className="flex items-center px-4 py-2 gap-3 min-w-0">
              <div className="p-2 bg-blue-100 rounded-lg shrink-0">
                <Database className="h-5 w-5 text-blue-600" />
              </div>
              <div className="min-w-0">
                {config.title && <h1 className="text-base font-semibold text-gray-900 truncate">{config.title}</h1>}
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-xs text-gray-500">
                    {totalRecords} records • {filteredRecords} filtered
                  </span>
                  {Object.values(pendingUpdates).length > 0 && (
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-100 rounded-md">
                      <div className="w-1.5 h-1.5 bg-amber-500 rounded-full"></div>
                      <span className="text-amber-700 text-xs font-medium">
                        {Object.values(pendingUpdates).reduce((t, r) => t + Object.keys(r).length, 0)} pending
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            {viewMode === "mis-table" && !!availableSheets.length && (
              <QuarterSheetSelect
                availableSheets={availableSheets}
                selectedSheet={selectedSheet}
                onSheetChange={onSheetChange}
                loading={externalLoading || loading.masterSheetData}
                className="h-9"
              />
            )}

            {viewMode === "mis-table" && (
              <MisToolbar
                isFiltered={isFiltered}
                onClearFilters={handleClearAllFilters}
                onResetColumns={handleResetColumnDimensions}
                onExportCSV={handleExportCSV}
                onExportXLSX={handleExportXLSX}
                onSaveChanges={handleSaveChanges}
                onClearChanges={handleClearChanges}
                pendingChangesCount={
                  config.enableBulkEdit ? Object.values(pendingUpdates).reduce((t, r) => t + Object.keys(r).length, 0) : 0
                }
                isFullscreen={isFullscreen}
                onToggleFullscreen={() => setIsFullscreen(prev => !prev)}
              />
            )}
          </div>
        </div>
      </div>

      {/* Optional: MIS filter summary only (shared search replaces GlobalSearchBar) */}
      {viewMode === "mis-table" && isFiltered && (
        <div className="bg-gray-50 border-b border-gray-200">
          <div className="px-6 py-2.5">
            <div className="flex items-center justify-end">
              <FilterSummary
                stats={{
                  totalRecords,
                  totalFilteredRecords: filteredRecords,
                  activeFilters: Object.keys(filters.columnFilters || {}).length + ((filters as any)?.globalSearch ? 1 : 0),
                }}
                onClearAll={handleClearAllFilters}
              />
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {viewMode === "balance-sheet" ? (
        <div className="flex-1">
    <BalanceSheet sharedSearchQuery={sharedSearch} />
  </div>
) : viewMode === "broker-sheet" ? (
  <div className="flex-1">
    <BrokerSheet data={balanceSheetData?.broker_data || []} loading={balanceSheetLoading} sharedSearchQuery={sharedSearch} />
  </div>
) : viewMode === "super-admin-reports" ? (
   <div className="flex-1 overflow-auto min-h-0">
    <SuperAdminCharts />
  </div>
      ) : (
        <div className="flex-1 relative overflow-auto">
          {resizeIndicator?.isActive && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-blue-500 z-50 pointer-events-none"
              style={{ left: resizeIndicator.position, transform: "translateX(-1px)" }}
            />
          )}

          <Table className="w-full bg-white border-collapse table-auto" style={{ width: table.getCenterTotalSize(), tableLayout: "fixed" }}>
            <TableHeader className="sticky top-0 z-10">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={`header-group-${headerGroup.id}`} className="border-b border-gray-200 bg-gray-50">
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={`header-${header.id}`}
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-50 border-r border-gray-200 last:border-r-0 relative"
                      style={{ width: header.getSize() }}
                    >
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanResize() && (
                        <div
                          onMouseDown={createCustomResizeHandler(header)}
                          onTouchStart={header.getResizeHandler()}
                          className={cn(
                            "absolute -right-1 top-0 h-full w-3 cursor-col-resize select-none touch-none z-10",
                            "flex items-center justify-center",
                            header.column.getIsResizing() ? "bg-blue-500/20" : "hover:bg-blue-400/20"
                          )}
                        >
                          <div className="w-0.5 h-4 bg-gray-400 hover:bg-blue-500 transition-colors" />
                        </div>
                      )}
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
                      style={{ width: cell.column.getSize() }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="h-12 flex justify-center items-center bg-white border-t border-gray-200">
            <div className="text-sm text-gray-600">Showing {paginatedData.data.length} of {filteredRecords} records</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DataTableClientFiltered;
