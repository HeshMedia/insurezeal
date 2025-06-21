'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Cookies from 'js-cookie'
import { authApi } from '@/lib/api/auth'
import useUser from '@/hooks/use-user'

interface User {
  id: string
  user_id: string
  email: string
  username?: string
  first_name?: string
  last_name?: string
  user_role: 'admin' | 'agent'
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>
  register: (data: any) => Promise<void>
  logout: () => Promise<void>
  isAuthenticated: boolean
  checkAuth: () => Promise<void>
  refetchUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authLoading, setAuthLoading] = useState(true)
  const router = useRouter()
  
  // Use the custom useUser hook
  const { user: profileUser, loading: userLoading, error: userError, refetch: refetchUser } = useUser()
  
  // Convert profile user to auth user format
  const user: User | null = profileUser ? {
    id: profileUser.id,
    user_id: profileUser.user_id,
    email: profileUser.email,
    username: profileUser.username,
    first_name: profileUser.first_name,
    last_name: profileUser.last_name,
    user_role: (profileUser.user_role as 'admin' | 'agent') || 'agent'
  } : null

  const loading = authLoading || userLoading

  // Check auth on mount and set up token refresh
  useEffect(() => {
    checkAuth()
    
    // Set up periodic token refresh
    const refreshInterval = setInterval(async () => {
      await refreshTokenIfNeeded()
    }, 4 * 60 * 1000) // Check every 4 minutes

    return () => clearInterval(refreshInterval)
  }, [])

  // Handle user errors (like token expiry)
  useEffect(() => {
    if (userError && userError.message.includes('401')) {
      console.log('User fetch failed with 401, clearing auth')
      clearAuth()
    }
  }, [userError])

  const checkAuth = async () => {
    try {
      const token = Cookies.get('access_token')
      const refreshToken = Cookies.get('refresh_token')
      
      console.log('CheckAuth - Token exists:', !!token, 'Refresh exists:', !!refreshToken)
      
      if (!token && refreshToken) {
        console.log('No access token, trying refresh')
        try {
          await authApi.refreshToken(refreshToken)
          // After refresh, useUser hook will automatically refetch
        } catch (refreshError) {
          console.log('Token refresh failed, clearing auth')
          clearAuth()
        }
      } else if (!token && !refreshToken) {
        console.log('No tokens found')
        clearAuth()
      }
    } catch (error) {
      console.error('Auth check failed:', error)
      clearAuth()
    } finally {
      setAuthLoading(false)
    }
  }

  const refreshTokenIfNeeded = async () => {
    const token = Cookies.get('access_token')
    const refreshToken = Cookies.get('refresh_token')
    
    if (!token && refreshToken) {
      try {
        await authApi.refreshToken(refreshToken)
        console.log('Token refreshed successfully')
        // Refetch user data after token refresh
        await refetchUser()
      } catch (error) {
        console.log('Token refresh failed:', error)
        clearAuth()
      }
    }
  }

  const clearAuth = () => {
    Cookies.remove('access_token')
    Cookies.remove('refresh_token')
    localStorage.removeItem('remember_me')
    setAuthLoading(false)
  }

  const login = async (email: string, password: string, rememberMe: boolean = false) => {
    try {
      const response = await authApi.login({ email, password })
      
      // Set cookie expiration based on remember me
      const tokenExpiry = rememberMe ? 30 : 7 // 30 days vs 7 days
      const refreshExpiry = rememberMe ? 365 : 30 // 1 year vs 30 days
      
      Cookies.set('access_token', response.access_token, { 
        expires: tokenExpiry,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production'
      })
      Cookies.set('refresh_token', response.refresh_token, { 
        expires: refreshExpiry,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production'
      })
      
      if (rememberMe) {
        localStorage.setItem('remember_me', 'true')
      }
      
      // Refetch user data after login
      await refetchUser()
      
      // Route based on role
      if (response.user.user_role === 'admin') {
        router.push('/admin')
      } else if (response.user.user_role === 'agent') {
        router.push('/agent')
      } else {
        throw new Error('Invalid user role')
      }
    } catch (error: any) {
      throw new Error(error.message || 'Login failed')
    }
  }

  const register = async (data: any) => {
    try {
      const response = await authApi.register(data)
      
      if (response.access_token) {
        // Store tokens after successful registration
        Cookies.set('access_token', response.access_token, { expires: 7 })
        Cookies.set('refresh_token', response.refresh_token, { expires: 30 })
        
        // Refetch user data after registration
        await refetchUser()
        
        if (response.user.user_role === 'admin') {
          router.push('/admin')
        } else if (response.user.user_role === 'agent') {
          router.push('/agent')
        }
      } else {
        router.push(`/verify-email?email=${encodeURIComponent(data.email)}`)
      }
    } catch (error: any) {
      throw new Error(error.message || 'Registration failed')
    }
  }

  const logout = async () => {
    try {
      await authApi.logout()
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      clearAuth()
      router.push('/login')
    }
  }

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      register,
      logout,
      isAuthenticated: !!user,
      checkAuth,
      refetchUser
    }}>
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
