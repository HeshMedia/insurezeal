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

  const getActiveBrokers = () => brokers?.filter((broker) => broker.is_active).length || 0
  const getActiveInsurers = () => insurers?.filter((insurer) => insurer.is_active).length || 0
  const getActiveChildIds = () =>
    adminChildIds?.filter((childId) => childId.is_active && !childId.is_suspended).length || 0

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="border-b border-border pb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">Super Admin Dashboard</h1>
            <p className="text-muted-foreground mt-2">
              Manage brokers, insurers, and administrative child IDs across the platform
            </p>
          </div>
          <div className="hidden md:block">
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Total Active Entities</p>
              <p className="text-3xl font-semibold text-foreground mt-1">
                {getActiveBrokers() + getActiveInsurers() + getActiveChildIds()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Brokers */}
        <Card className="border border-border hover:shadow-sm transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Brokers</CardTitle>
            <Building2 className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            {brokersLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="space-y-2">
                <div className="text-2xl font-semibold text-foreground">{brokers?.length || 0}</div>
                <Badge variant="secondary" className="text-xs">
                  {getActiveBrokers()} Active
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Total Insurers */}
        <Card className="border border-border hover:shadow-sm transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Insurers</CardTitle>
            <Building className="h-5 w-5 text-emerald-600" />
          </CardHeader>
          <CardContent>
            {insurersLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="space-y-2">
                <div className="text-2xl font-semibold text-foreground">{insurers?.length || 0}</div>
                <Badge variant="secondary" className="text-xs">
                  {getActiveInsurers()} Active
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Admin Child IDs */}
        <Card className="border border-border hover:shadow-sm transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Child IDs</CardTitle>
            <Database className="h-5 w-5 text-violet-600" />
          </CardHeader>
          <CardContent>
            {adminChildIdsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="space-y-2">
                <div className="text-2xl font-semibold text-foreground">{adminChildIds?.length || 0}</div>
                <Badge variant="secondary" className="text-xs">
                  {getActiveChildIds()} Active
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* MIS & Reports */}
        <Card
          className="border border-border hover:shadow-sm transition-all cursor-pointer hover:border-muted-foreground/20"
          onClick={() => router.push("/superadmin/mis-reports")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">MIS & Reports</CardTitle>
            <FileSpreadsheet className="h-5 w-5 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-2xl font-semibold text-foreground">Analytics</div>
              <Badge variant="outline" className="text-xs">
                View Reports
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Recent Brokers */}
        <Card className="border border-border">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-600" />
              Recent Brokers
            </CardTitle>
          </CardHeader>
          <CardContent>
            {brokersLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between py-2">
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-5 w-16" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {brokers?.slice(0, 5).map((broker) => (
                  <div
                    key={broker.id}
                    className="flex items-center justify-between py-2 border-b border-border last:border-0"
                  >
                    <div>
                      <p className="font-medium text-foreground">{broker.name}</p>
                      <p className="text-sm text-muted-foreground">{broker.broker_code}</p>
                    </div>
                    <Badge variant={broker.is_active ? "default" : "secondary"} className="text-xs">
                      {broker.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                ))}
                {(!brokers || brokers.length === 0) && (
                  <p className="text-muted-foreground text-center py-8">No brokers found</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Insurers */}
        <Card className="border border-border">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Building className="h-5 w-5 text-emerald-600" />
              Recent Insurers
            </CardTitle>
          </CardHeader>
          <CardContent>
            {insurersLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between py-2">
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-5 w-16" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {insurers?.slice(0, 5).map((insurer) => (
                  <div
                    key={insurer.id}
                    className="flex items-center justify-between py-2 border-b border-border last:border-0"
                  >
                    <div>
                      <p className="font-medium text-foreground">{insurer.name}</p>
                      <p className="text-sm text-muted-foreground">{insurer.insurer_code}</p>
                    </div>
                    <Badge variant={insurer.is_active ? "default" : "secondary"} className="text-xs">
                      {insurer.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                ))}
                {(!insurers || insurers.length === 0) && (
                  <p className="text-muted-foreground text-center py-8">No insurers found</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
