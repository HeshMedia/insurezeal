"use client"

import React, { useState, useEffect, useMemo } from 'react'
import { useAtom } from 'jotai'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from '@tanstack/react-table'
import { useMasterSheetList, useBulkUpdateMasterSheet } from '@/hooks/misQuery'
import { BulkUpdateItem } from '@/types/mis.types'
import { masterSheetPendingUpdatesAtom } from '@/lib/atoms/mis'
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
import { Button } from '@/components/ui/button'
import { Save, Loader2, RotateCcw, Database } from 'lucide-react'
import { useInView } from 'react-intersection-observer'
import { cn } from '@/lib/utils'

interface MasterSheetTableProps {
  onPendingChangesCount?: (count: number) => void
}

export function MasterSheetTable({ onPendingChangesCount }: MasterSheetTableProps) {
  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useMasterSheetList({ page_size: 50 })
  
  const bulkUpdateMutation = useBulkUpdateMasterSheet()
  
  const [pendingUpdates, setPendingUpdates] = useAtom(masterSheetPendingUpdatesAtom)
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; columnId: string } | null>(null)
  
  const { ref, inView } = useInView()

  useEffect(() => {
    if (inView && hasNextPage) {
      fetchNextPage()
    }
  }, [inView, hasNextPage, fetchNextPage])

  const records = useMemo(() => data?.pages.flatMap(page => page.records) ?? [], [data])

  const updateData = (recordId: string, columnId: string, value: unknown) => {
    setPendingUpdates(prev => {
      const newUpdates = { ...prev }
      if (!newUpdates[recordId]) {
        newUpdates[recordId] = {}
      }
      newUpdates[recordId][columnId] = String(value)
      return newUpdates
    })
  }

  const table = useReactTable({
    data: records,
    columns: columnDefs,
    getCoreRowModel: getCoreRowModel(),
    meta: {
      updateDataById: updateData,
      editingCell,
      setEditingCell,
      pendingUpdates,
    },
  })

  const handleSaveChanges = () => {
    const updates: BulkUpdateItem[] = []

    const columnHeaderMap = new Map<string, string>()
    table.getAllLeafColumns().forEach(col => {
      if (typeof col.columnDef.header === 'string') {
        columnHeaderMap.set(col.id, col.columnDef.header)
      }
    })

    for (const recordId in pendingUpdates) {
      for (const columnId in pendingUpdates[recordId]) {
        const header = columnHeaderMap.get(columnId)
        if (header) {
          updates.push({
            record_id: recordId,
            field_name: header,
            new_value: pendingUpdates[recordId][columnId],
          })
        }
      }
    }

    if (updates.length === 0) {
      toast.info("No changes to save.")
      return
    }

    const promise = bulkUpdateMutation.mutateAsync({ updates })

    toast.promise(promise, {
      loading: 'Saving changes...',
      success: (res) => {
        setPendingUpdates({})
        return `${res.successful_updates} changes saved successfully!`
      },
      error: (err) => `Failed to save: ${err.message}`,
    })
  }

  const handleClearChanges = () => {
    setPendingUpdates({})
    toast.success("All pending changes cleared")
  }

  const pendingChangesCount = Object.keys(pendingUpdates).length

  useEffect(() => {
    onPendingChangesCount?.(pendingChangesCount)
  }, [pendingChangesCount, onPendingChangesCount])

  if (isLoading && !data) {
    return (
      <div className="space-y-6 p-8 bg-gradient-to-br from-slate-50 to-blue-50 rounded-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg animate-pulse"></div>
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px] bg-gradient-to-br from-red-50 to-orange-50 rounded-2xl">
        <div className="text-center p-8 bg-white rounded-xl shadow-lg border border-red-100">
          <div className="text-red-600 text-xl font-bold mb-2">⚠️ Error Loading Data</div>
          <div className="text-red-500 text-sm">{error.message}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 rounded-2xl shadow-2xl border border-white/20 backdrop-blur-sm ">
      {/* HEADER WITH SAVE BUTTON */}
      <div className="bg-white/80 backdrop-blur-lg border-b border-gray-200/50 rounded-t-2xl">
        <div className="px-8 py-6">
          <div className="flex items-center justify-between">
            {/* Left Section */}
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl shadow-lg">
                <Database className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                  Master Sheet Data
                </h1>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-sm text-gray-600 font-medium">{records.length} records</span>
                  {pendingChangesCount > 0 && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-amber-400 to-orange-400 rounded-full shadow-md">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                      <span className="text-white text-sm font-semibold">
                        {pendingChangesCount} pending changes
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex items-center gap-4">
              {pendingChangesCount > 0 && (
                <Button
                  variant="outline"
                  onClick={handleClearChanges}
                  className="bg-white/50 border-gray-300 hover:bg-red-50 hover:border-red-300 hover:text-red-600 transition-all duration-200 shadow-md"
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Clear Changes
                </Button>
              )}
              
              <Button
                onClick={handleSaveChanges}
                disabled={pendingChangesCount === 0 || bulkUpdateMutation.isPending}
                size="lg"
                className={cn(
                  "font-bold px-8 py-3 rounded-xl shadow-xl transition-all duration-300 transform",
                  pendingChangesCount > 0
                    ? "bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-green-200 hover:scale-105 ring-4 ring-green-200"
                    : "bg-gradient-to-r from-gray-300 to-gray-400 text-gray-600 cursor-not-allowed"
                )}
              >
                {bulkUpdateMutation.isPending ? (
                  <>
                    <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                    Saving Changes...
                  </>
                ) : (
                  <>
                    <Save className="mr-3 h-5 w-5" />
                    Save All Changes
                    {pendingChangesCount > 0 && (
                      <span className="ml-2 px-2 py-1 bg-white/20 rounded-full text-sm">
                        {pendingChangesCount}
                      </span>
                    )}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* TABLE WITH CLEAR BORDERS */}
      <div className="flex-1 relative overflow-auto scrollbar-thin scrollbar-thumb-blue-400 scrollbar-track-blue-100">
        <div className="min-w-max">
          <Table className="w-full bg-white border-collapse">
            <TableHeader className="sticky top-0 z-10">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="border-b-2 border-gray-300">
                  {headerGroup.headers.map((header) => (
                    <TableHead 
                      key={header.id} 
                      className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider whitespace-nowrap bg-gray-50 border-r border-gray-300 last:border-r-0"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody className="bg-white">
              {table.getRowModel().rows.map((row, index) => (
                <TableRow 
                  key={row.original.id} 
                  className={cn(
                    "transition-colors duration-200 border-b border-gray-200 hover:bg-blue-50",
                    index % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell 
                      key={cell.id} 
                      className="p-0 whitespace-nowrap text-sm text-slate-800 border-r border-gray-200 last:border-r-0"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {/* LOADING INDICATOR */}
          <div ref={ref} className="h-20 flex justify-center items-center bg-white border-t-2 border-gray-300">
            {isFetchingNextPage && (
              <div className="flex items-center gap-3 bg-blue-50 px-6 py-3 rounded-lg border border-blue-200">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                <span className="text-sm font-medium text-slate-700">Loading more records...</span>
              </div>
            )}
            {!hasNextPage && records.length > 0 && (
              <div className="flex items-center gap-2 bg-green-50 px-6 py-3 rounded-lg border border-green-200">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm font-medium text-slate-700">All records loaded</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
