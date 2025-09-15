import {
  useMutation,
  useQuery,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import * as policyApi from "@/lib/api/policy";
import {
  ListAgentPoliciesParams,
  ListPoliciesParams,
  UpdatePolicyPayload,
} from "@/types/policy.types";

const policyKeys = {
  all: ["policies"] as const,
  lists: () => [...policyKeys.all, "list"] as const,
  list: (filters: ListPoliciesParams) =>
    [...policyKeys.lists(), filters] as const,
  details: () => [...policyKeys.all, "detail"] as const,
  detail: (id: string) => [...policyKeys.details(), id] as const,
  agentLists: () => [...policyKeys.all, "agent-list"] as const,
  agentList: (agentCode: string, filters: ListAgentPoliciesParams) =>
    [...policyKeys.agentLists(), agentCode, filters] as const,
  helpers: () => [...policyKeys.all, "helpers"] as const,
  childIds: (insurerCode?: string, brokerCode?: string, agentId?: string) =>
    [
      ...policyKeys.helpers(),
      "child-ids",
      insurerCode,
      brokerCode,
      agentId,
    ] as const,
  agents: () => [...policyKeys.helpers(), "agents"] as const,
};

export const useExtractPdfData = () => {
  return useMutation({
    mutationFn: policyApi.extractPdfData,
  });
};

export const useUploadPolicyPdf = () => {
  return useMutation({
    mutationFn: policyApi.uploadPolicyPdf,
  });
};

export const useSubmitPolicy = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: policyApi.submitPolicy,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: policyKeys.lists() });
    },
  });
};

// Fixed: Replace keepPreviousData: true with placeholderData: keepPreviousData
export const useListPolicies = (params: ListPoliciesParams) => {
  return useQuery({
    queryKey: policyKeys.list(params),
    queryFn: () => policyApi.listPolicies(params),
    placeholderData: keepPreviousData,
  });
};

export const usePolicyDetailsByNumber = ({
  policy_number,
  quarter,
  year,
}: {
  policy_number: string;
  quarter: number;
  year: number;
}) => {
  return useQuery({
    queryKey: ["policies", "detail-by-number", policy_number, quarter, year],
    queryFn: () =>
      policyApi.getPolicyDetailsByNumber({ policy_number, quarter, year }),
    enabled: !!policy_number && !!quarter && !!year,
  });
};

export const useUpdatePolicyByNumber = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      policy_number,
      quarter,
      year,
      payload,
    }: {
      policy_number: string;
      quarter: number;
      year: number;
      payload: UpdatePolicyPayload;
    }) =>
      policyApi.updatePolicyByNumber({ policy_number, quarter, year, payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: policyKeys.lists() });
    },
  });
};

export const useDeletePolicy = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: policyApi.deletePolicyByNumber,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: policyKeys.lists() });
    },
  });
};

export const useChildIdOptions = (params?: {
  insurer_code: string;
  broker_code?: string;
  agent_id?: string;
}) => {
  return useQuery({
    queryKey: policyKeys.childIds(
      params?.insurer_code,
      params?.broker_code,
      params?.agent_id
    ),
    queryFn: () =>
      params ? policyApi.getChildIdOptions(params) : Promise.resolve([]),
    enabled: !!params?.insurer_code, // Only run when insurer_code is available
  });
};

export const useAgentOptions = () => {
  return useQuery({
    queryKey: policyKeys.agents(),
    queryFn: policyApi.getAgentOptions,
  });
};

// Fixed: Replace keepPreviousData: true with placeholderData: keepPreviousData
export const useAgentPolicies = (
  agentCode: string,
  params: ListAgentPoliciesParams
) => {
  return useQuery({
    queryKey: policyKeys.agentList(agentCode, params),
    queryFn: () => policyApi.getAgentPolicies({ agentCode, params }),
    enabled: !!agentCode,
    placeholderData: keepPreviousData,
  });
};

export const useExportPoliciesCsv = () => {
  return useMutation({
    mutationFn: policyApi.exportPoliciesCsv,
    onSuccess: (data: Blob) => {
      const blob = new Blob([data], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `policies-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    },
  });
};
