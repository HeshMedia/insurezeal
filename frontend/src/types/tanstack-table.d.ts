import { RowData } from '@tanstack/react-table'
import { PendingUpdates } from '@/lib/atoms/mis'

// This file augments the TanStack Table module to add our custom properties to the table's `meta` object.
// By defining it in one central place, we avoid conflicts between different table implementations.
// All properties are optional (`?`) so that each table only needs to provide the meta properties it actually uses.

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface TableMeta<TData extends RowData> {
    // --- Properties for MasterSheetTable ---
    updateDataById?: (recordId: string, columnId: string, value: unknown) => void
    pendingUpdates?: PendingUpdates

    // --- Properties for CutPayTable ---
    updateDataByIndex?: (rowIndex: number, columnId: string, value: unknown) => void

    // --- Common properties for all editable tables ---
    editingCell?: { rowIndex: number; columnId: string } | null
    setEditingCell?: (cell: { rowIndex: number; columnId: string } | null) => void
  }
}