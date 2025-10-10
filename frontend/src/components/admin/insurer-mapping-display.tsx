'use client'

import { useMemo } from 'react'
import { useInsurerMapping } from '@/hooks/universalQuery'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {AlertCircle, FileSearch, ArrowRight, Database, FileText } from 'lucide-react'
import Loading from '@/app/loading'

interface InsurerMappingDisplayProps {
  insurerName: string;
}

interface MappingField {
  field: string;
  description?: string;
}

function MappingEmptyState({ title, description, icon: Icon }: { title: string, description: string, icon: React.ElementType }) {
    return (
        <div className="text-center py-16 px-6 border-2 border-dashed rounded-lg bg-gray-50/50">
            <Icon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-semibold text-gray-900">{title}</h3>
            <p className="mt-1 text-sm text-gray-500">{description}</p>
        </div>
    )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatFieldValue(value: any): { formatted: string; fields: MappingField[] } {
    if (typeof value === 'string') {
        return { formatted: value, fields: [{ field: value }] };
    }
    
    if (Array.isArray(value)) {
        const fields = value.map(item => ({ field: String(item) }));
        return { formatted: `${value.length} fields`, fields };
    }
    
    if (typeof value === 'object' && value !== null) {
        const fields = Object.entries(value).map(([key, val]) => ({
            field: key,
            description: String(val)
        }));
        return { formatted: `${fields.length} mapped fields`, fields };
    }
    
    return { formatted: String(value), fields: [{ field: String(value) }] };
}

function FieldDetails({ fields }: { fields: MappingField[] }) {
    if (fields.length === 1 && !fields[0].description) {
        return <span className="text-gray-700">{fields[0].field}</span>;
    }

    return (
        <div className="space-y-2">
            {fields.map((field, index) => (
                <div key={index} className="flex items-start gap-2">
                    <Badge variant="secondary" className="text-xs font-mono">
                        {field.field}
                    </Badge>
                    {field.description && (
                        <span className="text-xs text-gray-500 mt-0.5">
                            → {field.description}
                        </span>
                    )}
                </div>
            ))}
        </div>
    );
}

export function InsurerMappingDisplay({ insurerName }: InsurerMappingDisplayProps) {
  const { data, isLoading, error } = useInsurerMapping(insurerName)
  
  const processedMappings = useMemo(() => {
    if (!data) return [];
    
    return Object.entries(data).map(([source, destination]) => {
      const { formatted, fields } = formatFieldValue(destination);
      return {
        source,
        destination: formatted,
        fields,
        isComplex: fields.length > 1 || fields.some(f => f.description)
      };
    });
  }, [data]);

  if (isLoading) {
    return (
     <Loading />
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error Loading Mappings</AlertTitle>
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    )
  }

  if (!data || processedMappings.length === 0) {
    return (
        <MappingEmptyState 
            title="No Mappings Configured"
            description={`No header mappings have been configured for ${insurerName}.`}
            icon={FileSearch}
        />
    )
  }

  const totalMappings = processedMappings.reduce((acc, mapping) => acc + mapping.fields.length, 0);

  return (
    <Card className="border-gray-200 shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-blue-600" />
              Header Mappings for {insurerName}
            </CardTitle>
            <CardDescription>
              This shows how headers from the insurers spreadsheet are mapped to our system fields.
            </CardDescription>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-blue-600">{totalMappings}</div>
            <div className="text-xs text-gray-500">Total Mappings</div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg overflow-hidden bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-gradient-to-r from-gray-50 to-gray-100 hover:from-gray-50 hover:to-gray-100 border-b">
                <TableHead className="w-1/3 font-semibold text-gray-700 px-6 py-4">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Spreadsheet Header (Source)
                  </div>
                </TableHead>
                <TableHead className="w-2/3 font-semibold text-gray-700 px-6 py-4">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    System Field (Destination)
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {processedMappings.map((mapping, index) => (
                <TableRow 
                  key={mapping.source} 
                  className={`hover:bg-blue-50/50 border-b last:border-b-0 transition-colors ${
                    index % 2 === 0 ? 'bg-gray-50/30' : 'bg-white'
                  }`}
                >
                  <TableCell className="font-medium text-gray-900 px-6 py-4 align-top">
                    <div className="flex items-start gap-2">
                      <Badge variant="outline" className="mt-0.5 font-mono text-xs">
                        {mapping.source}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-4 align-top">
                    <div className="flex items-start gap-3">
                      <ArrowRight className="h-4 w-4 text-blue-500 shrink-0 mt-1" />
                      <div className="flex-1 min-w-0">
                        {mapping.isComplex ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="default" className="text-xs">
                                {mapping.destination}
                              </Badge>
                            </div>
                            <FieldDetails fields={mapping.fields} />
                          </div>
                        ) : (
                          <FieldDetails fields={mapping.fields} />
                        )}
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        
        {/* Summary section */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center gap-2 text-blue-800">
            <Database className="h-4 w-4" />
            <span className="font-medium">Mapping Summary</span>
          </div>
          <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="font-medium text-blue-700">Source Headers:</span>
              <span className="ml-1 text-blue-600">{processedMappings.length}</span>
            </div>
            <div>
              <span className="font-medium text-blue-700">System Fields:</span>
              <span className="ml-1 text-blue-600">{totalMappings}</span>
            </div>
            <div>
              <span className="font-medium text-blue-700">Complex Mappings:</span>
              <span className="ml-1 text-blue-600">
                {processedMappings.filter(m => m.isComplex).length}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
