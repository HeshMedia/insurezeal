"use client"

import { useState } from "react"
import { useAtom } from "jotai"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useCutPayList } from "@/hooks/adminQuery"
import { cutpayListParamsAtom } from "@/lib/atoms/admin"
import { CutPayTransaction, CutPayListParams } from "@/types/admin.types"
import { cn } from "@/lib/utils"
import { 
  Search, 
  Filter, 
  Download, 
  MoreHorizontal, 
  Eye, 
  Edit,
  DollarSign,
  Calendar,
  ArrowLeft,
  ArrowRight,
  Plus,
  CreditCard
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

function CutPayCard({ cutpay, onViewDetails, onEdit, onEditSplit }: { 
  cutpay: CutPayTransaction; 
  onViewDetails: (id: number) => void;
  onEdit: (id: number) => void;
  onEditSplit: (id: number) => void;
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
              <DropdownMenuItem
                onClick={() => onViewDetails(cutpay.id)}
                className="cursor-pointer"
              >
                <Eye className="h-4 w-4 mr-2" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onEdit(cutpay.id)}
                className="cursor-pointer"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Transaction
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onEditSplit(cutpay.id)}
                className="cursor-pointer"
              >
                <Eye className="h-4 w-4 mr-2" />
                Edit with Document View
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
            <span className="text-gray-600 font-medium">Amount Received:</span>
            <span className="font-bold text-blue-600">{formatCurrency(cutpay.amount_received || 0)}</span>
          </div>
          <div className="flex items-center gap-3 text-gray-600 pt-2">
            <div className="p-1.5 bg-gray-100 rounded-md">
              <Calendar className="h-3.5 w-3.5 text-gray-500" />
            </div>
            <span>
              {cutpay.transaction_date ? new Date(cutpay.transaction_date).toLocaleDateString('en-IN', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              }) : 'No date'}
            </span>
          </div>
        </div>
        <div className="mt-5 pt-4 border-t border-gray-100">
          <Button
            onClick={() => onViewDetails(cutpay.id)}
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
  const [params, setParams] = useAtom(cutpayListParamsAtom)
  const [searchQuery, setSearchQuery] = useState("")
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  const { data: cutpayData, isLoading, error } = useCutPayList({
    skip: params.page ? (params.page - 1) * (params.page_size || 20) : 0,
    limit: params.page_size || 20,
    search: params.search,
    insurer_code: params.insurer_code,
    broker_code: params.broker_code,
    date_from: params.date_from,
    date_to: params.date_to,
  })

  // Since the API returns an array directly, we need to handle pagination client-side
  const pageSize = params.page_size || 20
  const currentPage = params.page || 1
  const transactions = cutpayData || []
  const totalCount = transactions.length
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const paginatedTransactions = transactions.slice(startIndex, endIndex)

  const handleSearch = () => {
    setParams((prev: CutPayListParams) => ({ ...prev, search: searchQuery, page: 1 }))
  }

  const handlePageChange = (newPage: number) => {
    setParams((prev: CutPayListParams) => ({ ...prev, page: newPage }))
  }

  const handleViewDetails = (cutpayId: number) => {
    router.push(`/admin/cutpay/${cutpayId}`)
  }

  const handleEdit = (cutpayId: number) => {
    router.push(`/admin/cutpay/${cutpayId}/edit`)
  }

  const handleEditSplit = (cutpayId: number) => {
    router.push(`/admin/cutpay/${cutpayId}/edit-split`)
  }

  const handleCreateNew = () => {
    router.push('/admin/cutpay/create')
  }

  const handlePageSizeChange = (newPageSize: string) => {
    setParams(prev => ({ ...prev, page_size: parseInt(newPageSize), page: 1 }))
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
            <Button variant="outline" size="sm" onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}>
              {viewMode === 'grid' ? 'List View' : 'Grid View'}
            </Button>
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

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-white border border-gray-200 shadow-sm rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Total Transactions</CardTitle>
            <div className="p-2 bg-slate-100 rounded-lg">
              <CreditCard className="h-4 w-4 text-slate-600" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold text-gray-900">
              {totalCount}
            </div>
            <p className="text-xs text-gray-500 mt-1">Total cutpay transactions</p>
          </CardContent>
        </Card>

        <Card className="bg-white border border-gray-200 shadow-sm rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Recent Transactions</CardTitle>
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="h-4 w-4 text-green-600" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold text-gray-900">
              {transactions.filter((t: CutPayTransaction) => {
                const transactionDate = t.transaction_date ? new Date(t.transaction_date) : null
                if (!transactionDate) return false
                
                const thirtyDaysAgo = new Date()
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
                return transactionDate > thirtyDaysAgo
              }).length || 0}
            </div>
            <p className="text-xs text-gray-500 mt-1">Last 30 days</p>
          </CardContent>
        </Card>

        <Card className="bg-white border border-gray-200 shadow-sm rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Total Amount</CardTitle>
            <div className="p-2 bg-blue-100 rounded-lg">
              <DollarSign className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold text-gray-900">
              ₹{transactions.reduce((sum: number, t: CutPayTransaction) => sum + (t.cut_pay_amount || 0), 0).toLocaleString('en-IN') || '0'}
            </div>
            <p className="text-xs text-gray-500 mt-1">Total cut pay amount</p>
          </CardContent>
        </Card>
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
              <Button variant="outline" className="shrink-0 border-gray-200 hover:bg-gray-50">
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
              <Button variant="outline" className="shrink-0 border-gray-200 hover:bg-gray-50">
                <Download className="h-4 w-4 mr-2" />
                Export
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
              <span className="text-sm text-gray-500">Show</span>
              <Select
                value={params.page_size?.toString() || "20"}
                onValueChange={handlePageSizeChange}
              >
                <SelectTrigger className="w-20 border-gray-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-gray-500">entries</span>
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
          ) : transactions.length === 0 ? (
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
              {paginatedTransactions.map((cutpay: CutPayTransaction) => (
                <CutPayCard
                  key={cutpay.id}
                  cutpay={cutpay}
                  onViewDetails={handleViewDetails}
                  onEdit={handleEdit}
                  onEditSplit={handleEditSplit}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {transactions.length > 0 && (
            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-gray-500">
                Showing {startIndex + 1} to{' '}
                {Math.min(endIndex, totalCount)} of{' '}
                {totalCount} transactions
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
                  Page {currentPage} of {Math.ceil(totalCount / pageSize)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage >= Math.ceil(totalCount / pageSize)}
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
