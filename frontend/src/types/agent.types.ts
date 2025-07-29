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
  total_requests: number
  active_child_ids: number
  pending_requests: number
  rejected_requests: number
}
