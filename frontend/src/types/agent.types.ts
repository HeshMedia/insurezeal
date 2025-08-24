// Child ID Request Types
export type ChildIdStatus = 'pending' | 'accepted' | 'rejected' | 'suspended'
export type CodeType = 'Direct Code' | 'Broker Code'

// Dropdown Response Types
export interface InsurerDropdownResponse {
  id: number
  insurer_code: string
  name: string
}

export interface BrokerDropdownResponse {
  id: number
  broker_code: string
  name: string
}

export interface BrokerInsurerDropdownResponse {
  brokers: BrokerDropdownResponse[]
  insurers: InsurerDropdownResponse[]
}

// Create Child ID Request Types
// import { InsurerInfo, BrokerInfo } from "./admin.types"

export interface CreateChildIdRequest {
  phone_number: string
  email: string
  location: string
  code_type: string
  insurer_code: string
  broker_code?: string
  preferred_rm_name?: string
}

export interface ChildIdRequest {
  id: string
  user_id: string
  phone_number: string
  email: string
  location: string
  code_type: string
  insurer_id: number
  broker_code?: number
  preferred_rm_name?: string
  password: string
  status: ChildIdStatus
  child_id?: string
  branch_code?: string
  region?: string
  manager_name?: string
  manager_email?: string
  admin_notes?: string
  approved_by?: string
  approved_at?: string
  created_at: string
  updated_at: string
  insurer?: InsurerDropdownResponse
  broker_relation?: BrokerDropdownResponse
}

// Summary view for list/card display
export interface ChildIdSummary {
  id: string
  phone_number: string
  location: string
  code_type: string
  status: ChildIdStatus
  child_id?: string
  created_at: string
  insurer?: InsurerDropdownResponse
  broker_relation?: BrokerDropdownResponse
}

// List Response Types
export interface ChildIdListResponse {
  requests: ChildIdSummary[]
  total_count: number
  page: number
  page_size: number
  total_pages: number
}

export interface ChildIdListParams {
  page?: number
  page_size?: number
}

// Agent Dashboard Stats
export interface AgentStats {
  active_child_ids: number
  pending_requests: number
}
// Agent MIS Record - filtered version of MasterSheetRecord for agents
export interface AgentMISRecord {
  id: string;
  reporting_month: string;
  booking_date: string;
  agent_code: string;
  insurer_name: string;
  broker_name: string;
  policy_number: string;
  formatted_policy_number: string;
  customer_name: string;
  customer_phone_number: string;
  major_categorisation: string;
  product_insurer_report: string;
  product_type: string;
  plan_type: string;
  gross_premium: string;
  net_premium: string;
  registration_number: string;
  make_model: string;
  model: string;
  agent_commission_perc: string;
  agent_po_amount: string;
  total_agent_po: string;
  running_balance: string;
  already_given_to_agent: string;
  created_at: string;
  updated_at: string;
}

// Agent MIS Statistics
export interface AgentMISStats {
  number_of_policies: number;
  running_balance: number;
  total_net_premium: number;
}

// Parameters for fetching agent MIS data
export interface AgentMISParams {
  page?: number;
  page_size?: number;
}

// Response for the agent MIS endpoint (direct full API response)
export interface AgentMISResponse {
  records: AgentMISRecord[];
  stats: AgentMISStats;
  total_count: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// Table state for UI, using response data split into typed fields
export interface AgentMISTable {
  data: AgentMISRecord[];
  stats: AgentMISStats;
  pagination: {
    total_count: number;
    page: number;
    page_size: number;
    total_pages: number;
  }
}
