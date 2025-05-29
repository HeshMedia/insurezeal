'use client';

import { DatabaseInfo } from '../types/types';

interface DatabaseInfoSummaryProps {
  databaseInfo: DatabaseInfo | null;
}

export function DatabaseInfoSummary({ databaseInfo }: DatabaseInfoSummaryProps) {
  if (!databaseInfo) return null;
  
  return (
    <div className="flex gap-4 text-sm text-muted-foreground">
      <span>Tables: {databaseInfo.totalTables}</span>
      <span>Total Rows: {databaseInfo.totalRows.toLocaleString()}</span>
      {databaseInfo.processedTables && (
        <span>Processed: {databaseInfo.processedTables}</span>
      )}
    </div>
  );
}