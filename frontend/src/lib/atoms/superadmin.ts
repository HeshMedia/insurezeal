import { atom } from 'jotai'

// Broker state atoms
export const brokerSearchAtom = atom('')
export const selectedBrokerIdAtom = atom<number | null>(null)
export const isBrokerDialogOpenAtom = atom(false)
export const brokerDialogTypeAtom = atom<'create' | 'edit'>('create')

// Insurer state atoms
export const insurerSearchAtom = atom('')
export const selectedInsurerIdAtom = atom<number | null>(null)
export const isInsurerDialogOpenAtom = atom(false)
export const insurerDialogTypeAtom = atom<'create' | 'edit'>('create')

// Admin Child ID state atoms
export const adminChildIdSearchAtom = atom('')
export const selectedAdminChildIdAtom = atom<number | null>(null)
export const isAdminChildIdDialogOpenAtom = atom(false)
export const adminChildIdDialogTypeAtom = atom<'create' | 'edit'>('create')

// Super Admin dashboard state
export const superAdminActiveTabAtom = atom<'overview' | 'brokers' | 'insurers' | 'admin-child-ids'>('overview')
export const superAdminSearchQueryAtom = atom('')
export const superAdminFiltersOpenAtom = atom(false)
