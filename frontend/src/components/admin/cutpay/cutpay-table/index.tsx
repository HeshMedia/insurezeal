"use client"

import React, { useState, useEffect, useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from '@tanstack/react-table'
import { useCutPayList, useUpdateBulkPostDetails } from '@/hooks/cutpayQuery'
import { CutPayTransaction, PostCutpayDetails } from '@/types/cutpay.types'
import { columns as columnDefs } from './columns'
import { toast } from 'sonner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

// The 'declare module' block has been REMOVED from this file.
// The global type definition is now in 'src/types/tanstack-table.d.ts'.

export function CutPayTable() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { data: fetchedData, isLoading, error, isFetching } = useCutPayList({ limit: 500 })
  const updateMutation = useUpdateBulkPostDetails()

  const [data, setData] = useState<CutPayTransaction[]>([])
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; columnId: string } | null>(null)

  useEffect(() => {
    if (fetchedData) {
      setData(fetchedData)
    }
  }, [fetchedData])

  const columns = useMemo(() => columnDefs, [])

  const updateData = (rowIndex: number, columnId: string, value: unknown) => {
    const row = data[rowIndex]
    if (!row) return

    // Keep a snapshot of the data before optimistic update to revert on error
    const oldData = [...data]
    
    setData(old =>
      old.map((r, index) => (index === rowIndex ? { ...r, [columnId]: value } : r))
    )

    const payload = {
      cutpay_ids: [row.id],
      details: {
        [columnId]: (typeof value === 'string' && !isNaN(Number(value)) && value.trim() !== '') ? Number(value) : value,
      } as PostCutpayDetails,
    }

    toast.info(`Saving Transaction #${row.id}...`, { id: `update-${row.id}` })

    updateMutation.mutate(payload, {
      onSuccess: () => {
        toast.success(`Transaction #${row.id} updated successfully.`, { id: `update-${row.id}` })
      },
      onError: (err) => {
        toast.error(`Failed to update #${row.id}: ${err.message}`, { id: `update-${row.id}` })
        setData(oldData) // Revert on error
      },
    })
  }

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    meta: {
      updateDataByIndex: updateData,
      editingCell,
      setEditingCell,
    },
  })

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-1/3" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) return <div className="p-4 text-red-600">Error loading data: {error.message}</div>

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[80vw] ">
      <Card className="shadow-lg border-gray-200 max-w-[80vw]">
        
        <CardContent className="p-0 max-w-[80vw]">
          <div className="max-w-[80vw] overflow-x-auto">
            <Table className="min-w-full divide-y divide-gray-200">
              <TableHeader className="bg-gray-50">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody className="bg-white divide-y divide-gray-200">
                {table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} className="hover:bg-blue-50/50 transition-colors duration-150">
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="p-0 whitespace-nowrap text-sm text-gray-800">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}