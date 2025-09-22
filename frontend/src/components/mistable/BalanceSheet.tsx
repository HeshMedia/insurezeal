"use client";

import React, { useMemo, useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  ChevronRight,
  ChevronDown,
  RefreshCw,
  BarChart3,
  Minimize2,
  FilterX,
  Search
} from "lucide-react";
import { useBalanceSheetStats } from "@/hooks/useGoogleSheetsMIS";
// import { BalanceSheetRecord } from "@/types" // if available

interface BalanceSheetProps {
  className?: string;
  sharedSearchQuery?: string;
}

function toNum(v?: string) { const n = parseFloat(v ?? ""); return Number.isFinite(n) ? n : 0; }
function toInt(v?: string) { const n = parseInt(v ?? "", 10); return Number.isFinite(n) ? n : 0; }

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
const fmt = new Intl.NumberFormat("en-IN");

// Compact icon-only button with tooltip
function IconAction({
  label,
  children,
  onClick,
  disabled,
  variant = "ghost",
  className,
  tooltipSide = "bottom",
}: {
  label: string;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "ghost" | "secondary" | "default" | "outline";
  className?: string;
  tooltipSide?: "top" | "bottom" | "left" | "right";
}) {
  if (disabled) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} className="inline-flex">
            <Button
              type="button"
              variant={variant}
              disabled
              title={label}
              className={cn("h-9 w-9 p-0 inline-flex items-center justify-center", className)}
            >
              {children}
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent side={tooltipSide} sideOffset={6}>
          {label}
        </TooltipContent>
      </Tooltip>
    );
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant={variant}
          onClick={onClick}
          title={label}
          className={cn("h-9 w-9 p-0 inline-flex items-center justify-center", className)}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side={tooltipSide} sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export function BalanceSheet({ className, sharedSearchQuery }: BalanceSheetProps) {
  const { data, loading, error, refresh } = useBalanceSheetStats();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showAgentColumns] = useState(false);

  // Search - use shared search when provided, otherwise internal search
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  
  useEffect(() => {
    if (sharedSearchQuery !== undefined) {
      // When using shared search, debounce the shared query
      const t = setTimeout(() => setDebounced(sharedSearchQuery.trim()), 200);
      return () => clearTimeout(t);
    } else {
      // When using internal search, debounce our own query
      const t = setTimeout(() => setDebounced(query.trim()), 200);
      return () => clearTimeout(t);
    }
  }, [query, sharedSearchQuery]);

  // If you have a BalanceSheetRecord type, prefer casting once:
  // type BalanceSheetRecord = { /* your declared shape with "Agent Code", etc. */ }
  const rawRows = useMemo(() => (data?.data ?? []) /* as BalanceSheetRecord[] */, [data]);

  // Client-side filter by Agent Code (no name)
  const rows = useMemo(() => {
    if (!debounced) return rawRows;
    const q = debounced.toLowerCase();
    return rawRows.filter((r /*: BalanceSheetRecord*/) => {
      const code = (r["Agent Code"] ?? "").toLowerCase();
      return code.includes(q);
    });
  }, [rawRows, debounced]);

  const summary = useMemo(() => {
    const d = rows;
    const totalAgents = d.length;
    const totalRunningBalance = d.reduce((s, r) => s + toNum(r["Running Balance (True&False)"]), 0);
    const totalNetPremium = d.reduce((s, r) => s + toNum(r["Net Premium (True&False)"]), 0);
    const totalPolicies = d.reduce((s, r) => s + toInt(r["Policy Count (True&False)"]), 0);
    const totalCommissionablePremium = d.reduce((s, r) => s + toNum(r["Commissionable Premium (True&False)"]), 0);
    return { totalAgents, totalRunningBalance, totalNetPremium, totalPolicies, totalCommissionablePremium };
  }, [rows]);

  const allExpanded =
    rows.length > 0 &&
    Object.keys(expanded).length === rows.length &&
    Object.values(expanded).every(Boolean);

  const toggleAll = useCallback(() => {
    if (!rows.length) return;
    if (allExpanded) {
      setExpanded({});
    } else {
      const next: Record<string, boolean> = {};
      for (const r of rows) next[r["Agent Code"]] = true;
      setExpanded(next);
    }
  }, [rows, allExpanded]);

  if (error) {
    return (
      <div className={cn("h-full flex flex-col rounded-xl border bg-background shadow-sm", className)}>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
              <BarChart3 className="h-8 w-8 text-red-600" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">Failed to Load Balance Sheet</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
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
    <TooltipProvider delayDuration={150}>
      <div className={cn("flex h-full flex-col  border bg-background shadow-sm", className)}>
        {/* Card Header */}
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3 bg-muted/20 ">
          <div className="min-w-0 flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg shrink-0">
              <BarChart3 className="h-5 w-5 text-green-700" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold leading-none">Financial Summary</h2>
            
            </div>
          </div>

          {/* Actions: search + compact icons */}
          <div className="flex items-center gap-2">
            {sharedSearchQuery === undefined && (
              <div className="relative">
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search agent code…"
                  className="h-9 w-[220px] pr-8"
                />
                <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
                  <Search className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            )}

            <IconAction label="Refresh" onClick={refresh} variant="outline">
              <RefreshCw className="h-4 w-4" />
            </IconAction>

               <div className="flex items-center gap-1.5">
            {debounced && (
              <IconAction label="Clear search" onClick={() => setQuery("")} variant="ghost">
                <FilterX className="h-4 w-4" />
              </IconAction>
            )}
            <IconAction
              label={allExpanded ? "Collapse all" : "Expand all"}
              onClick={toggleAll}
              variant="outline"
            >
              {allExpanded ? <Minimize2 className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </IconAction>
          </div>
          </div>
        </div>

      

        {/* KPI summary cards */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-4 py-3 border-b bg-background">
            <div className="rounded-md bg-blue-50 px-3 py-2">
              <div className="text-[11px] text-blue-700 font-medium">AGENTS</div>
              <div className="text-base font-semibold text-blue-900">{fmt.format(summary.totalAgents)}</div>
            </div>
            <div className="rounded-md bg-green-50 px-3 py-2">
              <div className="text-[11px] text-green-700 font-medium">RUNNING BALANCE</div>
              <div className={cn("text-base font-semibold", summary.totalRunningBalance >= 0 ? "text-green-900" : "text-red-900")}>
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

        {/* Table container with sticky header */}
        <div className="relative flex-1">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <div className="text-center">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Loading balance sheet data…</p>
              </div>
            </div>
          ) : rows.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <div className="text-center">
                <BarChart3 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  {debounced ? "No matches. Try another search." : "No data available"}
                </p>
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 overflow-auto">
              <div className="min-w-[920px]">
                <Table className="w-full">
                  <TableHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
                    <TableRow>
                      <TableHead className="sticky left-0 z-[12] bg-background w-[220px] min-w-[220px] border-r font-semibold">
                        Agent
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
                    {rows.map((r, index) => {
                      const code = r["Agent Code"];
                      const isOpen = !!expanded[code];

                      const totalRB = toNum(r["Running Balance (True&False)"]);
                      const totalNP = toNum(r["Net Premium (True&False)"]);
                      const totalCP = toNum(r["Commissionable Premium (True&False)"]);
                      const totalPC = toInt(r["Policy Count (True&False)"]);

                      const agentRB = toNum(r["Running Balance (True)"]);
                      const agentNP = toNum(r["Net Premium (True)"]);
                      const agentCP = toNum(r["Commissionable Premium (True)"]);
                      const agentPC = toInt(r["Policy Count (True)"]);

                      return (
                        <React.Fragment key={`${code}-${index}`}>
                          <TableRow className="hover:bg-muted/40 border-b even:bg-muted/10">
                            <TableCell className="sticky left-0 bg-background z-[11] w-[220px] min-w-[220px] border-r">
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
                                <span className="font-medium truncate">
                                  {code}
                                </span>
                              </button>
                            </TableCell>

                            <TableCell className={cn("whitespace-nowrap text-right font-medium", totalRB >= 0 ? "text-green-700" : "text-red-700")}>
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

                            {showAgentColumns && (
                              <>
                                <TableCell className={cn("whitespace-nowrap text-right font-medium bg-orange-50/30", agentRB >= 0 ? "text-green-700" : "text-red-700")}>
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
                                  <div className="flex flex-col lg:flex-row gap-4">
                                    <div className="flex-1 rounded-md border bg-orange-50/50 p-3">
                                      
                                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                        <div className="space-y-1">
                                          <span className="text-muted-foreground text-xs block">Running Balance</span>
                                          <span className={cn("font-medium text-sm block", agentRB >= 0 ? "text-green-700" : "text-red-700")}>
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
    </TooltipProvider>
  );
}
