"use client"

import React, { useState, useEffect, useMemo } from 'react'
import { useAtom } from 'jotai'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  getSortedRowModel,
  SortingState,
} from '@tanstack/react-table'
import { useMasterSheetList, useBulkUpdateMasterSheet } from '@/hooks/misQuery'
import { BulkUpdateItem, MasterSheetListParams } from '@/types/mis.types'
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
import { Input } from '@/components/ui/input'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { CalendarIcon, Settings2, ChevronDown, ChevronUp } from 'lucide-react'
import { Save, Loader2, RotateCcw, Database, Search, Filter, X } from 'lucide-react'
import { format } from 'date-fns'
import { useInView } from 'react-intersection-observer'
import { cn } from '@/lib/utils'
import { useDebounce } from '@/hooks/use-debounce'

interface MasterSheetTableProps {
  onPendingChangesCount?: (count: number) => void
}

export function MasterSheetTable({ onPendingChangesCount }: MasterSheetTableProps) {
  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  
  // Basic filters
  const [agentCodeFilter, setAgentCodeFilter] = useState('')
  const [insurerNameFilter, setInsurerNameFilter] = useState('')
  const [policyNumberFilter, setPolicyNumberFilter] = useState('')
  const [reportingMonthFilter, setReportingMonthFilter] = useState('')
  
  // Advanced filters
  const [codeTypeFilter, setCodeTypeFilter] = useState('')
  const [bookingDateFromFilter, setBookingDateFromFilter] = useState<Date | undefined>(undefined)
  const [bookingDateToFilter, setBookingDateToFilter] = useState<Date | undefined>(undefined)
  const [productTypeFilter, setProductTypeFilter] = useState('')
  const [paymentByFilter, setPaymentByFilter] = useState('')
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState('')
  const [majorCategorisationFilter, setMajorCategorisationFilter] = useState('')
  const [stateFilter, setStateFilter] = useState('')
  const [brokerNameFilter, setBrokerNameFilter] = useState('')
  
  const [sorting, setSorting] = useState<SortingState>([])

  // Debounce search terms to avoid excessive API calls
  const debouncedSearchTerm = useDebounce(searchTerm, 300)
  const debouncedAgentCode = useDebounce(agentCodeFilter, 300)
  const debouncedInsurerName = useDebounce(insurerNameFilter, 300)
  const debouncedPolicyNumber = useDebounce(policyNumberFilter, 300)
  const debouncedReportingMonth = useDebounce(reportingMonthFilter, 300)
  const debouncedCodeType = useDebounce(codeTypeFilter, 300)
  const debouncedProductType = useDebounce(productTypeFilter, 300)
  const debouncedPaymentBy = useDebounce(paymentByFilter, 300)
  const debouncedInvoiceStatus = useDebounce(invoiceStatusFilter, 300)
  const debouncedMajorCategorisation = useDebounce(majorCategorisationFilter, 300)
  const debouncedState = useDebounce(stateFilter, 300)
  const debouncedBrokerName = useDebounce(brokerNameFilter, 300)

  // Build query parameters
  const queryParams: MasterSheetListParams = useMemo(() => ({
    page_size: 50,
    ...(debouncedSearchTerm && { search: debouncedSearchTerm }),
    ...(debouncedAgentCode && { agent_code: debouncedAgentCode }),
    ...(debouncedInsurerName && { insurer_name: debouncedInsurerName }),
    ...(debouncedPolicyNumber && { policy_number: debouncedPolicyNumber }),
    ...(debouncedReportingMonth && { reporting_month: debouncedReportingMonth }),
    ...(debouncedCodeType && { code_type: debouncedCodeType }),
    ...(bookingDateFromFilter && { booking_date_from: format(bookingDateFromFilter, 'yyyy-MM-dd') }),
    ...(bookingDateToFilter && { booking_date_to: format(bookingDateToFilter, 'yyyy-MM-dd') }),
    ...(debouncedProductType && { product_type: debouncedProductType }),
    ...(debouncedPaymentBy && { payment_by: debouncedPaymentBy }),
    ...(debouncedInvoiceStatus && { invoice_status: debouncedInvoiceStatus }),
    ...(debouncedMajorCategorisation && { major_categorisation: debouncedMajorCategorisation }),
    ...(debouncedState && { state: debouncedState }),
    ...(debouncedBrokerName && { broker_name: debouncedBrokerName }),
  }), [
    debouncedSearchTerm, 
    debouncedAgentCode, 
    debouncedInsurerName, 
    debouncedPolicyNumber, 
    debouncedReportingMonth,
    debouncedCodeType,
    bookingDateFromFilter,
    bookingDateToFilter,
    debouncedProductType,
    debouncedPaymentBy,
    debouncedInvoiceStatus,
    debouncedMajorCategorisation,
    debouncedState,
    debouncedBrokerName
  ])

  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useMasterSheetList(queryParams)
  
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
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    meta: {
      updateDataById: updateData,
      editingCell,
      setEditingCell,
      pendingUpdates,
    },
  })

  const clearAllFilters = () => {
    setSearchTerm('')
    setAgentCodeFilter('')
    setInsurerNameFilter('')
    setPolicyNumberFilter('')
    setReportingMonthFilter('')
    setCodeTypeFilter('')
    setBookingDateFromFilter(undefined)
    setBookingDateToFilter(undefined)
    setProductTypeFilter('')
    setPaymentByFilter('')
    setInvoiceStatusFilter('')
    setMajorCategorisationFilter('')
    setStateFilter('')
    setBrokerNameFilter('')
    toast.success("All filters cleared")
  }

  const hasActiveFilters = searchTerm || agentCodeFilter || insurerNameFilter || policyNumberFilter || 
    reportingMonthFilter || codeTypeFilter || bookingDateFromFilter || bookingDateToFilter || 
    productTypeFilter || paymentByFilter || invoiceStatusFilter || majorCategorisationFilter || 
    stateFilter || brokerNameFilter

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

      {/* ENHANCED SEARCH AND FILTERS SECTION */}
      <div className="bg-gradient-to-r from-white via-blue-50 to-indigo-50 border-b border-gray-200/50">
        <div className="px-8 py-6">
          {/* Search Bar and Filter Toggle */}
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1 max-w-2xl">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <Input
                placeholder="Search across all fields (policies, agents, customers, etc.)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 pr-4 h-12 text-base bg-white/80 backdrop-blur-sm border-gray-300 rounded-xl shadow-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
              />
            </div>
            
            <Button
              variant={showFilters ? "default" : "outline"}
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "h-12 px-6 rounded-xl font-medium transition-all duration-200 shadow-lg",
                showFilters 
                  ? "bg-blue-600 hover:bg-blue-700 text-white" 
                  : "bg-white/80 backdrop-blur-sm border-gray-300 hover:bg-blue-50"
              )}
            >
              <Settings2 className="mr-2 h-5 w-5" />
              Filters
              {showFilters ? (
                <ChevronUp className="ml-2 h-4 w-4" />
              ) : (
                <ChevronDown className="ml-2 h-4 w-4" />
              )}
              {hasActiveFilters && (
                <span className="ml-2 px-2 py-1 bg-red-500 text-white text-xs rounded-full">
                  {[
                    searchTerm, agentCodeFilter, insurerNameFilter, policyNumberFilter, 
                    reportingMonthFilter, codeTypeFilter, bookingDateFromFilter, bookingDateToFilter,
                    productTypeFilter, paymentByFilter, invoiceStatusFilter, majorCategorisationFilter,
                    stateFilter, brokerNameFilter
                  ].filter(Boolean).length}
                </span>
              )}
            </Button>

            {hasActiveFilters && (
              <Button
                variant="outline"
                size="default"
                onClick={clearAllFilters}
                className="h-12 px-4 rounded-xl bg-white/80 backdrop-blur-sm border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 shadow-lg"
              >
                <X className="mr-2 h-4 w-4" />
                Clear All
              </Button>
            )}
          </div>

          {/* Collapsible Filters Panel */}
          {showFilters && (
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-gray-200 shadow-xl p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                
                {/* Basic Filters Row 1 */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    Agent Code
                  </label>
                  <Input
                    placeholder="e.g., AG001, AG002..."
                    value={agentCodeFilter}
                    onChange={(e) => setAgentCodeFilter(e.target.value)}
                    className="h-10 bg-white border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    Insurer Name
                  </label>
                  <Input
                    placeholder="e.g., ICICI, HDFC, Bajaj..."
                    value={insurerNameFilter}
                    onChange={(e) => setInsurerNameFilter(e.target.value)}
                    className="h-10 bg-white border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    Broker Name
                  </label>
                  <Input
                    placeholder="e.g., PB Fintech, PolicyBazaar..."
                    value={brokerNameFilter}
                    onChange={(e) => setBrokerNameFilter(e.target.value)}
                    className="h-10 bg-white border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                    Policy Number
                  </label>
                  <Input
                    placeholder="Full or partial policy number..."
                    value={policyNumberFilter}
                    onChange={(e) => setPolicyNumberFilter(e.target.value)}
                    className="h-10 bg-white border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Advanced Filters Row 2 */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                    Code Type
                  </label>
                  <Select value={codeTypeFilter} onValueChange={setCodeTypeFilter}>
                    <SelectTrigger className="h-10 bg-white border-gray-300 rounded-lg">
                      <SelectValue placeholder="Select code type..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Code Types</SelectItem>
                      <SelectItem value="Direct">Direct</SelectItem>
                      <SelectItem value="Broker">Broker</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    Product Type
                  </label>
                  <Select value={productTypeFilter} onValueChange={setProductTypeFilter}>
                    <SelectTrigger className="h-10 bg-white border-gray-300 rounded-lg">
                      <SelectValue placeholder="Select product..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Products</SelectItem>
                      <SelectItem value="Private Car">Private Car</SelectItem>
                      <SelectItem value="Bike">Bike</SelectItem>
                      <SelectItem value="GCV">GCV</SelectItem>
                      <SelectItem value="PCV">PCV</SelectItem>
                      <SelectItem value="Misc D">Misc D</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <div className="w-2 h-2 bg-pink-500 rounded-full"></div>
                    Payment By
                  </label>
                  <Select value={paymentByFilter} onValueChange={setPaymentByFilter}>
                    <SelectTrigger className="h-10 bg-white border-gray-300 rounded-lg">
                      <SelectValue placeholder="Select payment by..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Payment Methods</SelectItem>
                      <SelectItem value="Agent">Agent</SelectItem>
                      <SelectItem value="InsureZeal">InsureZeal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <div className="w-2 h-2 bg-teal-500 rounded-full"></div>
                    Invoice Status
                  </label>
                  <Select value={invoiceStatusFilter} onValueChange={setInvoiceStatusFilter}>
                    <SelectTrigger className="h-10 bg-white border-gray-300 rounded-lg">
                      <SelectValue placeholder="Select status..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Statuses</SelectItem>
                      <SelectItem value="Pending">Pending</SelectItem>
                      <SelectItem value="Completed">Completed</SelectItem>
                      <SelectItem value="Cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Date Range Filters Row 3 */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                    Booking Date From
                  </label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="h-10 w-full justify-start text-left font-normal bg-white border-gray-300 rounded-lg hover:bg-gray-50"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {bookingDateFromFilter ? format(bookingDateFromFilter, "PPP") : "Select start date..."}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={bookingDateFromFilter}
                        onSelect={setBookingDateFromFilter}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <div className="w-2 h-2 bg-amber-600 rounded-full"></div>
                    Booking Date To
                  </label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="h-10 w-full justify-start text-left font-normal bg-white border-gray-300 rounded-lg hover:bg-gray-50"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {bookingDateToFilter ? format(bookingDateToFilter, "PPP") : "Select end date..."}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={bookingDateToFilter}
                        onSelect={setBookingDateToFilter}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <div className="w-2 h-2 bg-cyan-500 rounded-full"></div>
                    Reporting Month
                  </label>
                  <Input
                    type="month"
                    value={reportingMonthFilter}
                    onChange={(e) => setReportingMonthFilter(e.target.value)}
                    className="h-10 bg-white border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                    State
                  </label>
                  <Input
                    placeholder="e.g., Maharashtra, Delhi..."
                    value={stateFilter}
                    onChange={(e) => setStateFilter(e.target.value)}
                    className="h-10 bg-white border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <div className="w-2 h-2 bg-violet-500 rounded-full"></div>
                    Major Categorisation
                  </label>
                  <Select value={majorCategorisationFilter} onValueChange={setMajorCategorisationFilter}>
                    <SelectTrigger className="h-10 bg-white border-gray-300 rounded-lg">
                      <SelectValue placeholder="Select category..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Categories</SelectItem>
                      <SelectItem value="Motor">Motor</SelectItem>
                      <SelectItem value="Health">Health</SelectItem>
                      <SelectItem value="Life">Life</SelectItem>
                      <SelectItem value="General">General</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Active Filters Summary */}
              {hasActiveFilters && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Filter className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-semibold text-gray-700">Active filters:</span>
                    {searchTerm && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                        Search: {searchTerm}
                      </span>
                    )}
                    {agentCodeFilter && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                        Agent: {agentCodeFilter}
                      </span>
                    )}
                    {insurerNameFilter && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200">
                        Insurer: {insurerNameFilter}
                      </span>
                    )}
                    {brokerNameFilter && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200">
                        Broker: {brokerNameFilter}
                      </span>
                    )}
                    {policyNumberFilter && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 border border-orange-200">
                        Policy: {policyNumberFilter}
                      </span>
                    )}
                    {codeTypeFilter && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 border border-indigo-200">
                        Code Type: {codeTypeFilter}
                      </span>
                    )}
                    {productTypeFilter && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
                        Product: {productTypeFilter}
                      </span>
                    )}
                    {paymentByFilter && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-pink-100 text-pink-800 border border-pink-200">
                        Payment By: {paymentByFilter}
                      </span>
                    )}
                    {invoiceStatusFilter && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-teal-100 text-teal-800 border border-teal-200">
                        Status: {invoiceStatusFilter}
                      </span>
                    )}
                    {bookingDateFromFilter && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                        From: {format(bookingDateFromFilter, "MMM dd, yyyy")}
                      </span>
                    )}
                    {bookingDateToFilter && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                        To: {format(bookingDateToFilter, "MMM dd, yyyy")}
                      </span>
                    )}
                    {reportingMonthFilter && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-cyan-100 text-cyan-800 border border-cyan-200">
                        Month: {reportingMonthFilter}
                      </span>
                    )}
                    {stateFilter && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                        State: {stateFilter}
                      </span>
                    )}
                    {majorCategorisationFilter && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-violet-100 text-violet-800 border border-violet-200">
                        Category: {majorCategorisationFilter}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
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
                  key={`${row.original.id}-${index}`} 
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
