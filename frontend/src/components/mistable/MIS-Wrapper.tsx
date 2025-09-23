/* eslint-disable @typescript-eslint/no-explicit-any */
// COMPONENT WORK IN PROGRSS

"use client";


import React, { useCallback, useEffect, useState } from "react";
import { useAtom } from "jotai";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import { QuarterSheetSelect } from "./QuarterSelector";
import { MisToolbar } from "./ToolbarActions";
import { GlobalSearchBar, FilterSummary } from "./FilterableColumnHeader";
import { useGoogleSheetsMIS, useBalanceSheetStats } from "@/hooks/useGoogleSheetsMIS";
import { exportRowsToCsv, exportRowsToXlsx } from "@/lib/utils/export-file";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BalanceSheet } from "./BalanceSheet";
import { BrokerSheet } from "./BrokerSheet";

import {
  multiSelectStateAtom,
  unifiedViewModeAtom,
  ViewMode,
} from "@/lib/atoms/google-sheets-mis";

import { Database, BarChart3, Table as TableIcon, Building2 } from "lucide-react";
import { DataTableProps } from "./table-component.types";
import MISTable, { ComputeExportRowsFn } from "./MIS-Table";

type WrapperProps<T> = DataTableProps<T> & { loading?: boolean };

export default function MISWrapper<T>({
  config,
  onPendingChangesCount,
  clientFiltering: propClientFiltering,
  availableSheets = [],
  selectedSheet,
  onSheetChange,
  loading: externalLoading,
}: WrapperProps<T>) {
  const [viewMode, setViewMode] = useAtom(unifiedViewModeAtom);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [multiSelectState] = useAtom(multiSelectStateAtom);

  const { data: balanceSheetData, loading: balanceSheetLoading } = useBalanceSheetStats();

  const {
    clientFiltering: hookClientFiltering,
    fetchAllMasterSheetData,
    loading,
    errors,
    isReady,
    hasData,
  } = useGoogleSheetsMIS();

  const clientFiltering = propClientFiltering || hookClientFiltering;

  useEffect(() => {
    if (isReady && !propClientFiltering && !hasData) {
      fetchAllMasterSheetData().catch(console.error);
    }
  }, [isReady, fetchAllMasterSheetData, propClientFiltering, hasData]);

  const clientFilteringData = (clientFiltering || {}) as any;
  const {
    filters = { columnFilters: {}, globalSearch: "" },
    handleClearAllFilters = () => {},
    isFiltered = false,
    totalRecords = 0,
    filteredRecords = 0,
  } = clientFilteringData;

  const baseTitleStats = (
    <>
      <span className="text-xs text-gray-500">
        {totalRecords as number} records • {filteredRecords as number} filtered
      </span>
    </>
  );

  // Export helpers require a computeExportRows function from the table
  const [computeExportRows, setComputeExportRows] = useState<ComputeExportRowsFn | null>(null);

  const handleExportCSV = useCallback(() => {
    if (!computeExportRows) return;
    const rows = computeExportRows();
    const headers = Object.keys(rows[0] || {});
    exportRowsToCsv(rows, `${config.title || "export"}.csv`, headers);
  }, [computeExportRows, config.title]);

  const handleExportXLSX = useCallback(() => {
    if (!computeExportRows) return;
    const rows = computeExportRows();
    exportRowsToXlsx(rows, `${config.title || "export"}.xlsx`, config.title || "Sheet");
  }, [computeExportRows, config.title]);

  const handleToggleFullscreen = useCallback(() => setIsFullscreen((p) => !p), []);
  const handleSetViewMode = useCallback((newMode: ViewMode) => setViewMode(newMode), [setViewMode]);

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
    <div
      className={cn(
        "h-full flex flex-col rounded-xl border bg-background shadow-sm",
        (multiSelectState.isSelecting || multiSelectState.isDragFilling) && "select-none",
        isFullscreen && "fixed inset-0 z-50 rounded-none border-0 shadow-none",
        config.className
      )}
    >
      {/* View toggle */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-3 border-b border-gray-100 bg-gray-50">
          <div className="flex justify-center">
            <div className="inline-flex items-center bg-white rounded-lg p-1 shadow-sm border border-gray-200">
              <Button
                variant={viewMode === "mis-table" ? "default" : "ghost"}
                onClick={() => handleSetViewMode("mis-table")}
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
                onClick={() => handleSetViewMode("balance-sheet")}
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
                onClick={() => handleSetViewMode("broker-sheet")}
                className={cn(
                  "h-8 px-3 text-sm font-medium rounded-md transition-all",
                  viewMode === "broker-sheet" ? "bg-blue-600 text-white shadow-sm" : "text-gray-600 hover:text-gray-900"
                )}
              >
                <Building2 className="mr-2 h-4 w-4" />
                Broker Sheet
              </Button>
            </div>
          </div>
        </div>

        {/* Title/meta + quarter + actions */}
        <div className="px-6 py-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            {viewMode === "mis-table" && (
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 bg-blue-100 rounded-lg shrink-0">
                  <Database className="h-5 w-5 text-blue-600" />
                </div>
                <div className="min-w-0">
                  {config.title && <h1 className="text-base font-semibold text-gray-900 truncate">{config.title}</h1>}
                  <div className="flex items-center gap-3 mt-0.5">
                    {baseTitleStats}
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
                  isFiltered={isFiltered as boolean}
                  onClearFilters={handleClearAllFilters as () => void}
                  onResetColumns={() => toast.success("Column dimensions reset to default")}
                  onExportCSV={handleExportCSV}
                  onExportXLSX={handleExportXLSX}
                  onSaveChanges={() => document.dispatchEvent(new CustomEvent("mis:save"))}
                  onClearChanges={() => document.dispatchEvent(new CustomEvent("mis:clear"))}
                  pendingChangesCount={0 /* updated by MIS table via event or prop if desired */}
                  isFullscreen={isFullscreen}
                  onToggleFullscreen={handleToggleFullscreen}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Search + filter summary */}
      {viewMode === "mis-table" && (
        <div className="bg-gray-50 border-b border-gray-200">
          <div className="px-6 py-2.5">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-[220px] max-w-[520px]">
                <GlobalSearchBar
                  value={(filters as any)?.globalSearch || ""}
                  onChange={clientFiltering?.handleGlobalSearch || (() => {})}
                  placeholder={config.searchPlaceholder || "Search across all fields..."}
                />
              </div>
              {(isFiltered as boolean) && (
                <FilterSummary
                  stats={{
                    totalRecords: totalRecords as number,
                    totalFilteredRecords: filteredRecords as number,
                    activeFilters:
                      Object.keys((filters as any).columnFilters || {}).length + ((filters as any)?.globalSearch ? 1 : 0),
                  }}
                  onClearAll={handleClearAllFilters as () => void}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {viewMode === "balance-sheet" ? (
        <div className="flex-1">
          <BalanceSheet className="rounded-none border-0 shadow-none" />
        </div>
      ) : viewMode === "broker-sheet" ? (
        <div className="flex-1">
          <BrokerSheet data={balanceSheetData?.broker_data || []} loading={balanceSheetLoading} />
        </div>
      ) : (
        <MISTable
          config={config}
          clientFiltering={clientFiltering}
          onPendingChangesCount={onPendingChangesCount}
          setComputeExportRows={setComputeExportRows}
        />
      )}
    </div>
  );
}
