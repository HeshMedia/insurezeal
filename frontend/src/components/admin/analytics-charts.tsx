"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useCutPayStats } from "@/hooks/adminQuery"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

export function AnalyticsCharts() {
  const { data: cutpayStats, isLoading } = useCutPayStats()

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value)
  }

  const monthlyData = cutpayStats?.stats?.monthly_breakdown?.map(item => ({
    month: item.month || 'Unknown',
    amount: item.total_amount || 0,
    transactions: item.transaction_count || 0,
  })).slice(-6) || []

  const topAgentsData = cutpayStats?.stats?.top_agents?.slice(0, 5).map((agent, index) => ({
    name: agent.agent_code || `Agent ${index + 1}`,
    amount: agent.total_cut_pay_amount || 0,
    transactions: agent.transaction_count || 0,
  })) || []

  const COLORS = ['#64748b', '#94a3b8', '#cbd5e1', '#e2e8f0', '#f1f5f9']

  if (isLoading) {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <Card className="border border-gray-200">
          <CardHeader className="pb-2">
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-48 w-full" />
          </CardContent>
        </Card>
        <Card className="border border-gray-200">
          <CardHeader className="pb-2">
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-48 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {/* Monthly Revenue Chart */}
      <Card className="col-span-1 border border-gray-200 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-gray-900">
            Monthly CutPay Trends
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3">
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="month" 
                  tick={{ fontSize: 11 }}
                  stroke="#6b7280"
                />
                <YAxis 
                  tick={{ fontSize: 11 }}
                  stroke="#6b7280"
                  tickFormatter={(value) => `₹${(value / 1000)}K`}
                />
                <Tooltip 
                  formatter={(value: number) => [formatCurrency(value), 'Amount']}
                  labelStyle={{ color: '#374151' }}
                  contentStyle={{ 
                    backgroundColor: '#ffffff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  }}
                />
                <Bar 
                  dataKey="amount" 
                  fill="#64748b" 
                  radius={[3, 3, 0, 0]}
                  stroke="#475569"
                  strokeWidth={1}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-gray-600">
            <span>Last 6 months performance</span>
            <span className="font-medium">
              Total: {formatCurrency(monthlyData.reduce((sum, item) => sum + item.amount, 0))}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Top Agents Chart */}
      <Card className="col-span-1 border border-gray-200 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-gray-900">
            Top Performing Agents
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3">
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={topAgentsData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={75}
                  paddingAngle={2}
                  dataKey="amount"
                >
                  {topAgentsData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => [formatCurrency(value), 'CutPay Amount']}
                  contentStyle={{ 
                    backgroundColor: '#ffffff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 space-y-2">
            {topAgentsData.map((agent, index) => (
              <div key={agent.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-2.5 h-2.5 rounded-full" 
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="text-xs font-medium text-gray-700">{agent.name}</span>
                </div>
                <div className="text-right">
                  <div className="text-xs font-semibold text-gray-900">
                    {formatCurrency(agent.amount)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {agent.transactions} transactions
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
