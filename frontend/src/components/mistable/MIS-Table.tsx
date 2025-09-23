/* eslint-disable @typescript-eslint/no-explicit-any */

// component work in progress
"use client";


import React, { useMemo, useCallback, useEffect, useState } from "react";
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
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { GenericEditableCell } from "./editable-cell";
import {
  multiSelectStateAtom,
} from "@/lib/atoms/google-sheets-mis";
import { FilterableColumnHeader } from "./FilterableColumnHeader";
import { DataTableProps } from "./table-component.types";

export type ComputeExportRowsFn = () => Array<Record<string, unknown>>;

const createPendingUpdatesAtom = (key: string) =>
  atomWithStorage<Record<string, Record<string, unknown>>>(`pendingUpdates_${key}`, {});
const createColumnSizingAtom = (key: string) =>
  atomWithStorage<Record<string, number>>(`columnSizing_${key}`, {});

export default function MISTable<T>({
  config,
  clientFiltering,
  onPendingChangesCount,
  setComputeExportRows,
}: {
  config: DataTableProps<T>["config"];
  clientFiltering: unknown;
  onPendingChangesCount?: (n: number) => void;
  setComputeExportRows?: (fn: ComputeExportRowsFn) => void;
}) {
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; columnId: string } | null>(null);
  const [multiSelectState, setMultiSelectState] = useAtom(multiSelectStateAtom);

  // storage keys
  const baseAtomKey =
    config.title?.replace(/\s+/g, "_").toLowerCase() ||
    config.columns.map((c) => c.id).join("-").substring(0, 50);
  const pendingUpdatesAtom = useMemo(() => createPendingUpdatesAtom(baseAtomKey), [baseAtomKey]);
  const [pendingUpdates, setPendingUpdates] = useAtom(pendingUpdatesAtom);

  const columnSizingAtom = useMemo(() => createColumnSizingAtom("global_mis_table_column_widths"), []);
  const [columnSizing, setColumnSizing] = useAtom(columnSizingAtom);

  useEffect(() => {
    onPendingChangesCount?.(Object.values(pendingUpdates).reduce((t, r) => t + Object.keys(r).length, 0));
  }, [pendingUpdates, onPendingChangesCount]);

  const {
    filteredData = [],
    handleSort = () => {},
    handleColumnFilter = () => {},
    getColumnUniqueValues = () => [],
    getColumnFilter = () => null,
    paginatedData = { data: [], totalRecords: 0, totalPages: 0, currentPage: 1, pageSize: 50 },
    filteredRecords = 0,
    handleColumnSearch,
    handleDateRangeFilter,
    handleNumberRangeFilter,
  } = (clientFiltering || {}) as {
    filteredData?: T[];
    handleSort?: (colId: string) => void;
    handleColumnFilter?: (colId: string, values: Set<string>, enabled: boolean) => void;
    getColumnUniqueValues?: (colId: string) => string[];
    getColumnFilter?: (colId: string) => Set<string> | null;
    paginatedData?: { data: T[]; totalRecords: number; totalPages: number; currentPage: number; pageSize: number };
    filteredRecords?: number;
    handleColumnSearch?: (colId: string, search: string) => void;
    handleDateRangeFilter?: (colId: string, start: Date, end: Date) => void;
    handleNumberRangeFilter?: (colId: string, min: number, max: number) => void;
  };

  const createCustomResizeHandler = useCallback((header: { id: string; getResizeHandler: () => (event: React.MouseEvent) => void }) => {
    return (event: React.MouseEvent) => {
      const tableContainer = (event.currentTarget as HTMLElement).closest(".relative.overflow-auto");
      if (!tableContainer) return;
      header.getResizeHandler()(event);
    };
  }, []);

  const handleColumnSelection = useCallback(
    (columnId: string) => {
      const allRows = filteredData as T[];
      if (allRows.length === 0) {
        toast.error("No data available to select");
        return;
      }
      const columnIndex = config.columns.findIndex((col) => col.id === columnId);
      if (columnIndex === -1) {
        toast.error("Column not found");
        return;
      }
      const columnSelections = allRows.map((row: T, index: number) => {
        const rowId = config.idAccessor(row);
        return {
          recordId: rowId,
          fieldName: columnId,
          rowIndex: index,
          columnIndex,
          currentValue: String((row as Record<string, unknown>)[columnId] || ""),
        };
      });
      setMultiSelectState({
        selectedCells: columnSelections,
        isSelecting: false,
        selectionStart: columnSelections[0] || null,
        dragFillSource: null,
        isDragFilling: false,
      });
      setEditingCell({ rowIndex: 0, columnId });
      toast.success(`Selected ${columnSelections.length} cells in column "${columnId}" for bulk editing`);
    },
    [filteredData, config, setMultiSelectState, setEditingCell]
  );

  const columnHelper = createColumnHelper<T>();
  const columns = useMemo(
    () =>
      config.columns
        .filter((colConfig) => !colConfig.hidden || !colConfig.hidden(filteredData[0] as T, filteredData as T[]))
        .map(
          (colConfig): ColumnDef<T, unknown> =>
            columnHelper.accessor(colConfig.accessor || ((row: T) => (row as Record<string, unknown>)[colConfig.id]), {
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
                            const valueSet = new Set<string>((filter.values || []).map((v: unknown) => String(v)));
                            handleColumnFilter(colId as never, valueSet, true);
                            break;
                          }
                          case "search": {
                            if (handleColumnSearch && filter.search) {
                              handleColumnSearch(colId as never, filter.search);
                            }
                            break;
                          }
                          case "date_range": {
                            if (handleDateRangeFilter && filter.dateRange?.start && filter.dateRange?.end) {
                              handleDateRangeFilter(
                                colId,
                                new Date(filter.dateRange.start),
                                new Date(filter.dateRange.end)
                              );
                            }
                            break;
                          }
                          case "number_range": {
                            if (
                              handleNumberRangeFilter &&
                              filter.numberRange?.min !== undefined &&
                              filter.numberRange?.max !== undefined
                            ) {
                              handleNumberRangeFilter(colId, filter.numberRange.min, filter.numberRange.max);
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
                      return `₹${isNaN(numValue) ? safeValue : numValue.toLocaleString()}`;
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
                      return isNaN(num) ? safeValue : num.toLocaleString();
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
    [
      columnHelper,
      config.columns,
      config.enableBulkEdit,
      filteredData,
      columnSizing,
      handleColumnSelection,
      handleSort,
      handleColumnFilter,
      getColumnUniqueValues,
      getColumnFilter,
      handleColumnSearch,
      handleDateRangeFilter,
      handleNumberRangeFilter,
    ]
  );

  const table = useReactTable({
    data: filteredData as T[],
    columns,
    getCoreRowModel: getCoreRowModel(),
    enableSortingRemoval: false,
    enableColumnResizing: true,
    columnResizeMode: "onEnd" as const,
    state: { columnSizing },
    onColumnSizingChange: setColumnSizing,
    defaultColumn: { size: 150, minSize: 120, maxSize: 500 },
    meta: {
      updateDataById: (recordId: string, fieldId: string, value: unknown) => {
        setPendingUpdates((prev) => ({
          ...prev,
          [recordId]: { ...prev[recordId], [fieldId]: String(value) },
        }));
      },
      editingCell,
      setEditingCell,
      pendingUpdates: pendingUpdates as Record<string, Record<string, string>>,
      idAccessor: config.idAccessor,
    } as any,
  });

  // expose computeExportRows to wrapper
  useEffect(() => {
    if (!setComputeExportRows) return;
    const fn: ComputeExportRowsFn = () => {
      const dataset = filteredData;
      const visibleIds = table.getVisibleLeafColumns().map((c) => c.id);
      return dataset.map((row) => {
        const out: Record<string, unknown> = {};
        visibleIds.forEach((id) => (out[id] = (row as Record<string, unknown>)[id]));
        return out;
      });
    };
    setComputeExportRows(fn);
  }, [filteredData, table, setComputeExportRows]);

  // listen to wrapper events for save/clear (optional)
  useEffect(() => {
    const doSave = async () => {
      if (Object.keys(pendingUpdates).length === 0) {
        toast.info("No changes to save.");
        return;
      }
      const payload = config.saveAdapter.toUpdates(
        pendingUpdates as Record<string, Record<string, string | number | boolean | null>>
      );
      const mutateFn = config.saveAdapter.mutate();
      const result = await mutateFn(payload);
      setPendingUpdates({});
      toast.success(`${(result as { successful_updates?: number }).successful_updates || "Changes"} saved successfully!`);
    };
    const doClear = () => {
      setPendingUpdates({});
      toast.success("All pending changes cleared");
    };

    const saveHandler = () => void doSave();
    const clearHandler = () => void doClear();

    document.addEventListener("mis:save", saveHandler);
    document.addEventListener("mis:clear", clearHandler);
    return () => {
      document.removeEventListener("mis:save", saveHandler);
      document.removeEventListener("mis:clear", clearHandler);
    };
  }, [pendingUpdates, config.saveAdapter, setPendingUpdates]);

  // Keyboard navigation and editing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isInputFocused =
        activeElement?.tagName === "INPUT" || activeElement?.tagName === "TEXTAREA";
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
                  (table.options.meta as { updateDataById?: (id: string, field: string, value: unknown) => void })?.updateDataById?.(cell.recordId, cell.fieldName, e.key);
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
        const targetValue = (targetRow.original as Record<string, unknown>)[targetColumn.id];
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

            const rangeSelection: Array<{
              recordId: string;
              fieldName: string;
              rowIndex: number;
              columnIndex: number;
              currentValue: string;
            }> = [];
            for (let rowIdx = startRow; rowIdx <= endRow; rowIdx++) {
              for (let colIdx = startCol; colIdx <= endCol; colIdx++) {
                const row = allRows[rowIdx];
                const column = allColumns[colIdx];
                if (row && column) {
                  const recordId = config.idAccessor(row.original);
                  const value = (row.original as Record<string, unknown>)[column.id];
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
  }, [multiSelectState, table, config, setMultiSelectState, setEditingCell]);

  return (
    <div className="flex-1 relative overflow-auto">
      <Table
        className="w-full bg-white border-collapse table-auto"
        style={{ width: table.getCenterTotalSize(), tableLayout: "fixed" }}
      >
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
        <div className="text-sm text-gray-600">
          Showing {paginatedData.data.length} of {filteredRecords} records
        </div>
      </div>
    </div>
  );
}
