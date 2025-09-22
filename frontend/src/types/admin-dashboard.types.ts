
export type DashboardViewType = 'agent' | 'admin';

// Chart data interfaces for admin dashboard
export interface AgentPerformance {
  name: string;
  premium: number;
  policies: number;
  balance: number;
}

export interface DistributionItem {
  name: string;
  value: number;
  [key: string]: string | number; // Index signature for Recharts compatibility
}

export interface PolicyDistributionItem {
  name: string;
  policies: number;
}

export interface BalanceDistributionItem {
  name: string;
  balance: number;
}

export interface MonthlyTrend {
  month: string;
  premium: number;
  policies: number;
}

// Summary metrics for dashboard cards
export interface DashboardSummaryMetrics {
  totalAgents: number;
  totalPolicies: number;
  totalPremium: number;
  totalBalance: number;
  activeAgents: number;
  positiveBalance: number;
  negativeBalance: number;
}

// Chart data collection
export interface DashboardChartData {
  topAgents: AgentPerformance[];
  premiumDistribution: DistributionItem[];
  monthlyTrends: MonthlyTrend[];
  balanceDistribution: BalanceDistributionItem[];
  policyDistribution: PolicyDistributionItem[];
}

// Processed balance sheet data (can be array or object format)
export type ProcessedBalanceSheetData = Record<string, string>[];

// Dashboard props and state interfaces
export interface AdminOverviewProps {
  className?: string;
}

export interface DashboardFilters {
  viewType: DashboardViewType;
  dateRange?: {
    from: Date;
    to: Date;
  };
  agentCodes?: string[];
}

// Chart configuration types
export interface ChartColors {
  primary: string;
  secondary: string;
  accent: string;
  success: string;
  warning: string;
  danger: string;
}

export interface ChartTooltipFormatter {
  (value: number, name: string): [string, string];
}

// Data refresh state
export interface RefreshState {
  isRefreshing: boolean;
  lastRefreshed: Date | null;
  autoRefresh: boolean;
  interval: number; // in milliseconds
}

// Export interfaces for external usage
export type {
  BalanceSheetRecord,
  BrokerSheetRecord
} from './mis.types';