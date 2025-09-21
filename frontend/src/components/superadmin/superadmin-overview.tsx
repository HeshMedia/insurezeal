"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Building2, Building, Database, FileSpreadsheet } from "lucide-react"
import { useBrokerList, useInsurerList, useAdminChildIdList } from "@/hooks/superadminQuery"
import { Skeleton } from "@/components/ui/skeleton"
import { useRouter } from "next/navigation"

export function SuperAdminOverview() {
  const router = useRouter()
  const { data: brokers, isLoading: brokersLoading } = useBrokerList()
  const { data: insurers, isLoading: insurersLoading } = useInsurerList()
  const { data: adminChildIds, isLoading: adminChildIdsLoading } = useAdminChildIdList()

  const getActiveBrokers = () => brokers?.filter(broker => broker.is_active).length || 0
  const getActiveInsurers = () => insurers?.filter(insurer => insurer.is_active).length || 0
  const getActiveChildIds = () => adminChildIds?.filter(childId => childId.is_active && !childId.is_suspended).length || 0

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">Super Admin Dashboard</h1>
            <p className="text-red-100 text-sm">
              Manage brokers, insurers, and administrative child IDs across the platform
            </p>
          </div>
          <div className="hidden md:flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-red-100">Total Active Entities</p>
              <p className="text-2xl font-bold">
                {(getActiveBrokers() + getActiveInsurers() + getActiveChildIds())}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Brokers */}
        <Card className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-700">Brokers</CardTitle>
            <Building2 className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            {brokersLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="space-y-1">
                <div className="text-2xl font-bold text-gray-900">{brokers?.length || 0}</div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">
                    {getActiveBrokers()} Active
                  </Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Total Insurers */}
        <Card className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-700">Insurers</CardTitle>
            <Building className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            {insurersLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="space-y-1">
                <div className="text-2xl font-bold text-gray-900">{insurers?.length || 0}</div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">
                    {getActiveInsurers()} Active
                  </Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Admin Child IDs */}
        <Card className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-700">Child IDs</CardTitle>
            <Database className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            {adminChildIdsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="space-y-1">
                <div className="text-2xl font-bold text-gray-900">{adminChildIds?.length || 0}</div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">
                    {getActiveChildIds()} Active
                  </Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* MIS & Reports */}
        <Card 
          className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer hover:bg-gray-50"
          onClick={() => router.push('/superadmin/mis-reports')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-700">MIS & Reports</CardTitle>
            <FileSpreadsheet className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="text-2xl font-bold text-gray-900">Analytics</div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-orange-100 text-orange-700 border-orange-200">
                  View Reports
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Recent Brokers */}
        <Card className="border border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-600" />
              Recent Brokers
            </CardTitle>
          </CardHeader>
          <CardContent>
            {brokersLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {brokers?.slice(0, 5).map((broker) => (
                  <div key={broker.id} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{broker.name}</p>
                      <p className="text-sm text-gray-600">{broker.broker_code}</p>
                    </div>
                    <Badge 
                      variant="secondary"
                      className={broker.is_active 
                        ? "bg-green-100 text-green-700 border-green-200" 
                        : "bg-gray-100 text-gray-700 border-gray-200"
                      }
                    >
                      {broker.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                ))}
                {(!brokers || brokers.length === 0) && (
                  <p className="text-gray-500 text-center py-4">No brokers found</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Insurers */}
        <Card className="border border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Building className="h-5 w-5 text-green-600" />
              Recent Insurers
            </CardTitle>
          </CardHeader>
          <CardContent>
            {insurersLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {insurers?.slice(0, 5).map((insurer) => (
                  <div key={insurer.id} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{insurer.name}</p>
                      <p className="text-sm text-gray-600">{insurer.insurer_code}</p>
                    </div>
                    <Badge 
                      variant="secondary"
                      className={insurer.is_active 
                        ? "bg-green-100 text-green-700 border-green-200" 
                        : "bg-gray-100 text-gray-700 border-gray-200"
                      }
                    >
                      {insurer.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                ))}
                {(!insurers || insurers.length === 0) && (
                  <p className="text-gray-500 text-center py-4">No insurers found</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
