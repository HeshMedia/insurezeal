"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search, Grid3X3, List, Eye, Edit, MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LoadingSpinner } from '@/components/ui/loader'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu'
import { useListPolicies } from '@/hooks/policyQuery'
import { useAtom } from 'jotai'
import { selectedPolicyContextAtom } from '@/lib/atoms/policy'
import { PolicyListItem, ListPoliciesParams } from '@/types/policy.types'

function PolicyCard({ policy, onViewDetails, onEdit }: { 
  policy: PolicyListItem; 
  onViewDetails: (id: string) => void;
  onEdit: (id: string) => void;
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
        Active
      </Badge>
    )
  }

  return (
    <Card className="bg-white hover:shadow-lg transition-all duration-200 border border-gray-200 shadow-sm rounded-xl">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900 text-lg">
                {policy.policy_number}
              </h3>
              {getStatusBadge()}
            </div>
            <p className="text-sm text-gray-600">
              {policy.policy_type} • {policy.insurance_type}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onViewDetails(policy.id)}>
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(policy.id)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit Policy
              </DropdownMenuItem>
              {/* Delete is admin-only; hidden for agents */}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-gray-500">Agent Code</p>
              <p className="font-medium text-gray-900">{policy.agent_code}</p>
            </div>
            <div>
              <p className="text-gray-500">Vehicle Type</p>
              <p className="font-medium text-gray-900">{policy.vehicle_type || 'N/A'}</p>
            </div>
            <div>
              <p className="text-gray-500">Registration No</p>
              <p className="font-medium text-gray-900">{policy.registration_number || 'N/A'}</p>
            </div>
            <div>
              <p className="text-gray-500">Net Premium</p>
              <p className="font-medium text-green-600">{formatCurrency(policy.net_premium)}</p>
            </div>
            <div>
              <p className="text-gray-500">Start Date</p>
              <p className="font-medium text-gray-900">
                {new Date(policy.start_date).toLocaleDateString('en-IN')}
              </p>
            </div>
            <div>
              <p className="text-gray-500">End Date</p>
              <p className="font-medium text-gray-900">
                {new Date(policy.end_date).toLocaleDateString('en-IN')}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function PolicyManagement() {
  const router = useRouter()
  const [, setSelectedPolicy] = useAtom(selectedPolicyContextAtom)
  const [params, setParams] = useState<ListPoliciesParams>({
    page: 1,
    page_size: 20
  })
  const [searchQuery, setSearchQuery] = useState("")
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  const { data: policiesResponse, isLoading, error } = useListPolicies(params)


  const handleSearch = () => {
    setParams(prev => ({ ...prev, search: searchQuery, page: 1 }))
  }

  const handleViewDetails = (policyId: string, policy?: PolicyListItem) => {
    if (policy?.policy_number && policy?.quarter && typeof policy.year === 'number') {
      // Save to atom for downstream pages
      const quarterNum = parseInt(String(policy.quarter).replace(/[^0-9]/g, '') || '0', 10)
      setSelectedPolicy({ policy_number: policy.policy_number, quarter: quarterNum, year: Number(policy.year) })
      router.push(`/agent/policies/${policy.policy_number}?quarter=${quarterNum}&year=${policy.year}`)
      return
    }
    router.push(`/agent/policies/${policyId}`)
  }

  const handleEdit = (policyId: string, policy?: PolicyListItem) => {
    if (policy?.policy_number && policy?.quarter && typeof policy.year === 'number') {
      const quarterNum = parseInt(String(policy.quarter).replace(/[^0-9]/g, '') || '0', 10)
      setSelectedPolicy({ policy_number: policy.policy_number, quarter: quarterNum, year: Number(policy.year) })
      router.push(`/agent/policies/${policy.policy_number}/edit?quarter=${quarterNum}&year=${policy.year}`)
      return
    }
    router.push(`/agent/policies/${policyId}/edit`)
  }


  const handleCreateNew = () => {
    router.push('/agent/policies/create')
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="text-center py-12">
          <div className="text-red-500 text-lg mb-2">Error loading policies</div>
          <p className="text-gray-600">{error.message}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="flex flex-1 gap-2 max-w-md">
          <Input
            placeholder="Search policies..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
          <Button onClick={handleSearch} variant="outline">
            <Search className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex border rounded-lg overflow-hidden">
            <Button
              size="sm"
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              onClick={() => setViewMode('grid')}
              className="rounded-none"
            >
              <Grid3X3 className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              onClick={() => setViewMode('list')}
              className="rounded-none"
            >
              <List className="w-4 h-4" />
            </Button>
          </div>

          <Button onClick={handleCreateNew} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
            <Plus className="w-4 h-4 mr-2" />
            New Policy
          </Button>
        </div>
      </div>

      {/* Stats Summary */}
      {policiesResponse && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-blue-600">{policiesResponse.total_count}</div>
              <p className="text-sm text-gray-600">Total Policies</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
             <div className="text-2xl font-bold text-green-600">{policiesResponse.policies?.length ?? 0}</div>
              <p className="text-sm text-gray-600">Current Page</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-purple-600">{policiesResponse.total_pages}</div>
              <p className="text-sm text-gray-600">Total Pages</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-orange-600">
                {(policiesResponse.policies || [])
                  .reduce((sum, policy) => sum + (policy.net_premium || 0), 0)
                  .toLocaleString('en-IN')}
              </div>
              <p className="text-sm text-gray-600">Total Premium (₹)</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner />
        </div>
      )}

      {/* Policies Grid/List */}
      {policiesResponse && !isLoading && (
        <>
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {(policiesResponse.policies || []).map((policy) => (
                <PolicyCard
                  key={policy.id}
                  policy={policy}
                  onViewDetails={(id) => handleViewDetails(id, policy)}
                  onEdit={(id) => handleEdit(id, policy)}
                
                />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Policy Details
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Vehicle Info
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Premium
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Period
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {(policiesResponse.policies || []).map((policy) => (
                        <tr key={policy.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="font-medium text-gray-900">{policy.policy_number}</div>
                              <div className="text-sm text-gray-500">{policy.agent_code}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="font-medium text-gray-900">{policy.vehicle_type || 'N/A'}</div>
                              <div className="text-sm text-gray-500">{policy.registration_number || 'N/A'}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="font-medium text-green-600">
                              {new Intl.NumberFormat('en-IN', {
                                style: 'currency',
                                currency: 'INR',
                                minimumFractionDigits: 0,
                              }).format(policy.net_premium)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <div>
                              <div>{new Date(policy.start_date).toLocaleDateString('en-IN')}</div>
                              <div className="text-gray-500">to {new Date(policy.end_date).toLocaleDateString('en-IN')}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleViewDetails(policy.id)}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleEdit(policy.id)}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit Policy
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Pagination */}
          {policiesResponse.total_pages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-700">
                Showing page {policiesResponse.page} of {policiesResponse.total_pages} 
                ({policiesResponse.total_count} total policies)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={policiesResponse.page <= 1}
                  onClick={() => setParams(prev => ({ ...prev, page: prev.page! - 1 }))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={policiesResponse.page >= policiesResponse.total_pages}
                  onClick={() => setParams(prev => ({ ...prev, page: prev.page! + 1 }))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Empty State */}
      {policiesResponse && (policiesResponse.policies || []).length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-500 text-lg mb-2">No policies found</div>
          <p className="text-gray-400 mb-4">Get started by creating your first policy</p>
          <Button onClick={handleCreateNew} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
            <Plus className="w-4 h-4 mr-2" />
            Create Policy
          </Button>
        </div>
      )}
    </div>
  )
}
