// components/ui/ColumnFilterDropdown.tsx - Google Sheets-style column filter dropdown
"use client";

import React, { useState, useMemo } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Search, 
  Calendar, 
  Hash, 
  Type, 
  Check, 
  X 
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ColumnFilter {
  type: 'values' | 'search' | 'date_range' | 'number_range';
  values?: string[];
  search?: string;
  dateRange?: { start?: string; end?: string };
  numberRange?: { min?: number; max?: number };
}

interface ColumnFilterDropdownProps {
  columnId: string;
  onFilter: (columnId: string, filter: ColumnFilter | null) => void;
  getUniqueValues: () => any[];
  currentFilter?: ColumnFilter;
  children: React.ReactNode;
}

export function ColumnFilterDropdown({
  columnId,
  onFilter,
  getUniqueValues,
  currentFilter,
  children
}: ColumnFilterDropdownProps) {
  const [filterType, setFilterType] = useState<ColumnFilter['type']>('values');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedValues, setSelectedValues] = useState<string[]>(
    currentFilter?.values || []
  );
  const [dateRange, setDateRange] = useState(
    currentFilter?.dateRange || { start: '', end: '' }
  );
  const [numberRange, setNumberRange] = useState(
    currentFilter?.numberRange || { min: undefined, max: undefined }
  );

  const uniqueValues = useMemo(() => {
    const values = getUniqueValues()
      .filter(val => val !== null && val !== undefined && val !== '')
      .map(val => String(val))
      .filter((val, index, arr) => arr.indexOf(val) === index)
      .sort();
    return values;
  }, [getUniqueValues]);

  // Detect column type based on values
  const columnType = useMemo(() => {
    const sampleValues = uniqueValues.slice(0, 10);
    
    // Check if mostly dates
    const dateCount = sampleValues.filter(val => 
      !isNaN(Date.parse(val)) && val.match(/\d{4}-\d{2}-\d{2}|\/|-/)
    ).length;
    
    // Check if mostly numbers
    const numberCount = sampleValues.filter(val => 
      !isNaN(Number(val)) && isFinite(Number(val))
    ).length;
    
    if (dateCount > sampleValues.length * 0.7) return 'date';
    if (numberCount > sampleValues.length * 0.7) return 'number';
    return 'text';
  }, [uniqueValues]);

  const filteredValues = useMemo(() => {
    if (!searchTerm) return uniqueValues;
    return uniqueValues.filter(val => 
      val.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [uniqueValues, searchTerm]);

  const handleApplyFilter = () => {
    let filter: ColumnFilter | null = null;

    switch (filterType) {
      case 'values':
        if (selectedValues.length > 0 && selectedValues.length < uniqueValues.length) {
          filter = { type: 'values', values: selectedValues };
        }
        break;
      case 'search':
        if (searchTerm.trim()) {
          filter = { type: 'search', search: searchTerm.trim() };
        }
        break;
      case 'date_range':
        if (dateRange.start || dateRange.end) {
          filter = { type: 'date_range', dateRange };
        }
        break;
      case 'number_range':
        if (numberRange.min !== undefined || numberRange.max !== undefined) {
          filter = { type: 'number_range', numberRange };
        }
        break;
    }

    onFilter(columnId, filter);
  };

  const handleClearFilter = () => {
    setSelectedValues([]);
    setSearchTerm('');
    setDateRange({ start: '', end: '' });
    setNumberRange({ min: undefined, max: undefined });
    onFilter(columnId, null);
  };

  const toggleValue = (value: string) => {
    setSelectedValues(prev => 
      prev.includes(value) 
        ? prev.filter(v => v !== value)
        : [...prev, value]
    );
  };

  const selectAll = () => {
    setSelectedValues(uniqueValues);
  };

  const selectNone = () => {
    setSelectedValues([]);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-sm">Filter Column</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilter}
              className="h-6 px-2 text-xs"
            >
              Clear
            </Button>
          </div>
          
          {/* Filter Type Selector */}
          <div className="flex gap-1 mb-3">
            <Button
              variant={filterType === 'values' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setFilterType('values')}
              className="h-7 px-2 text-xs"
            >
              <Check className="h-3 w-3 mr-1" />
              Values
            </Button>
            <Button
              variant={filterType === 'search' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setFilterType('search')}
              className="h-7 px-2 text-xs"
            >
              <Search className="h-3 w-3 mr-1" />
              Search
            </Button>
            {columnType === 'date' && (
              <Button
                variant={filterType === 'date_range' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setFilterType('date_range')}
                className="h-7 px-2 text-xs"
              >
                <Calendar className="h-3 w-3 mr-1" />
                Date
              </Button>
            )}
            {columnType === 'number' && (
              <Button
                variant={filterType === 'number_range' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setFilterType('number_range')}
                className="h-7 px-2 text-xs"
              >
                <Hash className="h-3 w-3 mr-1" />
                Number
              </Button>
            )}
          </div>
        </div>

        <div className="p-4 max-h-80 overflow-auto">
          {/* Values Filter */}
          {filterType === 'values' && (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search values..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-8 text-sm"
                />
              </div>
              
              <div className="flex justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={selectAll}
                  className="h-6 px-2 text-xs"
                >
                  Select All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={selectNone}
                  className="h-6 px-2 text-xs"
                >
                  Select None
                </Button>
              </div>
              
              <Separator />
              
              <ScrollArea className="h-48">
                <div className="space-y-2">
                  {filteredValues.map((value) => (
                    <div key={value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`${columnId}-${value}`}
                        checked={selectedValues.includes(value)}
                        onCheckedChange={() => toggleValue(value)}
                      />
                      <Label
                        htmlFor={`${columnId}-${value}`}
                        className="text-sm flex-1 cursor-pointer"
                      >
                        {value}
                      </Label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Search Filter */}
          {filterType === 'search' && (
            <div className="space-y-3">
              <Input
                placeholder="Enter search term..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8 text-sm"
              />
              <p className="text-xs text-gray-500">
                Find rows where this column contains the search term.
              </p>
            </div>
          )}

          {/* Date Range Filter */}
          {filterType === 'date_range' && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-gray-500">From</Label>
                <Input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-500">To</Label>
                <Input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  className="h-8 text-sm"
                />
              </div>
            </div>
          )}

          {/* Number Range Filter */}
          {filterType === 'number_range' && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-gray-500">Minimum</Label>
                <Input
                  type="number"
                  value={numberRange.min || ''}
                  onChange={(e) => setNumberRange(prev => ({ 
                    ...prev, 
                    min: e.target.value ? Number(e.target.value) : undefined 
                  }))}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-500">Maximum</Label>
                <Input
                  type="number"
                  value={numberRange.max || ''}
                  onChange={(e) => setNumberRange(prev => ({ 
                    ...prev, 
                    max: e.target.value ? Number(e.target.value) : undefined 
                  }))}
                  className="h-8 text-sm"
                />
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t">
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleApplyFilter}
              className="flex-1 h-8"
            >
              Apply Filter
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}