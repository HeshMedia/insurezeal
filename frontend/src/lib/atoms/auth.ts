import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import { UserResponse } from '@/types/auth.types'

// Persistent auth state using atomWithStorage
export const accessTokenAtom = atomWithStorage<string | null>('accessToken', null)
export const refreshTokenAtom = atomWithStorage<string | null>('refreshToken', null)
export const userAtom = atomWithStorage<UserResponse | null>('user', null)

// Derived atom to check if user is logged in
export const isLoggedInAtom = atom((get) => {
  const accessToken = get(accessTokenAtom)
  const user = get(userAtom)
  return !!(accessToken && user)
})

// Auth loading states
export const authLoadingAtom = atom(false)

export const logoutLoadingAtom = atom(false)
export const refreshLoadingAtom = atom(false)

// Auth error state
export const authErrorAtom = atom<Error | null>(null)

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
