// SuperAdmin API Types

// Broker Types
export interface Broker {
  id: number
  broker_code: string
  name: string
  address: string
  rm: string
  gst: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CreateBrokerRequest {
  name: string
  address: string
  rm: string
  gst: string
}

export interface UpdateBrokerRequest {
  name?: string
  address?: string
  rm?: string
  gst?: string
  is_active?: boolean
}

// Insurer Types
export interface Insurer {
  id: number
  insurer_code: string
  name: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CreateInsurerRequest {
  name: string
}

export interface UpdateInsurerRequest {
  name?: string
  is_active?: boolean
}

// Combined Broker-Insurer List
export interface BrokerInsurerListResponse {
  brokers: Broker[]
  insurers: Insurer[]
}

// Admin Child ID Types
export interface AdminChildId {
  id: number
  child_id: string
  branch_code: string
  region: string
  manager_name: string
  manager_email: string
  admin_notes: string | null
  code_type: string
  insurer_id: number
  broker_id: number | null
  is_active: boolean
  is_suspended: boolean
  created_at: string
  updated_at: string
  insurer: Insurer
  broker: Broker | null
}

export interface CreateAdminChildIdRequest {
  child_id: string
  branch_code: string
  region: string
  manager_name: string
  manager_email: string
  admin_notes?: string
  code_type: string
  insurer_code: string
  broker_code?: string
}

export interface UpdateAdminChildIdRequest {
  child_id?: string
  branch_code?: string
  region?: string
  manager_name?: string
  manager_email?: string
  admin_notes?: string
  code_type?: string
  insurer_code?: string
  broker_code?: string
  is_active?: boolean
  is_suspended?: boolean
}

// Query Parameters
export interface AvailableChildIdsParams {
  insurer_code: string
  broker_code?: string
}

// Common Response Types
export interface SuperAdminResponse<T = Record<string, unknown>> {
  data: T
  message?: string
}
