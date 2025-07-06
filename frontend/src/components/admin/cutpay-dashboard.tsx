"use client"

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  FileText, 
  Users, 
  Building,
  CheckCircle,
  Clock
} from 'lucide-react'
// import { useCutPayStats } from '@/hooks/adminQuery' // Commented out - API returning 500 error

export function CutPayDashboard() {
  // const { data: stats, isLoading, error } = useCutPayStats() // Commented out - API returning 500 error
  
  // Temporary placeholder while stats API is broken
  const isLoading = false
  const error = null
  const stats = null

  if (isLoading) {
    return <DashboardSkeleton />
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-red-500">Failed to load dashboard statistics</p>
        </CardContent>
      </Card>
    )
  }

  // Placeholder data while stats API is broken
  const placeholderStats = {
    total_transactions: 0,
    completed_transactions: 0,
    draft_transactions: 0,
    total_cut_pay_amount: 0,
    total_agent_payouts: 0,
    total_commission_receivable: 0,
    pending_sync_count: 0,
    top_agents: [],
    top_insurers: [],
    monthly_stats: {}
  }

  const displayStats = stats || placeholderStats

  return (
    <div className="space-y-6">
      {/* Placeholder Notice */}
      {!stats && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-4">
            <p className="text-orange-800 text-sm">
              <strong>Note:</strong> Dashboard statistics are temporarily unavailable. 
              Displaying placeholder data while the stats API is being fixed.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Main Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Transactions"
          value={displayStats.total_transactions}
          icon={<FileText className="h-4 w-4" />}
          trend={displayStats.completed_transactions > displayStats.draft_transactions ? 'up' : 'down'}
        />
        
        <StatsCard
          title="Completed"
          value={displayStats.completed_transactions}
          icon={<CheckCircle className="h-4 w-4 text-green-500" />}
          subtitle="Transactions"
        />
        
        <StatsCard
          title="Total CutPay Amount"
          value={`₹${displayStats.total_cut_pay_amount.toLocaleString()}`}
          icon={<DollarSign className="h-4 w-4 text-blue-500" />}
          subtitle="Commission"
        />
        
        <StatsCard
          title="Agent Payouts"
          value={`₹${displayStats.total_agent_payouts.toLocaleString()}`}
          icon={<Users className="h-4 w-4 text-purple-500" />}
          subtitle="Total Paid"
        />
      </div>

      {/* Additional Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Commission Receivable</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹{displayStats.total_commission_receivable.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              From brokers and insurers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Sync</CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{displayStats.pending_sync_count}</div>
            <p className="text-xs text-muted-foreground">
              Awaiting Google Sheets sync
            </p>
            {displayStats.pending_sync_count > 0 && (
              <Badge variant="outline" className="mt-2">
                Action Required
              </Badge>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Draft Transactions</CardTitle>
            <FileText className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{displayStats.draft_transactions}</div>
            <p className="text-xs text-muted-foreground">
              Incomplete transactions
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Top Performers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Agents */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Top Agents
            </CardTitle>
          </CardHeader>
          <CardContent>
            {displayStats.top_agents && displayStats.top_agents.length > 0 ? (
              <div className="space-y-2">
                {displayStats.top_agents.slice(0, 5).map((agent: Record<string, unknown>, index: number) => {
                  const agentData = agent as Record<string, unknown>
                  return (
                    <div key={index} className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {agentData.agent_code as string || `Agent ${index + 1}`}
                      </span>
                      <Badge variant="secondary">
                        ₹{((agentData.total_cut_pay_amount as number) || 0).toLocaleString()}
                      </Badge>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No agent data available</p>
            )}
          </CardContent>
        </Card>

        {/* Top Insurers */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Top Insurers
            </CardTitle>
          </CardHeader>
          <CardContent>
            {displayStats.top_insurers && displayStats.top_insurers.length > 0 ? (
              <div className="space-y-2">
                {displayStats.top_insurers.slice(0, 5).map((insurer: Record<string, unknown>, index: number) => {
                  const insurerData = insurer as Record<string, unknown>
                  return (
                    <div key={index} className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {insurerData.insurer_name as string || `Insurer ${index + 1}`}
                      </span>
                      <Badge variant="secondary">
                        ₹{((insurerData.total_cut_pay_amount as number) || 0).toLocaleString()}
                      </Badge>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No insurer data available</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Monthly Stats (if available) */}
      {displayStats.monthly_stats && Object.keys(displayStats.monthly_stats).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Monthly Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(displayStats.monthly_stats).slice(0, 4).map(([month, data]) => {
                const monthData = data as Record<string, unknown>
                return (
                  <div key={month} className="text-center">
                    <p className="text-sm font-medium">{month}</p>
                    <p className="text-2xl font-bold">
                      {typeof monthData === 'object' && monthData !== null
                        ? (monthData.transaction_count as number) || 0
                        : 0}
                    </p>
                    <p className="text-xs text-muted-foreground">transactions</p>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

interface StatsCardProps {
  title: string
  value: string | number
  icon: React.ReactNode
  trend?: 'up' | 'down'
  subtitle?: string
}

function StatsCard({ title, value, icon, trend, subtitle }: StatsCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {trend ? (
          trend === 'up' ? (
            <TrendingUp className="h-4 w-4 text-green-500" />
          ) : (
            <TrendingDown className="h-4 w-4 text-red-500" />
          )
        ) : (
          icon
        )}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(2)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[...Array(3)].map((_, j) => (
                  <Skeleton key={j} className="h-4 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
