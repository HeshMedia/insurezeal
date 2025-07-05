import { atom } from 'jotai'
import { UserResponse } from '@/types/auth.types'

// Auth user state
export const authUserAtom = atom<UserResponse | null>(null)

// Auth loading states
export const authLoadingAtom = atom(false)
export const loginLoadingAtom = atom(false)
export const logoutLoadingAtom = atom(false)
export const refreshLoadingAtom = atom(false)

// Auth error state
export const authErrorAtom = atom<Error | null>(null)

// Computed auth state
export const isAuthenticatedAtom = atom((get) => {
  const user = get(authUserAtom)
  return !!user
})

// Token refresh state
export const lastTokenRefreshAtom = atom<number>(0)
export const tokenRefreshIntervalAtom = atom<NodeJS.Timeout | null>(null)

// Auth form states
export const loginFormDataAtom = atom({
  email: '',
  password: '',
  rememberMe: false
})

export const registerFormDataAtom = atom({
  email: '',
  password: '',
  confirmPassword: '',
  username: '',
  first_name: '',
  last_name: ''
})

export const resetPasswordFormDataAtom = atom({
  new_password: '',
  confirmPassword: ''
})

// Auth UI states
export const showPasswordAtom = atom(false)
export const showConfirmPasswordAtom = atom(false)
export const authModalOpenAtom = atom(false)
