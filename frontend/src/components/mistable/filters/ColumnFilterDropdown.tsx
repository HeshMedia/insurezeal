import React, { useState, useEffect, useMemo } from 'react';
import { QuarterlySheetRecord } from '@/types/admin-mis.types';
import { useClientSideFiltering } from '@/hooks/useClientSideFiltering';

interface ColumnFilterDropdownProps {
  column: keyof QuarterlySheetRecord;
  isOpen: boolean;
  onClose: () => void;
  position?: { top: number; left: number };
}

export const ColumnFilterDropdown: React.FC<ColumnFilterDropdownProps> = ({
  column,
  isOpen,
  onClose,
  position = { top: 0, left: 0 }
}) => {
  const { 
    getColumnUniqueValues, 
    getColumnFilter, 
    handleColumnFilter, 
    handleColumnSearch,
    handleDateRangeFilter,
    handleNumberRangeFilter
  } = useClientSideFiltering();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectAll, setSelectAll] = useState(true);
  const [selectedValues, setSelectedValues] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<'values' | 'search' | 'date' | 'number'>('values');

  const uniqueValues = useMemo(() => getColumnUniqueValues(column), [column, getColumnUniqueValues]);
  const currentFilter = useMemo(() => getColumnFilter(column), [column, getColumnFilter]);

  // Detect column type for smart filtering
  const columnType = useMemo(() => {
    if (uniqueValues.length === 0) return 'text';
    
    // Check if it's a date column
    const dateKeywords = ['date', 'time', 'created', 'updated', 'start', 'end'];
    const columnName = column.toString().toLowerCase();
    if (dateKeywords.some(keyword => columnName.includes(keyword))) {
      return 'date';
    }
    
    // Check if it's a number column
    const numberKeywords = ['premium', 'amount', 'price', 'cost', 'gst', 'balance', 'cc'];
    if (numberKeywords.some(keyword => columnName.includes(keyword))) {
      return 'number';
    }
    
    // Check if most values are numbers
    const numericValues = uniqueValues.filter(value => !isNaN(parseFloat(value)) && isFinite(parseFloat(value)));
    if (numericValues.length > uniqueValues.length * 0.8) {
      return 'number';
    }
    
    // Check if most values are dates
    const dateValues = uniqueValues.filter(value => !isNaN(Date.parse(value)));
    if (dateValues.length > uniqueValues.length * 0.8) {
      return 'date';
    }
    
    return 'text';
  }, [column, uniqueValues]);

  // Initialize filter state
  useEffect(() => {
    if (currentFilter) {
      setSelectedValues(new Set(currentFilter.selectedValues || []));
      setSearchTerm(currentFilter.searchTerm || '');
      setSelectAll((currentFilter.selectedValues?.size || 0) === uniqueValues.length);
    } else {
      setSelectedValues(new Set(uniqueValues));
      setSelectAll(true);
      setSearchTerm('');
    }
  }, [currentFilter, uniqueValues]);

  // Set default filter type based on column type
  useEffect(() => {
    setFilterType(columnType === 'text' ? 'values' : columnType);
  }, [columnType]);

  const filteredValues = useMemo(() => {
    if (!searchTerm) return uniqueValues;
    return uniqueValues.filter(value => 
      value.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [uniqueValues, searchTerm]);

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedValues(new Set());
      setSelectAll(false);
    } else {
      setSelectedValues(new Set(filteredValues));
      setSelectAll(true);
    }
  };

  const handleValueToggle = (value: string) => {
    const newSelection = new Set(selectedValues);
    if (newSelection.has(value)) {
      newSelection.delete(value);
    } else {
      newSelection.add(value);
    }
    setSelectedValues(newSelection);
    setSelectAll(newSelection.size === filteredValues.length);
  };

  const applyFilter = () => {
    if (filterType === 'values') {
      handleColumnFilter(column, selectedValues, selectedValues.size > 0);
    } else if (filterType === 'search') {
      handleColumnSearch(column, searchTerm);
    }
    onClose();
  };

  const clearFilter = () => {
    setSelectedValues(new Set(uniqueValues));
    setSelectAll(true);
    setSearchTerm('');
    handleColumnFilter(column, new Set(), false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div 
      className="absolute z-50 bg-white border border-gray-300 rounded-lg shadow-lg min-w-[280px] max-w-[400px]"
      style={{ top: position.top, left: position.left }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200">
        <h3 className="text-sm font-medium text-gray-900 truncate" title={column.toString()}>
          Filter: {column}
        </h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-lg"
        >
          ×
        </button>
      </div>

      {/* Filter Type Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setFilterType('values')}
          className={`px-3 py-2 text-xs font-medium ${
            filterType === 'values' 
              ? 'text-blue-600 border-b-2 border-blue-600' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Values
        </button>
        <button
          onClick={() => setFilterType('search')}
          className={`px-3 py-2 text-xs font-medium ${
            filterType === 'search' 
              ? 'text-blue-600 border-b-2 border-blue-600' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Search
        </button>
        {columnType === 'date' && (
          <button
            onClick={() => setFilterType('date')}
            className={`px-3 py-2 text-xs font-medium ${
              filterType === 'date' 
                ? 'text-blue-600 border-b-2 border-blue-600' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Date Range
          </button>
        )}
        {columnType === 'number' && (
          <button
            onClick={() => setFilterType('number')}
            className={`px-3 py-2 text-xs font-medium ${
              filterType === 'number' 
                ? 'text-blue-600 border-b-2 border-blue-600' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Number Range
          </button>
        )}
      </div>

      {/* Filter Content */}
      <div className="max-h-80 overflow-y-auto">
        {filterType === 'values' && (
          <ValuesFilter
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            selectAll={selectAll}
            handleSelectAll={handleSelectAll}
            filteredValues={filteredValues}
            selectedValues={selectedValues}
            handleValueToggle={handleValueToggle}
          />
        )}

        {filterType === 'search' && (
          <SearchFilter
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
          />
        )}

        {filterType === 'date' && (
          <DateRangeFilter
            column={column.toString()}
            onApply={handleDateRangeFilter}
          />
        )}

        {filterType === 'number' && (
          <NumberRangeFilter
            column={column.toString()}
            uniqueValues={uniqueValues}
            onApply={handleNumberRangeFilter}
          />
        )}
      </div>

      {/* Footer */}
      <div className="flex justify-between p-3 border-t border-gray-200">
        <button
          onClick={clearFilter}
          className="px-3 py-1 text-xs text-gray-600 hover:text-gray-800 border border-gray-300 rounded"
        >
          Clear
        </button>
        <div className="space-x-2">
          <button
            onClick={onClose}
            className="px-3 py-1 text-xs text-gray-600 hover:text-gray-800 border border-gray-300 rounded"
          >
            Cancel
          </button>
          <button
            onClick={applyFilter}
            className="px-3 py-1 text-xs text-white bg-blue-600 hover:bg-blue-700 rounded"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
};

// Sub-components for different filter types
const ValuesFilter: React.FC<{
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  selectAll: boolean;
  handleSelectAll: () => void;
  filteredValues: string[];
  selectedValues: Set<string>;
  handleValueToggle: (value: string) => void;
}> = ({ searchTerm, setSearchTerm, selectAll, handleSelectAll, filteredValues, selectedValues, handleValueToggle }) => (
  <div className="p-3">
    {/* Search within values */}
    <input
      type="text"
      placeholder="Search values..."
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      className="w-full px-3 py-1 text-sm border border-gray-300 rounded mb-3 focus:outline-none focus:ring-1 focus:ring-blue-500"
    />

    {/* Select All */}
    <label className="flex items-center space-x-2 p-2 hover:bg-gray-50 cursor-pointer">
      <input
        type="checkbox"
        checked={selectAll}
        onChange={handleSelectAll}
        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
      />
      <span className="text-sm font-medium text-gray-700">Select All</span>
    </label>

    {/* Values List */}
    <div className="space-y-1 max-h-48 overflow-y-auto">
      {filteredValues.map((value) => (
        <label key={value} className="flex items-center space-x-2 p-2 hover:bg-gray-50 cursor-pointer">
          <input
            type="checkbox"
            checked={selectedValues.has(value)}
            onChange={() => handleValueToggle(value)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700 truncate" title={value}>
            {value || '(empty)'}
          </span>
        </label>
      ))}
    </div>

    {filteredValues.length === 0 && (
      <div className="text-sm text-gray-500 text-center py-4">
        No matching values found
      </div>
    )}
  </div>
);

const SearchFilter: React.FC<{
  searchTerm: string;
  setSearchTerm: (term: string) => void;
}> = ({ searchTerm, setSearchTerm }) => (
  <div className="p-3">
    <label className="block text-sm font-medium text-gray-700 mb-2">
      Search in column
    </label>
    <input
      type="text"
      placeholder="Enter search term..."
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
    />
    <p className="text-xs text-gray-500 mt-2">
      Filter rows containing this text
    </p>
  </div>
);

const DateRangeFilter: React.FC<{
  column: string;
  onApply: (column: string, from?: string, to?: string) => void;
}> = ({ column, onApply }) => {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  return (
    <div className="p-3 space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          From Date
        </label>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          To Date
        </label>
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
    </div>
  );
};

const NumberRangeFilter: React.FC<{
  column: string;
  uniqueValues: string[];
  onApply: (column: string, min?: number, max?: number) => void;
}> = ({ column, uniqueValues, onApply }) => {
  const [minValue, setMinValue] = useState('');
  const [maxValue, setMaxValue] = useState('');

  // Calculate min/max from data
  const { min: dataMin, max: dataMax } = useMemo(() => {
    const numbers = uniqueValues
      .map(v => parseFloat(v))
      .filter(n => !isNaN(n) && isFinite(n));
    
    if (numbers.length === 0) return { min: 0, max: 100 };
    
    return {
      min: Math.min(...numbers),
      max: Math.max(...numbers)
    };
  }, [uniqueValues]);

  return (
    <div className="p-3 space-y-3">
      <div className="text-xs text-gray-500">
        Range: {dataMin.toLocaleString()} - {dataMax.toLocaleString()}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Minimum Value
        </label>
        <input
          type="number"
          placeholder={dataMin.toString()}
          value={minValue}
          onChange={(e) => setMinValue(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Maximum Value
        </label>
        <input
          type="number"
          placeholder={dataMax.toString()}
          value={maxValue}
          onChange={(e) => setMaxValue(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
    </div>
  );
};