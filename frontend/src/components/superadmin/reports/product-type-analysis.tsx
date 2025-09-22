/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { QuarterlySheetRecord } from '@/types/admin-mis.types'
import {
  ResponsiveContainer,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ComposedChart,
  Line,
  AreaChart,
  Area,
} from 'recharts'

interface ProductTypeAnalysisProps {
  data: QuarterlySheetRecord[]
}

export function ProductTypeAnalysis({ data }: ProductTypeAnalysisProps) {
  const toNumber = (value: string | null | undefined): number => {
    if (!value) return 0
    const num = parseFloat(value.toString().replace(/[^0-9.-]/g, ''))
    return isNaN(num) ? 0 : num
  }

  // Product type performance
  const productTypeData = useMemo(() => {
    const productData = data.reduce((acc, record) => {
      const productType = record["Product Type"] || 'Unknown'
      if (!acc[productType]) {
        acc[productType] = {
          name: productType,
          totalPremium: 0,
          netPremium: 0,
          commissionablePremium: 0,
          policyCount: 0,
          avgPremium: 0,
          receivableFromBroker: 0
        }
      }
      acc[productType].totalPremium += toNumber(record["Gross premium"])
      acc[productType].netPremium += toNumber(record["Net premium"])
      acc[productType].commissionablePremium += toNumber(record["Commissionable Premium"])
      acc[productType].receivableFromBroker += toNumber(record["Receivable from Broker"])
      acc[productType].policyCount += 1
      return acc
    }, {} as Record<string, any>)

    return Object.values(productData)
      .map((product: any) => ({
        ...product,
        avgPremium: product.policyCount > 0 ? product.totalPremium / product.policyCount : 0
      }))
      .sort((a: any, b: any) => b.totalPremium - a.totalPremium)
  }, [data])

  // Plan type analysis
  const planTypeData = useMemo(() => {
    const planData = data.reduce((acc, record) => {
      const planType = record["Plan type (Comp/STP/SAOD)"] || 'Unknown'
      if (!acc[planType]) {
        acc[planType] = {
          name: planType,
          totalPremium: 0,
          policyCount: 0,
          avgPremium: 0,
          commissionablePremium: 0
        }
      }
      acc[planType].totalPremium += toNumber(record["Gross premium"])
      acc[planType].commissionablePremium += toNumber(record["Commissionable Premium"])
      acc[planType].policyCount += 1
      return acc
    }, {} as Record<string, any>)

    return Object.values(planData)
      .map((plan: any) => ({
        ...plan,
        avgPremium: plan.policyCount > 0 ? plan.totalPremium / plan.policyCount : 0
      }))
      .sort((a: any, b: any) => b.totalPremium - a.totalPremium)
  }, [data])

  // Business type distribution
  const businessTypeData = useMemo(() => {
    const businessData = data.reduce((acc, record) => {
      const businessType = record["Business Type"] || 'Unknown'
      if (!acc[businessType]) {
        acc[businessType] = {
          name: businessType,
          value: 0,
          policyCount: 0,
          avgPremium: 0
        }
      }
      const premium = toNumber(record["Gross premium"])
      acc[businessType].value += premium
      acc[businessType].policyCount += 1
      return acc
    }, {} as Record<string, any>)

    return Object.values(businessData)
      .map((business: any) => ({
        ...business,
        avgPremium: business.policyCount > 0 ? business.value / business.policyCount : 0
      }))
      .sort((a: any, b: any) => b.value - a.value)
  }, [data])

  // Product performance radar chart data
  const productRadarData = useMemo(() => {
    const topProducts = productTypeData.slice(0, 6)
    const maxValues = {
      totalPremium: Math.max(...topProducts.map((p: any) => p.totalPremium)),
      policyCount: Math.max(...topProducts.map((p: any) => p.policyCount)),
      avgPremium: Math.max(...topProducts.map((p: any) => p.avgPremium)),
      commissionablePremium: Math.max(...topProducts.map((p: any) => p.commissionablePremium))
    }

    return topProducts.map((product: any) => ({
      product: product.name,
      'Premium Volume': (product.totalPremium / maxValues.totalPremium) * 100,
      'Policy Count': (product.policyCount / maxValues.policyCount) * 100,
      'Avg Premium': (product.avgPremium / maxValues.avgPremium) * 100,
      'Commission': (product.commissionablePremium / maxValues.commissionablePremium) * 100
    }))
  }, [productTypeData])

  // Monthly product trend
  const monthlyProductTrend = useMemo(() => {
    const monthlyData = data.reduce((acc, record) => {
      const month = record["Reporting Month (mmm'yy)"] || 'Unknown'
      const productType = record["Product Type"] || 'Unknown'
      
      if (!acc[month]) {
        acc[month] = {
          month,
          products: {}
        }
      }
      
      if (!acc[month].products[productType]) {
        acc[month].products[productType] = 0
      }
      
      acc[month].products[productType] += toNumber(record["Gross premium"])
      return acc
    }, {} as Record<string, any>)

    const topProducts = productTypeData.slice(0, 5).map((p: any) => p.name)
    
    return Object.values(monthlyData)
      .map((monthData: any) => {
        const result: any = { month: monthData.month }
        topProducts.forEach(product => {
          result[product] = monthData.products[product] || 0
        })
        return result
      })
      .sort((a: any, b: any) => a.month.localeCompare(b.month))
  }, [data, productTypeData])

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF7C7C']

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
              {`${entry.name}: ${typeof entry.value === 'number' && entry.name.includes('Premium') ? formatCurrency(entry.value) : entry.value}`}
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
            Premium: {formatCurrency(data.value)}
          </p>
          <p className="text-sm text-gray-600">
            Policies: {data.payload.policyCount}
          </p>
          <p className="text-sm text-gray-600">
            Avg Premium: {formatCurrency(data.payload.avgPremium)}
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="grid gap-6">
      {/* Product Type Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Product Type Performance Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart data={productTypeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
              <YAxis yAxisId="left" tickFormatter={(value) => `₹${(value / 1000000).toFixed(1)}M`} />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar yAxisId="left" dataKey="totalPremium" fill="#8884d8" name="Total Premium" />
              <Bar yAxisId="left" dataKey="commissionablePremium" fill="#82ca9d" name="Commissionable Premium" />
              <Line yAxisId="right" type="monotone" dataKey="policyCount" stroke="#ff7300" strokeWidth={3} name="Policy Count" />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
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
                     label={(entry) => {
                    const { name, percent } = entry as { name?: string; percent?: number }
                    const pct = typeof percent === 'number' ? percent : 0
                    return `${name} ${(pct * 100).toFixed(0)}%`
                  }}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="totalPremium"
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

        {/* Business Type Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Business Type Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={businessTypeData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => {
                    const { name, percent } = entry as { name?: string; percent?: number }
                    const pct = typeof percent === 'number' ? percent : 0
                    return `${name} ${(pct * 100).toFixed(0)}%`
                  }}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {businessTypeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Product Performance Radar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Top 6 Products - Multi-dimensional Analysis</CardTitle>
          <p className="text-sm text-gray-600">Normalized performance metrics (0-100 scale)</p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <RadarChart data={productRadarData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="product" />
              <PolarRadiusAxis domain={[0, 100]} />
              <Radar
                name="Premium Volume"
                dataKey="Premium Volume"
                stroke="#8884d8"
                fill="#8884d8"
                fillOpacity={0.1}
              />
              <Radar
                name="Policy Count"
                dataKey="Policy Count"
                stroke="#82ca9d"
                fill="#82ca9d"
                fillOpacity={0.1}
              />
              <Radar
                name="Avg Premium"
                dataKey="Avg Premium"
                stroke="#ffc658"
                fill="#ffc658"
                fillOpacity={0.1}
              />
              <Radar
                name="Commission"
                dataKey="Commission"
                stroke="#ff7c7c"
                fill="#ff7c7c"
                fillOpacity={0.1}
              />
              <Legend />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Monthly Product Trends */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Monthly Product Performance Trends</CardTitle>
          <p className="text-sm text-gray-600">Top 5 products by premium volume</p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={monthlyProductTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={(value) => `₹${(value / 1000000).toFixed(1)}M`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              {productTypeData.slice(0, 5).map((product: any, index: number) => (
                <Area
                  key={product.name}
                  type="monotone"
                  dataKey={product.name}
                  stackId="1"
                  stroke={COLORS[index % COLORS.length]}
                  fill={COLORS[index % COLORS.length]}
                  fillOpacity={0.6}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}
