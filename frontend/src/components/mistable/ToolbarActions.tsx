// ToolbarActions.tsx
"use client";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, RefreshCw, FilterX, Save, Maximize2, Minimize2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

function IconAction({
  label,
  children,
  onClick,
  disabled,
  variant = "ghost",
  className,
  tooltipSide = "bottom",
}: {
  label: string;
  children: React.ReactNode;        // the icon
  onClick?: () => void;
  disabled?: boolean;
  variant?: "ghost" | "secondary" | "default";
  className?: string;
  tooltipSide?: "top" | "bottom" | "left" | "right";
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant={variant}
          onClick={onClick}
          disabled={disabled}
          title={label} // fallback tooltip
          className={cn(
            "h-9 w-9 p-0 shrink-0 inline-flex items-center justify-center", // compact square
            // visual states
            "aria-disabled:opacity-50 aria-disabled:cursor-not-allowed",
            className
          )}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side={tooltipSide} sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export function MisToolbar({
  isFiltered,
  onClearFilters,
  onResetColumns,
  onExportCSV,
  onExportXLSX,
  onSaveChanges,
  onClearChanges,
  pendingChangesCount,
  isFullscreen,
  onToggleFullscreen,
}: {
  isFiltered: boolean;
  onClearFilters: () => void;
  onResetColumns: () => void;
  onExportCSV: () => void;
  onExportXLSX: () => void;
  onSaveChanges: () => void;
  onClearChanges: () => void;
  pendingChangesCount: number;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}) {
  const hasBulkEditFeatures = pendingChangesCount >= 0; // If pendingChangesCount is provided (even 0), bulk edit is enabled
  
  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
        <IconAction label="Export CSV" onClick={onExportCSV} variant="secondary">
          <FileSpreadsheet className="h-4 w-4" />
        </IconAction>

        <IconAction label="Export Excel" onClick={onExportXLSX} variant="secondary">
          <FileSpreadsheet className="h-4 w-4" />
        </IconAction>

        <IconAction label="Reset columns" onClick={onResetColumns}>
          <RefreshCw className="h-4 w-4" />
        </IconAction>

        {isFiltered && (
          <IconAction label="Clear filters" onClick={onClearFilters}>
            <FilterX className="h-4 w-4" />
          </IconAction>
        )}

        {/* Bulk edit actions - only show if bulk edit is enabled */}
        {hasBulkEditFeatures && (
          <>
            {pendingChangesCount > 0 && (
              <IconAction
                label="Clear changes"
                onClick={onClearChanges}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <RotateCcw className="h-4 w-4" />
              </IconAction>
            )}

            <div className="relative">
              <IconAction
                label={pendingChangesCount > 0 ? "Save changes" : "Save (no changes)"}
                onClick={onSaveChanges}
                disabled={pendingChangesCount === 0}
                variant={pendingChangesCount > 0 ? "default" : "secondary"}
                className={cn(
                  pendingChangesCount > 0
                    ? "bg-blue-600 hover:bg-blue-700 text-white"
                    : "bg-gray-200 text-gray-500"
                )}
              >
                <Save className="h-4 w-4" />
              </IconAction>
              {pendingChangesCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-[10px] leading-none px-1.5 py-0.5 rounded-full">
                  {pendingChangesCount}
                </span>
              )}
            </div>
          </>
        )}

        <IconAction
          label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          onClick={onToggleFullscreen}
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </IconAction>
      </div>
    </TooltipProvider>
  );
}