import { createAuthenticatedClient } from './client'
import {
  AgentOption,
  ChildIdOption,
  // ChildIdOptionsParams,
  ExportCsvParams,
  ExtractPdfDataResponse,
  ListAgentPoliciesParams,
  ListPoliciesParams,
  ListPoliciesResponse,
  Policy,
  SubmitPolicyPayload,
  UpdatePolicyPayload,
  UploadPolicyPdfResponse,
  CheckPolicyNumberResponse,
} from "@/types/policy.types";


const apiClient = createAuthenticatedClient()


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

// Submit policy (backend will derive quarter/year from dates internally; if required, extend signature)
export const submitPolicy = async (payload: SubmitPolicyPayload): Promise<Policy> => {
  const { data } = await apiClient.post("/policies/submit", payload);
  return data;
};

export const listPolicies = async (params: ListPoliciesParams): Promise<ListPoliciesResponse> => {
  // Backend now expects skip/limit and optional quarter/year
  const page = params.page ?? 1;
  const pageSize = params.page_size ?? 20;
  const skip = (page - 1) * pageSize;
  const limit = pageSize;

  const { data } = await apiClient.get("/policies/", { params: { skip, limit, ...(params.quarter && { quarter: params.quarter }), ...(params.year && { year: params.year }) } });

  // New backend returns a simple array of PolicySummaryResponse. Wrap it into expected shape.
  if (Array.isArray(data)) {
    type BackendSummary = {
      id: string;
      policy_number?: string;
      policy_type?: string;
      agent_code?: string;
      policy_start_date?: string;
      policy_end_date?: string;
      start_date?: string;
      end_date?: string;
      created_at?: string;
    };

    const items = (data as BackendSummary[]).map((d) => ({
      id: d.id,
      policy_number: d.policy_number ?? "",
      policy_type: d.policy_type ?? "",
      insurance_type: "",
      agent_code: d.agent_code ?? "",
      vehicle_type: "",
      registration_number: "",
      net_premium: 0,
      start_date: d.policy_start_date ?? d.start_date ?? "",
      end_date: d.policy_end_date ?? d.end_date ?? "",
      created_at: d.created_at ?? "",
      quarter: (d as unknown as { quarter?: string }).quarter,
      year: (d as unknown as { year?: number }).year,
    }));

    return {
      policies: items,
      total_count: items.length,
      page,
      page_size: pageSize,
      total_pages: Math.max(1, Math.ceil(items.length / pageSize)),
    } as ListPoliciesResponse;
  }

  return data as ListPoliciesResponse;
};



export const getPolicyDetailsByNumber = async ({
  policy_number,
  quarter,
  year,
}: {
  policy_number: string;
  quarter: number;
  year: number;
}): Promise<Policy> => {
  const { data } = await apiClient.get("/policies/policy-details", {
    params: { policy_number, quarter, year },
  });
  
  // The backend returns { database_record: {...}, google_sheets_data: {...} }
  // We need to merge both sources into a flat Policy object
  const dbRecord = data.database_record || {};
  const sheetsData = data.google_sheets_data || {};
  
  // Merge data from both sources, with sheets data taking precedence for detailed fields
  // Google Sheets uses different field names, so we need to map them correctly
  const mergedPolicy = {
    // Database fields (essential data)
    id: dbRecord.id || "",
    agent_id: sheetsData.agent_id || "",
    policy_number: dbRecord.policy_number || policy_number,
    child_id: dbRecord.child_id || sheetsData["Child ID/ User ID [Provided by Insure Zeal]"] || "",
    agent_code: dbRecord.agent_code || sheetsData["Agent Code"] || "",
    additional_documents: dbRecord.additional_documents || "",
    policy_pdf_url: dbRecord.policy_pdf_url || "",
    booking_date: dbRecord.booking_date || sheetsData["Booking Date(Click to select Date)"] || "",
    policy_start_date: dbRecord.policy_start_date || "",
    policy_end_date: dbRecord.policy_end_date || "",
    created_at: dbRecord.created_at || "",
    updated_at: dbRecord.updated_at || "",
    
    // Google Sheets fields (detailed data) - map from actual sheet column names
    formatted_policy_number: sheetsData["Formatted Policy number"] || "",
    major_categorisation: sheetsData["Major Categorisation( Motor/Life/ Health)"] || "",
    product_insurer_report: sheetsData["Product (Insurer Report)"] || "",
    product_type: sheetsData["Product Type"] || "",
    plan_type: sheetsData["Plan type (Comp/STP/SAOD)"] || "",
    customer_name: sheetsData["Customer Name"] || "",
    customer_phone_number: sheetsData["Customer Number"] || "",
    broker_name: sheetsData["Broker Name"] || data.broker_name || "",
    insurance_company: sheetsData["Insurer name"] || data.insurer_name || "",
    policy_type: sheetsData["Plan type (Comp/STP/SAOD)"] || "", // Using plan_type as policy_type
    insurance_type: sheetsData["Major Categorisation( Motor/Life/ Health)"] || "",
    vehicle_type: sheetsData["Product Type"] || "",
    registration_number: sheetsData["Registration.no"] || "",
    vehicle_class: sheetsData["Make_Model"] || "",
    vehicle_segment: sheetsData["Product Type"] || "",
    make_model: sheetsData["Make_Model"] || "",
    model: sheetsData["Model"] || "",
    vehicle_variant: sheetsData["Vehicle_Variant"] || "",
    gvw: parseFloat(sheetsData["GVW"] || "0") || 0,
    fuel_type: sheetsData["Fuel Type"] || "",
    cc: parseFloat(sheetsData["CC"] || "0") || 0,
    rto: sheetsData["RTO"] || "",
    state: sheetsData["State"] || "",
    age_year: parseFloat(sheetsData["Age(Year)"] || "0") || 0,
    ncb: sheetsData["NCB (YES/NO)"] || "",
    discount_percent: parseFloat(sheetsData["Discount %"] || "0") || 0,
    business_type: sheetsData["Business Type"] || "",
    seating_capacity: parseFloat(sheetsData["Seating Capacity"] || "0") || 0,
    veh_wheels: parseFloat(sheetsData["Veh_Wheels"] || "0") || 0,
    is_private_car: sheetsData[""] === "TRUE", // Using the empty key that has TRUE/FALSE
    gross_premium: parseFloat(sheetsData["Gross premium"] || "0") || 0,
    gst: parseFloat(sheetsData["GST Amount"] || "0") || 0,
    gst_amount: parseFloat(sheetsData["GST Amount"] || "0") || 0,
    net_premium: parseFloat(sheetsData[" Net premium "] || "0") || 0,
    od_premium: parseFloat(sheetsData["OD Preimium"] || "0") || 0,
    tp_premium: parseFloat(sheetsData["TP Premium"] || "0") || 0,
    agent_commission_given_percent: parseFloat(sheetsData["Actual Agent_PO%"] || "0") || 0,
    agent_extra_percent: parseFloat(sheetsData["Agent_Extra%"] || "0") || 0,
    payment_by_office: parseFloat(sheetsData["Payment By Office"] || "0") || 0,
    total_agent_payout_amount: parseFloat(sheetsData["Running Bal"] || "0") || 0,
    running_bal: parseFloat(sheetsData["Running Bal"] || "0") || 0,
    code_type: sheetsData["Insurer /broker code"] ? "Direct" : "Broker", // Derive from insurer code presence
    payment_by: sheetsData["Payment by"] || "",
    payment_method: sheetsData["Payment Mode"] || "",
    cluster: sheetsData["Cluster"] || "",
    notes: sheetsData["Remarks"] || "",
    
    // Map date fields properly
    start_date: dbRecord.policy_start_date || sheetsData["Policy Start Date"] || "",
    end_date: dbRecord.policy_end_date || sheetsData["Policy End Date"] || "",
  };
  
  return mergedPolicy as unknown as Policy;
};

export const updatePolicyByNumber = async ({
  policy_number,
  quarter,
  year,
  payload,
}: {
  policy_number: string;
  quarter: number;
  year: number;
  payload: UpdatePolicyPayload;
}): Promise<Policy> => {
  const { data } = await apiClient.put("/policies/policy-update", payload, {
    params: { policy_number, quarter, year },
  });
  return data;
};

// Legacy update by ID still supported where needed
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

export const deletePolicyByNumber = async ({
  policy_number,
  quarter,
  year,
}: {
  policy_number: string;
  quarter: number;
  year: number;
}): Promise<string> => {
  const { data } = await apiClient.delete(`/policies/policy-delete`, { params: { policy_number, quarter, year } });
  return data;
};

export const getChildIdOptions = async (params: {
  insurer_code: string;
  broker_code?: string;
  agent_id?: string;
}): Promise<ChildIdOption[]> => {
  const { data } = await apiClient.get("/policies/helpers/child-ids", {
    params: {
      insurer_code: params.insurer_code,
      ...(params.broker_code && { broker_code: params.broker_code }),
      ...(params.agent_id && { agent_id: params.agent_id }),
    },
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

export const checkPolicyNumberDuplicate = async ({
  policy_number,
  exclude_policy_id,
}: {
  policy_number: string;
  exclude_policy_id?: string | null;
}): Promise<CheckPolicyNumberResponse> => {
  const { data } = await apiClient.get(
    "/policies/helpers/check-policy-number",
    {
      params: {
        policy_number,
        ...(exclude_policy_id ? { exclude_policy_id } : {}),
      },
    }
  );
  return data as CheckPolicyNumberResponse;
};