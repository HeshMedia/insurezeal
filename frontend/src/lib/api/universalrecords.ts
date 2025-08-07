import { createAuthenticatedClient } from './client';
import {
  UniversalInsurersResponse,
  UniversalPreviewParams,
  UniversalPreviewResponse,
  UniversalUploadParams,
  UniversalUploadResponse,
  UniversalTemplateParams,
  ReconciliationSummaryParams,
  ReconciliationSummaryResponse,
  InsurerMappingResponse,
} from '@/types/universalrecords.types';

export const universalRecordsApi = {
  // GET /universal-records/insurers
  getInsurers: async (): Promise<UniversalInsurersResponse> => {
    const client = await createAuthenticatedClient();
    const response = await client.get('/universal-records/insurers');
    return response.data;
  },

  // POST /universal-records/preview
  preview: async (params: UniversalPreviewParams): Promise<UniversalPreviewResponse> => {
    const client = await createAuthenticatedClient();
    const formData = new FormData();
    formData.append('file', params.file);
    const response = await client.post('/universal-records/preview', formData, {
      params: {
        insurer_name: params.insurer_name,
        preview_rows: params.preview_rows,
      },
    });
    return response.data;
  },

  // POST /universal-records/upload
  upload: async (params: UniversalUploadParams): Promise<UniversalUploadResponse> => {
    const client = await createAuthenticatedClient();
    const formData = new FormData();
    formData.append('file', params.file);
    const response = await client.post('/universal-records/upload', formData, {
      params: { insurer_name: params.insurer_name },
    });
    return response.data;
  },

  // GET /universal-records/template
  downloadTemplate: async (params: UniversalTemplateParams): Promise<Blob> => {
    const client = await createAuthenticatedClient();
    const response = await client.get('/universal-records/template', {
      params,
      responseType: 'blob',
    });
    return response.data;
  },

  // GET /universal-records/reconciliation/summary
  getReconciliationSummary: async (params: ReconciliationSummaryParams): Promise<ReconciliationSummaryResponse> => {
    const client = await createAuthenticatedClient();
    const response = await client.get('/universal-records/reconciliation/summary', { params });
    return response.data;
  },

  // GET /universal-records/mappings/{insurer_name}
  getInsurerMapping: async (insurerName: string): Promise<InsurerMappingResponse> => {
    const client = await createAuthenticatedClient();
    const response = await client.get(`/universal-records/mappings/${insurerName}`);
    return response.data;
  },
};