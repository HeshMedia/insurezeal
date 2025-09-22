// components/datatable/GenericEditableCell.tsx
"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { CellContext } from "@tanstack/react-table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ColumnConfig } from "@/types/table.types";
import { useAtom } from 'jotai';
import { multiSelectStateAtom, SelectedCell } from '@/lib/atoms/google-sheets-mis';

interface GenericEditableCellProps<T> extends CellContext<T, unknown> {
  columnConfig: ColumnConfig;
}


export function GenericEditableCell<T>({ 
  row, 
  column, 
  table,
  columnConfig 
}: GenericEditableCellProps<T>) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [multiSelectState, setMultiSelectState] = useAtom(multiSelectStateAtom);

  // Get the value using exact field access like original (no backendField mapping)
  const getRowValue = () => {
    if (columnConfig.accessor) {
      return columnConfig.accessor(row.original as Record<string, unknown>);
    }
    // Use column ID as literal field name (matches original pattern exactly)
    return (row.original as Record<string, unknown>)[column.id];
  };

  const initialValue = getRowValue();

  // Get meta functions from table (exact same pattern as original)
  const { updateDataById, editingCell, setEditingCell, pendingUpdates, idAccessor } = table.options.meta! as {
    updateDataById: (recordId: string, fieldName: string, value: unknown) => void;
    editingCell: { rowIndex: number; columnId: string } | null;
    setEditingCell: (cell: { rowIndex: number; columnId: string } | null) => void;
    pendingUpdates: Record<string, Record<string, unknown>> | undefined;
    idAccessor: (row: unknown) => string;
  };

  const recordId = idAccessor(row.original);
  const pendingValue = pendingUpdates?.[recordId]?.[column.id];
  const displayValue = pendingValue !== undefined ? pendingValue : initialValue;

  const [value, setValue] = useState<string | number>(() => {
    if (displayValue === null || displayValue === undefined) return '';
    return String(displayValue);
  });

  const isEditing = editingCell?.rowIndex === row.index && editingCell?.columnId === column.id;
  
  // Multi-select cell data
  const cellData: SelectedCell = {
    recordId,
    fieldName: column.id,
    rowIndex: row.index,
    columnIndex: table.getAllColumns().findIndex(col => col.id === column.id),
    currentValue: String(displayValue || '')
  };
  
  const isSelected = multiSelectState.selectedCells.some(
    cell => cell.recordId === recordId && cell.fieldName === column.id
  );
  
  const isDragFillSource = multiSelectState.dragFillSource?.recordId === recordId && 
                          multiSelectState.dragFillSource?.fieldName === column.id;

  const onSave = () => {
    setEditingCell!(null);
    if (value === displayValue) return;

    // If multi-select is active, apply the typed value to all selected cells (Excel-like Ctrl+Enter behavior)
    if (multiSelectState.selectedCells.length > 1) {
      multiSelectState.selectedCells.forEach(cell => {
        updateDataById!(cell.recordId, cell.fieldName, value);
      });
      // Clear selection after applying to all cells
      setMultiSelectState(prev => ({ ...prev, selectedCells: [] }));
    } else {
      updateDataById!(recordId, column.id, value);
    }
  };

  const onCancel = () => {
    setValue(displayValue ? String(displayValue) : '');
    setEditingCell!(null);
    // Don't clear selection on cancel, keep it for further operations
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      onSave();
    } else if (e.key === "Escape") {
      onCancel();
    }
  };

  // Multi-select event handlers with improved text selection prevention
  const handleCellClick = (e: React.MouseEvent) => {
    if (!columnConfig.editable) return;

    if (e.ctrlKey || e.metaKey) {
      // Ctrl+Click: Toggle individual cell selection
      e.preventDefault();
      setMultiSelectState(prev => {
        const isCurrentlySelected = prev.selectedCells.some(
          cell => cell.recordId === recordId && cell.fieldName === column.id
        );
        
        if (isCurrentlySelected) {
          // Remove from selection
          return {
            ...prev,
            selectedCells: prev.selectedCells.filter(
              cell => !(cell.recordId === recordId && cell.fieldName === column.id)
            )
          };
        } else {
          // Add to selection
          return {
            ...prev,
            selectedCells: [...prev.selectedCells, cellData]
          };
        }
      });
    } else if (e.shiftKey && multiSelectState.selectionStart) {
      // Shift+Click: Select range
      e.preventDefault();
      const start = multiSelectState.selectionStart;
      const end = cellData;
      
      const startRow = Math.min(start.rowIndex, end.rowIndex);
      const endRow = Math.max(start.rowIndex, end.rowIndex);
      const startCol = Math.min(start.columnIndex, end.columnIndex);
      const endCol = Math.max(start.columnIndex, end.columnIndex);
      
      const rangeSelection: SelectedCell[] = [];
      const allColumns = table.getAllColumns();
      const allRows = table.getRowModel().rows;
      
      for (let rowIdx = startRow; rowIdx <= endRow; rowIdx++) {
        for (let colIdx = startCol; colIdx <= endCol; colIdx++) {
          const targetRow = allRows[rowIdx];
          const targetColumn = allColumns[colIdx];
          if (targetRow && targetColumn) {
            const targetRecordId = idAccessor(targetRow.original);
            const targetValue = (targetRow.original as Record<string, unknown>)[targetColumn.id];
            rangeSelection.push({
              recordId: targetRecordId,
              fieldName: targetColumn.id,
              rowIndex: rowIdx,
              columnIndex: colIdx,
              currentValue: String(targetValue || '')
            });
          }
        }
      }
      
      setMultiSelectState(prev => ({
        ...prev,
        selectedCells: rangeSelection
      }));
    } else {
      // Regular click: Clear selection and select this cell
      setMultiSelectState(prev => ({
        ...prev,
        selectedCells: [cellData],
        selectionStart: cellData,
        isSelecting: false
      }));
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!columnConfig.editable) return;
    
    // Prevent default text selection and clear existing selections
    e.preventDefault();
    window.getSelection?.()?.removeAllRanges?.();
    
    // Check if clicking on drag-fill handle
    const target = e.target as HTMLElement;
    if (target.classList.contains('drag-fill-handle')) {
      setMultiSelectState(prev => ({
        ...prev,
        dragFillSource: cellData,
        isDragFilling: true
      }));
      return;
    }

    // Start selection drag
    if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
      setMultiSelectState(prev => ({
        ...prev,
        isSelecting: true,
        selectionStart: cellData,
        selectedCells: [cellData]
      }));
    }
  };

  const handleMouseEnter = (e: React.MouseEvent) => {
    // Prevent text selection during drag operations
    if (multiSelectState.isSelecting || multiSelectState.isDragFilling) {
      e.preventDefault();
      window.getSelection?.()?.removeAllRanges?.();
    }

    if (multiSelectState.isSelecting && multiSelectState.selectionStart) {
      // Drag selection
      const start = multiSelectState.selectionStart;
      const end = cellData;
      
      const startRow = Math.min(start.rowIndex, end.rowIndex);
      const endRow = Math.max(start.rowIndex, end.rowIndex);
      const startCol = Math.min(start.columnIndex, end.columnIndex);
      const endCol = Math.max(start.columnIndex, end.columnIndex);
      
      const rangeSelection: SelectedCell[] = [];
      const allColumns = table.getAllColumns();
      const allRows = table.getRowModel().rows;
      
      for (let rowIdx = startRow; rowIdx <= endRow; rowIdx++) {
        for (let colIdx = startCol; colIdx <= endCol; colIdx++) {
          const targetRow = allRows[rowIdx];
          const targetColumn = allColumns[colIdx];
          if (targetRow && targetColumn) {
            const targetRecordId = idAccessor(targetRow.original);
            const targetValue = (targetRow.original as Record<string, unknown>)[targetColumn.id];
            rangeSelection.push({
              recordId: targetRecordId,
              fieldName: targetColumn.id,
              rowIndex: rowIdx,
              columnIndex: colIdx,
              currentValue: String(targetValue || '')
            });
          }
        }
      }
      
      setMultiSelectState(prev => ({
        ...prev,
        selectedCells: rangeSelection
      }));
    } else if (multiSelectState.isDragFilling && multiSelectState.dragFillSource) {
      // Drag fill functionality - immediately copy source value to pending updates
      const source = multiSelectState.dragFillSource;
      const current = cellData;
      
      // Determine if we're dragging vertically or horizontally
      const isVertical = source.columnIndex === current.columnIndex;
      const isHorizontal = source.rowIndex === current.rowIndex;
      
      if (isVertical || isHorizontal) {
        const fillCells: SelectedCell[] = [];
        
        if (isVertical) {
          // Vertical fill
          const startRow = Math.min(source.rowIndex, current.rowIndex);
          const endRow = Math.max(source.rowIndex, current.rowIndex);
          const allRows = table.getRowModel().rows;
          
          for (let rowIdx = startRow; rowIdx <= endRow; rowIdx++) {
            const targetRow = allRows[rowIdx];
            if (targetRow) {
              const targetRecordId = idAccessor(targetRow.original);
              fillCells.push({
                recordId: targetRecordId,
                fieldName: source.fieldName,
                rowIndex: rowIdx,
                columnIndex: source.columnIndex,
                currentValue: source.currentValue
              });
            }
          }
        } else if (isHorizontal) {
          // Horizontal fill
          const startCol = Math.min(source.columnIndex, current.columnIndex);
          const endCol = Math.max(source.columnIndex, current.columnIndex);
          const allColumns = table.getAllColumns();
          
          for (let colIdx = startCol; colIdx <= endCol; colIdx++) {
            const targetColumn = allColumns[colIdx];
            if (targetColumn) {
              fillCells.push({
                recordId: source.recordId,
                fieldName: targetColumn.id,
                rowIndex: source.rowIndex,
                columnIndex: colIdx,
                currentValue: source.currentValue
              });
            }
          }
        }
        
        setMultiSelectState(prev => ({
          ...prev,
          selectedCells: fillCells
        }));
      }
    }
  };

  const handleMouseUp = useCallback(() => {
    if (multiSelectState.isDragFilling && multiSelectState.selectedCells.length > 0) {
      // Apply drag fill values immediately to pending updates
      const sourceValue = multiSelectState.dragFillSource?.currentValue || '';
      multiSelectState.selectedCells.forEach(cell => {
        if (cell.recordId !== multiSelectState.dragFillSource?.recordId || 
            cell.fieldName !== multiSelectState.dragFillSource?.fieldName) {
          updateDataById!(cell.recordId, cell.fieldName, sourceValue);
        }
      });
    }
    
    setMultiSelectState(prev => ({
      ...prev,
      isSelecting: false,
      isDragFilling: false
    }));
  }, [multiSelectState.isDragFilling, multiSelectState.selectedCells, multiSelectState.dragFillSource, updateDataById, setMultiSelectState]);

  // Prevent native text selection during drag operations
  useEffect(() => {
    if (multiSelectState.isSelecting || multiSelectState.isDragFilling) {
      const prev = document.body.style.userSelect;
      document.body.style.userSelect = 'none';
      window.getSelection?.()?.removeAllRanges?.();
      return () => { 
        document.body.style.userSelect = prev; 
      };
    }
  }, [multiSelectState.isSelecting, multiSelectState.isDragFilling]);

  // Global mouse events
  useEffect(() => {
    const handleGlobalMouseUp = () => handleMouseUp();
    
    if (multiSelectState.isSelecting || multiSelectState.isDragFilling) {
      document.addEventListener('mouseup', handleGlobalMouseUp);
      return () => document.removeEventListener('mouseup', handleGlobalMouseUp);
    }
  }, [multiSelectState.isSelecting, multiSelectState.isDragFilling, handleMouseUp]);

  // Handle typing on selected cells (Excel-like behavior)
  const onKeyDownWrapper = (e: React.KeyboardEvent) => {
    // Don't handle if we're already editing
    if (isEditing) return;

    // Handle typing on selected cells - when multiple cells are selected, typing should fill all
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && multiSelectState.selectedCells.length > 0) {
      e.preventDefault();
      
      // Apply the typed character to all selected cells immediately
      multiSelectState.selectedCells.forEach(cell => {
        updateDataById!(cell.recordId, cell.fieldName, e.key);
      });
      
      // Start editing this specific cell
      setEditingCell!({ rowIndex: row.index, columnId: column.id });
      
      // Clear the selection since we're now in edit mode
      setMultiSelectState(prev => ({ ...prev, selectedCells: [] }));
      
      // Set the input value and focus
      setTimeout(() => {
        setValue(e.key);
        inputRef.current?.focus();
        inputRef.current?.setSelectionRange(1, 1); // Put cursor at end
      }, 0);
    }
    // Handle Escape key to clear selection
    else if (e.key === 'Escape' && multiSelectState.selectedCells.length > 0) {
      e.preventDefault();
      setMultiSelectState(prev => ({ ...prev, selectedCells: [] }));
    }
  };

  // Block native HTML drag
  const onDragStart = (e: React.DragEvent) => e.preventDefault();

  useEffect(() => {
    if (isEditing) {
      setValue(displayValue ? String(displayValue) : '');
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing, displayValue]);

  useEffect(() => {
    if (!isEditing) {
      setValue(displayValue ? String(displayValue) : '');
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

  const renderDisplayValue = (): React.ReactNode => {
    if (displayValue === null || displayValue === undefined || displayValue === '') {
      return <span className="text-gray-400">N/A</span>;
    }
    
    // Use custom formatter if provided (like original)
    if (columnConfig.formatter) {
      return <div dangerouslySetInnerHTML={{ __html: columnConfig.formatter(displayValue, row.original as Record<string, unknown>) }} />;
    }
    
    // Type-specific rendering (like InputForm's renderField logic)
    switch (columnConfig.kind) {
      case 'currency':
        return `₹${Number(displayValue).toLocaleString()}`;
      case 'badge':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">{String(displayValue)}</span>;
      case 'select':
        const option = columnConfig.options?.find(opt => opt.value === displayValue);
        return option?.label || String(displayValue);
      case 'number':
        return typeof displayValue === 'number' ? displayValue.toLocaleString() : String(displayValue);
      case 'date':
        try {
          return new Date(String(displayValue)).toLocaleDateString();
        } catch {
          return String(displayValue);
        }
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
      onClick={handleCellClick}
      onMouseDown={handleMouseDown}
      onMouseEnter={handleMouseEnter}
      onMouseUp={handleMouseUp}
      onKeyDown={onKeyDownWrapper}
      onDragStart={onDragStart}
      onDoubleClick={() => setEditingCell!({ rowIndex: row.index, columnId: column.id })}
      tabIndex={0}
      className={cn(
        "w-full h-full min-h-[53px] flex items-center px-4 py-2 relative transition-all duration-200",
        "hover:bg-blue-100/50 cursor-pointer focus:outline-none",
        isSelected ? "bg-blue-200/70 border-2 border-blue-500" : "",
        isDragFillSource ? "border-blue-600 border-2 shadow-lg" : "",
        hasPendingChange && !isSelected
          ? "bg-green-100 border-2 border-green-300 border-solid"
          : !isSelected ? "border-2 border-transparent" : ""
      )}
    >
      {hasPendingChange && (
        <div
          className="absolute top-0 left-0 w-0 h-0 border-l-8 border-l-orange-400 border-t-8 border-t-orange-400"
          title="Pending change"
        />
      )}
      
      {/* Single drag fill handle on active bottom-right cell of selection (Excel-like) */}
      {(() => {
        const allCols = table.getAllColumns();
        const thisColIndex = allCols.findIndex(col => col.id === column.id);
        const sel = multiSelectState.selectedCells;
        const isActiveHandleCell = isSelected && sel.length > 0 && 
          row.index === Math.max(...sel.map(c => c.rowIndex)) &&
          thisColIndex === Math.max(...sel.map(c => c.columnIndex));
        
        return isActiveHandleCell && columnConfig.editable && (
          <div 
            className="
              drag-fill-handle absolute bottom-0 right-0 w-2 h-2 bg-blue-500 
              cursor-crosshair border border-white transform translate-x-1 translate-y-1
              hover:bg-blue-600 z-10
            "
            onMouseDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setMultiSelectState(prev => ({
                ...prev,
                dragFillSource: cellData,
                isDragFilling: true
              }));
            }}
          />
        );
      })()}
      
      {renderDisplayValue()}
    </div>
  );
}
