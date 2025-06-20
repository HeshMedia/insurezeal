'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { authApi } from '@/lib/api/auth'
import Cookies from 'js-cookie'

interface User {
  id: string
  user_id: string
  email: string
  username: string
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const token = Cookies.get('access_token')
      if (token) {
        const userData = await authApi.getCurrentUser()
        setUser(userData)
      }
    } catch (error) {
      console.error('Auth check failed:', error)
      Cookies.remove('access_token')
      Cookies.remove('refresh_token')
    } finally {
      setLoading(false)
    }
  }
  const login = async (email: string, password: string, rememberMe: boolean = false) => {
    try {
      const response = await authApi.login({ email, password })
      
      // Set cookie expiration based on remember me
      if (rememberMe) {
        // Store tokens for longer period
        Cookies.set('access_token', response.access_token, { expires: 30 })
        Cookies.set('refresh_token', response.refresh_token, { expires: 365 })
        localStorage.setItem('remember_me', 'true')
      } else {
        // Session cookies (expire when browser closes)
        Cookies.set('access_token', response.access_token)
        Cookies.set('refresh_token', response.refresh_token)
        localStorage.removeItem('remember_me')
      }
      
      setUser(response.user as User)
      
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
        setUser(response.user as User)
        
        if (response.user.user_role === 'admin') {
          router.push('/admin')
        } else if (response.user.user_role === 'agent') {
          router.push('/agent')
        }
      } else {
        // Redirect to verify email with email parameter
        router.push(`/verify-email?email=${encodeURIComponent(data.email)}`)
      }
    } catch (error: any) {
      throw new Error(error.message || 'Registration failed')
    }
  }

  const logout = async () => {
    try {
      await authApi.logout()
      // Clear remember me preference
      localStorage.removeItem('remember_me')
      setUser(null)
      router.push('/login')
    } catch (error) {
      console.error('Logout error:', error)
      // Force logout even if backend call fails
      Cookies.remove('access_token')
      Cookies.remove('refresh_token')
      localStorage.removeItem('remember_me')
      setUser(null)
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
      isAuthenticated: !!user
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
