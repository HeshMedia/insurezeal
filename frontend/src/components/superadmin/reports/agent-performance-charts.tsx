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
  ScatterChart,
  Scatter,
  LineChart,
  Line,
  ComposedChart,
} from 'recharts'

interface AgentPerformanceChartsProps {
  data: QuarterlySheetRecord[]
}

export function AgentPerformanceCharts({ data }: AgentPerformanceChartsProps) {
  const toNumber = (value: string | null | undefined): number => {
    if (!value) return 0
    const num = parseFloat(value.toString().replace(/[^0-9.-]/g, ''))
    return isNaN(num) ? 0 : num
  }

  // Top performing agents by premium
  const topAgentsByPremium = useMemo(() => {
    const agentData = data.reduce((acc, record) => {
      const agentCode = record["Agent Code"] || 'Unknown'
      if (!acc[agentCode]) {
        acc[agentCode] = {
          agentCode,
          totalGrossPremium: 0,
          totalCommissionablePremium: 0,
          totalReceivableFromBroker: 0,
          totalRunningBalance: 0,
          policyCount: 0,
          avgPremium: 0
        }
      }
      acc[agentCode].totalGrossPremium += toNumber(record["Gross premium"])
      acc[agentCode].totalCommissionablePremium += toNumber(record["Commissionable Premium"])
      acc[agentCode].totalReceivableFromBroker += toNumber(record["Receivable from Broker"])
      acc[agentCode].totalRunningBalance += toNumber(record["Running Bal"])
      acc[agentCode].policyCount += 1
      return acc
    }, {} as Record<string, any>)

    // Calculate average premium and sort by total premium
    return Object.values(agentData)
      .map((agent: any) => ({
        ...agent,
        avgPremium: agent.policyCount > 0 ? agent.totalGrossPremium / agent.policyCount : 0
      }))
      .sort((a: any, b: any) => b.totalGrossPremium - a.totalGrossPremium)
      .slice(0, 15) // Top 15 agents
  }, [data])

  // Agent efficiency analysis (Premium vs Policy Count)
  const agentEfficiencyData = useMemo(() => {
    const agentData = data.reduce((acc, record) => {
      const agentCode = record["Agent Code"] || 'Unknown'
      if (!acc[agentCode]) {
        acc[agentCode] = {
          agentCode,
          totalPremium: 0,
          policyCount: 0,
          runningBalance: 0
        }
      }
      acc[agentCode].totalPremium += toNumber(record["Gross premium"])
      acc[agentCode].policyCount += 1
      acc[agentCode].runningBalance += toNumber(record["Running Bal"])
      return acc
    }, {} as Record<string, any>)

    return Object.values(agentData)
      .filter((agent: any) => agent.policyCount > 0 && agent.totalPremium > 0)
      .map((agent: any) => ({
        ...agent,
        avgPremium: agent.totalPremium / agent.policyCount,
        efficiency: agent.totalPremium / agent.policyCount // Premium per policy
      }))
      .slice(0, 50) // Top 50 for scatter plot
  }, [data])

  // Agent running balance analysis
  const agentBalanceData = useMemo(() => {
    const agentData = data.reduce((acc, record) => {
      const agentCode = record["Agent Code"] || 'Unknown'
      if (!acc[agentCode]) {
        acc[agentCode] = {
          agentCode,
          totalRunningBalance: 0,
          totalReceivable: 0,
          totalPaid: 0,
          policyCount: 0
        }
      }
      acc[agentCode].totalRunningBalance += toNumber(record["Running Bal"])
      acc[agentCode].totalReceivable += toNumber(record["Receivable from Broker"])
      acc[agentCode].totalPaid += toNumber(record["Already Given to agent"])
      acc[agentCode].policyCount += 1
      return acc
    }, {} as Record<string, any>)

    return Object.values(agentData)
      .sort((a: any, b: any) => Math.abs(b.totalRunningBalance) - Math.abs(a.totalRunningBalance))
      .slice(0, 10) // Top 10 by absolute balance
  }, [data])

  // Monthly agent performance trend
  const monthlyAgentTrend = useMemo(() => {
    const monthlyData = data.reduce((acc, record) => {
      const month = record["Reporting Month (mmm'yy)"] || 'Unknown'
      const agentCode = record["Agent Code"] || 'Unknown'
      
      if (!acc[month]) {
        acc[month] = {
          month,
          uniqueAgents: new Set(),
          totalPremium: 0,
          avgPremiumPerAgent: 0
        }
      }
      
      acc[month].uniqueAgents.add(agentCode)
      acc[month].totalPremium += toNumber(record["Gross premium"])
      return acc
    }, {} as Record<string, any>)

    return Object.values(monthlyData)
      .map((monthData: any) => ({
        month: monthData.month,
        agentCount: monthData.uniqueAgents.size,
        totalPremium: monthData.totalPremium,
        avgPremiumPerAgent: monthData.uniqueAgents.size > 0 ? monthData.totalPremium / monthData.uniqueAgents.size : 0
      }))
      .sort((a: any, b: any) => a.month.localeCompare(b.month))
  }, [data])

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

  const ScatterTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium">Agent: {data.agentCode}</p>
          <p>Policies: {data.policyCount}</p>
          <p>Total Premium: {formatCurrency(data.totalPremium)}</p>
          <p>Avg Premium: {formatCurrency(data.avgPremium)}</p>
          <p>Running Balance: {formatCurrency(data.runningBalance)}</p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="grid gap-6">
      {/* Top Agents by Premium */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Top 15 Agents by Premium Volume</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={topAgentsByPremium} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={(value) => `₹${(value / 1000000).toFixed(1)}M`} />
              <YAxis dataKey="agentCode" type="category" width={80} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar dataKey="totalGrossPremium" fill="#8884d8" name="Gross Premium" />
              <Bar dataKey="totalCommissionablePremium" fill="#82ca9d" name="Commissionable Premium" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Agent Efficiency Scatter Plot */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Agent Efficiency Analysis</CardTitle>
            <p className="text-sm text-gray-600">Premium Volume vs Policy Count</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <ScatterChart data={agentEfficiencyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="policyCount" 
                  name="Policy Count"
                  label={{ value: 'Policy Count', position: 'insideBottom', offset: -5 }}
                />
                <YAxis 
                  dataKey="totalPremium" 
                  name="Total Premium"
                  tickFormatter={(value) => `₹${(value / 1000000).toFixed(1)}M`}
                  label={{ value: 'Total Premium', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip content={<ScatterTooltip />} />
                <Scatter dataKey="totalPremium" fill="#8884d8" />
              </ScatterChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Agent Running Balance */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Top 10 Agents by Running Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={agentBalanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="agentCode" />
                <YAxis tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}K`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar 
                  dataKey="totalRunningBalance" 
                  fill={(entry) => entry >= 0 ? "#82ca9d" : "#ff7c7c"} 
                  name="Running Balance"
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Agent Performance Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Monthly Agent Performance Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart data={monthlyAgentTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis yAxisId="left" tickFormatter={(value) => `₹${(value / 1000000).toFixed(1)}M`} />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar dataKey="totalPremium" fill="#8884d8" name="Total Premium" yAxisId="left" />
              <Line 
                type="monotone" 
                dataKey="agentCount" 
                stroke="#ff7300" 
                name="Active Agents" 
                yAxisId="right"
                strokeWidth={3}
              />
              <Line 
                type="monotone" 
                dataKey="avgPremiumPerAgent" 
                stroke="#82ca9d" 
                name="Avg Premium per Agent" 
                yAxisId="left"
                strokeWidth={2}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}
