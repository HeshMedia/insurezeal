/* eslint-disable @typescript-eslint/no-explicit-any */
// table-component.types.ts - Shared types for MIS table components

export interface ColumnConfig {
  id: string;
  header: string;
  kind: 'text' | 'number' | 'date' | 'select' | 'badge' | 'readonly' | 'currency';
  accessor?: (row: unknown) => unknown;
  editable?: boolean;
  enableSorting?: boolean;
  width?: number;
  options?: { value: string; label: string }[];
  formatter?: (value: unknown, row?: unknown) => string;
  required?: boolean;
  hidden?: (row: unknown, allData: unknown[]) => boolean;
}

export interface DataSource {
  useList: () => {
    data: { pages: { records: unknown[] }[] };
    error: Error | null;
    fetchNextPage: () => void;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    isLoading: boolean;
  };
}

export interface SaveAdapter {
  toUpdates: (pendingUpdates: Record<string, Record<string, unknown>>) => {
    updates: { id: string; [key: string]: unknown }[];
  };
  mutate: () => (payload: unknown) => Promise<{ successful_updates?: number; [key: string]: unknown }>;
}

export interface SortConfig {
  id: string;
  desc: boolean;
}

export interface TableConfig<T> {
  title?: string;
  className?: string;
  columns: ColumnConfig[];
  pageSize?: number;
  enableSearch?: boolean;
  enableBulkEdit?: boolean;
  searchPlaceholder?: string;
  idAccessor: (row: T) => string;
  dataSource: DataSource;
  saveAdapter: SaveAdapter;
  defaultSort?: SortConfig[];
}

export interface DataTableProps<T> {
  config: TableConfig<T>;
  onPendingChangesCount?: (count: number) => void;
  clientFiltering?: any; // Accept client filtering from parent
  availableSheets?: string[]; // Available sheet names
  selectedSheet?: string; // Currently selected sheet
  onSheetChange?: (sheetName: string) => void; // Sheet change handler
}