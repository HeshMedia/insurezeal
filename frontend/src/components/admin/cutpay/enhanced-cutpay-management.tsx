"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"


import { useCutPayList } from "@/hooks/cutpayQuery"
import { CutPayListParams, CutPayTransaction } from "@/types/cutpay.types"
import { cn } from "@/lib/utils"
import { 
  Search, 
  MoreHorizontal, 
  Eye, 
  Edit,
  Calendar,
  ArrowLeft,
  ArrowRight,
  Plus,
  CreditCard,
  LayoutGrid,
  List,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

function CutPayCard({ cutpay, onViewDetails, onEdit }: { 
  cutpay: CutPayTransaction; 
  onViewDetails: () => void;
  onEdit: () => void;
}) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount)
  }

  const getStatusBadge = () => {
    return (
      <Badge className="bg-green-100 text-green-700 border-green-200">
        Completed
      </Badge>
    )
  }

  return (
    <Card className="bg-white hover:shadow-lg transition-all duration-200 border border-gray-200 shadow-sm rounded-xl">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-green-100 to-emerald-100 rounded-xl">
              <CreditCard className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold text-gray-900 mb-1">
                {cutpay.policy_number || `Transaction #${cutpay.id}`}
              </CardTitle>
              <div className="flex items-center gap-2">
                {cutpay.agent_code && (
                  <Badge variant="outline" className="font-mono text-xs bg-gray-50 text-gray-700 border-gray-200">
                    {cutpay.agent_code}
                  </Badge>
                )}
                {getStatusBadge()}
              </div>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-gray-100">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={onViewDetails} className="cursor-pointer">
                <Eye className="h-4 w-4 mr-2" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={onEdit}
                className="cursor-pointer"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Transaction
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <span className="text-gray-600 font-medium">Cut Pay Amount:</span>
            <span className="font-bold text-green-600">{formatCurrency(cutpay.cut_pay_amount || 0)}</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
            <span className="text-gray-600 font-medium">Total Agent PO:</span>
            <span className="font-bold text-blue-600">{formatCurrency(cutpay.total_agent_po_amt || 0)}</span>
          </div>
          <div className="flex items-center gap-3 text-gray-600 pt-2">
            <div className="p-1.5 bg-gray-100 rounded-md">
              <Calendar className="h-3.5 w-3.5 text-gray-500" />
            </div>
            <span>
              {cutpay.created_at ? new Date(cutpay.created_at).toLocaleDateString('en-IN', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              }) : 'No date'}
            </span>
          </div>
        </div>
        <div className="mt-5 pt-4 border-t border-gray-100">
          <Button
            onClick={onViewDetails}
            className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-sm"
            size="sm"
          >
            <Eye className="h-4 w-4 mr-2" />
            View Transaction
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export function CutPayManagement() {
  const router = useRouter()
  const [params, setParams] = useState<CutPayListParams>({
    limit: 100,
    skip: 0
  })
  const [searchQuery, setSearchQuery] = useState("")
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 20

  const { data: cutpayTransactions, isLoading, error } = useCutPayList(params)

  // Client-side pagination and filtering
  const filteredTransactions = cutpayTransactions?.filter(transaction => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      transaction.policy_number?.toLowerCase().includes(query) ||
      transaction.customer_name?.toLowerCase().includes(query) ||
      transaction.registration_number?.toLowerCase().includes(query) ||
      transaction.agent_code?.toLowerCase().includes(query)
    )
  }) || []

  const totalTransactions = filteredTransactions.length
  const totalPages = Math.ceil(totalTransactions / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const currentTransactions = filteredTransactions.slice(startIndex, endIndex)

  const handleSearch = () => {
    setParams(prev => ({ ...prev, search: searchQuery }))
    setCurrentPage(1) // Reset to first page when searching
  }

  // Handle pagination
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage)
  }

  const computeQuarterYear = (dateStr?: string | null) => {
    const d = dateStr ? new Date(dateStr) : new Date()
    const year = d.getFullYear()
    const month = d.getMonth() + 1
    const quarter = Math.ceil(month / 3)
    return { quarter, year }
  }

  const handleViewDetails = (cutpay: CutPayTransaction) => {
    const { quarter, year } = computeQuarterYear(cutpay.booking_date || cutpay.created_at)
    const policy = cutpay.policy_number || ''
    const query = `?policy=${encodeURIComponent(policy)}&q=${quarter}&y=${year}`
    router.push(`/admin/cutpay/${cutpay.id}${query}`)
  }

  const handleEdit = (cutpay: CutPayTransaction) => {
    const { quarter, year } = computeQuarterYear(cutpay.booking_date || cutpay.created_at)
    const policy = cutpay.policy_number || ''
    const query = `?policy=${encodeURIComponent(policy)}&q=${quarter}&y=${year}`
    router.push(`/admin/cutpay/${cutpay.id}/edit${query}`)
  }

  const handleCreateNew = () => {
    router.push('/admin/cutpay/create')
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-6">
          <p className="text-red-600">Failed to load cutpay data: {error instanceof Error ? error.message : 'Unknown error'}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">CutPay Management</h1>
            <p className="text-gray-600 mt-1">Manage cutpay transactions and monitor payments</p>
          </div>
          
          <div className="flex gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="w-[120px]">
                  {viewMode === 'grid' ? (
                    <LayoutGrid className="h-4 w-4 mr-2" />
                  ) : (
                    <List className="h-4 w-4 mr-2" />
                  )}
                  <span>{viewMode.charAt(0).toUpperCase() + viewMode.slice(1)} View</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setViewMode('grid')}>
                  <LayoutGrid className="h-4 w-4 mr-2" />
                  Grid View
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setViewMode('list')}>
                  <List className="h-4 w-4 mr-2" />
                  List View
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button 
              onClick={handleCreateNew}
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Transaction
            </Button>
          </div>
        </div>
      </div>
      {/* Filters and Search */}
      <Card className="bg-white border border-gray-200 shadow-sm rounded-xl">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search by policy number, agent code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10 border-gray-200 focus:border-green-400 focus:ring-green-400"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSearch} variant="outline" className="shrink-0 border-gray-200 hover:bg-gray-50">
                <Search className="h-4 w-4 mr-2" />
                Search
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Grid/List */}
      <Card className="bg-white border border-gray-200 shadow-sm rounded-xl">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-gray-900">Transactions</CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Page size: {pageSize}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className={cn(
              "grid gap-4",
              viewMode === 'grid' ? "md:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"
            )}>
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-9 w-9 rounded-lg" />
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-3/4" />
                      <Skeleton className="h-8 w-full mt-4" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : totalTransactions === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-2">
                <CreditCard className="h-12 w-12 mx-auto" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-1">No transactions found</h3>
              <p className="text-gray-500 mb-4">No cutpay transactions match your current search criteria.</p>
              <Button onClick={handleCreateNew} className="bg-green-600 hover:bg-green-700 text-white">
                <Plus className="h-4 w-4 mr-2" />
                Create First Transaction
              </Button>
            </div>
          ) : (
            <div className={cn(
              "grid gap-4",
              viewMode === 'grid' ? "md:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"
            )}>
              {currentTransactions.map((cutpay) => (
                <CutPayCard
                  key={cutpay.id}
                  cutpay={cutpay}
                  onViewDetails={() => handleViewDetails(cutpay)}
                  onEdit={() => handleEdit(cutpay)}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalTransactions > 0 && totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-gray-500">
                Showing {startIndex + 1} to {Math.min(endIndex, totalTransactions)} of {totalTransactions} transactions
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage <= 1}
                >
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <span className="text-sm text-gray-600">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                >
                  Next
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
