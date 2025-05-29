export interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
}

export interface TableData {
  name: string;
  data: Record<string, any>[];
  columns: ColumnInfo[];
  rowCount: number;
}

export interface DatabaseInfo {
  tables: TableData[];
  totalTables: number;
  totalRows: number;
  processedTables?: number;
  message?: string;
  error?: string;
}

export interface ErrorResponse {
  error: string;
  details?: string;
  suggestion?: string;
  troubleshooting?: {
    timestamp: string;
    userAgent: string;
    user: string;
    suggestions: string[];
  };
}