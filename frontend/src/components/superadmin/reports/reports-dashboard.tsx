/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import React, { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {  
  Filter,
  Download,
  RefreshCw
} from "lucide-react"
import { QuarterlySheetRecord } from '@/types/admin-mis.types'
import { ReportsFilters } from '@/components/superadmin/reports/reports-filters'
import { FinancialMetricsCards } from '@/components/superadmin/reports/financial-metrics-cards'
import { PremiumAnalysisCharts } from '@/components/superadmin/reports/premium-analysis-charts'
import { AgentPerformanceCharts } from '@/components/superadmin/reports/agent-performance-charts'
import { GeographicDistribution } from '@/components/superadmin/reports/geographic-distribution'
import { ProductTypeAnalysis } from '@/components/superadmin/reports/product-type-analysis'

interface ReportsDashboardProps {
  data: QuarterlySheetRecord[]
  loading?: boolean
  selectedSheet?: string
}

export interface ReportsFilterState {
  reportingMonth: string
  agentCode: string
  childId: string
  brokerName: string
  insurerName: string
  majorCategory: string
  productType: string
  planType: string
  state: string
  dateRange: {
    from: Date | null
    to: Date | null
  }
  amountRange: {
    min: number | null
    max: number | null
  }
}

const initialFilters: ReportsFilterState = {
  reportingMonth: '',
  agentCode: '',
  childId: '',
  brokerName: '',
  insurerName: '',
  majorCategory: '',
  productType: '',
  planType: '',
  state: '',
  dateRange: {
    from: null,
    to: null
  },
  amountRange: {
    min: null,
    max: null
  }
}

export function ReportsDashboard({ data, loading, selectedSheet }: ReportsDashboardProps) {
  const [filters, setFilters] = useState<ReportsFilterState>(initialFilters)
  const [showFilters, setShowFilters] = useState(false)

  // Helper function to safely convert string to number
  const toNumber = (value: string | null | undefined): number => {
    if (!value) return 0
    const num = parseFloat(value.toString().replace(/[^0-9.-]/g, ''))
    return isNaN(num) ? 0 : num
  }

  // Filter data based on current filters
  const filteredData = useMemo(() => {
    if (!data || data.length === 0) return []

    return data.filter((record) => {
      // Reporting Month filter
      if (filters.reportingMonth && record["Reporting Month (mmm'yy)"] !== filters.reportingMonth) {
        return false
      }

      // Agent Code filter
      if (filters.agentCode && !record["Agent Code"]?.toLowerCase().includes(filters.agentCode.toLowerCase())) {
        return false
      }

      // Child ID filter
      if (filters.childId && !record["Child ID/ User ID [Provided by Insure Zeal]"]?.toLowerCase().includes(filters.childId.toLowerCase())) {
        return false
      }

      // Broker Name filter
      if (filters.brokerName && !record["Broker Name"]?.toLowerCase().includes(filters.brokerName.toLowerCase())) {
        return false
      }

      // Insurer Name filter
      if (filters.insurerName && !record["Insurer name"]?.toLowerCase().includes(filters.insurerName.toLowerCase())) {
        return false
      }

      // Major Category filter
      if (filters.majorCategory && record["Major Categorisation( Motor/Life/ Health)"] !== filters.majorCategory) {
        return false
      }

      // Product Type filter
      if (filters.productType && record["Product Type"] !== filters.productType) {
        return false
      }

      // Plan Type filter
      if (filters.planType && record["Plan type (Comp/STP/SAOD)"] !== filters.planType) {
        return false
      }

      // State filter
      if (filters.state && record["State"] !== filters.state) {
        return false
      }

      // Date range filter (based on booking date)
      if (filters.dateRange.from || filters.dateRange.to) {
        const bookingDate = new Date(record["Booking Date(Click to select Date)"])
        if (filters.dateRange.from && bookingDate < filters.dateRange.from) return false
        if (filters.dateRange.to && bookingDate > filters.dateRange.to) return false
      }

      // Amount range filter (based on gross premium)
      if (filters.amountRange.min !== null || filters.amountRange.max !== null) {
        const grossPremium = toNumber(record["Gross premium"])
        if (filters.amountRange.min !== null && grossPremium < filters.amountRange.min) return false
        if (filters.amountRange.max !== null && grossPremium > filters.amountRange.max) return false
      }

      return true
    })
  }, [data, filters])

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    const totalRecords = filteredData.length
    const totalGrossPremium = filteredData.reduce((sum, record) => sum + toNumber(record["Gross premium"]), 0)
    const totalNetPremium = filteredData.reduce((sum, record) => sum + toNumber(record["Net premium"]), 0)
    const totalCommissionablePremium = filteredData.reduce((sum, record) => sum + toNumber(record["Commissionable Premium"]), 0)
    const totalReceivableFromBroker = filteredData.reduce((sum, record) => sum + toNumber(record["Receivable from Broker"]), 0)
    const totalRunningBalance = filteredData.reduce((sum, record) => sum + toNumber(record["Running Bal"]), 0)
    const uniqueAgents = new Set(filteredData.map(record => record["Agent Code"])).size
    const uniqueBrokers = new Set(filteredData.map(record => record["Broker Name"])).size

    return {
      totalRecords,
      totalGrossPremium,
      totalNetPremium,
      totalCommissionablePremium,
      totalReceivableFromBroker,
      totalRunningBalance,
      uniqueAgents,
      uniqueBrokers,
      averagePremium: totalRecords > 0 ? totalGrossPremium / totalRecords : 0
    }
  }, [filteredData])

  // Get unique values for filter dropdowns
  const filterOptions = useMemo(() => {
    const getUniqueValues = (key: keyof QuarterlySheetRecord): string[] => {
      return Array.from(new Set(data.map(record => record[key]).filter(Boolean))) as string[]
    }

    return {
      reportingMonths: getUniqueValues("Reporting Month (mmm'yy)"),
      agentCodes: getUniqueValues("Agent Code"),
      childIds: getUniqueValues("Child ID/ User ID [Provided by Insure Zeal]"),
      brokerNames: getUniqueValues("Broker Name"),
      insurerNames: getUniqueValues("Insurer name"),
      majorCategories: getUniqueValues("Major Categorisation( Motor/Life/ Health)"),
      productTypes: getUniqueValues("Product Type"),
      planTypes: getUniqueValues("Plan type (Comp/STP/SAOD)"),
      states: getUniqueValues("State")
    }
  }, [data])

  const handleFilterChange = (key: keyof ReportsFilterState, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const clearFilters = () => {
    setFilters(initialFilters)
  }

  const exportData = () => {
    // TODO: Implement export functionality
    console.log('Exporting filtered data:', filteredData)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-600">Loading reports...</span>
      </div>
    )
  }

  return (
    <div className="h-full min-h-0 overflow-auto space-y-6 p-6">
      {/* Header with Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h2>
          <p className="text-gray-600">
            {selectedSheet ? `Sheet: ${selectedSheet}` : 'Comprehensive MIS Reports'} 
            {filteredData.length !== data.length && (
              <span className="ml-2">
                ({filteredData.length} of {data.length} records)
              </span>
            )}
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2"
          >
            <Filter className="h-4 w-4" />
            Filters
            {Object.values(filters).some(v => 
              (typeof v === 'string' && v !== '') || 
              (typeof v === 'object' && v !== null && Object.values(v).some(val => val !== null))
            ) && (
              <Badge variant="secondary" className="ml-1">
                Active
              </Badge>
            )}
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={exportData}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg">Filters</CardTitle>
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ReportsFilters
              filters={filters}
              onFilterChange={handleFilterChange}
              filterOptions={filterOptions}
            />
          </CardContent>
        </Card>
      )}

      {/* Summary Metrics Cards */}
      <FinancialMetricsCards stats={summaryStats} />

      {/* Charts Section */}
      <div className="grid gap-6">
        {/* Premium Analysis */}
        <PremiumAnalysisCharts data={filteredData} />
        
        {/* Agent Performance */}
        <AgentPerformanceCharts data={filteredData} />
        
        {/* Geographic Distribution */}
        <GeographicDistribution data={filteredData} />
        
        {/* Product Type Analysis */}
        <ProductTypeAnalysis data={filteredData} />
      </div>
    </div>
  )
}
