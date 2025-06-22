"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, TrendingDown, Users, FileText, DollarSign, MessageSquare } from "lucide-react"
import { useAdminStats, useCutPayStats, useChildRequestStats } from "@/hooks/adminQuery"
import { cn } from "@/lib/utils"

interface StatCardProps {
  title: string
  value: string | number
  change?: number
  changeLabel?: string
  icon: React.ComponentType<{ className?: string }>
  isLoading?: boolean
  trend?: 'up' | 'down' | 'neutral'
  className?: string
}

function StatCard({ 
  title, 
  value, 
  change, 
  changeLabel, 
  icon: Icon, 
  isLoading, 
  trend = 'neutral',
  className 
}: StatCardProps) {
  if (isLoading) {
    return (
      <Card className={cn("hover:shadow-md transition-shadow", className)}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-5" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-20 mb-2" />
          <Skeleton className="h-3 w-32" />
        </CardContent>
      </Card>
    )
  }

  const getTrendIcon = () => {
    if (trend === 'up') return <TrendingUp className="h-3 w-3" />
    if (trend === 'down') return <TrendingDown className="h-3 w-3" />
    return null
  }

  const getTrendColor = () => {
    if (trend === 'up') return 'text-green-600 bg-green-50'
    if (trend === 'down') return 'text-red-600 bg-red-50'
    return 'text-gray-600 bg-gray-50'
  }

  return (
    <Card className={cn("hover:shadow-md transition-shadow", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-gray-600">{title}</CardTitle>
        <Icon className="h-5 w-5 text-gray-500" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-gray-900 mb-1">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </div>
        {change !== undefined && changeLabel && (
          <div className="flex items-center gap-1">
            <Badge variant="secondary" className={cn("text-xs font-medium", getTrendColor())}>
              {getTrendIcon()}
              <span className="ml-1">
                {change > 0 ? '+' : ''}{change}% {changeLabel}
              </span>
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function StatsCards() {
  const { data: adminStats, isLoading: adminStatsLoading } = useAdminStats()
  const { data: cutpayStats, isLoading: cutpayStatsLoading } = useCutPayStats()
  const { data: childStats, isLoading: childStatsLoading } = useChildRequestStats()

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const getMonthlyGrowth = (breakdown?: Array<{ month?: string; year?: number; total_amount?: number; transaction_count?: number }>) => {
    if (!breakdown || breakdown.length < 2) return 0
    
    const sortedData = [...breakdown].sort((a, b) => {
      const dateA = new Date(a.year || 0, (new Date(`${a.month} 1`).getMonth()) || 0)
      const dateB = new Date(b.year || 0, (new Date(`${b.month} 1`).getMonth()) || 0)
      return dateB.getTime() - dateA.getTime()
    })
    
    const current = sortedData[0]?.total_amount || 0
    const previous = sortedData[1]?.total_amount || 0
    
    if (previous === 0) return 0
    return ((current - previous) / previous) * 100
  }
  const monthlyGrowth = getMonthlyGrowth(cutpayStats?.stats?.monthly_breakdown)

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Total Agents"
        value={adminStats?.total_agents || 0}
        change={adminStats?.new_agents_this_month ? ((adminStats.new_agents_this_month / (adminStats.total_agents || 1)) * 100) : undefined}
        changeLabel="this month"
        icon={Users}
        isLoading={adminStatsLoading}
        trend={adminStats?.new_agents_this_month && adminStats.new_agents_this_month > 0 ? 'up' : 'neutral'}
        className="border-l-4 border-l-blue-500"
      />
      
      <StatCard
        title="Total Documents"
        value={adminStats?.total_documents || 0}
        icon={FileText}
        isLoading={adminStatsLoading}
        className="border-l-4 border-l-green-500"
      />
      
      <StatCard
        title="Total CutPay Amount"
        value={cutpayStats?.stats ? formatCurrency(cutpayStats.stats.total_cut_pay_amount) : '₹0'}
        change={monthlyGrowth ? Math.round(monthlyGrowth) : undefined}        changeLabel="vs last month"
        icon={DollarSign}
        isLoading={cutpayStatsLoading}
        trend={monthlyGrowth > 0 ? 'up' : monthlyGrowth < 0 ? 'down' : 'neutral'}
        className="border-l-4 border-l-purple-500"
      />
      
      <StatCard
        title="Child Requests"
        value={childStats?.total_requests || 0}
        change={childStats?.pending_requests ? ((childStats.pending_requests / (childStats.total_requests || 1)) * 100) : undefined}
        changeLabel="pending"
        icon={MessageSquare}
        isLoading={childStatsLoading}
        trend={childStats?.pending_requests && childStats.pending_requests > 0 ? 'down' : 'neutral'}
        className="border-l-4 border-l-orange-500"
      />
    </div>
  )
}
