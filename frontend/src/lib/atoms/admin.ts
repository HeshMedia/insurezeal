import { atom } from 'jotai'
import { AgentListParams } from '@/types/admin.types'



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
