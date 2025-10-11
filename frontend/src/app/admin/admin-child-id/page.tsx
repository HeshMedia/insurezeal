"use client"

import { useAdminChildIdList } from "@/hooks/superadminQuery"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react"
import Loading from "@/app/loading"

export default function AdminChildIdsPage() {
  const { data: adminChildIds, isLoading, error } = useAdminChildIdList()

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  const BooleanIcon = ({ value }: { value: boolean }) => {
    return value 
      ? <CheckCircle2 className="h-5 w-5 text-green-500" /> 
      : <XCircle className="h-5 w-5 text-red-500" />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Admin Child IDs</CardTitle>
          <CardDescription>
            A complete list of all Admin Child IDs and their associated data. The table is horizontally scrollable.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && (
          
              <Loading />
          )}
          {!isLoading && error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                {error instanceof Error ? error.message : "Failed to fetch admin child IDs."}
              </AlertDescription>
            </Alert>
          )}
          {!isLoading && !error && adminChildIds && (
            <div className="overflow-x-auto border rounded-md">
              <Table className="min-w-max">
                <TableHeader>
                  <TableRow>
                    {/* Main Child ID fields */}
                    <TableHead className="whitespace-nowrap">ID</TableHead>
                    <TableHead className="whitespace-nowrap">Child ID</TableHead>
                    <TableHead className="whitespace-nowrap">Password</TableHead>
                    <TableHead className="whitespace-nowrap">Branch Code</TableHead>
                    <TableHead className="whitespace-nowrap">Region</TableHead>
                    <TableHead className="whitespace-nowrap">Manager Name</TableHead>
                    <TableHead className="whitespace-nowrap">Manager Email</TableHead>
                    <TableHead className="whitespace-nowrap">Admin Notes</TableHead>
                    <TableHead className="whitespace-nowrap">Code Type</TableHead>
                    <TableHead className="whitespace-nowrap">Is Active</TableHead>
                    <TableHead className="whitespace-nowrap">Is Suspended</TableHead>
                    <TableHead className="whitespace-nowrap">Created At</TableHead>
                    <TableHead className="whitespace-nowrap">Updated At</TableHead>
                    
                    {/* Insurer fields */}
                    <TableHead className="whitespace-nowrap bg-blue-50">Insurer ID</TableHead>
                    <TableHead className="whitespace-nowrap bg-blue-50">Insurer Code</TableHead>
                    <TableHead className="whitespace-nowrap bg-blue-50">Insurer Name</TableHead>
                    <TableHead className="whitespace-nowrap bg-blue-50">Insurer Active</TableHead>
                    <TableHead className="whitespace-nowrap bg-blue-50">Insurer Created</TableHead>
                    <TableHead className="whitespace-nowrap bg-blue-50">Insurer Updated</TableHead>

                    {/* Broker fields */}
                    <TableHead className="whitespace-nowrap bg-green-50">Broker ID</TableHead>
                    <TableHead className="whitespace-nowrap bg-green-50">Broker Code</TableHead>
                    <TableHead className="whitespace-nowrap bg-green-50">Broker Name</TableHead>
                    <TableHead className="whitespace-nowrap bg-green-50">Broker Address</TableHead>
                    <TableHead className="whitespace-nowrap bg-green-50">Broker RM</TableHead>
                    <TableHead className="whitespace-nowrap bg-green-50">Broker GST</TableHead>
                    <TableHead className="whitespace-nowrap bg-green-50">Broker Active</TableHead>
                    <TableHead className="whitespace-nowrap bg-green-50">Broker Created</TableHead>
                    <TableHead className="whitespace-nowrap bg-green-50">Broker Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {adminChildIds.length > 0 ? (
                    adminChildIds.map((childId) => (
                      <TableRow key={childId.id}>
                        {/* Main Child ID fields */}
                        <TableCell className="whitespace-nowrap">{childId.id}</TableCell>
                        <TableCell className="whitespace-nowrap font-medium">{childId.child_id}</TableCell>
                        <TableCell className="whitespace-nowrap font-mono">********</TableCell>
                        <TableCell className="whitespace-nowrap">{childId.branch_code}</TableCell>
                        <TableCell className="whitespace-nowrap">{childId.region}</TableCell>
                        <TableCell className="whitespace-nowrap">{childId.manager_name}</TableCell>
                        <TableCell className="whitespace-nowrap">{childId.manager_email}</TableCell>
                        <TableCell className="max-w-sm whitespace-pre-wrap break-words">{childId.admin_notes || 'N/A'}</TableCell>
                        <TableCell className="whitespace-nowrap">{childId.code_type}</TableCell>
                        <TableCell className="whitespace-nowrap"><BooleanIcon value={childId.is_active} /></TableCell>
                        <TableCell className="whitespace-nowrap"><BooleanIcon value={childId.is_suspended} /></TableCell>
                        <TableCell className="whitespace-nowrap">{formatDate(childId.created_at)}</TableCell>
                        <TableCell className="whitespace-nowrap">{formatDate(childId.updated_at)}</TableCell>

                        {/* Insurer fields */}
                        <TableCell className="whitespace-nowrap bg-blue-50">{childId.insurer.id}</TableCell>
                        <TableCell className="whitespace-nowrap bg-blue-50">{childId.insurer.insurer_code}</TableCell>
                        <TableCell className="whitespace-nowrap bg-blue-50">{childId.insurer.name}</TableCell>
                        <TableCell className="whitespace-nowrap bg-blue-50"><BooleanIcon value={childId.insurer.is_active} /></TableCell>
                        <TableCell className="whitespace-nowrap bg-blue-50">{formatDate(childId.insurer.created_at)}</TableCell>
                        <TableCell className="whitespace-nowrap bg-blue-50">{formatDate(childId.insurer.updated_at)}</TableCell>

                        {/* Broker fields */}
                        <TableCell className="whitespace-nowrap bg-green-50">{childId.broker?.id ?? 'N/A'}</TableCell>
                        <TableCell className="whitespace-nowrap bg-green-50">{childId.broker?.broker_code || 'N/A'}</TableCell>
                        <TableCell className="whitespace-nowrap bg-green-50">{childId.broker?.name || 'N/A'}</TableCell>
                        <TableCell className="whitespace-nowrap bg-green-50">{childId.broker?.address || 'N/A'}</TableCell>
                        <TableCell className="whitespace-nowrap bg-green-50">{childId.broker?.rm || 'N/A'}</TableCell>
                        <TableCell className="whitespace-nowrap bg-green-50">{childId.broker?.gst || 'N/A'}</TableCell>
                        <TableCell className="whitespace-nowrap bg-green-50">{childId.broker ? <BooleanIcon value={childId.broker.is_active} /> : 'N/A'}</TableCell>
                        <TableCell className="whitespace-nowrap bg-green-50">{formatDate(childId.broker?.created_at)}</TableCell>
                        <TableCell className="whitespace-nowrap bg-green-50">{formatDate(childId.broker?.updated_at)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={29} className="h-24 text-center">
                        No admin child IDs found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}