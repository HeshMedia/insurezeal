'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Database, Info } from 'lucide-react';
import { useDatabaseConnection } from './hooks/useDatabaseConnection';

import { ConnectionForm } from './components/ConnectionForm';
import { ConnectionProgress } from './components/ConnectionProgress';
import { DatabaseInfoSummary } from './components/DatabaseInfoSummary';
import { ErrorDisplay } from './components/ErrorDisplay';
import { TablesSidebar } from './components/TablesSidebar';
import { TableSchema } from './components/TableSchema';
import { TableDataComponent } from './components/TableData';
import { ThemeToggle } from './ThemeTogggle';

export default function PostgreSQLHTTPViewer() {
  const {
    databaseUrl,
    setDatabaseUrl,
    showPassword,
    setShowPassword,
    databaseInfo,
    loading,
    connectionProgress,
    connectionStep,
    errorInfo,
    selectedTable,
    setSelectedTable,
    fetchDatabaseData,
    handleRefresh,
    maskUrl
  } = useDatabaseConnection();

  const selectedTableData = databaseInfo?.tables.find(t => t.name === selectedTable);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <Database className="h-6 w-6" />
              PostgreSQL Database Viewer (HTTP Method)
              <Badge variant="outline">Improved SSL</Badge>
            </CardTitle>
            <ThemeToggle />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <ConnectionForm 
            databaseUrl={databaseUrl}
            setDatabaseUrl={setDatabaseUrl}
            showPassword={showPassword}
            setShowPassword={setShowPassword}
            maskUrl={maskUrl}
            loading={loading}
            onConnect={fetchDatabaseData}
            onRefresh={handleRefresh}
            hasData={!!databaseInfo}
          />

          {/* Connection Progress */}
          {loading && <ConnectionProgress
            connectionStep={connectionStep}
            connectionProgress={connectionProgress}
          />}

          {/* Success Message */}
          {databaseInfo && databaseInfo.message && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>{databaseInfo.message}</AlertDescription>
            </Alert>
          )}

          {/* Database Info */}
          <DatabaseInfoSummary databaseInfo={databaseInfo} />

          {/* Error Display */}
          <ErrorDisplay errorInfo={errorInfo} />
        </CardContent>
      </Card>

      {/* Database Tables Display */}
      {databaseInfo && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Table List Sidebar */}
          <TablesSidebar 
            tables={databaseInfo.tables} 
            selectedTable={selectedTable}
            onTableSelect={setSelectedTable}
          />

          {/* Table Details */}
          <div className="lg:col-span-3 space-y-4">
            {selectedTableData && (
              <>
                {/* Table Data */}
                <TableDataComponent table={selectedTableData} />
                {/* Table Schema */}
                <TableSchema table={selectedTableData} />

              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}