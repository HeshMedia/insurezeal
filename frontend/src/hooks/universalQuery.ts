import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { universalRecordsApi } from '@/lib/api/universalrecords';
import {
  UniversalPreviewParams,
  UniversalUploadParams,
  UniversalTemplateParams,
  ReconciliationSummaryParams,
} from '@/types/universalrecords.types';

export const universalRecordsKeys = {
  all: ['universalRecords'] as const,
  insurers: () => [...universalRecordsKeys.all, 'insurers'] as const,
  summaries: () => [...universalRecordsKeys.all, 'summaries'] as const,
  summary: (params: ReconciliationSummaryParams) => [...universalRecordsKeys.summaries(), params] as const,
  mappings: () => [...universalRecordsKeys.all, 'mappings'] as const,
  mapping: (insurerName: string) => [...universalRecordsKeys.mappings(), insurerName] as const,
};

// GET /universal-records/insurers
export const useUniversalInsurersList = () => {
  return useQuery({
    queryKey: universalRecordsKeys.insurers(),
    queryFn: universalRecordsApi.getInsurers,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// POST /universal-records/preview
export const usePreviewUniversalRecord = () => {
  return useMutation({
    mutationFn: (params: UniversalPreviewParams) => universalRecordsApi.preview(params),
  });
};

// POST /universal-records/upload
export const useUploadUniversalRecord = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: UniversalUploadParams) => universalRecordsApi.upload(params),
    onSuccess: () => {
      // Invalidate summaries after a successful upload
      queryClient.invalidateQueries({ queryKey: universalRecordsKeys.summaries() });
    },
  });
};

// GET /universal-records/template
export const useDownloadUniversalTemplate = () => {
  return useMutation({
    mutationFn: (params: UniversalTemplateParams) => universalRecordsApi.downloadTemplate(params),
  });
};

// GET /universal-records/reconciliation/summary
export const useReconciliationSummary = (params: ReconciliationSummaryParams) => {
  return useQuery({
    queryKey: universalRecordsKeys.summary(params),
    queryFn: () => universalRecordsApi.getReconciliationSummary(params),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// GET /universal-records/mappings/{insurer_name}
export const useInsurerMapping = (insurerName: string) => {
  return useQuery({
    queryKey: universalRecordsKeys.mapping(insurerName),
    queryFn: () => universalRecordsApi.getInsurerMapping(insurerName),
    enabled: !!insurerName, // Only run query if insurerName is provided
    staleTime: Infinity, // Mappings are unlikely to change
  });
};