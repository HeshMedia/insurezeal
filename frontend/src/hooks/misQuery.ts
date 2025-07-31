import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { misApi } from '@/lib/api/mis';
import { MasterSheetListParams, BulkUpdateRequest, MasterSheetExportParams } from '@/types/mis.types';

export const misKeys = {
  all: ['mis'] as const,
  masterSheet: {
    all: () => [...misKeys.all, 'masterSheet'] as const,
    lists: () => [...misKeys.masterSheet.all(), 'list'] as const,
    list: (params: MasterSheetListParams) => [...misKeys.masterSheet.lists(), params] as const,
    stats: () => [...misKeys.masterSheet.all(), 'stats'] as const,
    fields: () => [...misKeys.masterSheet.all(), 'fields'] as const,
  },
};

// Get paginated master sheet data using an infinite query
export const useMasterSheetList = (params: MasterSheetListParams) => {
  return useInfiniteQuery({
    queryKey: misKeys.masterSheet.list(params),
    queryFn: ({ pageParam = 1 }) => misApi.listMasterSheet({ ...params, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      return lastPage.page < lastPage.total_pages ? lastPage.page + 1 : undefined;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Perform bulk updates on the master sheet
export const useBulkUpdateMasterSheet = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: BulkUpdateRequest) => misApi.bulkUpdateMasterSheet(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: misKeys.masterSheet.lists() });
      queryClient.invalidateQueries({ queryKey: misKeys.masterSheet.stats() });
    },
  });
};

// Get master sheet statistics
export const useMasterSheetStats = () => {
  return useQuery({
    queryKey: misKeys.masterSheet.stats(),
    queryFn: misApi.getMasterSheetStats,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Get the list of available fields from the master sheet
export const useMasterSheetFields = () => {
  return useQuery({
    queryKey: misKeys.masterSheet.fields(),
    queryFn: misApi.getMasterSheetFields,
    staleTime: Infinity, // Field names are unlikely to change frequently
  });
};

// Export master sheet data
export const useExportMasterSheet = () => {
  return useMutation({
    mutationFn: (params: MasterSheetExportParams) => misApi.exportMasterSheet(params),
  });
};