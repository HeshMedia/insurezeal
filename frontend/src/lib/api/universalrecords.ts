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


interface ValidationError {
  type: string;
  loc: (string | number)[];
  msg: string;
  input: unknown;
}

interface FastAPIErrorResponse {
  detail?: ValidationError[];
}

interface AxiosErrorResponse {
  response?: {
    status: number;
    data: FastAPIErrorResponse;
  };
}

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
  // POST /universal-records/upload
  upload: async (params: UniversalUploadParams): Promise<UniversalUploadResponse> => {
    const client = await createAuthenticatedClient();
    
    // Debug file object
    console.log('🔍 API Client File Debug:', {
      file: params.file,
      name: params.file?.name,
      size: params.file?.size,
      type: params.file?.type,
      instanceof: params.file instanceof File
    });
    
    // Validate file
    if (!params.file || !(params.file instanceof File) || params.file.size === 0) {
      throw new Error('Invalid or empty file provided');
    }
    
    const formData = new FormData();
    formData.append('file', params.file, params.file.name);
    
    // Debug FormData
    console.log('📋 FormData contents:');
    for (const [key, value] of formData.entries()) {
      console.log(`${key}:`, value, typeof value, value instanceof File);
    }
    
    const queryParams: Record<string, string> = {
      insurer_name: params.insurer_name,
      quarters: params.quarters || "1,2,3,4",
      years: params.years || "2025"
    };
    
    console.log('📤 Query params:', queryParams);
    console.log('📤 Request URL: /universal-records/upload');
    
    try {
      const response = await client.post('/universal-records/upload', formData, {
        params: queryParams,
        headers: {
          // Let browser set Content-Type automatically for multipart
          'Content-Type': undefined
        }
      });
      return response.data;
    } catch (error) {
      console.error('❌ API Error:', error);
      
      // Fixed TypeScript error handling with proper types
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as AxiosErrorResponse;
        if (axiosError.response) {
          console.error('❌ Response status:', axiosError.response.status);
          console.error('❌ Response data:', axiosError.response.data);
          
          // Log detailed validation errors with proper typing
          if (axiosError.response.data?.detail && Array.isArray(axiosError.response.data.detail)) {
            console.error('❌ Validation errors:');
            axiosError.response.data.detail.forEach((validationError: ValidationError, index: number) => {
              console.error(`  ${index + 1}:`, {
                type: validationError.type,
                location: validationError.loc,
                message: validationError.msg,
                input: validationError.input
              });
            });
          }
        }
      }
      throw error;
    }
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