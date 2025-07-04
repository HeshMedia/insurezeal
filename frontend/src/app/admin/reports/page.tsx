'use client'

import { DashboardWrapper } from '@/components/dashboard-wrapper'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  BarChart3, 
  TrendingUp, 
  DollarSign, 
  Users, 
  FileText,
  Download,
  Calendar,
  Filter
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AnalyticsCharts } from '@/components/admin/analytics-charts'
import { CutPayExport } from '@/components/admin/cutpay-export'
import { useCutPayStats, useAdminStats } from '@/hooks/adminQuery'

export default function ReportsPage() {
  const { data: cutpayStats } = useCutPayStats()
  const { data: adminStats } = useAdminStats()

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount)
  }

  return (
    <DashboardWrapper requiredRole="admin">
      <div className="space-y-3">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Reports & Analytics</h1>
            <p className="text-sm text-gray-600">Comprehensive business insights and analytics</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 px-3 text-xs">
              <Filter className="h-3 w-3 mr-1.5" />
              Filter
            </Button>
            <Button variant="outline" size="sm" className="h-8 px-3 text-xs">
              <Calendar className="h-3 w-3 mr-1.5" />
              Date Range
            </Button>
            <Button size="sm" className="h-8 px-3 text-xs">
              <Download className="h-3 w-3 mr-1.5" />
              Export
            </Button>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="border border-gray-200 shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-slate-100 rounded-md">
                  <DollarSign className="h-4 w-4 text-slate-600" />
                </div>
                <div>
                  <div className="text-xs text-gray-600">Total Revenue</div>
                  <div className="text-lg font-bold text-gray-900">
                    {cutpayStats?.stats ? formatCurrency(cutpayStats.stats.total_cut_pay_amount) : '₹0'}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-green-600">
                    <TrendingUp className="h-2.5 w-2.5" />
                    +12.5%
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200 shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-slate-100 rounded-md">
                  <Users className="h-4 w-4 text-slate-600" />
                </div>
                <div>
                  <div className="text-xs text-gray-600">Total Agents</div>
                  <div className="text-lg font-bold text-gray-900">
                    {adminStats?.total_agents || 0}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-green-600">
                    <TrendingUp className="h-2.5 w-2.5" />
                    +{adminStats?.new_agents_this_month || 0} this month
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200 shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-slate-100 rounded-md">
                  <BarChart3 className="h-4 w-4 text-slate-600" />
                </div>
                <div>
                  <div className="text-xs text-gray-600">Transactions</div>
                  <div className="text-lg font-bold text-gray-900">
                    {cutpayStats?.stats.total_transactions || 0}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-green-600">
                    <TrendingUp className="h-2.5 w-2.5" />
                    +8.2%
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200 shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-slate-100 rounded-md">
                  <FileText className="h-4 w-4 text-slate-600" />
                </div>
                <div>
                  <div className="text-xs text-gray-600">Documents</div>
                  <div className="text-lg font-bold text-gray-900">
                    {adminStats?.total_documents || 0}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-green-600">
                    <TrendingUp className="h-2.5 w-2.5" />
                    +15.3%
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Reports Tabs */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5 h-8">
            <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
            <TabsTrigger value="analytics" className="text-xs">Analytics</TabsTrigger>
            <TabsTrigger value="financial" className="text-xs">Financial</TabsTrigger>
            <TabsTrigger value="exports" className="text-xs">Data Export</TabsTrigger>
            <TabsTrigger value="performance" className="text-xs">Performance</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <AnalyticsCharts />
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <AnalyticsCharts />
            </div>
          </TabsContent>

          <TabsContent value="financial" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="border border-gray-200 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Monthly Revenue Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="p-3">
                  <div className="space-y-4">
                    {cutpayStats?.stats.monthly_breakdown?.map((month, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <div className="font-medium">{month.month} {month.year}</div>
                          <div className="text-sm text-gray-600">{month.transaction_count} transactions</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-green-600">
                            {formatCurrency(month.total_amount || 0)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Top Performing Agents</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {cutpayStats?.stats.top_agents?.map((agent, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary">{index + 1}</Badge>
                          <div>
                            <div className="font-medium">{agent.agent_name || agent.agent_code}</div>
                            <div className="text-sm text-gray-600">{agent.transaction_count} transactions</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-blue-600">
                            {formatCurrency(agent.total_cut_pay_amount || 0)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="exports" className="space-y-6">
            <CutPayExport />
            
            <Card>
              <CardHeader>
                <CardTitle>Other Export Options</CardTitle>
                <p className="text-sm text-gray-600">Additional data export options will be available soon</p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="p-4 border border-gray-200 rounded-lg opacity-50">
                    <h4 className="font-medium text-gray-900 mb-2">Agent Reports</h4>
                    <p className="text-sm text-gray-600 mb-3">Export agent performance and activity data</p>
                    <Button disabled size="sm" variant="outline">Coming Soon</Button>
                  </div>
                  <div className="p-4 border border-gray-200 rounded-lg opacity-50">
                    <h4 className="font-medium text-gray-900 mb-2">Policy Analytics</h4>
                    <p className="text-sm text-gray-600 mb-3">Export policy data and trends</p>
                    <Button disabled size="sm" variant="outline">Coming Soon</Button>
                  </div>
                  <div className="p-4 border border-gray-200 rounded-lg opacity-50">
                    <h4 className="font-medium text-gray-900 mb-2">Financial Summary</h4>
                    <p className="text-sm text-gray-600 mb-3">Export comprehensive financial reports</p>
                    <Button disabled size="sm" variant="outline">Coming Soon</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="performance" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>System Performance Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">API Response Time</span>
                      <span className="font-medium">245ms</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Database Performance</span>
                      <Badge className="bg-green-100 text-green-800">Excellent</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Error Rate</span>
                      <span className="font-medium text-green-600">0.02%</span>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Daily Active Users</span>
                      <span className="font-medium">1,234</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">System Uptime</span>
                      <span className="font-medium text-green-600">99.9%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Storage Usage</span>
                      <span className="font-medium">73%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardWrapper>
  )
}
