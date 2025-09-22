'use client'

import React from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ReportsFilterState } from '@/components/superadmin/reports/reports-dashboard'

interface ReportsFiltersProps {
  filters: ReportsFilterState
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onFilterChange: (key: keyof ReportsFilterState, value: any) => void
  filterOptions: {
    reportingMonths: string[]
    agentCodes: string[]
    childIds: string[]
    brokerNames: string[]
    insurerNames: string[]
    majorCategories: string[]
    productTypes: string[]
    planTypes: string[]
    states: string[]
  }
}

export function ReportsFilters({ filters, onFilterChange, filterOptions }: ReportsFiltersProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {/* Reporting Month */}
      <div className="space-y-2">
        <Label htmlFor="reporting-month">Reporting Month</Label>
        <Select
          value={filters.reportingMonth}
          onValueChange={(value) => onFilterChange('reportingMonth', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select month" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Months</SelectItem>
            {filterOptions.reportingMonths.map((month) => (
              <SelectItem key={month} value={month}>
                {month}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Agent Code */}
      <div className="space-y-2">
        <Label htmlFor="agent-code">Agent Code</Label>
        <Input
          id="agent-code"
          placeholder="Search agent code"
          value={filters.agentCode}
          onChange={(e) => onFilterChange('agentCode', e.target.value)}
        />
      </div>

      {/* Child ID */}
      <div className="space-y-2">
        <Label htmlFor="child-id">Child ID</Label>
        <Input
          id="child-id"
          placeholder="Search child ID"
          value={filters.childId}
          onChange={(e) => onFilterChange('childId', e.target.value)}
        />
      </div>

      {/* Broker Name */}
      <div className="space-y-2">
        <Label htmlFor="broker-name">Broker Name</Label>
        <Select
          value={filters.brokerName}
          onValueChange={(value) => onFilterChange('brokerName', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select broker" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Brokers</SelectItem>
            {filterOptions.brokerNames.map((broker) => (
              <SelectItem key={broker} value={broker}>
                {broker}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Insurer Name */}
      <div className="space-y-2">
        <Label htmlFor="insurer-name">Insurer Name</Label>
        <Select
          value={filters.insurerName}
          onValueChange={(value) => onFilterChange('insurerName', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select insurer" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Insurers</SelectItem>
            {filterOptions.insurerNames.map((insurer) => (
              <SelectItem key={insurer} value={insurer}>
                {insurer}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Major Category */}
      <div className="space-y-2">
        <Label htmlFor="major-category">Category</Label>
        <Select
          value={filters.majorCategory}
          onValueChange={(value) => onFilterChange('majorCategory', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Categories</SelectItem>
            {filterOptions.majorCategories.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Product Type */}
      <div className="space-y-2">
        <Label htmlFor="product-type">Product Type</Label>
        <Select
          value={filters.productType}
          onValueChange={(value) => onFilterChange('productType', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select product" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Products</SelectItem>
            {filterOptions.productTypes.map((product) => (
              <SelectItem key={product} value={product}>
                {product}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Plan Type */}
      <div className="space-y-2">
        <Label htmlFor="plan-type">Plan Type</Label>
        <Select
          value={filters.planType}
          onValueChange={(value) => onFilterChange('planType', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select plan" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Plans</SelectItem>
            {filterOptions.planTypes.map((plan) => (
              <SelectItem key={plan} value={plan}>
                {plan}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* State */}
      <div className="space-y-2">
        <Label htmlFor="state">State</Label>
        <Select
          value={filters.state}
          onValueChange={(value) => onFilterChange('state', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select state" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All States</SelectItem>
            {filterOptions.states.map((state) => (
              <SelectItem key={state} value={state}>
                {state}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Date Range - From */}
      <div className="space-y-2">
        <Label htmlFor="date-from">From Date</Label>
        <Input
          id="date-from"
          type="date"
          value={filters.dateRange.from ? filters.dateRange.from.toISOString().split('T')[0] : ''}
          onChange={(e) => onFilterChange('dateRange', { 
            ...filters.dateRange, 
            from: e.target.value ? new Date(e.target.value) : null 
          })}
        />
      </div>

      {/* Date Range - To */}
      <div className="space-y-2">
        <Label htmlFor="date-to">To Date</Label>
        <Input
          id="date-to"
          type="date"
          value={filters.dateRange.to ? filters.dateRange.to.toISOString().split('T')[0] : ''}
          onChange={(e) => onFilterChange('dateRange', { 
            ...filters.dateRange, 
            to: e.target.value ? new Date(e.target.value) : null 
          })}
        />
      </div>

      {/* Amount Range - Min */}
      <div className="space-y-2">
        <Label htmlFor="amount-min">Min Premium (₹)</Label>
        <Input
          id="amount-min"
          type="number"
          placeholder="0"
          value={filters.amountRange.min || ''}
          onChange={(e) => onFilterChange('amountRange', { 
            ...filters.amountRange, 
            min: e.target.value ? parseFloat(e.target.value) : null 
          })}
        />
      </div>

      {/* Amount Range - Max */}
      <div className="space-y-2">
        <Label htmlFor="amount-max">Max Premium (₹)</Label>
        <Input
          id="amount-max"
          type="number"
          placeholder="1000000"
          value={filters.amountRange.max || ''}
          onChange={(e) => onFilterChange('amountRange', { 
            ...filters.amountRange, 
            max: e.target.value ? parseFloat(e.target.value) : null 
          })}
        />
      </div>
    </div>
  )
}
