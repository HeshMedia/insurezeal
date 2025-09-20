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
  Treemap,
} from 'recharts'

interface GeographicDistributionProps {
  data: QuarterlySheetRecord[]
}

export function GeographicDistribution({ data }: GeographicDistributionProps) {
  const toNumber = (value: string | null | undefined): number => {
    if (!value) return 0
    const num = parseFloat(value.toString().replace(/[^0-9.-]/g, ''))
    return isNaN(num) ? 0 : num
  }

  // State-wise distribution
  const stateDistribution = useMemo(() => {
    const stateData = data.reduce((acc, record) => {
      const state = record["State"] || 'Unknown'
      if (!acc[state]) {
        acc[state] = {
          name: state,
          totalPremium: 0,
          policyCount: 0,
          commissionablePremium: 0,
          avgPremium: 0
        }
      }
      acc[state].totalPremium += toNumber(record["Gross premium"])
      acc[state].commissionablePremium += toNumber(record["Commissionable Premium"])
      acc[state].policyCount += 1
      return acc
    }, {} as Record<string, any>)

    return Object.values(stateData)
      .map((state: any) => ({
        ...state,
        avgPremium: state.policyCount > 0 ? state.totalPremium / state.policyCount : 0
      }))
      .sort((a: any, b: any) => b.totalPremium - a.totalPremium)
      .slice(0, 15) // Top 15 states
  }, [data])

  // Cluster-wise distribution
  const clusterDistribution = useMemo(() => {
    const clusterData = data.reduce((acc, record) => {
      const cluster = record["Cluster"] || 'Unknown'
      if (!acc[cluster]) {
        acc[cluster] = {
          name: cluster,
          totalPremium: 0,
          policyCount: 0,
          value: 0
        }
      }
      acc[cluster].totalPremium += toNumber(record["Gross premium"])
      acc[cluster].policyCount += 1
      acc[cluster].value = acc[cluster].totalPremium
      return acc
    }, {} as Record<string, any>)

    return Object.values(clusterData)
      .sort((a: any, b: any) => b.totalPremium - a.totalPremium)
  }, [data])

  // RTO-wise distribution
  const rtoDistribution = useMemo(() => {
    const rtoData = data.reduce((acc, record) => {
      const rto = record["RTO"] || 'Unknown'
      if (!acc[rto]) {
        acc[rto] = {
          rto,
          totalPremium: 0,
          policyCount: 0,
          commissionablePremium: 0
        }
      }
      acc[rto].totalPremium += toNumber(record["Gross premium"])
      acc[rto].commissionablePremium += toNumber(record["Commissionable Premium"])
      acc[rto].policyCount += 1
      return acc
    }, {} as Record<string, any>)

    return Object.values(rtoData)
      .sort((a: any, b: any) => b.totalPremium - a.totalPremium)
      .slice(0, 20) // Top 20 RTOs
  }, [data])

  // State vs Cluster heatmap data
  const stateClusterData = useMemo(() => {
    const heatmapData = data.reduce((acc, record) => {
      const state = record["State"] || 'Unknown'
      const cluster = record["Cluster"] || 'Unknown'
      const key = `${state}-${cluster}`
      
      if (!acc[key]) {
        acc[key] = {
          state,
          cluster,
          name: `${state} - ${cluster}`,
          totalPremium: 0,
          policyCount: 0,
          size: 0
        }
      }
      acc[key].totalPremium += toNumber(record["Gross premium"])
      acc[key].policyCount += 1
      acc[key].size = acc[key].totalPremium
      return acc
    }, {} as Record<string, any>)

    return Object.values(heatmapData)
      .filter((item: any) => item.totalPremium > 0)
      .sort((a: any, b: any) => b.totalPremium - a.totalPremium)
      .slice(0, 30) // Top 30 state-cluster combinations
  }, [data])

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
            Premium: {formatCurrency(data.value)}
          </p>
          <p className="text-sm text-gray-600">
            Policies: {data.payload.policyCount}
          </p>
        </div>
      )
    }
    return null
  }

  const TreemapTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium">{data.name}</p>
          <p>Premium: {formatCurrency(data.totalPremium)}</p>
          <p>Policies: {data.policyCount}</p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="grid gap-6">
      {/* State-wise Premium Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Top 15 States by Premium Volume</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={stateDistribution}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
              <YAxis tickFormatter={(value) => `₹${(value / 1000000).toFixed(1)}M`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar dataKey="totalPremium" fill="#8884d8" name="Total Premium" />
              <Bar dataKey="commissionablePremium" fill="#82ca9d" name="Commissionable Premium" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Cluster Distribution Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Premium Distribution by Cluster</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={clusterDistribution.slice(0, 8)}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {clusterDistribution.slice(0, 8).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top RTOs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Top 10 RTOs by Premium</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={rtoDistribution.slice(0, 10)} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(value) => `₹${(value / 1000000).toFixed(1)}M`} />
                <YAxis dataKey="rto" type="category" width={60} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="totalPremium" fill="#8884d8" name="Total Premium" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* State-Cluster Treemap */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Geographic Distribution Heatmap</CardTitle>
          <p className="text-sm text-gray-600">State-Cluster combinations by premium volume</p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <Treemap
              data={stateClusterData}
              dataKey="size"
              aspectRatio={4 / 3}
              stroke="#fff"
              fill="#8884d8"
            >
              <Tooltip content={<TreemapTooltip />} />
            </Treemap>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}
