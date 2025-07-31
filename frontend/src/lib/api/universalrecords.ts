import axios, { AxiosInstance, AxiosError } from 'axios';
import Cookies from 'js-cookie';
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

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
});

// Request interceptor to add auth token
apiClient.interceptors.request.use((config) => {
  const token = Cookies.get('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Do not set Content-Type for FormData
  if (!(config.data instanceof FormData)) {
    config.headers['Content-Type'] = 'application/json';
  }
  return config;
});

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ErrorResponse | string>) => {
    console.error('Universal Records API Error:', {
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

export const universalRecordsApi = {
  // GET /universal-records/insurers
  getInsurers: async (): Promise<UniversalInsurersResponse> => {
    const response = await apiClient.get('/universal-records/insurers');
    return response.data;
  },

  // POST /universal-records/preview
  preview: async (params: UniversalPreviewParams): Promise<UniversalPreviewResponse> => {
    const formData = new FormData();
    formData.append('file', params.file);
    const response = await apiClient.post('/universal-records/preview', formData, {
      params: {
        insurer_name: params.insurer_name,
        preview_rows: params.preview_rows,
      },
    });
    return response.data;
  },

  // POST /universal-records/upload
  upload: async (params: UniversalUploadParams): Promise<UniversalUploadResponse> => {
    const formData = new FormData();
    formData.append('file', params.file);
    const response = await apiClient.post('/universal-records/upload', formData, {
      params: { insurer_name: params.insurer_name },
    });
    return response.data;
  },

  // GET /universal-records/template
  downloadTemplate: async (params: UniversalTemplateParams): Promise<Blob> => {
    const response = await apiClient.get('/universal-records/template', {
      params,
      responseType: 'blob',
    });
    return response.data;
  },

  // GET /universal-records/reconciliation/summary
  getReconciliationSummary: async (params: ReconciliationSummaryParams): Promise<ReconciliationSummaryResponse> => {
    const response = await apiClient.get('/universal-records/reconciliation/summary', { params });
    return response.data;
  },

  // GET /universal-records/mappings/{insurer_name}
  getInsurerMapping: async (insurerName: string): Promise<InsurerMappingResponse> => {
    const response = await apiClient.get(`/universal-records/mappings/${insurerName}`);
    return response.data;
  },
};