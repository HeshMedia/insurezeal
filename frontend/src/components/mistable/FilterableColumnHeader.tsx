// components/ui/FilterableColumnHeader.tsx - Google Sheets-style column headers with filtering
"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ColumnFilterDropdown } from './ColumnFilterDropdown';
import { Search, Filter, X, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FilterableColumnHeaderProps {
  title: string;
  columnId: string;
  onSort: (columnId: string, direction: 'asc' | 'desc' | null) => void;
  onFilter: (columnId: string, filter: any) => void;
  getUniqueValues: () => any[];
  currentSort?: { direction: 'asc' | 'desc' } | null;
  currentFilter?: any;
}

export function FilterableColumnHeader({
  title,
  columnId,
  onSort,
  onFilter,
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

  const hasFilter = currentFilter && Object.keys(currentFilter).length > 0;

  return (
    <div className="flex items-center justify-between w-full">
      <Button
        variant="ghost"
        onClick={handleSort}
        className="h-auto p-0 font-bold text-slate-700 hover:text-slate-900 hover:bg-transparent flex-1 justify-start"
      >
        {title}
        {currentSort?.direction === "asc" ? (
          <ArrowUp className="ml-2 h-4 w-4" />
        ) : currentSort?.direction === "desc" ? (
          <ArrowDown className="ml-2 h-4 w-4" />
        ) : (
          <ArrowUpDown className="ml-2 h-4 w-4" />
        )}
      </Button>
      
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

interface GlobalSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function GlobalSearchBar({
  value,
  onChange,
  placeholder = "Search across all fields..."
}: GlobalSearchBarProps) {
  return (
    <div className="relative max-w-2xl flex-1">
      <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-12 pr-12 h-12 text-base bg-white/80 backdrop-blur-sm border-gray-300 rounded-xl shadow-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
      />
      {value && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 hover:bg-gray-100"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

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