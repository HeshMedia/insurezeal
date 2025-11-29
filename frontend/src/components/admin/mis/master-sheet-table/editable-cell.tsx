"use client";

import React, { useState, useEffect, useRef } from "react";
import { CellContext } from "@tanstack/react-table";
import { MasterSheetRecord } from "@/types/mis.types";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const EditableCell = ({
  getValue,
  row,
  column,
  table,
}: CellContext<MasterSheetRecord, unknown>) => {
  const initialValue = getValue();
  const inputRef = useRef<HTMLInputElement>(null);

  // Get pending updates from the table's meta object
  const { updateDataById, editingCell, setEditingCell, pendingUpdates } = table.options.meta!;

  // Determine the correct value to display: check for a pending update first, then fall back to the original value.
  const pendingValue = pendingUpdates?.[row.original.id]?.[column.id];
  const displayValue = pendingValue !== undefined ? pendingValue : initialValue;

  const [value, setValue] = useState(displayValue);

  const isEditing =
    editingCell?.rowIndex === row.index && editingCell?.columnId === column.id;

  const onSave = () => {
    setEditingCell!(null);
    // Only update if the value has actually changed from what's currently displayed
    if (value !== displayValue) {
      updateDataById!(row.original.id, column.id, value);
    }
  };

  const onCancel = () => {
    // On cancel, revert the cell's local state to the current display value
    setValue(displayValue);
    setEditingCell!(null);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      onSave();
    } else if (e.key === "Escape") {
      onCancel();
    }
  };

  useEffect(() => {
    if (isEditing) {
      // When entering edit mode, ensure the input is populated with the correct current value
      setValue(displayValue);
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing, displayValue]);

  // This effect ensures that if pending changes are cleared (e.g., after a successful save),
  // the cell updates to show the new initial value.
  useEffect(() => {
    if (!isEditing) {
      setValue(displayValue);
    }
  }, [displayValue, isEditing]);

  if (isEditing) {
    return (
      <div className="p-1">
        <Input
          ref={inputRef}
          type={"text"}
          value={(value as string) || ""}
          onChange={(e) => setValue(e.target.value)}
          onBlur={onSave}
          onKeyDown={onKeyDown}
          className="h-9 w-full bg-white ring-2 ring-blue-400 transition-transform duration-200 scale-105"
        />
      </div>
    );
  }

  const hasPendingChange = pendingValue !== undefined;

  // Helper function to safely render the display value
  const renderDisplayValue = () => {
    if (displayValue === null || displayValue === undefined || displayValue === '') {
      return <span className="text-gray-400">N/A</span>;
    }

    // If it's an object, convert to string or handle appropriately
    if (typeof displayValue === 'object') {
      return <span className="text-gray-400">N/A</span>;
    }

    return String(displayValue);
  };

  return (
    <div
      onDoubleClick={() =>
        setEditingCell!({ rowIndex: row.index, columnId: column.id })
      }
      className={cn(
        "w-full h-full min-h-[53px] flex items-center px-4 py-2 relative transition-all duration-200",
        "hover:bg-blue-100/50 cursor-pointer",
        // Add green styling for pending changes
        hasPendingChange
          ? "bg-green-100 border-2 border-green-300 border-solid"
          : "border-2 border-transparent"
      )}
    >
      {/* Keep the yellow triangle indicator as well */}
      {hasPendingChange && (
        <div
          className="absolute top-0 left-0 w-0 h-0  border-l-8  border-l-transparent"
          title="Pending change"
        ></div>
      )}
      {renderDisplayValue()}
    </div>
  );
};
