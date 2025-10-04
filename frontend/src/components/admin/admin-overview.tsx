"use client";

import { useBalanceSheetStats, useBrokerSheetStats } from "@/hooks/useGoogleSheetsMIS";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  Users,
  Building2,
  
} from "lucide-react";
import React from "react";


export default function AdminOverview() {
  const balanceSheetStats = useBalanceSheetStats();
  const brokerSheetStats = useBrokerSheetStats();

  const handleRefresh = () => {
    balanceSheetStats.refresh();
    brokerSheetStats.refresh();
  };

  if (balanceSheetStats.loading || brokerSheetStats.loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <LoadingSpinner size="lg" />
          <p className="text-muted-foreground">Loading admin statistics...</p>
        </div>
      </div>
    );
  }

  if (balanceSheetStats.error || brokerSheetStats.error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <p className="text-destructive">Error loading statistics</p>
          <p className="text-muted-foreground text-sm">
            {balanceSheetStats.error || brokerSheetStats.error}
          </p>
          <Button onClick={handleRefresh} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // Summary stats (agents)
  const calculateSummaryStats = () => {
    if (!balanceSheetStats.data?.data) return null;
    const data = balanceSheetStats.data.data;

    const totalRunningBalance = data.reduce(
      (sum, agent) => sum + parseFloat(agent["Running Balance (True&False)"] || "0"),
      0
    );
    const totalNetPremium = data.reduce(
      (sum, agent) => sum + parseFloat(agent["Net Premium (True&False)"] || "0"),
      0
    );
    const totalCommissionablePremium = data.reduce(
      (sum, agent) => sum + parseFloat(agent["Commissionable Premium (True&False)"] || "0"),
      0
    );
    const totalPolicyCount = data.reduce(
      (sum, agent) => sum + parseInt(agent["Policy Count (True&False)"] || "0"),
      0
    );
    const activeAgents = data.filter(
      (agent) => parseInt(agent["Policy Count (True&False)"] || "0") > 0
    ).length;

    return {
      totalRunningBalance,
      totalNetPremium,
      totalCommissionablePremium,
      totalPolicyCount,
      activeAgents,
      totalAgents: data.length,
    };
  };

  // Summary stats (brokers)
  const calculateBrokerStats = () => {
    if (!brokerSheetStats.data?.data) return null;
    const data = brokerSheetStats.data.data;

    const totalReceivable = data.reduce(
      (sum, broker) => sum + parseFloat(broker["Total Receivable from Broker"] || "0"),
      0
    );
    const totalPOAmount = data.reduce(
      (sum, broker) => sum + parseFloat(broker["As per Broker PO AMT"] || "0"),
      0
    );
    const activeBrokers = data.filter(
      (broker) => parseFloat(broker["Total Receivable from Broker"] || "0") > 0
    ).length;
    const totalPaymentPending = data.reduce(
      (sum, broker) => sum + parseFloat(broker["IS - Payment Pending (Broker PO AMT)"] || "0"),
      0
    );

    return {
      totalReceivable,
      totalPOAmount,
      activeBrokers,
      totalBrokers: data.length,
      totalPaymentPending,
    };
  };

  const summaryStats = calculateSummaryStats();
  const brokerStats = calculateBrokerStats();

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);

  const formatNumber = (num: number) => new Intl.NumberFormat("en-IN").format(num);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Admin Dashboard</h1>
        </div>
        <Button onClick={handleRefresh} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Agent Summary */}
      {summaryStats && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-semibold">Agent Summary</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            <Card className="border-gray-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-[12px] font-medium text-muted-foreground">TOTAL AGENTS</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl numeric-strong">{formatNumber(summaryStats.totalAgents)}</div>
                <CardDescription>Tracked in system</CardDescription>
              </CardContent>
            </Card>

  
            <Card className="border-gray-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-[12px] font-medium text-muted-foreground">RUNNING BALANCE</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl numeric-strong text-green-700">
                  {formatCurrency(summaryStats.totalRunningBalance)}
                </div>
                <CardDescription>Across all agents</CardDescription>
              </CardContent>
            </Card>

            <Card className="border-gray-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-[12px] font-medium text-muted-foreground">NET PREMIUM</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl numeric-strong">{formatCurrency(summaryStats.totalNetPremium)}</div>
                <CardDescription>All policies combined</CardDescription>
              </CardContent>
            </Card>

            <Card className="border-gray-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-[12px] font-medium text-muted-foreground">TOTAL POLICIES</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl numeric-strong">{formatNumber(summaryStats.totalPolicyCount)}</div>
                <CardDescription>Active policies</CardDescription>
              </CardContent>
            </Card>
          </div>
        </section>
      )}

      {/* Broker Summary */}
      {brokerStats && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="w-4 h-4 text-purple-600" />
            <h2 className="text-sm font-semibold">Broker Summary</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            <Card className="border-gray-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-[12px] font-medium text-muted-foreground">TOTAL BROKERS</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl numeric-strong">{formatNumber(brokerStats.totalBrokers)}</div>
                <CardDescription>Tracked in system</CardDescription>
              </CardContent>
            </Card>

            <Card className="border-gray-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-[12px] font-medium text-muted-foreground">ACTIVE BROKERS</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl numeric-strong">{formatNumber(brokerStats.activeBrokers)}</div>
                <CardDescription>With receivables</CardDescription>
              </CardContent>
            </Card>

            <Card className="border-gray-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-[12px] font-medium text-muted-foreground">TOTAL RECEIVABLE</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl numeric-strong">{formatCurrency(brokerStats.totalReceivable)}</div>
                <CardDescription>From all brokers</CardDescription>
              </CardContent>
            </Card>

            <Card className="border-gray-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-[12px] font-medium text-muted-foreground">PAYMENT PENDING</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl numeric-strong text-orange-700">{formatCurrency(brokerStats.totalPaymentPending)}</div>
                <CardDescription>Unsettled against PO</CardDescription>
              </CardContent>
            </Card>
          </div>
        </section>
      )}

      {/* Data freshness */}
      <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-4">
        <div className="flex items-center gap-4">
          <span>Last updated: {balanceSheetStats.lastUpdated?.toLocaleString() || "Never"}</span>
          <span className="flex items-center">
            <span
              className={`w-2 h-2 rounded-full mr-2 ${
                balanceSheetStats.isDataFresh ? "bg-green-500" : "bg-yellow-500"
              }`}
            />
            {balanceSheetStats.isDataFresh ? "Data is fresh" : "Data may be stale"}
          </span>
        </div>
        <span className="truncate">
          Source: {balanceSheetStats.data?.sheet_name} • {brokerSheetStats.data?.sheet_name}
        </span>
      </div>
    </div>
  );
}
