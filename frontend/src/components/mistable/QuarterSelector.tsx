// components/mistable/QuarterSheetSelect.tsx
"use client";

import React, { useMemo } from "react";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "lucide-react";

type Props = {
  availableSheets: string[];
  selectedSheet?: string;
  onSheetChange?: (sheet: string) => void;
  loading?: boolean;
  className?: string;
};

const isQuarterSheet = (sheetName: string) => {
  const quarterPatterns = [
    /q[1-4]/i,
    /quarter/i,
    /qtr/i,
    /\d{4}.*q[1-4]/i,
    /[1-4].*quarter/i,
    /jan.*mar|apr.*jun|jul.*sep|oct.*dec/i,
    /fy\d{2}/i,
  ];
  return quarterPatterns.some((pattern) => pattern.test(sheetName));
};

export function QuarterSheetSelect({
  availableSheets,
  selectedSheet,
  onSheetChange,
  loading,
  className,
}: Props) {
  const { quarterSheets, hasQuarters } = useMemo(() => {
    const qs = availableSheets.filter(isQuarterSheet);
    return { quarterSheets: qs, hasQuarters: qs.length > 0 };
  }, [availableSheets]);

  return (
    <div className={`flex items-center gap-2 ml-8 pl-6 border-l border-gray-200 ${className || ""}`}>
      {hasQuarters ? (
        <>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Calendar className="h-4 w-4 text-blue-500" />
            <span className="font-medium">Quarter:</span>
          </div>
          <Select
            value={selectedSheet || ""}
            onValueChange={(value) => {
              onSheetChange?.(value);
            }}
          >
            <SelectTrigger
              className="w-52 h-8 text-sm bg-white border-gray-300 hover:border-blue-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors"
              title="Select a quarter sheet to view specific period data"
            >
              <SelectValue placeholder="Choose quarter..." />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {quarterSheets.map((sheetName) => (
                <SelectItem
                  key={sheetName}
                  value={sheetName}
                  className="text-sm hover:bg-blue-50 focus:bg-blue-50"
                >
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3 w-3 text-blue-400" />
                    {sheetName}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
         
          {loading && (
            <div className="text-xs text-blue-600 font-medium animate-pulse"> Loading...</div>
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
