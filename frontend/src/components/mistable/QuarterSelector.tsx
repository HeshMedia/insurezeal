// components/mistable/QuarterSheetSelect.tsx
"use client";

import React, { useMemo, useState, useEffect } from "react";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";


type Props = {
  availableSheets: string[];
  selectedSheet?: string;
  onSheetChange?: (sheet: string) => void;
  loading?: boolean;
  className?: string;
};

type ParsedSheet = {
  name: string;
  quarter: number;
  year: number;
  displayName: string;
};

const parseQuarterSheet = (sheetName: string): ParsedSheet | null => {
  const name = sheetName.toLowerCase();
  
  // Extract quarter (Q1, Q2, Q3, Q4)
  let quarter = 0;
  if (name.includes('q1') || name.includes('quarter 1') || name.includes('jan') || name.includes('mar')) {
    quarter = 1;
  } else if (name.includes('q2') || name.includes('quarter 2') || name.includes('apr') || name.includes('jun')) {
    quarter = 2;
  } else if (name.includes('q3') || name.includes('quarter 3') || name.includes('jul') || name.includes('sep')) {
    quarter = 3;
  } else if (name.includes('q4') || name.includes('quarter 4') || name.includes('oct') || name.includes('dec')) {
    quarter = 4;
  } else {
    // Try to extract from patterns like "1", "2", "3", "4"
    const qMatch = name.match(/[^a-z]([1-4])[^0-9]/);
    if (qMatch) {
      quarter = parseInt(qMatch[1]);
    }
  }
  
  // Extract year (4-digit year or 2-digit FY)
  let year = 0;
  const yearMatch = name.match(/(?:20|fy)(\d{2})/);
  if (yearMatch) {
    const twoDigitYear = parseInt(yearMatch[1]);
    year = twoDigitYear < 50 ? 2000 + twoDigitYear : 1900 + twoDigitYear;
  } else {
    // Try 4-digit year
    const fullYearMatch = name.match(/(20\d{2})/);
    if (fullYearMatch) {
      year = parseInt(fullYearMatch[1]);
    }
  }
  
  if (quarter === 0 || year === 0) {
    return null;
  }
  
  return {
    name: sheetName,
    quarter,
    year,
    displayName: `Q${quarter} ${year}`
  };
};

export function QuarterSheetSelect({
  availableSheets,
  selectedSheet,
  onSheetChange,
  loading,
  className,
}: Props) {
  const [selectedQuarter, setSelectedQuarter] = useState<number | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  const { parsedSheets, availableQuarters, availableYears, hasQuarters } = useMemo(() => {
    const parsed = availableSheets
      .map(parseQuarterSheet)
      .filter((sheet): sheet is ParsedSheet => sheet !== null)
      .sort((a, b) => {
        // Sort by year desc, then quarter desc
        if (a.year !== b.year) return b.year - a.year;
        return b.quarter - a.quarter;
      });
    
    const quarters = Array.from(new Set(parsed.map(s => s.quarter))).sort((a, b) => a - b);
    const years = Array.from(new Set(parsed.map(s => s.year))).sort((a, b) => b - a);
    
    return {
      parsedSheets: parsed,
      availableQuarters: quarters,
      availableYears: years,
      hasQuarters: parsed.length > 0
    };
  }, [availableSheets]);

  // Initialize selection from selectedSheet prop
  useEffect(() => {
    if (selectedSheet) {
      const parsed = parseQuarterSheet(selectedSheet);
      if (parsed) {
        setSelectedQuarter(parsed.quarter);
        setSelectedYear(parsed.year);
      }
    }
  }, [selectedSheet]);

  // Update selected sheet when quarter/year changes
  useEffect(() => {
    if (selectedQuarter && selectedYear) {
      const matchingSheet = parsedSheets.find(
        s => s.quarter === selectedQuarter && s.year === selectedYear
      );
      if (matchingSheet && matchingSheet.name !== selectedSheet) {
        onSheetChange?.(matchingSheet.name);
      }
    }
  }, [selectedQuarter, selectedYear, parsedSheets, selectedSheet, onSheetChange]);

  const handleQuarterNavigation = (direction: 'prev' | 'next') => {
    if (!selectedQuarter || !selectedYear) return;
    
    let newQuarter = selectedQuarter;
    let newYear = selectedYear;
    
    if (direction === 'next') {
      if (newQuarter === 4) {
        newQuarter = 1;
        newYear++;
      } else {
        newQuarter++;
      }
    } else {
      if (newQuarter === 1) {
        newQuarter = 4;
        newYear--;
      } else {
        newQuarter--;
      }
    }
    
    // Check if this combination exists
    const exists = parsedSheets.some(s => s.quarter === newQuarter && s.year === newYear);
    if (exists) {
      setSelectedQuarter(newQuarter);
      setSelectedYear(newYear);
    }
  };

  const canNavigate = (direction: 'prev' | 'next') => {
    if (!selectedQuarter || !selectedYear) return false;
    
    let newQuarter = selectedQuarter;
    let newYear = selectedYear;
    
    if (direction === 'next') {
      if (newQuarter === 4) {
        newQuarter = 1;
        newYear++;
      } else {
        newQuarter++;
      }
    } else {
      if (newQuarter === 1) {
        newQuarter = 4;
        newYear--;
      } else {
        newQuarter--;
      }
    }
    
    return parsedSheets.some(s => s.quarter === newQuarter && s.year === newYear);
  };

  const getAvailableYearsForQuarter = (quarter: number) => {
    return availableYears.filter(year => 
      parsedSheets.some(s => s.quarter === quarter && s.year === year)
    );
  };

  const getAvailableQuartersForYear = (year: number) => {
    return availableQuarters.filter(quarter => 
      parsedSheets.some(s => s.quarter === quarter && s.year === year)
    );
  };

  return (
    <div className={`flex items-center gap-3 ml-8 pl-6 border-l border-gray-200 ${className || ""}`}>
      {hasQuarters ? (
        <>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Calendar className="h-4 w-4 text-blue-500" />
            <span className="font-medium">Period:</span>
          </div>
          
          {/* Navigation buttons */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => handleQuarterNavigation('prev')}
              disabled={!canNavigate('prev')}
              title="Previous quarter"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => handleQuarterNavigation('next')}
              disabled={!canNavigate('next')}
              title="Next quarter"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Quarter Selector */}
          <div className="flex items-center gap-2">
            <Select
              value={selectedQuarter?.toString() || ""}
              onValueChange={(value) => {
                const quarter = parseInt(value);
                setSelectedQuarter(quarter);
                
                // Auto-select most recent year for this quarter
                const yearsForQuarter = getAvailableYearsForQuarter(quarter);
                if (yearsForQuarter.length > 0 && !yearsForQuarter.includes(selectedYear || 0)) {
                  setSelectedYear(yearsForQuarter[0]);
                }
              }}
            >
              <SelectTrigger className="w-20 h-8 text-sm">
                <SelectValue placeholder="Q" />
              </SelectTrigger>
              <SelectContent>
                {availableQuarters.map((quarter) => (
                  <SelectItem key={quarter} value={quarter.toString()}>
                    Q{quarter}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Year Selector */}
            <Select
              value={selectedYear?.toString() || ""}
              onValueChange={(value) => {
                const year = parseInt(value);
                setSelectedYear(year);
                
                // Auto-select first available quarter for this year if current quarter is not available
                const quartersForYear = getAvailableQuartersForYear(year);
                if (quartersForYear.length > 0 && !quartersForYear.includes(selectedQuarter || 0)) {
                  setSelectedQuarter(quartersForYear[0]);
                }
              }}
            >
              <SelectTrigger className="w-20 h-8 text-sm">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {(selectedQuarter ? getAvailableYearsForQuarter(selectedQuarter) : availableYears).map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Current Selection Display */}
          {selectedQuarter && selectedYear && (
            <div className="text-sm text-blue-600 font-medium bg-blue-50 px-3 py-1 rounded-md">
              Q{selectedQuarter} {selectedYear}
            </div>
          )}
         
          {loading && (
            <div className="text-xs text-blue-600 font-medium animate-pulse">Loading...</div>
          )}
        </>
      ) : (
        <>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Calendar className="h-4 w-4 text-gray-400" />
            <span className="font-medium">No quarter sheets found</span>
          </div>
          <div className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
            ⚠️ Only quarter sheets can be displayed
          </div>
        </>
      )}
    </div>
  );
}
