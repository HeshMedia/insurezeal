'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TableData } from '../types/types';
import { getDataTypeColor } from '../utils/format-utils';

interface TableSchemaProps {
  table: TableData;
}

export function TableSchema({ table }: TableSchemaProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{table.name} - Schema</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Column</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Nullable</TableHead>
                <TableHead>Default</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {table.columns.map((column) => (
                <TableRow key={column.column_name}>
                  <TableCell className="font-medium">
                    {column.column_name}
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant="secondary" 
                      className={getDataTypeColor(column.data_type)}
                    >
                      {column.data_type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={column.is_nullable === 'YES' ? 'outline' : 'secondary'}>
                      {column.is_nullable === 'YES' ? 'Yes' : 'No'}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-32 truncate">
                    {column.column_default || '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}