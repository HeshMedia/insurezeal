import { QuarterlySheetRecord } from "@/types/admin-mis.types";
import { ClientSideFilters, ColumnFilter } from "@/types/google-sheets.types";
import { atom } from "jotai";

// Raw data from Google Sheets (unfiltered)
export const googleSheetsMISRawDataAtom = atom<QuarterlySheetRecord[]>([]);


// Filter state atom
export const googleSheetsMISClientFiltersAtom = atom<ClientSideFilters>({
  globalSearch: '',
  columnFilters: new Map(),
  sortBy: null,
  sortDirection: 'asc',
  dateRangeFilters: {},
  numberRangeFilters: {}
});

// Unique values for each column (for filter dropdowns)
export const googleSheetsMISColumnValuesAtom = atom<Map<keyof QuarterlySheetRecord, string[]>>(new Map());

// Derived atom for filtered and sorted data
export const googleSheetsMISFilteredDataAtom = atom((get) => {
  const rawData = get(googleSheetsMISRawDataAtom);
  const filters = get(googleSheetsMISClientFiltersAtom);
  
  if (rawData.length === 0) return [];
  
  let filteredData = [...rawData];
  
  // Apply global search filter
  if (filters.globalSearch.trim()) {
    const searchTerm = filters.globalSearch.toLowerCase().trim();
    filteredData = filteredData.filter(record =>
      Object.values(record).some(value =>
        value?.toString().toLowerCase().includes(searchTerm)
      )
    );
  }
  
  // Apply column-specific filters
  for (const [column, filter] of filters.columnFilters) {
    if (filter.isActive && filter.selectedValues && filter.selectedValues.size > 0) {
      filteredData = filteredData.filter(record => {
        const cellValue = record[column]?.toString() || '';
        return filter.selectedValues!.has(cellValue);
      });
    }
    
    // Apply column search term
    if (filter.isActive && filter.searchTerm && filter.searchTerm.trim()) {
      const searchTerm = filter.searchTerm.toLowerCase().trim();
      filteredData = filteredData.filter(record => {
        const cellValue = record[column]?.toString().toLowerCase() || '';
        return cellValue.includes(searchTerm);
      });
    }
  }
  
  // Apply date range filters
  for (const [column, range] of Object.entries(filters.dateRangeFilters)) {
    if (range.from || range.to) {
      filteredData = filteredData.filter(record => {
        const cellValue = record[column as keyof QuarterlySheetRecord]?.toString();
        if (!cellValue) return false;
        
        const cellDate = new Date(cellValue);
        if (isNaN(cellDate.getTime())) return false;
        
        if (range.from && cellDate < new Date(range.from)) return false;
        if (range.to && cellDate > new Date(range.to)) return false;
        
        return true;
      });
    }
  }
  
  // Apply number range filters
  for (const [column, range] of Object.entries(filters.numberRangeFilters)) {
    if (range.min !== undefined || range.max !== undefined) {
      filteredData = filteredData.filter(record => {
        const cellValue = record[column as keyof QuarterlySheetRecord]?.toString();
        if (!cellValue) return false;
        
        const numValue = parseFloat(cellValue);
        if (isNaN(numValue)) return false;
        
        if (range.min !== undefined && numValue < range.min) return false;
        if (range.max !== undefined && numValue > range.max) return false;
        
        return true;
      });
    }
  }
  
  // Apply sorting
  if (filters.sortBy) {
    filteredData.sort((a, b) => {
      const aValue = a[filters.sortBy!];
      const bValue = b[filters.sortBy!];
      
      // Handle null/undefined values
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return filters.sortDirection === 'asc' ? -1 : 1;
      if (bValue == null) return filters.sortDirection === 'asc' ? 1 : -1;
      
      // Convert to strings for comparison
      const aStr = aValue.toString();
      const bStr = bValue.toString();
      
      // Try to parse as numbers if both look numeric
      const aNum = parseFloat(aStr);
      const bNum = parseFloat(bStr);
      
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return filters.sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
      }
      
      // String comparison
      const comparison = aStr.localeCompare(bStr);
      return filters.sortDirection === 'asc' ? comparison : -comparison;
    });
  }
  
  return filteredData;
});

// Statistics derived from filtered data
export const googleSheetsMISFilteredStatsAtom = atom((get) => {
  const filteredData = get(googleSheetsMISFilteredDataAtom);
  
  if (filteredData.length === 0) {
    return {
      total_records: 0,
      total_policies: 0,
      total_cutpay_transactions: 0,
      total_gross_premium: 0,
      total_net_premium: 0,
      total_cutpay_amount: 0,
      top_agents: [],
      top_insurers: [],
      monthly_summary: []
    };
  }
  
  const total_gross_premium = filteredData.reduce((sum, record) => {
    return sum + (parseFloat(record["Gross premium"]?.toString() || '0') || 0);
  }, 0);

  const total_net_premium = filteredData.reduce((sum, record) => {
    return sum + (parseFloat(record["Net premium"]?.toString() || '0') || 0);
  }, 0);

  const total_cutpay_amount = filteredData.reduce((sum, record) => {
    return sum + (parseFloat(record["Cut Pay Amount Received From Agent"]?.toString() || '0') || 0);
  }, 0);

  // Count unique policies
  const uniquePolicies = new Set(filteredData.map(record => record["Policy number"])).size;

  // Count cutpay transactions
  const cutpayTransactions = filteredData.filter(record => 
    parseFloat(record["Cut Pay Amount Received From Agent"]?.toString() || '0') > 0
  ).length;

  // Calculate top agents
  const agentStats = new Map<string, number>();
  filteredData.forEach(record => {
    const agentCode = record["Agent Code"];
    const premium = parseFloat(record["Gross premium"]?.toString() || '0') || 0;
    if (agentCode) {
      agentStats.set(agentCode, (agentStats.get(agentCode) || 0) + premium);
    }
  });

  const top_agents = Array.from(agentStats.entries())
    .map(([agent_code, total_gross_premium]) => ({ agent_code, total_gross_premium }))
    .sort((a, b) => b.total_gross_premium - a.total_gross_premium)
    .slice(0, 10);

  // Calculate top insurers
  const insurerStats = new Map<string, number>();
  filteredData.forEach(record => {
    const insurerName = record["Insurer name"];
    const premium = parseFloat(record["Gross premium"]?.toString() || '0') || 0;
    if (insurerName) {
      insurerStats.set(insurerName, (insurerStats.get(insurerName) || 0) + premium);
    }
  });

  const top_insurers = Array.from(insurerStats.entries())
    .map(([insurer_name, total_gross_premium]) => ({ insurer_name, total_gross_premium }))
    .sort((a, b) => b.total_gross_premium - a.total_gross_premium)
    .slice(0, 10);

  // Calculate monthly summary
  const monthlyStats = new Map<string, { premium: number; policies: Set<string> }>();
  filteredData.forEach(record => {
    const month = record["Reporting Month (mmm'yy)"];
    const premium = parseFloat(record["Gross premium"]?.toString() || '0') || 0;
    const policyNumber = record["Policy number"];
    
    if (month) {
      if (!monthlyStats.has(month)) {
        monthlyStats.set(month, { premium: 0, policies: new Set() });
      }
      const stats = monthlyStats.get(month)!;
      stats.premium += premium;
      if (policyNumber) {
        stats.policies.add(policyNumber);
      }
    }
  });

  const monthly_summary = Array.from(monthlyStats.entries())
    .map(([month, stats]) => ({
      month,
      total_gross_premium: stats.premium,
      total_policies: stats.policies.size
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  return {
    total_records: filteredData.length,
    total_policies: uniquePolicies,
    total_cutpay_transactions: cutpayTransactions,
    total_gross_premium,
    total_net_premium,
    total_cutpay_amount,
    top_agents,
    top_insurers,
    monthly_summary
  };
});

// Pagination state (client-side)
export const googleSheetsMISPaginationAtom = atom({
  page: 1,
  pageSize: 50,
  totalPages: 0
});

// Paginated data derived atom
export const googleSheetsMISPaginatedDataAtom = atom((get) => {
  const filteredData = get(googleSheetsMISFilteredDataAtom);
  const pagination = get(googleSheetsMISPaginationAtom);
  
  const totalPages = Math.ceil(filteredData.length / pagination.pageSize);
  const startIndex = (pagination.page - 1) * pagination.pageSize;
  const endIndex = startIndex + pagination.pageSize;
  
  return {
    data: filteredData.slice(startIndex, endIndex),
    totalRecords: filteredData.length,
    totalPages,
    currentPage: pagination.page,
    pageSize: pagination.pageSize
  };
});

// Atom to update column unique values when raw data changes
export const updateColumnValuesAtom = atom(
  null,
  (get, set) => {
    const rawData = get(googleSheetsMISRawDataAtom);
    const columnValues = new Map<keyof QuarterlySheetRecord, string[]>();
    
    if (rawData.length === 0) {
      set(googleSheetsMISColumnValuesAtom, columnValues);
      return;
    }
    
    // Get all unique values for each column
    const columns = Object.keys(rawData[0]) as (keyof QuarterlySheetRecord)[];
    
    columns.forEach(column => {
      const uniqueValues = new Set<string>();
      rawData.forEach(record => {
        const value = record[column]?.toString().trim();
        if (value) {
          uniqueValues.add(value);
        }
      });
      columnValues.set(column, Array.from(uniqueValues).sort());
    });
    
    set(googleSheetsMISColumnValuesAtom, columnValues);
  }
);

// Helper atoms for filter actions
export const setGlobalSearchAtom = atom(
  null,
  (get, set, searchTerm: string) => {
    const currentFilters = get(googleSheetsMISClientFiltersAtom);
    set(googleSheetsMISClientFiltersAtom, {
      ...currentFilters,
      globalSearch: searchTerm
    });
  }
);

export const setSortAtom = atom(
  null,
  (get, set, sortBy: keyof QuarterlySheetRecord | null, direction: 'asc' | 'desc' = 'asc') => {
    const currentFilters = get(googleSheetsMISClientFiltersAtom);
    set(googleSheetsMISClientFiltersAtom, {
      ...currentFilters,
      sortBy,
      sortDirection: direction
    });
  }
);

export const setColumnFilterAtom = atom(
  null,
  (get, set, column: keyof QuarterlySheetRecord, filter: Partial<ColumnFilter>) => {
    const currentFilters = get(googleSheetsMISClientFiltersAtom);
    const newColumnFilters = new Map(currentFilters.columnFilters);
    
    const currentColumnFilter = newColumnFilters.get(column) || {
      column,
      selectedValues: new Set(),
      searchTerm: '',
      isActive: false
    };
    
    newColumnFilters.set(column, { ...currentColumnFilter, ...filter });
    
    set(googleSheetsMISClientFiltersAtom, {
      ...currentFilters,
      columnFilters: newColumnFilters
    });
  }
);

export const setDateRangeFilterAtom = atom(
  null,
  (get, set, column: string, from?: string, to?: string) => {
    const currentFilters = get(googleSheetsMISClientFiltersAtom);
    const newDateRangeFilters = { ...currentFilters.dateRangeFilters };
    
    if (from || to) {
      newDateRangeFilters[column] = { from, to };
    } else {
      delete newDateRangeFilters[column];
    }
    
    set(googleSheetsMISClientFiltersAtom, {
      ...currentFilters,
      dateRangeFilters: newDateRangeFilters
    });
  }
);

export const setNumberRangeFilterAtom = atom(
  null,
  (get, set, column: string, min?: number, max?: number) => {
    const currentFilters = get(googleSheetsMISClientFiltersAtom);
    const newNumberRangeFilters = { ...currentFilters.numberRangeFilters };
    
    if (min !== undefined || max !== undefined) {
      newNumberRangeFilters[column] = { min, max };
    } else {
      delete newNumberRangeFilters[column];
    }
    
    set(googleSheetsMISClientFiltersAtom, {
      ...currentFilters,
      numberRangeFilters: newNumberRangeFilters
    });
  }
);

export const clearAllFiltersAtom = atom(
  null,
  (get, set) => {
    set(googleSheetsMISClientFiltersAtom, {
      globalSearch: '',
      columnFilters: new Map(),
      sortBy: null,
      sortDirection: 'asc',
      dateRangeFilters: {},
      numberRangeFilters: {}
    });
  }
);