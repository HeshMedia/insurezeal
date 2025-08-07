import { useInfiniteQuery } from '@tanstack/react-query'
import { agentApi } from '@/lib/api/agent'
import { AgentMISResponse, AgentMISParams } from '@/types/agent.types'

export const agentMISKeys = {
  all: ['agentMIS'] as const,
  list: (params: AgentMISParams) => [...agentMISKeys.all, 'list', params] as const,
}

export function useAgentMISList(params: AgentMISParams) {
  return useInfiniteQuery<AgentMISResponse, Error>({
    queryKey: agentMISKeys.list(params),

    // Explicitly type pageParam as number with default 1
    queryFn: async (context: {
  pageParam?: unknown
  [key: string]: unknown
}) => {
  const pageParam =
    typeof context.pageParam === 'number' ? context.pageParam : 1
  return agentApi.mis.getAgentMISData({
    ...params,
    page: pageParam,
  })
},

    // Specify initialPageParam to satisfy React Query's typing
    initialPageParam: 1,

    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.total_pages ? lastPage.page + 1 : undefined,

    staleTime: 5 * 60 * 1000, // 5 minutes

  })
}
