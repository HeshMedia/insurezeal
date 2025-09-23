'use client'

import React, { useEffect, useMemo, useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from '@tanstack/react-table'
import { agentApi } from '@/lib/api/agent'
import { AgentMISResponse } from '@/types/agent.types'
import { columns as columnDefs } from './columns'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { RefreshCw, Loader2, Calendar, TrendingUp } from 'lucide-react'
import { useInView } from 'react-intersection-observer'
import { cn } from '@/lib/utils'
import { useInfiniteQuery } from '@tanstack/react-query'

interface AgentMISTableProps {
  onStatsUpdate?: (stats: {
    number_of_policies: number
    running_balance: number
    total_net_premium: number
  }) => void
}

// Helper function to get current quarter
const getCurrentQuarter = (): number => {
  const month = new Date().getMonth() + 1 // getMonth() returns 0-11
  return Math.ceil(month / 3)
}

// Helper function to get current year
const getCurrentYear = (): number => {
  return new Date().getFullYear()
}

export function AgentMISTable({ onStatsUpdate }: AgentMISTableProps) {
  const [selectedQuarter, setSelectedQuarter] = useState<number>(getCurrentQuarter())
  const [selectedYear, setSelectedYear] = useState<number>(getCurrentYear())

  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
  } = useInfiniteQuery<AgentMISResponse, Error>({
    queryKey: ['agent-mis', selectedQuarter, selectedYear],
    queryFn: async (context: { pageParam?: unknown }) => {
      const pageParam = typeof context.pageParam === 'number' ? context.pageParam : 1
      return agentApi.mis.getAgentMISData({
        quarter: selectedQuarter,
        year: selectedYear,
        page: pageParam,
        page_size: 50,
      })
    },
    initialPageParam: 1,
    getNextPageParam: lastPage =>
      lastPage.page < lastPage.total_pages ? lastPage.page + 1 : undefined,

  })

  const { ref, inView } = useInView()

  // Trigger fetching next page when sentinel comes into view
  useEffect(() => {
    if (inView && hasNextPage) {
      fetchNextPage()
    }
  }, [inView, hasNextPage, fetchNextPage])

  const records = useMemo(() => data?.pages.flatMap(page => page.records) ?? [], [data])
  const stats = useMemo(() => data?.pages?.[0]?.stats ?? null, [data])

  useEffect(() => {
    if (stats && onStatsUpdate) {
      onStatsUpdate(stats)
    }
  }, [stats, onStatsUpdate])

  const table = useReactTable({
    data: records,
    columns: columnDefs,
    getCoreRowModel: getCoreRowModel(),
  })

  const handleRefresh = () => {
    refetch()
  }

  // Generate year options (current year and previous 4 years)
  const yearOptions = useMemo(() => {
    const currentYear = getCurrentYear()
    const years = []
    for (let i = 0; i < 5; i++) {
      years.push(currentYear - i)
    }
    return years
  }, [])

  if (isLoading && !data) {
    return (
      <div className="space-y-6 p-8 bg-gradient-to-br from-slate-50 to-blue-50 rounded-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg animate-pulse" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
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
          <div className="text-red-500 text-sm mb-4">{error.message}</div>
          <Button
            onClick={handleRefresh}
            variant="outline"
            className="border-red-300 hover:bg-red-50"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full max-w-full flex flex-col bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 rounded-2xl shadow-2xl border border-white/20 backdrop-blur-sm overflow-hidden">
      {/* Header with Controls */}
      <div className="p-6 bg-white/90 backdrop-blur-sm border-b border-gray-200">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">My Business Data (MIS)            </h2>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            {/* Quarter Selection */}
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-500" />
              <label className="text-sm font-medium text-gray-700">Quarter:</label>
              <Select 
                value={selectedQuarter.toString()} 
                onValueChange={(value) => setSelectedQuarter(parseInt(value))}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Q1</SelectItem>
                  <SelectItem value="2">Q2</SelectItem>
                  <SelectItem value="3">Q3</SelectItem>
                  <SelectItem value="4">Q4</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Year Selection */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Year:</label>
              <Select 
                value={selectedYear.toString()} 
                onValueChange={(value) => setSelectedYear(parseInt(value))}
              >
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Refresh Button */}
            <Button
              onClick={handleRefresh}
              variant="outline"
              size="sm"
              className="border-blue-300 hover:bg-blue-50"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Table Container with scroll */}
      <div className="flex-1 w-full overflow-auto scrollbar-thin scrollbar-thumb-blue-400 scrollbar-track-blue-100">
        <div className="min-w-full">
          <Table className="w-full bg-white border-collapse">
            <TableHeader className="sticky top-0 z-10 bg-gray-50">
              {table.getHeaderGroups().map(headerGroup => (
                <TableRow
                  key={headerGroup.id}
                  className="border-b-2 border-gray-300"
                >
                  {/* Serial Number Header */}
                  <TableHead className="w-16 px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider border-r border-gray-300">
                    S. NO
                  </TableHead>
                  {headerGroup.headers.map(header => (
                    <TableHead
                      key={header.id}
                      className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider last:border-r-0 whitespace-nowrap border-r border-gray-300"
                    >
                      {!header.isPlaceholder && (
                        <div className="truncate">
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                        </div>
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>

            <TableBody className="bg-white">
              {table.getRowModel().rows.map((row, index) => (
                <TableRow
                  key={`${row.original.policy_number}-${index}`}
                  className={cn(
                    'transition-colors duration-200 border-b border-gray-200 hover:bg-blue-50',
                    index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                  )}
                >
                  {/* Serial Number Cell */}
                  <TableCell className="w-16 px-4 py-4 text-sm text-slate-800 border-r border-gray-200 font-medium text-center">
                    {data?.pages.reduce((acc, page, pageIndex) => {
                      if (pageIndex === 0) return index + 1
                      return (
                        acc + (data.pages[pageIndex - 1]?.records.length || 0) + index + 1
                      )
                    }, 0) || index + 1}
                  </TableCell>
                  {row.getVisibleCells().map(cell => (
                    <TableCell
                      key={cell.id}
                      className="px-4 py-4 text-sm text-slate-800 border-r border-gray-200 last:border-r-0 whitespace-nowrap"
                    >
                      <div className="truncate" title={String(cell.getValue())}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </div>
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Infinite Loading Indicator and End Message */}
          <div
            ref={ref}
            className="h-20 flex justify-center items-center bg-white border-t-2 border-gray-300"
          >
            {isFetchingNextPage && (
              <div className="flex items-center gap-3 bg-blue-50 px-6 py-3 rounded-lg border border-blue-200">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                <span className="text-sm font-medium text-slate-700">
                  Loading more records...
                </span>
              </div>
            )}
            
          </div>
        </div>
      </div>
    </div>
  )
}
