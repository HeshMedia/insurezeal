'use client'

import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { QuarterlySheetRecord } from '@/types/admin-mis.types'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts'

interface PremiumAnalysisChartsProps {
  data: QuarterlySheetRecord[]
}

export function PremiumAnalysisCharts({ data }: PremiumAnalysisChartsProps) {
  const toNumber = (value: string | null | undefined): number => {
    if (!value) return 0
    const num = parseFloat(value.toString().replace(/[^0-9.-]/g, ''))
    return isNaN(num) ? 0 : num
  }

  // Premium breakdown by month
  const monthlyPremiumData = useMemo(() => {
    const monthlyData = data.reduce((acc, record) => {
      const month = record["Reporting Month (mmm'yy)"] || 'Unknown'
      if (!acc[month]) {
        acc[month] = {
          month,
          grossPremium: 0,
          netPremium: 0,
          commissionablePremium: 0,
          count: 0
        }
      }
      acc[month].grossPremium += toNumber(record["Gross premium"])
      acc[month].netPremium += toNumber(record["Net premium"])
      acc[month].commissionablePremium += toNumber(record["Commissionable Premium"])
      acc[month].count += 1
      return acc
    }, {} as Record<string, any>)

    return Object.values(monthlyData).sort((a: any, b: any) => a.month.localeCompare(b.month))
  }, [data])

  // Premium distribution by category
  const categoryPremiumData = useMemo(() => {
    const categoryData = data.reduce((acc, record) => {
      const category = record["Major Categorisation( Motor/Life/ Health)"] || 'Unknown'
      if (!acc[category]) {
        acc[category] = {
          name: category,
          value: 0,
          count: 0
        }
      }
      acc[category].value += toNumber(record["Gross premium"])
      acc[category].count += 1
      return acc
    }, {} as Record<string, any>)

    return Object.values(categoryData).sort((a: any, b: any) => b.value - a.value)
  }, [data])

  // Premium vs Commission analysis
  const premiumCommissionData = useMemo(() => {
    return data.slice(0, 50).map((record, index) => ({
      index: index + 1,
      grossPremium: toNumber(record["Gross premium"]),
      commissionablePremium: toNumber(record["Commissionable Premium"]),
      receivableFromBroker: toNumber(record["Receivable from Broker"]),
      policyNumber: record["Policy number"]
    })).filter(item => item.grossPremium > 0)
  }, [data])

  // Plan type distribution
  const planTypeData = useMemo(() => {
    const planData = data.reduce((acc, record) => {
      const planType = record["Plan type (Comp/STP/SAOD)"] || 'Unknown'
      if (!acc[planType]) {
        acc[planType] = {
          name: planType,
          value: 0,
          count: 0
        }
      }
      acc[planType].value += toNumber(record["Gross premium"])
      acc[planType].count += 1
      return acc
    }, {} as Record<string, any>)

    return Object.values(planData)
  }, [data])

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D']

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(value)
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium">{`${label}`}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {`${entry.name}: ${formatCurrency(entry.value)}`}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  const PieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0]
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium">{data.name}</p>
          <p style={{ color: data.color }}>
            Amount: {formatCurrency(data.value)}
          </p>
          <p className="text-sm text-gray-600">
            Policies: {data.payload.count}
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="grid gap-6">
      {/* Monthly Premium Trends */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Monthly Premium Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={monthlyPremiumData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={(value) => `₹${(value / 1000000).toFixed(1)}M`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar dataKey="grossPremium" fill="#8884d8" name="Gross Premium" />
              <Bar dataKey="netPremium" fill="#82ca9d" name="Net Premium" />
              <Bar dataKey="commissionablePremium" fill="#ffc658" name="Commissionable Premium" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Category Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Premium by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categoryPremiumData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {categoryPremiumData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Plan Type Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Premium by Plan Type</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={planTypeData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {planTypeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Premium vs Commission Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Premium vs Commission Analysis (Top 50 Policies)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={premiumCommissionData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="index" />
              <YAxis tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}K`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Area 
                type="monotone" 
                dataKey="grossPremium" 
                stackId="1" 
                stroke="#8884d8" 
                fill="#8884d8" 
                name="Gross Premium"
              />
              <Area 
                type="monotone" 
                dataKey="commissionablePremium" 
                stackId="2" 
                stroke="#82ca9d" 
                fill="#82ca9d" 
                name="Commissionable Premium"
              />
              <Area 
                type="monotone" 
                dataKey="receivableFromBroker" 
                stackId="3" 
                stroke="#ffc658" 
                fill="#ffc658" 
                name="Receivable from Broker"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}
