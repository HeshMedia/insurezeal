import React, { useState, useRef } from 'react';
import { QuarterlySheetRecord } from '@/types/admin-mis.types';
import { useClientSideFiltering } from '@/hooks/useClientSideFiltering';
import { ColumnFilterDropdown } from './ColumnFilterDropdown';

interface FilterableColumnHeaderProps {
  column: keyof QuarterlySheetRecord;
  displayName?: string;
  className?: string;
}

export const FilterableColumnHeader: React.FC<FilterableColumnHeaderProps> = ({
  column,
  displayName,
  className = ''
}) => {
  const { 
    filters, 
    handleSort, 
    getColumnFilter, 
    hasActiveFilters 
  } = useClientSideFiltering();

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);

  const currentFilter = getColumnFilter(column);
  const isFiltered = currentFilter?.isActive && (
    (currentFilter.selectedValues && currentFilter.selectedValues.size > 0) || 
    (currentFilter.searchTerm && currentFilter.searchTerm.trim().length > 0)
  );

  const isSorted = filters.sortBy === column;
  const sortDirection = filters.sortDirection;

  const handleSortClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleSort(column);
  };

  const handleFilterClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsFilterOpen(!isFilterOpen);
  };

  const getFilterPosition = () => {
    if (!headerRef.current) return { top: 0, left: 0 };
    
    const rect = headerRef.current.getBoundingClientRect();
    return {
      top: rect.bottom + window.scrollY + 4,
      left: rect.left + window.scrollX
    };
  };

  const displayText = displayName || column.toString();

  return (
    <>
      <div 
        ref={headerRef}
        className={`
          relative group flex items-center justify-between 
          px-3 py-2 bg-gray-50 border-b border-gray-200 
          cursor-pointer hover:bg-gray-100 transition-colors
          ${className}
        `}
      >
        {/* Column Text and Sort */}
        <div 
          className="flex items-center space-x-1 flex-1 min-w-0"
          onClick={handleSortClick}
        >
          <span 
            className="text-sm font-medium text-gray-700 truncate"
            title={displayText}
          >
            {displayText}
          </span>
          
          {/* Sort Indicator */}
          <div className="flex flex-col ml-1">
            {isSorted && (
              <div className="text-blue-600">
                {sortDirection === 'asc' ? (
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
            )}
            
            {!isSorted && (
              <div className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </div>
            )}
          </div>
        </div>

        {/* Filter Button */}
        <button
          onClick={handleFilterClick}
          className={`
            ml-2 p-1 rounded transition-colors
            ${isFiltered 
              ? 'text-blue-600 bg-blue-100' 
              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200'
            }
            ${isFilterOpen ? 'bg-gray-200' : ''}
          `}
          title="Filter column"
        >
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
          </svg>
        </button>

        {/* Filter Indicator Dot */}
        {isFiltered && (
          <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-600 rounded-full"></div>
        )}
      </div>

      {/* Filter Dropdown */}
      <ColumnFilterDropdown
        column={column}
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        position={getFilterPosition()}
      />
    </>
  );
};

// Wrapper component for easy integration with existing tables
export const FilterableTableHeader: React.FC<{
  columns: Array<{
    key: keyof QuarterlySheetRecord;
    label: string;
    className?: string;
  }>;
}> = ({ columns }) => {
  return (
    <div className="flex bg-gray-50 border-b border-gray-200">
      {columns.map((col) => (
        <FilterableColumnHeader
          key={col.key.toString()}
          column={col.key}
          displayName={col.label}
          className={col.className}
        />
      ))}
    </div>
  );
};

// Global search component
export const GlobalSearchBar: React.FC<{
  placeholder?: string;
  className?: string;
}> = ({ placeholder = "Search all columns...", className = "" }) => {
  const { filters, handleGlobalSearch, handleClearAllFilters, hasActiveFilters } = useClientSideFiltering();

  return (
    <div className={`flex items-center space-x-4 ${className}`}>
      {/* Global Search Input */}
      <div className="relative flex-1">
        <input
          type="text"
          placeholder={placeholder}
          value={filters.globalSearch}
          onChange={(e) => handleGlobalSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg className="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
          </svg>
        </div>
      </div>

      {/* Clear All Filters Button */}
      {hasActiveFilters() && (
        <button
          onClick={handleClearAllFilters}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Clear All Filters
        </button>
      )}
    </div>
  );
};

// Filter summary component
export const FilterSummary: React.FC<{ className?: string }> = ({ className = "" }) => {
  const { getFilterSummary, hasActiveFilters, filteredRecords, totalRecords } = useClientSideFiltering();

  if (!hasActiveFilters()) return null;

  const summary = getFilterSummary();

  return (
    <div className={`bg-blue-50 border border-blue-200 rounded-lg p-3 ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-blue-800">
            Showing {filteredRecords.toLocaleString()} of {totalRecords.toLocaleString()} records
          </div>
          <div className="text-xs text-blue-600 mt-1">
            Active filters: {summary.slice(0, 3).join(', ')}
            {summary.length > 3 && ` +${summary.length - 3} more`}
          </div>
        </div>
      </div>
    </div>
  );
};