// components/datatable/GenericEditableCell.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import { CellContext } from "@tanstack/react-table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ColumnConfig } from "@/types/mistable.types";

interface GenericEditableCellProps<T> extends CellContext<T, unknown> {
  columnConfig: ColumnConfig;
}

export function GenericEditableCell<T>({ 
  getValue, 
  row, 
  column, 
  table,
  columnConfig 
}: GenericEditableCellProps<T>) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Get the value using exact field access like original (no backendField mapping)
  const getRowValue = () => {
    if (columnConfig.accessor) {
      return columnConfig.accessor(row.original);
    }
    // Use column ID as literal field name (matches original pattern exactly)
    return (row.original as any)[column.id];
  };

  const initialValue = getRowValue();

  // Get meta functions from table (exact same pattern as original)
  const { updateDataById, editingCell, setEditingCell, pendingUpdates, idAccessor } = table.options.meta! as any;

  const recordId = idAccessor(row.original);
  const pendingValue = pendingUpdates?.[recordId]?.[column.id];
  const displayValue = pendingValue !== undefined ? pendingValue : initialValue;

  const [value, setValue] = useState(displayValue);

  const isEditing = editingCell?.rowIndex === row.index && editingCell?.columnId === column.id;

  const onSave = () => {
    setEditingCell!(null);
    if (value !== displayValue) {
      updateDataById!(recordId, column.id, value);
    }
  };

  const onCancel = () => {
    setValue(displayValue);
    setEditingCell!(null);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      onSave();
    } else if (e.key === "Escape") {
      onCancel();
    }
  };

  useEffect(() => {
    if (isEditing) {
      setValue(displayValue);
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing, displayValue]);

  useEffect(() => {
    if (!isEditing) {
      setValue(displayValue);
    }
  }, [displayValue, isEditing]);

  if (isEditing) {
    return (
      <div className="p-1">
        {columnConfig.kind === 'select' && columnConfig.options ? (
          <Select value={(value as string) || ""} onValueChange={setValue}>
            <SelectTrigger className="h-9 w-full bg-white ring-2 ring-blue-400">
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              {columnConfig.options.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            ref={inputRef}
            type={columnConfig.kind === 'number' || columnConfig.kind === 'currency' ? 'number' : columnConfig.kind === 'date' ? 'date' : 'text'}
            value={(value as string) || ""}
            onChange={(e) => setValue(e.target.value)}
            onBlur={onSave}
            onKeyDown={onKeyDown}
            className="h-9 w-full bg-white ring-2 ring-blue-400 transition-transform duration-200 scale-105"
            step={columnConfig.kind === 'number' || columnConfig.kind === 'currency' ? "0.01" : undefined}
          />
        )}
      </div>
    );
  }

  const hasPendingChange = pendingValue !== undefined;

  const renderDisplayValue = () => {
    if (displayValue === null || displayValue === undefined || displayValue === '') {
      return <span className="text-gray-400">N/A</span>;
    }
    
    // Use custom formatter if provided (like original)
    if (columnConfig.formatter) {
      return <div dangerouslySetInnerHTML={{ __html: columnConfig.formatter(displayValue, row.original) }} />;
    }
    
    // Type-specific rendering (like InputForm's renderField logic)
    switch (columnConfig.kind) {
      case 'currency':
        return `₹${Number(displayValue).toLocaleString()}`;
      case 'badge':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">{displayValue}</span>;
      case 'select':
        const option = columnConfig.options?.find(opt => opt.value === displayValue);
        return option?.label || displayValue;
      case 'number':
        return typeof displayValue === 'number' ? displayValue.toLocaleString() : displayValue;
      case 'date':
        return new Date(displayValue).toLocaleDateString();
      default:
        return String(displayValue);
    }
  };

  if (!columnConfig.editable) {
    return (
      <div className="w-full h-full min-h-[53px] flex items-center px-4 py-2">
        {renderDisplayValue()}
      </div>
    );
  }

  return (
    <div
      onDoubleClick={() => setEditingCell!({ rowIndex: row.index, columnId: column.id })}
      className={cn(
        "w-full h-full min-h-[53px] flex items-center px-4 py-2 relative transition-all duration-200",
        "hover:bg-blue-100/50 cursor-pointer",
        hasPendingChange
          ? "bg-green-100 border-2 border-green-300 border-solid"
          : "border-2 border-transparent"
      )}
    >
      {hasPendingChange && (
        <div
          className="absolute top-0 left-0 w-0 h-0 border-l-8 border-l-transparent"
          title="Pending change"
        />
      )}
      {renderDisplayValue()}
    </div>
  );
}
