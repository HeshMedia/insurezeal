'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { TableData } from '../types/types';

interface TablesSidebarProps {
  tables: TableData[];
  selectedTable: string;
  onTableSelect: (tableName: string) => void;
}

export function TablesSidebar({ tables, selectedTable, onTableSelect }: TablesSidebarProps) {
  return (
    <Card className="lg:col-span-1">
      <CardHeader>
        <CardTitle>Tables ({tables.length})</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-96 overflow-y-auto">
          {tables.map((table) => (
            <div
              key={table.name}
              className={`p-3 cursor-pointer hover:bg-accent border-b ${
                selectedTable === table.name ? 'bg-accent' : ''
              }`}
              onClick={() => onTableSelect(table.name)}
            >
              <div className="font-medium">{table.name}</div>
              <div className="text-sm text-muted-foreground">
                {table.rowCount.toLocaleString()} rows, {table.columns.length} columns
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}