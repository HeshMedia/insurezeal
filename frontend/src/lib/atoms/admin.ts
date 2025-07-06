import { atom } from 'jotai'
import { CutPayListParams, AgentListParams } from '@/types/admin.types'

// Extended params with pagination for UI
interface CutPayUIParams extends Omit<CutPayListParams, 'skip' | 'limit'> {
  page?: number
  page_size?: number
}

// Cutpay state atoms
export const cutpayListParamsAtom = atom<CutPayUIParams>({
  page: 1,
  page_size: 20,
})

export const selectedCutpayIdAtom = atom<number | null>(null)

export const isCutpayDialogOpenAtom = atom(false)

export const cutpayFormStateAtom = atom({
  isSubmitting: false,
  isEditing: false,
})

// Agent state atoms
export const agentListParamsAtom = atom<AgentListParams>({
  page: 1,
  page_size: 20,
})

export const selectedAgentIdAtom = atom<string | null>(null)

export const isAgentDialogOpenAtom = atom(false)

// Child requests state atoms
export const selectedChildRequestIdAtom = atom<string | null>(null)

export const isChildRequestDialogOpenAtom = atom(false)

export const childRequestActionAtom = atom<'assign' | 'reject' | 'suspend' | null>(null)

// Admin dashboard state
export const adminActiveTabAtom = atom<'overview' | 'cutpay' | 'agents' | 'child-requests'>('overview')

export const adminSearchQueryAtom = atom('')

export const adminFiltersOpenAtom = atom(false)
