import { Card, CardContent } from '@/components/ui/card'
import { FileText, Clock, Award, TrendingUp, DollarSign, Info } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

// Helper: Format large amounts nicely (Lakhs, Crores)
function formatAmount(value: number): string {
  if (value >= 1_00_00_000) {
    return (value / 1_00_00_000).toFixed(2) + ' Cr'
  }
  if (value >= 1_00_000) {
    return (value / 1_00_000).toFixed(2) + ' L'
  }
  if (value >= 1_000) {
    return (value / 1_000).toFixed(2) + ' K'
  }
  return value.toLocaleString()
}

function formatCurrencyWithSign(value: number): string {
  const absValue = Math.abs(value);
  const formatted = formatAmount(absValue);
  return value < 0 ? `-₹${formatted}` : `₹${formatted}`;
}

// Dynamic font size based on value size
function useAdjustedFontSize(value: number | undefined | null) {
  if (!value) return 'text-2xl'
  if (value >= 1_00_00_000) return 'text-lg'
  if (value >= 1_00_000) return 'text-xl'
  return 'text-2xl'
}

export function AgentStatsCards({
  stats,
  totalBalance,
}: {
  stats: {
    activeChildIds: number
    pendingRequests: number
    number_of_policies: number
    running_balance: number
    total_net_premium: number
  }
  totalBalance?: number
}) {
  const runningBalanceFontSize = useAdjustedFontSize(stats.running_balance)
  const totalPremiumFontSize = useAdjustedFontSize(stats.total_net_premium)

  return (
    <div className="flex gap-4 w-full">
      {/* Each card flex grows equally to fill container */}
      <Card className="group border border-gray-200 hover:border-green-300 hover:shadow-lg transition-all duration-300 ease-in-out bg-white flex-1 flex flex-col">
        <CardContent className="p-4 sm:p-5 flex flex-col justify-center flex-grow">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                Approved Child IDs
              </p>
              <p className="text-2xl sm:text-3xl font-bold text-green-600 truncate">
                {stats.activeChildIds}
              </p>
            </div>
            <div className="ml-3 p-2.5 rounded-lg bg-green-50 group-hover:bg-green-100 transition-colors duration-200 shrink-0">
              <Award className="h-5 w-5 text-green-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="group border border-gray-200 hover:border-amber-300 hover:shadow-lg transition-all duration-300 ease-in-out bg-white flex-1 flex flex-col">
        <CardContent className="p-4 sm:p-5 flex flex-col justify-center flex-grow">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                Pending Approval
              </p>
              <p className="text-2xl sm:text-3xl font-bold text-amber-600 truncate">
                {stats.pendingRequests}
              </p>
            </div>
            <div className="ml-3 p-2.5 rounded-lg bg-amber-50 group-hover:bg-amber-100 transition-colors duration-200 shrink-0">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="group border border-gray-200 hover:border-emerald-300 hover:shadow-lg transition-all duration-300 ease-in-out bg-white flex-1 flex flex-col">
        <CardContent className="p-4 sm:p-5 flex flex-col justify-center flex-grow">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                Total Policies
              </p>
              <p className="text-2xl sm:text-3xl font-bold text-emerald-600 truncate">
                {stats.number_of_policies.toLocaleString()}
              </p>
            </div>
            <div className="ml-3 p-2.5 rounded-lg bg-emerald-50 group-hover:bg-emerald-100 transition-colors duration-200 shrink-0">
              <FileText className="h-5 w-5 text-emerald-600" />
            </div>
          </div>
        </CardContent>
      </Card>

        <Card className="group border border-gray-200 hover:border-purple-300 hover:shadow-lg transition-all duration-300 ease-in-out bg-white flex-1 flex flex-col">
            <CardContent className="p-4 sm:p-5 flex flex-col justify-center flex-grow">
            <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Running Balance
                    </p>
                    {typeof totalBalance === 'number' && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                        <button
                            type="button"
                            aria-label={`Total Running Balance: ₹${totalBalance.toLocaleString()}`}
                            className="text-purple-500 hover:text-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-1 rounded-sm transition-colors"
                        >
                            <Info className="h-3 w-3" />
                        </button>
                        </TooltipTrigger>
                        <TooltipContent
                        side="top"
                        align="center"
                        className="max-w-xs bg-white text-black shadow-lg rounded-md p-2"
                        >
                        <p className="text-sm font-medium whitespace-pre-line">
                           {`Total Running Balance:\n${formatCurrencyWithSign(totalBalance)}`}
                        </p>
                        </TooltipContent>
                    </Tooltip>
                    )}
                </div>
                <p className={`${runningBalanceFontSize} font-bold text-purple-600 truncate`}>
                    {formatCurrencyWithSign(stats.running_balance)}
                </p>
                </div>
                <div className="ml-3 p-2.5 rounded-lg bg-purple-50 group-hover:bg-purple-100 transition-colors duration-200 shrink-0">
                <TrendingUp className="h-5 w-5 text-purple-600" />
                </div>
            </div>
            </CardContent>
        </Card>

        <Card className="group border border-gray-200 hover:border-orange-300 hover:shadow-lg transition-all duration-300 ease-in-out bg-white flex-1 flex flex-col">
            <CardContent className="p-4 sm:p-5 flex flex-col justify-center flex-grow">
                <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                                Total Premium
                            </p>
                            {typeof stats.total_net_premium === 'number' && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        type="button"
                                        aria-label={`Total Net Premium: ₹${stats.total_net_premium.toLocaleString()}`}
                                        className="text-orange-500 hover:text-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-1 rounded-sm transition-colors"
                                    >
                                        <Info className="h-3 w-3" />
                                    </button>
                                </TooltipTrigger>
                                
                                <TooltipContent
                                side="top"
                                align="center"
                                className="max-w-xs bg-white text-black shadow-lg rounded-md p-2"
                                >
                                    <p className="text-sm font-medium whitespace-pre-line">
                                      {`Total Net Premium:\n${formatCurrencyWithSign(stats.total_net_premium)}`}
                                    </p>
                                </TooltipContent>
                            </Tooltip>
                            )}
                        </div>
                            <p className={`${totalPremiumFontSize} font-bold text-orange-600 truncate`}>
                               {formatCurrencyWithSign(stats.total_net_premium)}
                            </p>
                        </div>
                    
                    <div className="ml-3 p-2.5 rounded-lg bg-orange-50 group-hover:bg-orange-100 transition-colors duration-200 shrink-0">
                        <DollarSign className="h-5 w-5 text-orange-600" />
                    </div>
                </div>
            </CardContent>
        </Card>

    </div>
  )
}
