'use client'

import React, { createContext, useContext, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAtom } from 'jotai'
import Cookies from 'js-cookie'
import { 
  useAuthUser, 
  useLogin, 
  useRegister, 
  useLogout, 
  useRefreshToken
} from '@/hooks/authQuery'
import { 
  authUserAtom, 
  authErrorAtom, 
  tokenRefreshIntervalAtom,
  isAuthenticatedAtom 
} from '@/lib/atoms/auth'
import { RegisterData, UserResponse } from '@/types/auth.types'

interface AuthContextType {
  user: UserResponse | null
  loading: boolean
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>
  register: (data: RegisterData) => Promise<void>
  logout: () => Promise<void>
  isAuthenticated: boolean
  checkAuth: () => Promise<void>
  refetchUser: () => Promise<void>
  error: Error | null
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useAtom(authUserAtom)
  const [error, setError] = useAtom(authErrorAtom)
  const [isAuthenticated] = useAtom(isAuthenticatedAtom)
  const [tokenRefreshInterval, setTokenRefreshInterval] = useAtom(tokenRefreshIntervalAtom)
  const router = useRouter()
  const pathname = usePathname()

  // React Query hooks
  const userQuery = useAuthUser()
  const loginMutation = useLogin()
  const registerMutation = useRegister()
  const logoutMutation = useLogout()
  const refreshMutation = useRefreshToken()

  const loading = userQuery.isLoading || userQuery.isFetching || 
                  loginMutation.isPending || registerMutation.isPending || 
                  logoutMutation.isPending

  const clearAuth = useCallback(() => {
    Cookies.remove('access_token')
    Cookies.remove('refresh_token')
    localStorage.removeItem('remember_me')
    setUser(null)
    setError(null)
    
    if (tokenRefreshInterval) {
      clearInterval(tokenRefreshInterval)
      setTokenRefreshInterval(null)
    }
  }, [setUser, setError, tokenRefreshInterval, setTokenRefreshInterval])

  const refreshTokenIfNeeded = useCallback(async () => {
    const token = Cookies.get('access_token')
    const refreshToken = Cookies.get('refresh_token')
    
    if (!token && refreshToken) {
      try {
        await refreshMutation.mutateAsync(refreshToken)
        // Query will auto-refetch after successful token refresh
      } catch (error) {
        console.error('Token refresh failed:', error)
        clearAuth()
      }
    }
  }, [refreshMutation, clearAuth])

  const checkAuth = useCallback(async () => {
    try {
      const token = Cookies.get('access_token')
      const refreshToken = Cookies.get('refresh_token')
      
      if (!token && !refreshToken) {
        setUser(null)
        return
      }

      if (!token && refreshToken) {
        // Try to refresh token
        await refreshTokenIfNeeded()
      }

      // User query will handle fetching user data if token exists
    } catch (error) {
      console.error('Auth check error:', error)
      setError(error as Error)
    }
  }, [setUser, setError, refreshTokenIfNeeded])

  // Set up automatic token refresh on mount
  useEffect(() => {
    checkAuth()
    
    // Set up periodic token refresh every 50 minutes (tokens expire in 60 minutes)
    const interval = setInterval(async () => {
      await refreshTokenIfNeeded()
    }, 50 * 60 * 1000)

    setTokenRefreshInterval(interval)

    return () => {
      if (interval) {
        clearInterval(interval)
        setTokenRefreshInterval(null)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Handle user query data changes
  useEffect(() => {
    if (userQuery.data) {
      setUser(userQuery.data)
      setError(null)
    }
  }, [userQuery.data, setUser, setError])

  // Handle query errors
  useEffect(() => {
    if (userQuery.error) {
      console.error('Auth user query error:', userQuery.error)
      setError(userQuery.error as Error)
      
      // Only clear auth on 401 if we're not on auth pages
      const isAuthPage = pathname?.includes('/login') || 
                        pathname?.includes('/register') || 
                        pathname?.includes('/reset-password') ||
                        pathname?.includes('/verify-email')
      
      if (!isAuthPage && (userQuery.error?.message?.includes('401') || userQuery.error?.message?.includes('Unauthorized'))) {
        clearAuth()
        router.push('/login')
      }
    }
  }, [userQuery.error, setError, pathname, router, clearAuth])

  const login = async (email: string, password: string, rememberMe = false) => {
    try {
      await loginMutation.mutateAsync({ data: { email, password }, rememberMe })
    } catch (error) {
      // Error is already handled in the mutation
      throw error
    }
  }

  const register = async (data: RegisterData) => {
    try {
      await registerMutation.mutateAsync(data)
    } catch (error) {
      // Error is already handled in the mutation
      throw error
    }
  }

  const logout = async () => {
    try {
      await logoutMutation.mutateAsync()
    } catch {
      // Error is already handled in the mutation, but we still clear auth
      clearAuth()
      router.push('/login')
    }
  }

  const refetchUser = async () => {
    await userQuery.refetch()
  }

  const contextValue: AuthContextType = {
    user,
    loading,
    login,
    register,
    logout,
    isAuthenticated,
    checkAuth,
    refetchUser,
    error: error || (loginMutation.error as Error) || (registerMutation.error as Error) || (logoutMutation.error as Error) || null
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}