'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { TableData as TableDataType } from '../types/types';
import { formatValue } from '../utils/format-utils';

interface TableDataProps {
  table: TableDataType;
}

export function TableDataComponent({ table }: TableDataProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{table.name} - Data (First 50 rows)</CardTitle>
      </CardHeader>
      <CardContent>
        {table.data.length === 0 ? (
          <p className="text-muted-foreground">No data in this table.</p>
        ) : (
          <div className="overflow-auto max-h-96 border rounded">
            <Table>
              <TableHeader>
                <TableRow>
                  {table.columns.map((column) => (
                    <TableHead key={column.column_name} className="whitespace-nowrap">
                      {column.column_name}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {table.data.map((row, index) => (
                  <TableRow key={index}>
                    {table.columns.map((column) => (
                      <TableCell 
                        key={column.column_name} 
                        className="whitespace-nowrap max-w-48 truncate"
                        title={formatValue(row[column.column_name])}
                      >
                        {formatValue(row[column.column_name])}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}