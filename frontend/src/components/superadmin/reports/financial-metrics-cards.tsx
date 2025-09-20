'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  DollarSign, 
  TrendingUp, 
  Users, 
  FileText, 
  Building, 
  PieChart,
  BarChart3
} from "lucide-react"

interface SummaryStats {
  totalRecords: number
  totalGrossPremium: number
  totalNetPremium: number
  totalCommissionablePremium: number
  totalReceivableFromBroker: number
  totalRunningBalance: number
  uniqueAgents: number
  uniqueBrokers: number
  averagePremium: number
}

interface FinancialMetricsCardsProps {
  stats: SummaryStats
}

export function FinancialMetricsCards({ stats }: FinancialMetricsCardsProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount)
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-IN').format(num)
  }

  const getGrowthIndicator = (value: number) => {
    if (value > 0) return 'positive'
    if (value < 0) return 'negative'
    return 'neutral'
  }

  const metrics = [
    {
      title: "Total Policies",
      value: formatNumber(stats.totalRecords),
      icon: FileText,
      color: "blue",
      description: "Active policies in dataset"
    },
    {
      title: "Gross Premium",
      value: formatCurrency(stats.totalGrossPremium),
      icon: DollarSign,
      color: "green",
      description: "Total gross premium collected",
      subtitle: `Avg: ${formatCurrency(stats.averagePremium)}`
    },
    {
      title: "Net Premium",
      value: formatCurrency(stats.totalNetPremium),
      icon: TrendingUp,
      color: "emerald",
      description: "Total net premium amount"
    },
    {
      title: "Commissionable Premium",
      value: formatCurrency(stats.totalCommissionablePremium),
      icon: PieChart,
      color: "purple",
      description: "Total commissionable amount"
    },
    {
      title: "Receivable from Brokers",
      value: formatCurrency(stats.totalReceivableFromBroker),
      icon: BarChart3,
      color: "orange",
      description: "Amount receivable from brokers"
    },
    {
      title: "Running Balance",
      value: formatCurrency(stats.totalRunningBalance),
      icon: TrendingUp,
      color: stats.totalRunningBalance >= 0 ? "green" : "red",
      description: "Current running balance",
      growth: stats.totalRunningBalance >= 0 ? 'positive' : 'negative'
    },
    {
      title: "Active Agents",
      value: formatNumber(stats.uniqueAgents),
      icon: Users,
      color: "blue",
      description: "Unique agents in dataset"
    },
    {
      title: "Partner Brokers",
      value: formatNumber(stats.uniqueBrokers),
      icon: Building,
      color: "indigo",
      description: "Unique broker partners"
    }
  ]

  const getColorClasses = (color: string) => {
    const colorMap = {
      blue: {
        icon: "text-blue-600",
        badge: "bg-blue-100 text-blue-800 border-blue-200"
      },
      green: {
        icon: "text-green-600",
        badge: "bg-green-100 text-green-800 border-green-200"
      },
      emerald: {
        icon: "text-emerald-600",
        badge: "bg-emerald-100 text-emerald-800 border-emerald-200"
      },
      purple: {
        icon: "text-purple-600",
        badge: "bg-purple-100 text-purple-800 border-purple-200"
      },
      orange: {
        icon: "text-orange-600",
        badge: "bg-orange-100 text-orange-800 border-orange-200"
      },
      red: {
        icon: "text-red-600",
        badge: "bg-red-100 text-red-800 border-red-200"
      },
      indigo: {
        icon: "text-indigo-600",
        badge: "bg-indigo-100 text-indigo-800 border-indigo-200"
      }
    }
    return colorMap[color as keyof typeof colorMap] || colorMap.blue
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((metric, index) => {
        const colors = getColorClasses(metric.color)
        const IconComponent = metric.icon
        
        return (
          <Card key={index} className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-700">
                {metric.title}
              </CardTitle>
              <IconComponent className={`h-4 w-4 ${colors.icon}`} />
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <div className="text-2xl font-bold text-gray-900">
                  {metric.value}
                </div>
                
                {metric.subtitle && (
                  <div className="text-xs text-gray-600">
                    {metric.subtitle}
                  </div>
                )}
                
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-600">
                    {metric.description}
                  </p>
                  
                  {metric.growth && (
                    <Badge 
                      variant="secondary" 
                      className={
                        metric.growth === 'positive' 
                          ? "bg-green-100 text-green-700 border-green-200"
                          : metric.growth === 'negative'
                          ? "bg-red-100 text-red-700 border-red-200"
                          : colors.badge
                      }
                    >
                      {metric.growth === 'positive' ? '↗' : metric.growth === 'negative' ? '↘' : '→'}
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
