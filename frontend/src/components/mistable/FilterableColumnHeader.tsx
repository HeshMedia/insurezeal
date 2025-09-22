// components/ui/FilterableColumnHeader.tsx - Google Sheets-style column headers with filtering
"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ColumnFilterDropdown } from './ColumnFilterDropdown';
import { Search, Filter, X, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ColumnFilter {
  type: 'values' | 'search' | 'date_range' | 'number_range';
  values?: string[];
  search?: string;
  dateRange?: { start?: string; end?: string };
  numberRange?: { min?: number; max?: number };
}

interface FilterableColumnHeaderProps {
  title: string;
  columnId: string;
  onSort: (columnId: string, direction: 'asc' | 'desc' | null) => void;
  onFilter: (columnId: string, filter: ColumnFilter | null) => void;
  onHeaderClick?: (columnId: string) => void;
  getUniqueValues: () => string[];
  currentSort?: { direction: 'asc' | 'desc' } | null;
  currentFilter?: ColumnFilter;
}

export function FilterableColumnHeader({
  title,
  columnId,
  onSort,
  onFilter,
  onHeaderClick,
  getUniqueValues,
  currentSort,
  currentFilter
}: FilterableColumnHeaderProps) {
  const handleSort = () => {
    if (!currentSort) {
      onSort(columnId, 'asc');
    } else if (currentSort.direction === 'asc') {
      onSort(columnId, 'desc');
    } else {
      onSort(columnId, null);
    }
  };

  const handleColumnNameDoubleClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onHeaderClick?.(columnId);
  };

  const hasFilter = currentFilter && Object.keys(currentFilter).length > 0;

  return (
    <div className="flex items-center justify-between w-full">
      <div className="flex items-center flex-1">
        <span
          onDoubleClick={handleColumnNameDoubleClick}
          className="font-bold text-slate-700 hover:text-slate-900 cursor-pointer select-none flex-1"
          title="Double-click to select all cells in this column for editing"
        >
          {title}
        </span>
        <Button
          variant="ghost"
          onClick={handleSort}
          className="h-auto p-1 ml-2 hover:bg-slate-100"
          title="Click to sort column"
        >
          {currentSort?.direction === "asc" ? (
            <ArrowUp className="h-4 w-4" />
          ) : currentSort?.direction === "desc" ? (
            <ArrowDown className="h-4 w-4" />
          ) : (
            <ArrowUpDown className="h-4 w-4" />
          )}
        </Button>
      </div>
      
      <ColumnFilterDropdown
        columnId={columnId}
        onFilter={onFilter}
        getUniqueValues={getUniqueValues}
        currentFilter={currentFilter}
      >
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-6 w-6 p-0 hover:bg-blue-100",
            hasFilter && "bg-blue-100 text-blue-600"
          )}
        >
          <Filter className="h-3 w-3" />
        </Button>
      </ColumnFilterDropdown>
    </div>
  );
}


interface GlobalSearchBarProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;       // wrapper
  inputClassName?: string;  // input element
  iconClassName?: string;   // left icon
  clearIconClassName?: string; // right icon
}

export const GlobalSearchBar = React.forwardRef<HTMLInputElement, GlobalSearchBarProps>(
  (
    {
      value,
      onChange,
      placeholder = "Search across all fields...",
      className,
      inputClassName,
      iconClassName,
      clearIconClassName,
      "aria-label": ariaLabel,
      type,
      ...rest
    },
    ref
  ) => {
    const isEmpty = !value;

    return (
      <div
        className={[
          "relative flex-1 max-w-full",
          className,
        ].filter(Boolean).join(" ")}
        role="search"
      >
        <Search
          aria-hidden="true"
          className={[
            "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4",
            iconClassName,
          ].filter(Boolean).join(" ")}
        />

        <Input
          ref={ref}
          type={type ?? "search"}
          role="searchbox"
          aria-label={ariaLabel || "Search"}
          placeholder={placeholder}
          value={value}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape" && value) {
              e.preventDefault();
              onChange("");
            }
          }}
          className={[
            // sizing and base styles
            "pl-10 pr-10 h-9 text-sm bg-white border border-gray-300 rounded-md",
            // focus
            "focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-blue-500",
            // transitions
            "transition-colors",
            inputClassName,
          ].filter(Boolean).join(" ")}
          {...rest}
        />

        {/* Clear */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange("")}
          className={[
            "absolute right-1.5 top-1/2 -translate-y-1/2 h-7 w-7 p-0",
            isEmpty ? "invisible" : "visible",
            "hover:bg-gray-100",
          ].join(" ")}
          aria-label="Clear search"
          tabIndex={isEmpty ? -1 : 0}
        >
          <X className={["h-4 w-4", clearIconClassName].filter(Boolean).join(" ")} />
        </Button>
      </div>
    );
  }
);

GlobalSearchBar.displayName = "GlobalSearchBar";

interface FilterSummaryProps {
  stats: {
    totalRecords: number;
    totalFilteredRecords: number;
    activeFilters: number;
  };
  onClearAll: () => void;
}

export function FilterSummary({
  stats,
  onClearAll
}: FilterSummaryProps) {
  if (stats.activeFilters === 0) return null;

  return (
    <div className="flex items-center gap-3">
      <div className="text-sm text-gray-600">
        <span className="font-medium">{stats.activeFilters}</span> filters active
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={onClearAll}
        className="h-8 px-3 text-xs hover:bg-red-50 hover:text-red-600 hover:border-red-300"
      >
        <X className="h-3 w-3 mr-1" />
        Clear All
      </Button>
    </div>
  );
}