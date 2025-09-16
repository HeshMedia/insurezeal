import { clearAllFiltersAtom, googleSheetsMISClientFiltersAtom, googleSheetsMISColumnValuesAtom, googleSheetsMISFilteredDataAtom, googleSheetsMISFilteredStatsAtom, googleSheetsMISPaginatedDataAtom, googleSheetsMISPaginationAtom, googleSheetsMISRawDataAtom, setColumnFilterAtom, setDateRangeFilterAtom, setGlobalSearchAtom, setNumberRangeFilterAtom, setSortAtom, updateColumnValuesAtom } from "@/lib/atoms/google-sheets-filter";
import { QuarterlySheetRecord } from "@/types/admin-mis.types";
import { ColumnFilter } from "@/types/google-sheets.types";
import { useAtom } from "jotai";
import { useEffect, useCallback } from "react";

export const useClientSideFiltering = () => {
  const [rawData, setRawData] = useAtom(googleSheetsMISRawDataAtom);
  const [filteredData] = useAtom(googleSheetsMISFilteredDataAtom);
  const [paginatedData] = useAtom(googleSheetsMISPaginatedDataAtom);
  const [filteredStats] = useAtom(googleSheetsMISFilteredStatsAtom);
  const [columnValues] = useAtom(googleSheetsMISColumnValuesAtom);
  const [filters] = useAtom(googleSheetsMISClientFiltersAtom);
  const [pagination, setPagination] = useAtom(googleSheetsMISPaginationAtom);
  
  // Filter action atoms
  const [, setGlobalSearch] = useAtom(setGlobalSearchAtom);
  const [, setSort] = useAtom(setSortAtom);
  const [, setColumnFilter] = useAtom(setColumnFilterAtom);
  const [, setDateRangeFilter] = useAtom(setDateRangeFilterAtom);
  const [, setNumberRangeFilter] = useAtom(setNumberRangeFilterAtom);
  const [, clearAllFilters] = useAtom(clearAllFiltersAtom);
  const [, updateColumnValues] = useAtom(updateColumnValuesAtom);

  // Update column values when raw data changes
  useEffect(() => {
    if (rawData.length > 0) {
      updateColumnValues();
    }
  }, [rawData, updateColumnValues]);

  // Load data from external source (Google Sheets service)
  const loadData = useCallback((data: QuarterlySheetRecord[]) => {
    setRawData(data);
  }, [setRawData]);

  // Global search functionality
  const handleGlobalSearch = useCallback((searchTerm: string) => {
    setGlobalSearch(searchTerm);
    // Reset to first page when searching
    setPagination(prev => ({ ...prev, page: 1 }));
  }, [setGlobalSearch, setPagination]);

  // Sorting functionality
  const handleSort = useCallback((column: keyof QuarterlySheetRecord) => {
    const currentSort = filters.sortBy;
    const currentDirection = filters.sortDirection;
    
    let newDirection: 'asc' | 'desc' = 'asc';
    
    // If clicking the same column, toggle direction
    if (currentSort === column) {
      newDirection = currentDirection === 'asc' ? 'desc' : 'asc';
    }
    
    setSort(column, newDirection);
  }, [filters.sortBy, filters.sortDirection, setSort]);

  // Column filter functionality
  const handleColumnFilter = useCallback((
    column: keyof QuarterlySheetRecord,
    selectedValues: Set<string>,
    isActive: boolean = true
  ) => {
    setColumnFilter(column, {
      selectedValues,
      isActive
    });
    // Reset to first page when filtering
    setPagination(prev => ({ ...prev, page: 1 }));
  }, [setColumnFilter, setPagination]);

  // Column search functionality
  const handleColumnSearch = useCallback((
    column: keyof QuarterlySheetRecord,
    searchTerm: string
  ) => {
    setColumnFilter(column, {
      searchTerm,
      isActive: true
    });
    // Reset to first page when searching
    setPagination(prev => ({ ...prev, page: 1 }));
  }, [setColumnFilter, setPagination]);

  // Date range filter functionality
  const handleDateRangeFilter = useCallback((
    column: string,
    from?: string,
    to?: string
  ) => {
    setDateRangeFilter(column, from, to);
    // Reset to first page when filtering
    setPagination(prev => ({ ...prev, page: 1 }));
  }, [setDateRangeFilter, setPagination]);

  // Number range filter functionality
  const handleNumberRangeFilter = useCallback((
    column: string,
    min?: number,
    max?: number
  ) => {
    setNumberRangeFilter(column, min, max);
    // Reset to first page when filtering
    setPagination(prev => ({ ...prev, page: 1 }));
  }, [setNumberRangeFilter, setPagination]);

  // Clear all filters
  const handleClearAllFilters = useCallback(() => {
    clearAllFilters();
    setPagination(prev => ({ ...prev, page: 1 }));
  }, [clearAllFilters, setPagination]);

  // Pagination controls
  const goToPage = useCallback((page: number) => {
    setPagination(prev => ({ ...prev, page: Math.max(1, Math.min(page, prev.totalPages)) }));
  }, [setPagination]);

  const changePageSize = useCallback((pageSize: number) => {
    setPagination(prev => ({ ...prev, pageSize, page: 1 }));
  }, [setPagination]);

  const nextPage = useCallback(() => {
    setPagination(prev => ({ 
      ...prev, 
      page: Math.min(prev.page + 1, paginatedData.totalPages) 
    }));
  }, [setPagination, paginatedData.totalPages]);

  const prevPage = useCallback(() => {
    setPagination(prev => ({ 
      ...prev, 
      page: Math.max(prev.page - 1, 1) 
    }));
  }, [setPagination]);

  // Get unique values for a column (for filter dropdowns)
  const getColumnUniqueValues = useCallback((column: keyof QuarterlySheetRecord): string[] => {
    return columnValues.get(column) || [];
  }, [columnValues]);

  // Get current filter for a column
  const getColumnFilter = useCallback((column: keyof QuarterlySheetRecord): ColumnFilter | undefined => {
    return filters.columnFilters.get(column);
  }, [filters.columnFilters]);

  // Check if any filters are active
  const hasActiveFilters = useCallback((): boolean => {
    return !!(
      filters.globalSearch.trim() ||
      Array.from(filters.columnFilters.values()).some(filter => filter.isActive) ||
      Object.keys(filters.dateRangeFilters).length > 0 ||
      Object.keys(filters.numberRangeFilters).length > 0
    );
  }, [filters]);

  // Get filter summary
  const getFilterSummary = useCallback(() => {
    const activeFilters: string[] = [];
    
    if (filters.globalSearch.trim()) {
      activeFilters.push(`Global: "${filters.globalSearch}"`);
    }
    
    for (const [column, filter] of filters.columnFilters) {
      if (filter.isActive) {
        if (filter.selectedValues && filter.selectedValues.size > 0) {
          activeFilters.push(`${column}: ${filter.selectedValues.size} values`);
        }
        if (filter.searchTerm && filter.searchTerm.trim()) {
          activeFilters.push(`${column}: "${filter.searchTerm}"`);
        }
      }
    }
    
    for (const [column, range] of Object.entries(filters.dateRangeFilters)) {
      activeFilters.push(`${column}: ${range.from || 'start'} - ${range.to || 'end'}`);
    }
    
    for (const [column, range] of Object.entries(filters.numberRangeFilters)) {
      activeFilters.push(`${column}: ${range.min || 'min'} - ${range.max || 'max'}`);
    }
    
    return activeFilters;
  }, [filters]);

  return {
    // Data
    rawData,
    filteredData,
    paginatedData,
    filteredStats,
    columnValues,
    filters,
    pagination,
    
    // Actions
    loadData,
    handleGlobalSearch,
    handleSort,
    handleColumnFilter,
    handleColumnSearch,
    handleDateRangeFilter,
    handleNumberRangeFilter,
    handleClearAllFilters,
    
    // Pagination
    goToPage,
    changePageSize,
    nextPage,
    prevPage,
    
    // Utilities
    getColumnUniqueValues,
    getColumnFilter,
    hasActiveFilters,
    getFilterSummary,
    
    // Computed values
    isFiltered: hasActiveFilters(),
    totalRecords: rawData.length,
    filteredRecords: filteredData.length,
    visibleRecords: paginatedData.data.length
  };
};