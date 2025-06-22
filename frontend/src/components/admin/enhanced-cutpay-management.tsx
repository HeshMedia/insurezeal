"use client"

import { useState } from "react"
import { useAtom } from "jotai"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useCutPayList, useCutPayStats } from "@/hooks/adminQuery"
import { cutpayListParamsAtom, selectedCutpayIdAtom, isCutpayDialogOpenAtom } from "@/lib/atoms/admin"
import { 
  Search, 
  Plus, 
  MoreHorizontal, 
  Eye, 
  TrendingUp,
  DollarSign,
  Users,
  Activity,
  ArrowLeft,
  ArrowRight,
  Calendar,
  Building
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function CutPayManagement() {
  const [params, setParams] = useAtom(cutpayListParamsAtom)
  const [, setSelectedId] = useAtom(selectedCutpayIdAtom)
  const [, setDialogOpen] = useAtom(isCutpayDialogOpenAtom)
  const [searchQuery, setSearchQuery] = useState("")

  const { data: cutpayData, isLoading, error } = useCutPayList(params)
  const { data: statsData, isLoading: isStatsLoading } = useCutPayStats()

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const handleSearch = () => {
    setParams(prev => ({ ...prev, search: searchQuery, page: 1 }))
  }

  const handlePageChange = (newPage: number) => {
    setParams(prev => ({ ...prev, page: newPage }))
  }

  const handleViewDetails = (cutpayId: number) => {
    setSelectedId(cutpayId)
    setDialogOpen(true)
  }

  const handleCreateNew = () => {
    setSelectedId(null)
    setDialogOpen(true)
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">CutPay Management</h2>
          <p className="text-gray-600">Manage agent commission transactions and payments</p>
        </div>
        <Button onClick={handleCreateNew} className="bg-blue-600 hover:bg-blue-700 shadow-sm">
          <Plus className="h-4 w-4 mr-2" />
          New Transaction
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {isStatsLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="hover:shadow-md transition-shadow">
              <CardHeader className="space-y-0 pb-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-8 rounded-lg" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-20" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <Card className="hover:shadow-md transition-shadow border-l-4 border-l-blue-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-sm font-medium text-gray-700">Total Amount</CardTitle>
                <div className="p-2 bg-blue-50 rounded-lg">
                  <DollarSign className="h-4 w-4 text-blue-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900">
                  {statsData?.stats ? formatCurrency(statsData.stats.total_cut_pay_amount) : '₹0'}
                </div>
                <p className="text-xs text-gray-500 mt-1">Total CutPay volume</p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow border-l-4 border-l-green-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-sm font-medium text-gray-700">Transactions</CardTitle>
                <div className="p-2 bg-green-50 rounded-lg">
                  <Activity className="h-4 w-4 text-green-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900">
                  {statsData?.stats?.total_transactions || 0}
                </div>
                <p className="text-xs text-gray-500 mt-1">Total transactions</p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow border-l-4 border-l-purple-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-sm font-medium text-gray-700">Avg Transaction</CardTitle>
                <div className="p-2 bg-purple-50 rounded-lg">
                  <TrendingUp className="h-4 w-4 text-purple-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900">
                  {statsData?.stats ? formatCurrency(statsData.stats.average_cut_pay_amount) : '₹0'}
                </div>
                <p className="text-xs text-gray-500 mt-1">Average amount</p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow border-l-4 border-l-orange-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-sm font-medium text-gray-700">Top Agents</CardTitle>
                <div className="p-2 bg-orange-50 rounded-lg">
                  <Users className="h-4 w-4 text-orange-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900">
                  {statsData?.stats?.top_agents?.length || 0}
                </div>
                <p className="text-xs text-gray-500 mt-1">Active agents</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search by policy number, agent code, or company..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10"
              />
            </div>            <div className="flex gap-2">
              <Button onClick={handleSearch} variant="outline" className="shrink-0">
                <Search className="h-4 w-4 mr-2" />
                Search
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold">CutPay Transactions</CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Show</span>
              <Select
                value={params.page_size?.toString() || "20"}
                onValueChange={handlePageSizeChange}
              >
                <SelectTrigger className="w-20">
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
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center space-x-4 p-4">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          ) : cutpayData?.transactions?.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-2">
                <DollarSign className="h-12 w-12 mx-auto" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-1">No transactions found</h3>
              <p className="text-gray-500">Get started by creating your first CutPay transaction.</p>
              <Button onClick={handleCreateNew} className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                Create Transaction
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-semibold text-gray-900">Policy Number</TableHead>
                    <TableHead className="font-semibold text-gray-900">Agent Code</TableHead>
                    <TableHead className="font-semibold text-gray-900">Company</TableHead>
                    <TableHead className="font-semibold text-gray-900">Broker</TableHead>
                    <TableHead className="font-semibold text-gray-900 text-right">CutPay Amount</TableHead>
                    <TableHead className="font-semibold text-gray-900 text-right">Amount Received</TableHead>
                    <TableHead className="font-semibold text-gray-900">Date</TableHead>
                    <TableHead className="font-semibold text-gray-900 text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cutpayData?.transactions?.map((transaction) => (
                    <TableRow key={transaction.id} className="hover:bg-gray-50 transition-colors">
                      <TableCell className="font-medium">{transaction.policy_number}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs">
                          {transaction.agent_code}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4 text-gray-400" />
                          <span className="truncate max-w-32">{transaction.insurance_company}</span>
                        </div>
                      </TableCell>
                      <TableCell className="truncate max-w-32">{transaction.broker}</TableCell>
                      <TableCell className="text-right font-semibold text-green-600">
                        {formatCurrency(transaction.cut_pay_amount)}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(transaction.amount_received)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          <span className="text-sm">{formatDate(transaction.transaction_date)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleViewDetails(transaction.id)}
                              className="cursor-pointer"
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {cutpayData && cutpayData.transactions.length > 0 && (
            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-gray-500">
                Showing {((cutpayData.page - 1) * cutpayData.page_size) + 1} to{' '}
                {Math.min(cutpayData.page * cutpayData.page_size, cutpayData.total_count)} of{' '}
                {cutpayData.total_count} results
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(cutpayData.page - 1)}
                  disabled={cutpayData.page <= 1}
                >
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, Math.ceil(cutpayData.total_count / cutpayData.page_size)) }, (_, i) => {
                    const pageNum = cutpayData.page - 2 + i
                    if (pageNum < 1 || pageNum > Math.ceil(cutpayData.total_count / cutpayData.page_size)) return null
                    return (
                      <Button
                        key={pageNum}
                        variant={pageNum === cutpayData.page ? "default" : "outline"}
                        size="sm"
                        onClick={() => handlePageChange(pageNum)}
                        className="w-8 h-8 p-0"
                      >
                        {pageNum}
                      </Button>
                    )
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(cutpayData.page + 1)}
                  disabled={cutpayData.page >= Math.ceil(cutpayData.total_count / cutpayData.page_size)}
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
