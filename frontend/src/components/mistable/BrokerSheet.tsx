"use client";

import React, { useMemo, useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Building2, RefreshCw, Search, FilterX } from "lucide-react";
import { BrokerSheetRecord } from "@/types/mis.types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface BrokerSheetProps {
  data: BrokerSheetRecord[];
  className?: string;
  loading?: boolean;
  sharedSearchQuery?: string;
}

function toNum(v?: string) {
  const n = parseFloat(v ?? "");
  return Number.isFinite(n) ? n : 0;
}

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });

export function BrokerSheet({ data, className, loading, sharedSearchQuery }: BrokerSheetProps) {
  const rows = useMemo(() => data ?? [], [data]);

  // Search (by Broker Name) - use shared search when provided, otherwise internal search
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

  const filteredRows = useMemo(() => {
    if (!debounced) return rows;
    const q = debounced.toLowerCase();
    return rows.filter((r) => (r["Broker Name"] ?? "").toLowerCase().includes(q));
  }, [rows, debounced]);

  const summary = useMemo(() => {
    const d = filteredRows;
    const totalBrokers = d.length;
    const totalReceivable = d.reduce((s, r) => s + toNum(r["Total Receivable from Broker"]), 0);
    const totalBrokerPO = d.reduce((s, r) => s + toNum(r["As per Broker PO AMT"]), 0);
    const totalPaymentPending = d.reduce((s, r) => s + toNum(r["IS - Payment Pending (Broker PO AMT)"]), 0);
    const totalInvoicePending = d.reduce((s, r) => s + toNum(r["IS - Invoice Pending (Total Receivable from Broker)"]), 0);
    return { totalBrokers, totalReceivable, totalBrokerPO, totalPaymentPending, totalInvoicePending };
  }, [filteredRows]);

  if (loading) {
    return (
      <div className={cn("flex h-full flex-col rounded-xl border bg-background shadow-sm", className)}>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Loading broker data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className={cn("flex h-full flex-col border bg-background shadow-sm", className)}>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Building2 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No broker data available</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex h-full flex-col  border bg-background shadow-sm", className)}>
      {/* Header with search */}
      <div className="flex items-center justify-between gap-3 border-b px-6 py-3 bg-muted/20 rounded-t-xl">
        <div className="min-w-0 flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg shrink-0">
            <Building2 className="h-5 w-5 text-blue-700" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold leading-none">Broker Financial Summary</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Financial overview of {summary.totalBrokers} broker{summary.totalBrokers !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {sharedSearchQuery === undefined && (
            <>
              <div className="relative">
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search broker name…"
                  className="h-9 w-[240px] pr-8"
                />
                <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
                  <Search className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
              {debounced && (
                <Button variant="ghost" onClick={() => setQuery("")} className="h-9 px-2">
                  <FilterX className="h-4 w-4" />
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 px-6 py-3 border-b bg-background">
        <div className="rounded-md bg-blue-50 px-3 py-2">
          <div className="text-[11px] text-blue-700 font-medium">BROKERS</div>
          <div className="text-base font-semibold text-blue-900">{summary.totalBrokers}</div>
        </div>
        <div className="rounded-md bg-green-50 px-3 py-2">
          <div className="text-[11px] text-green-700 font-medium">TOTAL RECEIVABLE</div>
          <div className="text-base font-semibold text-green-900">{inr.format(summary.totalReceivable)}</div>
        </div>
        <div className="rounded-md bg-purple-50 px-3 py-2">
          <div className="text-[11px] text-purple-700 font-medium">BROKER PO AMOUNT</div>
          <div className="text-base font-semibold text-purple-900">{inr.format(summary.totalBrokerPO)}</div>
        </div>
        <div className="rounded-md bg-orange-50 px-3 py-2">
          <div className="text-[11px] text-orange-700 font-medium">PAYMENT PENDING</div>
          <div
            className={cn(
              "text-base font-semibold",
              summary.totalPaymentPending > 0 ? "text-orange-900" : "text-green-900"
            )}
          >
            {inr.format(summary.totalPaymentPending)}
          </div>
        </div>
        <div className="rounded-md bg-red-50 px-3 py-2">
          <div className="text-[11px] text-red-700 font-medium">INVOICE PENDING</div>
          <div
            className={cn(
              "text-base font-semibold",
              summary.totalInvoicePending > 0 ? "text-red-900" : "text-green-900"
            )}
          >
            {inr.format(summary.totalInvoicePending)}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="relative flex-1">
        <div className="absolute inset-0 overflow-auto">
          <div className="min-w-[960px]">
            <Table className="w-full">
              <TableHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
                <TableRow>
                  <TableHead className="sticky left-0 z-[12] bg-background w-[260px] min-w-[260px] border-r font-semibold">
                    Broker Name
                  </TableHead>
                  <TableHead className="text-right font-semibold">Total Receivable</TableHead>
                  <TableHead className="text-right font-semibold">Broker PO Amount</TableHead>
                  <TableHead className="text-right font-semibold">Payment Pending</TableHead>
                  <TableHead className="text-right font-semibold">Invoice Pending</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((row, index) => {
                  const brokerName = row["Broker Name"];
                  const uniqueKey = `${index}-${brokerName}`;
                  const totalReceivable = toNum(row["Total Receivable from Broker"]);
                  const brokerPO = toNum(row["As per Broker PO AMT"]);
                  const paymentPending = toNum(row["IS - Payment Pending (Broker PO AMT)"]);
                  const invoicePending = toNum(row["IS - Invoice Pending (Total Receivable from Broker)"]);

                  const hasPaymentPending = paymentPending > 0;
                  const hasInvoicePending = invoicePending > 0;
                  const rowStatus = hasPaymentPending ? "payment-pending" : hasInvoicePending ? "invoice-pending" : "clear";

                  return (
                    <TableRow
                      key={uniqueKey}
                      className={cn("hover:bg-muted/40 border-b even:bg-muted/10")}
                    >
                      <TableCell className="sticky left-0 z-[11] bg-background font-medium border-r">
                        <div className="flex items-center gap-2">
                          <div
                            className={cn(
                              "w-2 h-2 rounded-full shrink-0",
                              rowStatus === "payment-pending" && "bg-orange-400",
                              rowStatus === "invoice-pending" && "bg-red-400",
                              rowStatus === "clear" && "bg-green-400"
                            )}
                          />
                          <span className="truncate">{brokerName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right ">{inr.format(totalReceivable)}</TableCell>
                      <TableCell className="text-right ">{inr.format(brokerPO)}</TableCell>
                      <TableCell className="text-right ">
                        <span className={cn(paymentPending > 0 ? "text-orange-600 font-semibold" : "text-muted-foreground")}>
                          {inr.format(paymentPending)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right ">
                        <span className={cn(invoicePending > 0 ? "text-red-600 font-semibold" : "text-muted-foreground")}>
                          {inr.format(invoicePending)}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}
