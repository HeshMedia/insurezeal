
"use client";

import React, { useMemo, useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { ChevronRight, ChevronDown, RefreshCw, BarChart3 } from "lucide-react";
import { useBalanceSheetStats } from "@/hooks/useGoogleSheetsMIS";



interface BalanceSheetProps {
  className?: string;
}

function toNum(v?: string) {
  const n = parseFloat(v ?? "");
  return Number.isFinite(n) ? n : 0;
}

function toInt(v?: string) {
  const n = parseInt(v ?? "", 10);
  return Number.isFinite(n) ? n : 0;
}

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
const fmt = new Intl.NumberFormat("en-IN");

export function BalanceSheet({ className }: BalanceSheetProps) {
  const { data, loading, error, refresh, fetchBalanceSheetStats } = useBalanceSheetStats();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showAgentColumns] = useState(false);

  const rows = useMemo(() => data?.data ?? [], [data]);

  // Fetch data on component mount
  useEffect(() => {
    fetchBalanceSheetStats();
  }, [fetchBalanceSheetStats]);

  const summary = useMemo(() => {
    const d = rows;
    const totalAgents = d.length;
    const totalRunningBalance = d.reduce((s, r) => s + toNum(r["Running Balance (True&False)"]), 0);
    const totalNetPremium = d.reduce((s, r) => s + toNum(r["Net Premium (True&False)"]), 0);
    const totalPolicies = d.reduce((s, r) => s + toInt(r["Policy Count (True&False)"]), 0);
    const totalCommissionablePremium = d.reduce((s, r) => s + toNum(r["Commissionable Premium (True&False)"]), 0);
    return { totalAgents, totalRunningBalance, totalNetPremium, totalPolicies, totalCommissionablePremium };
  }, [rows]);

  const toggleAll = useCallback(() => {
    if (!rows.length) return;
    const allExpanded = Object.keys(expanded).length === rows.length && Object.values(expanded).every(Boolean);
    if (allExpanded) {
      setExpanded({});
    } else {
      const next: Record<string, boolean> = {};
      for (const r of rows) next[r["Agent Code"]] = true;
      setExpanded(next);
    }
  }, [rows, expanded]);

  if (error) {
    return (
      <div className={cn("h-full flex flex-col bg-white rounded-lg shadow-sm border border-gray-200", className)}>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center p-6">
            <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
              <BarChart3 className="h-8 w-8 text-red-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to Load Balance Sheet</h3>
            <p className="text-gray-500 mb-4">{error}</p>
            <Button onClick={refresh} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex h-full flex-col rounded-lg border bg-background", className)}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <div className="min-w-0 flex items-center gap-3">
          <div className="p-2 bg-green-100 rounded-lg shrink-0">
            <BarChart3 className="h-5 w-5 text-green-600" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold">Balance Sheet</h2>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={toggleAll}>
            <ChevronDown className="mr-1 h-4 w-4" />
            {Object.keys(expanded).length === rows.length ? "Collapse All" : "Expand All"}
          </Button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 border-b px-4 py-3">
          <div className="rounded-md bg-blue-50 px-3 py-2">
            <div className="text-[11px] text-blue-600 font-medium">AGENTS</div>
            <div className="text-base font-semibold text-blue-900">{fmt.format(summary.totalAgents)}</div>
          </div>
          <div className="rounded-md bg-green-50 px-3 py-2">
            <div className="text-[11px] text-green-700 font-medium">RUNNING BALANCE</div>
            <div className={cn(
              "text-base font-semibold",
              summary.totalRunningBalance >= 0 ? "text-green-900" : "text-red-900"
            )}>
              {inr.format(summary.totalRunningBalance)}
            </div>
          </div>
          <div className="rounded-md bg-purple-50 px-3 py-2">
            <div className="text-[11px] text-purple-700 font-medium">NET PREMIUM</div>
            <div className="text-base font-semibold text-purple-900">{inr.format(summary.totalNetPremium)}</div>
          </div>
          <div className="rounded-md bg-orange-50 px-3 py-2">
            <div className="text-[11px] text-orange-700 font-medium">POLICIES</div>
            <div className="text-base font-semibold text-orange-900">{fmt.format(summary.totalPolicies)}</div>
          </div>
        </div>
      )}

      {/* Scrollable Table */}
      <div className="relative flex-1">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Loading balance sheet data...</p>
            </div>
          </div>
        ) : rows.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <BarChart3 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No data available</p>
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 overflow-auto">
            <div className="min-w-[920px]">
              <Table className="w-full">
                <TableHeader className="sticky top-0 z-10 bg-background border-b">
                  <TableRow>
                    <TableHead className="sticky left-0 z-[12] bg-background w-[160px] min-w-[160px] border-r font-semibold">
                      Agent Code
                    </TableHead>
                    <TableHead className="text-right font-semibold">Running Balance (Total)</TableHead>
                    <TableHead className="text-right font-semibold">Net Premium (Total)</TableHead>
                    <TableHead className="text-right font-semibold">Policies (Total)</TableHead>
                    <TableHead className="text-right font-semibold">Commissionable (Total)</TableHead>
                    {showAgentColumns && (
                      <>
                        <TableHead className="text-right font-semibold bg-orange-50/50">Running Balance (Agent)</TableHead>
                        <TableHead className="text-right font-semibold bg-orange-50/50">Net Premium (Agent)</TableHead>
                        <TableHead className="text-right font-semibold bg-orange-50/50">Policies (Agent)</TableHead>
                        <TableHead className="text-right font-semibold bg-orange-50/50">Commissionable (Agent)</TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const code = r["Agent Code"];
                    const isOpen = !!expanded[code];

                    // Admin view (True&False) values
                    const totalRB = toNum(r["Running Balance (True&False)"]);
                    const totalNP = toNum(r["Net Premium (True&False)"]);
                    const totalCP = toNum(r["Commissionable Premium (True&False)"]);
                    const totalPC = toInt(r["Policy Count (True&False)"]);

                    // Agent view (True only) values
                    const agentRB = toNum(r["Running Balance (True)"]);
                    const agentNP = toNum(r["Net Premium (True)"]);
                    const agentCP = toNum(r["Commissionable Premium (True)"]);
                    const agentPC = toInt(r["Policy Count (True)"]);

                    // Note: Variance calculations removed as they were unused
                    // They could be added back if needed: totalValue - agentValue

                    return (
                      <React.Fragment key={code}>
                        <TableRow className="hover:bg-muted/40 border-b">
                          <TableCell className="sticky left-0 bg-background z-[11] w-[160px] min-w-[160px] border-r">
                            <button
                              type="button"
                              aria-expanded={isOpen}
                              aria-controls={`panel-${code}`}
                              onClick={() => setExpanded((s) => ({ ...s, [code]: !s[code] }))}
                              className="flex items-center gap-2 w-full text-left hover:bg-muted/20 rounded px-2 py-1 transition-colors"
                            >
                              {isOpen ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                              <span className="font-medium truncate">{code}</span>
                            </button>
                          </TableCell>
                          
                          {/* Admin Columns */}
                          <TableCell className={cn(
                            "whitespace-nowrap text-right font-medium",
                            totalRB >= 0 ? "text-green-700" : "text-red-700"
                          )}>
                            {inr.format(totalRB)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-right">
                            {inr.format(totalNP)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-right">
                            {fmt.format(totalPC)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-right">
                            {inr.format(totalCP)}
                          </TableCell>

                          {/* Agent Columns (conditional) */}
                          {showAgentColumns && (
                            <>
                              <TableCell className={cn(
                                "whitespace-nowrap text-right font-medium bg-orange-50/30",
                                agentRB >= 0 ? "text-green-700" : "text-red-700"
                              )}>
                                {inr.format(agentRB)}
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-right bg-orange-50/30">
                                {inr.format(agentNP)}
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-right bg-orange-50/30">
                                {fmt.format(agentPC)}
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-right bg-orange-50/30">
                                {inr.format(agentCP)}
                              </TableCell>
                            </>
                          )}
                        </TableRow>

                        {isOpen && (
                          <TableRow id={`panel-${code}`} className="bg-muted/30 border-b">
                            <TableCell className="sticky left-0 bg-muted/30 z-[11] border-r">
                              <span className="text-xs text-muted-foreground px-2"></span>
                            </TableCell>
                            <TableCell colSpan={showAgentColumns ? 8 : 4} className="p-0">
                              <div className="p-4 space-y-4">
                                {/* Combined horizontal layout - always show both views when expanded */}
                                <div className="flex flex-col lg:flex-row gap-4">
                                  {/* Total (Admin) Panel */}
                                  

                                  {/* Agent View Panel - always show when expanded */}
                                  <div className="flex-1 rounded-md border bg-orange-50/50 p-3">
                                    <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                                      <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                                     On Agent Dashboard
                                      
                                    </h4>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                      <div className="space-y-1">
                                        <span className="text-muted-foreground text-xs block">Running Balance</span>
                                        <span className={cn(
                                          "font-medium text-sm block",
                                          agentRB >= 0 ? "text-green-700" : "text-red-700"
                                        )}>
                                          {inr.format(agentRB)}
                                        </span>
                                      </div>
                                      <div className="space-y-1">
                                        <span className="text-muted-foreground text-xs block">Net Premium</span>
                                        <span className="font-medium text-sm block">{inr.format(agentNP)}</span>
                                      </div>
                                      <div className="space-y-1">
                                        <span className="text-muted-foreground text-xs block">Commissionable</span>
                                        <span className="font-medium text-sm block">{inr.format(agentCP)}</span>
                                      </div>
                                      <div className="space-y-1">
                                        <span className="text-muted-foreground text-xs block">Policies</span>
                                        <span className="font-medium text-sm block">{fmt.format(agentPC)}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                               
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}