import apiClient from "@/lib/utils/api-client"; 
import {
  AgentOption,
  ChildIdOption,
  ExportCsvParams,
  ExtractPdfDataResponse,
  ListAgentPoliciesParams,
  ListPoliciesParams,
  ListPoliciesResponse,
  Policy,
  SubmitPolicyPayload,
  UpdatePolicyPayload,
  UploadPolicyPdfResponse,
} from "@/types/policy.types";

export const extractPdfData = async (file: File): Promise<ExtractPdfDataResponse> => {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await apiClient.post("/policies/extract-pdf-data", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
};

export const uploadPolicyPdf = async (payload: {
  file: File;
  policy_id: string;
}): Promise<UploadPolicyPdfResponse> => {
  const formData = new FormData();
  formData.append("file", payload.file);
  formData.append("policy_id", payload.policy_id);
  const { data } = await apiClient.post("/policies/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
};

export const submitPolicy = async (payload: SubmitPolicyPayload): Promise<Policy> => {
  const { data } = await apiClient.post("/policies/submit", payload);
  return data;
};

export const listPolicies = async (params: ListPoliciesParams): Promise<ListPoliciesResponse> => {
  const { data } = await apiClient.get("/policies/", { params });
  return data;
};

export const getPolicyDetails = async (policyId: string): Promise<Policy> => {
  const { data } = await apiClient.get(`/policies/${policyId}`);
  return data;
};

export const updatePolicy = async ({
  policyId,
  payload,
}: {
  policyId: string;
  payload: UpdatePolicyPayload;
}): Promise<Policy> => {
  const { data } = await apiClient.put(`/policies/${policyId}`, payload);
  return data;
};

export const deletePolicy = async (policyId: string): Promise<string> => {
  const { data } = await apiClient.delete(`/policies/${policyId}`);
  return data;
};

export const getChildIdOptions = async (agentId?: string): Promise<ChildIdOption[]> => {
  const { data } = await apiClient.get("/policies/helpers/child-ids", {
    params: agentId ? { agent_id: agentId } : {},
  });
  return data;
};

export const getAgentOptions = async (): Promise<AgentOption[]> => {
  const { data } = await apiClient.get("/policies/helpers/agents");
  return data;
};

export const exportPoliciesCsv = async (params: ExportCsvParams): Promise<Blob> => {
  const { data } = await apiClient.get("/policies/export/csv", {
    params,
    responseType: 'blob', // Or 'text' depending on what the API returns
  });
  return data;
};

export const getAgentPolicies = async ({
  agentCode,
  params,
}: {
  agentCode: string;
  params: ListAgentPoliciesParams;
}): Promise<ListPoliciesResponse> => {
  const { data } = await apiClient.get(`/policies/agent/${agentCode}`, { params });
  return data;
};