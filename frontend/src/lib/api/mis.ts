import { AxiosError } from 'axios';
import { createAuthenticatedClient } from './client';
import {
  MasterSheetListParams,
  MasterSheetListResponse,
  BulkUpdateRequest,
  BulkUpdateResponse,
  MasterSheetStats,
  MasterSheetExportParams,
} from '@/types/mis.types';

// Type for FastAPI validation errors
interface ValidationError {
  loc: (string | number)[];
  msg: string;
  type: string;
}

// Type for common error responses from the API
interface ErrorResponse {
  detail?: string | ValidationError[];
  message?: string;
  error?: string;
}

// Create axios instance with Supabase authentication
const apiClient = createAuthenticatedClient()

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ErrorResponse | string>) => {
    console.error('MIS API Error:', {
      response: error.response?.data,
      status: error.response?.status,
      message: error.message,
    });

    let message = 'An unexpected error occurred';

    const errorData = error.response?.data;

    if (errorData) {
      if (typeof errorData === 'string') {
        message = errorData;
      } else if (errorData.detail) {
        if (Array.isArray(errorData.detail)) {
          message = errorData.detail.map((d) => d.msg).join(', ');
        } else {
          message = errorData.detail;
        }
      } else if (errorData.message) {
        message = errorData.message;
      } else if (errorData.error) {
        message = errorData.error;
      } else {
        message = `Server error (${error.response?.status})`;
      }
    } else if (error.message) {
      message = error.message;
    }

    throw new Error(message);
  }
);

export const misApi = {
  // GET /mis/master-sheet
  listMasterSheet: async (params: MasterSheetListParams): Promise<MasterSheetListResponse> => {
    const response = await apiClient.get('/mis/master-sheet', { params });
    return response.data;
  },

  // PUT /mis/master-sheet/bulk-update
  bulkUpdateMasterSheet: async (data: BulkUpdateRequest): Promise<BulkUpdateResponse> => {
    const response = await apiClient.put('/mis/master-sheet/bulk-update', data);
    return response.data;
  },

  // GET /mis/master-sheet/stats
  getMasterSheetStats: async (): Promise<MasterSheetStats> => {
    const response = await apiClient.get('/mis/master-sheet/stats');
    return response.data;
  },

  // GET /mis/master-sheet/fields
  getMasterSheetFields: async (): Promise<string[]> => {
    const response = await apiClient.get('/mis/master-sheet/fields');
    return response.data;
  },

  // GET /mis/master-sheet/export
  exportMasterSheet: async (params: MasterSheetExportParams): Promise<Blob> => {
    const response = await apiClient.get('/mis/master-sheet/export', {
      params,
      responseType: 'blob',
    });
    return response.data;
  },
};