"use client";

import React, { useState, useMemo, useCallback } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  getSortedRowModel,
  SortingState,
} from "@tanstack/react-table";
import { useReconciliationReports } from "@/hooks/universalQuery";
import { ReconciliationReportsParams, ReconciliationReportItem } from "@/types/universalrecords.types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  RefreshCw,
  Loader2,
  Database,
  Search,
  X,
  FileText,
  BarChart3,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  Filter,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

interface ReconciliationReportsTableProps {
  className?: string;
}

interface TableCellProps {
  row: {
    original: ReconciliationReportItem;
  };
}

export function ReconciliationReportsTable({
  className,
}: ReconciliationReportsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "created_at", desc: true },
  ]);
  const [insurerFilter, setInsurerFilter] = useState<string>("");
  const [limit, setLimit] = useState<number>(50);
  const [offset, setOffset] = useState<number>(0);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [showFilterPopover, setShowFilterPopover] = useState<boolean>(false);
  
  // Temporary filter states for the popover
  const [tempInsurerFilter, setTempInsurerFilter] = useState<string>("");
  const [tempLimit, setTempLimit] = useState<number>(50);
  const [tempOffset, setTempOffset] = useState<number>(0);

  // Build query parameters
  const queryParams: ReconciliationReportsParams = useMemo(
    () => ({
      ...(insurerFilter && { insurer_name: insurerFilter }),
      limit,
      offset,
    }),
    [insurerFilter, limit, offset]
  );

  const {
    data,
    error,
    isLoading,
    refetch,
    isFetching,
  } = useReconciliationReports(queryParams);

  const records = data?.reports || [];
  const totalCount = data?.total_count || 0;

  // Helper function to get top field variations
  const getTopVariations = (record: ReconciliationReportItem) => {
    const variationFields = [
      { key: 'agent_code_variations', label: 'Agent Code' },
      { key: 'policy_number_variations', label: 'Policy Number' },
      { key: 'gross_premium_variations', label: 'Gross Premium' },
      { key: 'customer_name_variations', label: 'Customer Name' },
      { key: 'broker_name_variations', label: 'Broker Name' },
      { key: 'product_variations', label: 'Product' },
      { key: 'state_variations', label: 'State' },
      { key: 'payment_by_variations', label: 'Payment By' },
    ];

    return variationFields
      .map(field => ({
        ...field,
        value: (record as unknown as Record<string, number>)[field.key] || 0
      }))
      .filter(field => field.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  };

  // Helper function to get all variations grouped by category
  const getAllVariations = (record: ReconciliationReportItem) => {
    const categories = {
      'Basic Info': [
        { key: 'reporting_month_variations', label: 'Reporting Month' },
        { key: 'child_id_variations', label: 'Child ID' },
        { key: 'insurer_broker_code_variations', label: 'Insurer Broker Code' },
        { key: 'agent_code_variations', label: 'Agent Code' },
      ],
      'Policy Details': [
        { key: 'policy_number_variations', label: 'Policy Number' },
        { key: 'formatted_policy_number_variations', label: 'Formatted Policy Number' },
        { key: 'policy_start_date_variations', label: 'Policy Start Date' },
        { key: 'policy_end_date_variations', label: 'Policy End Date' },
        { key: 'booking_date_variations', label: 'Booking Date' },
      ],
      'Company Info': [
        { key: 'broker_name_variations', label: 'Broker Name' },
        { key: 'insurer_name_variations', label: 'Insurer Name' },
      ],
      'Product Info': [
        { key: 'major_categorisation_variations', label: 'Major Categorisation' },
        { key: 'product_variations', label: 'Product' },
        { key: 'product_type_variations', label: 'Product Type' },
        { key: 'plan_type_variations', label: 'Plan Type' },
      ],
      'Premium Details': [
        { key: 'gross_premium_variations', label: 'Gross Premium' },
        { key: 'gst_amount_variations', label: 'GST Amount' },
        { key: 'net_premium_variations', label: 'Net Premium' },
        { key: 'od_premium_variations', label: 'OD Premium' },
        { key: 'tp_premium_variations', label: 'TP Premium' },
        { key: 'commissionable_premium_variations', label: 'Commissionable Premium' },
      ],
      'Vehicle Info': [
        { key: 'registration_no_variations', label: 'Registration No' },
        { key: 'make_model_variations', label: 'Make Model' },
        { key: 'model_variations', label: 'Model' },
        { key: 'vehicle_variant_variations', label: 'Vehicle Variant' },
        { key: 'gvw_variations', label: 'GVW' },
        { key: 'fuel_type_variations', label: 'Fuel Type' },
        { key: 'cc_variations', label: 'CC' },
        { key: 'seating_capacity_variations', label: 'Seating Capacity' },
        { key: 'veh_wheels_variations', label: 'Vehicle Wheels' },
      ],
      'Location Info': [
        { key: 'rto_variations', label: 'RTO' },
        { key: 'state_variations', label: 'State' },
        { key: 'cluster_variations', label: 'Cluster' },
      ],
      'Customer Info': [
        { key: 'customer_name_variations', label: 'Customer Name' },
        { key: 'customer_number_variations', label: 'Customer Number' },
      ],
      'Financial Info': [
        { key: 'incoming_grid_percentage_variations', label: 'Incoming Grid %' },
        { key: 'receivable_from_broker_variations', label: 'Receivable from Broker' },
        { key: 'extra_grid_variations', label: 'Extra Grid' },
        { key: 'extra_amount_receivable_variations', label: 'Extra Amount Receivable' },
        { key: 'total_receivable_from_broker_variations', label: 'Total Receivable from Broker' },
        { key: 'total_receivable_gst_variations', label: 'Total Receivable GST' },
        { key: 'iz_total_po_percentage_variations', label: 'IZ Total PO %' },
        { key: 'as_per_broker_po_percentage_variations', label: 'As Per Broker PO %' },
        { key: 'as_per_broker_po_amt_variations', label: 'As Per Broker PO Amount' },
        { key: 'po_percentage_diff_broker_variations', label: 'PO % Diff Broker' },
        { key: 'po_amt_diff_broker_variations', label: 'PO Amount Diff Broker' },
      ],
      'Payment Info': [
        { key: 'claimed_by_variations', label: 'Claimed By' },
        { key: 'payment_by_variations', label: 'Payment By' },
        { key: 'payment_mode_variations', label: 'Payment Mode' },
        { key: 'cut_pay_amount_received_variations', label: 'Cut Pay Amount Received' },
        { key: 'payment_by_office_variations', label: 'Payment by Office' },
      ],
      'Agent Payout': [
        { key: 'already_given_to_agent_variations', label: 'Already Given to Agent' },
        { key: 'actual_agent_po_percentage_variations', label: 'Actual Agent PO %' },
        { key: 'agent_po_amt_variations', label: 'Agent PO Amount' },
        { key: 'agent_extra_percentage_variations', label: 'Agent Extra %' },
        { key: 'agent_extra_amount_variations', label: 'Agent Extra Amount' },
        { key: 'agent_total_po_amount_variations', label: 'Agent Total PO Amount' },
        { key: 'po_paid_to_agent_variations', label: 'PO Paid to Agent' },
        { key: 'running_bal_variations', label: 'Running Balance' },
        { key: 'actual_agent_po_percentage_2_variations', label: 'Actual Agent PO % (2)' },
        { key: 'as_per_agent_payout_percentage_variations', label: 'As Per Agent Payout %' },
        { key: 'as_per_agent_payout_amount_variations', label: 'As Per Agent Payout Amount' },
        { key: 'po_percentage_diff_agent_variations', label: 'PO % Diff Agent' },
        { key: 'po_amt_diff_agent_variations', label: 'PO Amount Diff Agent' },
      ],
      'Other': [
        { key: 'age_year_variations', label: 'Age Year' },
        { key: 'ncb_variations', label: 'NCB' },
        { key: 'discount_percentage_variations', label: 'Discount %' },
        { key: 'business_type_variations', label: 'Business Type' },
        { key: 'invoice_status_variations', label: 'Invoice Status' },
        { key: 'invoice_number_variations', label: 'Invoice Number' },
        { key: 'remarks_variations', label: 'Remarks' },
        { key: 'match_variations', label: 'Match' },
      ],
    };

    const result: Record<string, Array<{key: string, label: string, value: number}>> = {};
    
    Object.entries(categories).forEach(([category, fields]) => {
      const categoryVariations = fields
        .map(field => ({
          ...field,
          value: (record as unknown as Record<string, number>)[field.key] || 0
        }))
        .filter(field => field.value > 0);
      
      if (categoryVariations.length > 0) {
        result[category] = categoryVariations;
      }
    });

    return result;
  };

  const toggleRowExpansion = useCallback((recordId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(recordId)) {
      newExpanded.delete(recordId);
    } else {
      newExpanded.add(recordId);
    }
    setExpandedRows(newExpanded);
  }, [expandedRows]);

  // Define columns
  const columns = useMemo(
    () => [
      {
        id: "expand",
        header: "",
        cell: ({ row }: TableCellProps) => {
          const isExpanded = expandedRows.has(row.original.id);
          const topVariations = getTopVariations(row.original);
          const hasVariations = topVariations.length > 0;
          
          return (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleRowExpansion(row.original.id)}
              disabled={!hasVariations}
              className="h-8 w-8 p-0"
            >
              {hasVariations ? (
                isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )
              ) : null}
            </Button>
          );
        },
      },
      {
        id: "insurer_name",
        header: "Insurer",
        accessorKey: "insurer_name",
        cell: ({ row }: TableCellProps) => (
          <div className="flex flex-col">
            <span className="font-medium text-slate-900">
              {row.original.insurer_name}
            </span>
            {row.original.insurer_code && (
              <span className="text-xs text-slate-500">
                {row.original.insurer_code}
              </span>
            )}
          </div>
        ),
      },
      {
        id: "created_at",
        header: "Upload Date",
        accessorKey: "created_at",
        cell: ({ row }: TableCellProps) => (
          <div className="flex flex-col">
            <span className="font-medium text-slate-900">
              {format(new Date(row.original.created_at), "MMM dd, yyyy")}
            </span>
            <span className="text-xs text-slate-500">
              {format(new Date(row.original.created_at), "HH:mm")}
            </span>
          </div>
        ),
      },
      {
        id: "records_summary",
        header: "Records Summary",
        cell: ({ row }: TableCellProps) => (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-600">Total:</span>
              <Badge variant="outline" className="text-xs font-semibold">
                {row.original.total_records_processed.toLocaleString()}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-600">New:</span>
              <Badge
                variant="secondary"
                className="bg-green-100 text-green-800 text-xs font-semibold"
              >
                +{row.original.new_records_added.toLocaleString()}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-600">Updated:</span>
              <Badge
                variant="secondary"
                className="bg-blue-100 text-blue-800 text-xs font-semibold"
              >
                {row.original.total_records_updated.toLocaleString()}
              </Badge>
            </div>
          </div>
        ),
      },
      {
        id: "data_variance_percentage",
        header: "Data Variance",
        accessorKey: "data_variance_percentage",
        cell: ({ row }: TableCellProps) => {
          const variance = row.original.data_variance_percentage;
          const color =
            variance > 20
              ? "text-red-600 bg-red-100"
              : variance > 10
              ? "text-amber-600 bg-amber-100"
              : "text-green-600 bg-green-100";
          
          const icon = variance === 0 ? CheckCircle : AlertTriangle;
          const IconComponent = icon;
          
          return (
            <div className="flex items-center gap-2">
              <IconComponent className={cn("h-4 w-4", 
                variance === 0 ? "text-green-600" : 
                variance > 20 ? "text-red-600" : 
                variance > 10 ? "text-amber-600" : "text-green-600"
              )} />
              <Badge variant="secondary" className={cn("font-semibold", color)}>
                {variance.toFixed(1)}%
              </Badge>
            </div>
          );
        },
      },
      {
        id: "top_variations",
        header: "Top Field Variations",
        cell: ({ row }: TableCellProps) => {
          const topVariations = getTopVariations(row.original);
          
          if (topVariations.length === 0) {
            return (
              <div className="flex items-center gap-2 text-slate-500">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-xs">No variations</span>
              </div>
            );
          }
          
          return (
            <div className="space-y-1">
              {topVariations.slice(0, 3).map((variation) => (
                <div key={variation.key} className="flex items-center gap-2 text-xs">
                  <span className="text-slate-600 truncate max-w-20">
                    {variation.label}:
                  </span>
                  <Badge 
                    variant="outline" 
                    className={cn("text-xs", 
                      variation.value > 10 ? "border-red-300 text-red-700" :
                      variation.value > 5 ? "border-amber-300 text-amber-700" :
                      "border-blue-300 text-blue-700"
                    )}
                  >
                    {variation.value}
                  </Badge>
                </div>
              ))}
              {topVariations.length > 3 && (
                <div className="text-xs text-slate-500">
                  +{topVariations.length - 3} more...
                </div>
              )}
            </div>
          );
        },
      },
    ],
    [expandedRows, toggleRowExpansion]
  );

  const table = useReactTable({
    data: records,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
    },
    onSortingChange: setSorting,
  });

  const handleRefresh = () => {
    refetch();
  };

  const applyFilters = () => {
    setInsurerFilter(tempInsurerFilter);
    setLimit(tempLimit);
    setOffset(tempOffset);
    setShowFilterPopover(false);
  };

  const clearFilters = () => {
    setInsurerFilter("");
    setLimit(50);
    setOffset(0);
    setTempInsurerFilter("");
    setTempLimit(50);
    setTempOffset(0);
    setShowFilterPopover(false);
  };

  const resetTempFilters = () => {
    setTempInsurerFilter(insurerFilter);
    setTempLimit(limit);
    setTempOffset(offset);
  };

  // Initialize temp filters when popover opens
  const handleFilterPopoverOpen = (open: boolean) => {
    setShowFilterPopover(open);
    if (open) {
      resetTempFilters();
    }
  };

  const hasActiveFilters = insurerFilter || limit !== 50 || offset !== 0;

  const handlePrevPage = () => {
    setOffset(Math.max(0, offset - limit));
  };

  const handleNextPage = () => {
    setOffset(offset + limit);
  };

  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(totalCount / limit);
  const hasNextPage = offset + limit < totalCount;
  const hasPrevPage = offset > 0;

  if (isLoading) {
    return (
      <Card className={cn("shadow-lg border-0 bg-white/80 backdrop-blur-sm", className)}>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg animate-pulse" />
            <Skeleton className="h-8 w-64" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={cn("shadow-lg border-0 bg-white/80 backdrop-blur-sm", className)}>
        <CardContent className="flex items-center justify-center min-h-[400px]">
          <div className="text-center p-8 bg-white rounded-xl shadow-lg border border-red-100">
            <div className="text-red-600 text-xl font-bold mb-2">
              ⚠️ Error Loading Data
            </div>
            <div className="text-red-500 text-sm mb-4">{error.message}</div>
            <Button
              onClick={handleRefresh}
              variant="outline"
              className="border-red-300 hover:bg-red-50"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header Section */}
      <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl shadow-lg">
                <Database className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                  Reconciliation Reports
                </CardTitle>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-sm text-gray-600 font-medium">
                    {totalCount} total reports
                  </span>
                  {isFetching && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-blue-400 to-blue-500 rounded-full shadow-md">
                      <Loader2 className="w-3 h-3 text-white animate-spin" />
                      <span className="text-white text-xs font-semibold">
                        Refreshing...
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <Button
              onClick={handleRefresh}
              variant="outline"
              size="default"
              className="bg-white/50 border-gray-300 hover:bg-blue-50 hover:border-blue-300 shadow-md"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Filters Section */}
      <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            {/* Current Filters Display */}
            <div className="flex-1">
              {hasActiveFilters ? (
                <div className="space-y-2">
                  <div className="text-sm font-medium text-gray-700">Active Filters:</div>
                  <div className="flex flex-wrap gap-2">
                    {insurerFilter && (
                      <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                        Insurer: {insurerFilter}
                      </Badge>
                    )}
                    {limit !== 50 && (
                      <Badge variant="secondary" className="bg-green-100 text-green-800">
                        Limit: {limit}
                      </Badge>
                    )}
                    {offset !== 0 && (
                      <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                        Offset: {offset}
                      </Badge>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-500">
                  No filters applied. Use the filter button to set parameters.
                </div>
              )}
            </div>

            {/* Filter Controls */}
            <div className="flex items-center gap-3">
              <Popover open={showFilterPopover} onOpenChange={handleFilterPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="default"
                    className={cn(
                      "bg-white/50 border-gray-300 hover:bg-blue-50 hover:border-blue-300 shadow-md",
                      hasActiveFilters && "border-blue-400 bg-blue-50"
                    )}
                  >
                    <Filter className="mr-2 h-4 w-4" />
                    Filters
                    {hasActiveFilters && (
                      <Badge variant="secondary" className="ml-2 bg-blue-100 text-blue-800 text-xs">
                        {[insurerFilter, limit !== 50, offset !== 0].filter(Boolean).length}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-6" align="end">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b">
                      <Settings className="h-4 w-4 text-gray-600" />
                      <h3 className="font-semibold text-gray-900">Filter Options</h3>
                    </div>

                    {/* Insurer Name Filter */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">
                        Insurer Name (Optional)
                      </label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                        <Input
                          placeholder="Filter by specific insurer..."
                          value={tempInsurerFilter}
                          onChange={(e) => setTempInsurerFilter(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                      <p className="text-xs text-gray-500">
                        Leave empty to show all insurers
                      </p>
                    </div>

                    {/* Limit Filter */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">
                        Maximum Records to Return
                      </label>
                      <Select
                        value={tempLimit.toString()}
                        onValueChange={(value) => setTempLimit(parseInt(value))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="25">25 records</SelectItem>
                          <SelectItem value="50">50 records (default)</SelectItem>
                          <SelectItem value="100">100 records</SelectItem>
                          <SelectItem value="200">200 records</SelectItem>
                          <SelectItem value="500">500 records</SelectItem>
                          <SelectItem value="1000">1000 records (max)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-gray-500">
                        Default: 50, Maximum: 1000
                      </p>
                    </div>

                    {/* Offset Filter */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">
                        Records to Skip (Offset)
                      </label>
                      <Input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={tempOffset}
                        onChange={(e) => setTempOffset(parseInt(e.target.value) || 0)}
                      />
                      <p className="text-xs text-gray-500">
                        Number of records to skip for pagination (default: 0)
                      </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-4 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setTempInsurerFilter("");
                          setTempLimit(50);
                          setTempOffset(0);
                        }}
                        className="flex-1"
                      >
                        Reset
                      </Button>
                      <Button
                        size="sm"
                        onClick={applyFilters}
                        className="flex-1 bg-blue-600 hover:bg-blue-700"
                      >
                        Apply Filters
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {hasActiveFilters && (
                <Button
                  variant="outline"
                  size="default"
                  onClick={clearFilters}
                  className="bg-white/50 border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400"
                >
                  <X className="mr-2 h-4 w-4" />
                  Clear All
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table Section */}
      <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
        <CardContent className="p-0">
          <div className="overflow-auto rounded-lg">
            <Table className="w-full bg-white border-collapse">
              <TableHeader className="sticky top-0 z-10 bg-gray-50">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow
                    key={headerGroup.id}
                    className="border-b-2 border-gray-300"
                  >
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider whitespace-nowrap border-r border-gray-300 last:border-r-0"
                      >
                        {header.isPlaceholder ? null : (
                          <div
                            className={cn(
                              "flex items-center gap-2",
                              header.column.getCanSort() &&
                                "cursor-pointer hover:text-blue-600"
                            )}
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                            {header.column.getCanSort() && (
                              <div className="flex flex-col">
                                <div
                                  className={cn(
                                    "w-0 h-0 border-l-2 border-r-2 border-b-2 border-transparent",
                                    header.column.getIsSorted() === "asc" &&
                                      "border-b-blue-600"
                                  )}
                                />
                                <div
                                  className={cn(
                                    "w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent",
                                    header.column.getIsSorted() === "desc" &&
                                      "border-t-blue-600"
                                  )}
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>

              <TableBody className="bg-white">
                {table.getRowModel().rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="text-center py-12"
                    >
                      <div className="flex flex-col items-center gap-3">
                        <FileText className="h-12 w-12 text-gray-400" />
                        <div className="text-gray-500 font-medium">
                          No reconciliation reports found
                        </div>
                        {hasActiveFilters && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={clearFilters}
                          >
                            Clear filters
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  table.getRowModel().rows.map((row, index) => (
                    <React.Fragment key={row.id}>
                      <TableRow
                        className={cn(
                          "transition-colors duration-200 border-b border-gray-200 hover:bg-blue-50",
                          index % 2 === 0 ? "bg-white" : "bg-gray-50/50",
                          expandedRows.has(row.original.id) && "bg-blue-50/30"
                        )}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell
                            key={cell.id}
                            className="px-6 py-4 text-sm text-slate-800 border-r border-gray-200 last:border-r-0"
                          >
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                      
                      {/* Expanded Detail Row */}
                      {expandedRows.has(row.original.id) && (
                        <TableRow className="bg-slate-50 border-b border-gray-200">
                          <TableCell
                            colSpan={columns.length}
                            className="px-6 py-6"
                          >
                            <div className="space-y-6">
                              <div className="flex items-center gap-2 text-lg font-semibold text-slate-800">
                                <BarChart3 className="h-5 w-5" />
                                Detailed Field Variations
                              </div>
                              
                              {(() => {
                                const allVariations = getAllVariations(row.original);
                                
                                if (Object.keys(allVariations).length === 0) {
                                  return (
                                    <div className="flex items-center gap-3 text-slate-600 bg-green-50 p-4 rounded-lg">
                                      <CheckCircle className="h-6 w-6 text-green-600" />
                                      <div>
                                        <div className="font-medium">Perfect Match!</div>
                                        <div className="text-sm">No field variations detected in this reconciliation.</div>
                                      </div>
                                    </div>
                                  );
                                }
                                
                                return (
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {Object.entries(allVariations).map(([category, fields]) => (
                                      <div key={category} className="bg-white rounded-lg border border-gray-200 p-4">
                                        <div className="font-medium text-slate-800 mb-3 flex items-center gap-2">
                                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                          {category}
                                        </div>
                                        <div className="space-y-2">
                                          {fields.map((field) => (
                                            <div key={field.key} className="flex items-center justify-between">
                                              <span className="text-sm text-slate-600 truncate">
                                                {field.label}
                                              </span>
                                              <Badge 
                                                variant="outline" 
                                                className={cn("text-xs font-semibold ml-2", 
                                                  field.value > 10 ? "border-red-300 text-red-700 bg-red-50" :
                                                  field.value > 5 ? "border-amber-300 text-amber-700 bg-amber-50" :
                                                  "border-blue-300 text-blue-700 bg-blue-50"
                                                )}
                                              >
                                                {field.value}
                                              </Badge>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                );
                              })()}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination Section */}
      {totalCount > 0 && (
        <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing {offset + 1} to {Math.min(offset + limit, totalCount)} of{" "}
                {totalCount} reports
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrevPage}
                  disabled={!hasPrevPage}
                  className="bg-white border-gray-300"
                >
                  Previous
                </Button>
                
                <div className="flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-md">
                  <span className="text-sm font-medium text-gray-700">
                    Page {currentPage} of {totalPages}
                  </span>
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextPage}
                  disabled={!hasNextPage}
                  className="bg-white border-gray-300"
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
