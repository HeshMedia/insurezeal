"use client"

import { useAdminChildIdList } from "@/hooks/superadminQuery"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertTriangle } from "lucide-react"

export default function AdminChildIdsPage() {
  const { data: adminChildIds, isLoading, error } = useAdminChildIdList()

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Admin Child IDs</CardTitle>
          <CardDescription>
            A complete list of all Admin Child IDs in the system.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Child ID</TableHead>
                  <TableHead>Branch Code</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead>Manager</TableHead>
                  <TableHead>Insurer</TableHead>
                  <TableHead>Broker</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {adminChildIds.length > 0 ? (
                  adminChildIds.map((childId) => (
                    <TableRow key={childId.id}>
                      <TableCell className="font-medium">{childId.child_id}</TableCell>
                      <TableCell>{childId.branch_code}</TableCell>
                      <TableCell>{childId.region}</TableCell>
                      <TableCell>{childId.manager_name}</TableCell>
                      <TableCell>{childId.insurer.name}</TableCell>
                      <TableCell>{childId.broker?.name || 'N/A'}</TableCell>
                      <TableCell>
                        <Badge variant={childId.is_active && !childId.is_suspended ? "default" : "secondary"}>
                          {childId.is_suspended ? 'Suspended' : childId.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      No admin child IDs found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}