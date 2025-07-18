import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAtom } from 'jotai'
import { useEffect } from 'react'
import { authApi } from '@/lib/api/auth'
import { 
  LoginData, 
  RegisterData, 
  ResetPasswordData,
  ForgotPasswordData,
  UserResponse,
  JWTPayload
} from '@/types/auth.types'
import {
  accessTokenAtom,
  refreshTokenAtom,
  userAtom,
  authErrorAtom,
  lastTokenRefreshAtom,
  tokenRefreshIntervalAtom
} from '@/lib/atoms/auth'
import Cookies from 'js-cookie'
import { useRouter } from 'next/navigation'
import { profileApi } from '@/lib/api/profile'

// Query keys
export const AUTH_QUERY_KEYS = {
  user: ['auth', 'user'] as const,
  profile: ['auth', 'profile'] as const,
} as const

// Helper function to decode JWT and extract role
export const decodeJWTRole = (token: string): string | null => {
  try {
    const base64Payload = token.split('.')[1]
    const payload: JWTPayload = JSON.parse(atob(base64Payload))
    
    // Try to get role from user_metadata first (new format)
    if (payload.user_metadata?.role) {
      return payload.user_metadata.role
    }
    
    // Fallback: This should be handled by the user object from API
    return null
  } catch (error) {
    console.error('Error decoding JWT:', error)
    return null
  }
}

// Helper function to set auth cookies
const setAuthCookies = (tokens: { access_token: string; refresh_token: string }, rememberMe = false) => {
  const accessExpiry = rememberMe ? 30 : 7 // days
  const refreshExpiry = rememberMe ? 365 : 30 // days
  
  Cookies.set('access_token', tokens.access_token, {
    expires: accessExpiry,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  })
  
  Cookies.set('refresh_token', tokens.refresh_token, {
    expires: refreshExpiry,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  })
  
  localStorage.setItem('remember_me', rememberMe.toString())
}

// Helper function to clear auth data
const clearAuthData = () => {
  Cookies.remove('access_token')
  Cookies.remove('refresh_token')
  localStorage.removeItem('remember_me')
}

// User profile query
export const useAuthUser = () => {
  const [, setUser] = useAtom(userAtom)
  const [, setAuthError] = useAtom(authErrorAtom)

  const query = useQuery({
    queryKey: AUTH_QUERY_KEYS.profile,
    queryFn: async () => {
      const token = Cookies.get('access_token')
      if (!token) {
        throw new Error('No access token found')
      }
      
      const profile = await profileApi.getCurrentProfile()
      
      // Convert UserProfile to UserResponse format
      const userResponse: UserResponse = {
        id: profile.id,
        user_id: profile.user_id,
        email: profile.email,
        username: profile.username,
        first_name: profile.first_name,
        last_name: profile.last_name,
        display_name: profile.display_name,
        bio: profile.bio,
        avatar_url: profile.avatar_url,
        date_of_birth: profile.date_of_birth,
        timezone: profile.timezone,
        language: profile.language || 'en',
        preferences: profile.preferences || {},
        created_at: profile.created_at,
        updated_at: profile.updated_at,
        user_role: profile.user_role || 'agent'
      }
      
      return userResponse
    },
    enabled: !!Cookies.get('access_token'),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: (failureCount, error) => {
      // Don't retry on 401 errors
      if (error?.message?.includes('401') || error?.message?.includes('Unauthorized')) {
        return false
      }
      return failureCount < 2
    }
  })

  // Handle success and error in useEffect to avoid React Query v5 deprecation
  useEffect(() => {
    if (query.data) {
      setUser(query.data)
      setAuthError(null)
    }
  }, [query.data, setUser, setAuthError])

  useEffect(() => {
    if (query.error) {
      console.error('Auth user query error:', query.error)
      setAuthError(query.error as Error)
      
      // Clear auth data on 401 errors
      if (query.error?.message?.includes('401') || query.error?.message?.includes('Unauthorized')) {
        clearAuthData()
        setUser(null)
      }
    }
  }, [query.error, setAuthError, setUser])

  return query
}

// Login mutation
export const useLogin = () => {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [, setAccessToken] = useAtom(accessTokenAtom)
  const [, setRefreshToken] = useAtom(refreshTokenAtom)
  const [, setUser] = useAtom(userAtom)
  const [, setAuthError] = useAtom(authErrorAtom)

  return useMutation({
    mutationFn: async ({ data, rememberMe = false }: { data: LoginData; rememberMe?: boolean }) => {
      const response = await authApi.login(data)
      return { ...response, rememberMe }
    },
    onSuccess: (response) => {
      const { access_token, refresh_token, user } = response
      const rememberMe = localStorage.getItem('remember_me') === 'true'

      // Set cookies and atoms
      setAuthCookies({ access_token, refresh_token }, rememberMe)
      setAccessToken(access_token)
      setRefreshToken(refresh_token)
      setUser(user)
      setAuthError(null)

      // Invalidate user query to refetch with new token
      queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEYS.profile })

      // Redirect based on user role
      const role = user.user_role
      if (role === 'superadmin') {
        router.push('/superadmin')
      } else if (role === 'admin') {
        router.push('/admin')
      } else if (role === 'agent') {
        router.push('/agent')
      } else {
        router.push('/')
      }
    },
    onError: (error) => {
      console.error('Login error:', error)
      setAuthError(error as Error)
    }
  })
}

// Register mutation
export const useRegister = () => {
  const router = useRouter()
  const [, setAuthError] = useAtom(authErrorAtom)

  return useMutation({
    mutationFn: async (data: RegisterData) => {
      return await authApi.register(data)
    },
    onSuccess: (response, variables) => {
      // For registration, don't auto-login - redirect to email verification
      // The backend should not return tokens for unverified users
      setAuthError(null)
      
      // Redirect to email verification page with email parameter
      router.push(`/verify-email?email=${encodeURIComponent(variables.email)}`)
    },
    onError: (error) => {
      console.error('Register error:', error)
      setAuthError(error as Error)
    }
  })
}

// Logout mutation
export const useLogout = () => {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [, setAccessToken] = useAtom(accessTokenAtom)
  const [, setRefreshToken] = useAtom(refreshTokenAtom)
  const [, setUser] = useAtom(userAtom)
  const [, setAuthError] = useAtom(authErrorAtom)
  const [, setTokenRefreshInterval] = useAtom(tokenRefreshIntervalAtom)

  return useMutation({
    mutationFn: async () => {
      try {
        await authApi.logout()
      } catch {
        // Continue even if logout fails on server
      }
    },
    onSuccess: () => {
      // Clear auth data from cookies and atoms
      clearAuthData()
      setAccessToken(null)
      setRefreshToken(null)
      setUser(null)
      setAuthError(null)
      
      // Clear refresh interval
      const [interval] = [null] as [NodeJS.Timeout | null]
      if (interval) {
        clearInterval(interval)
        setTokenRefreshInterval(null)
      }
      
      // Clear all queries to remove cached data
      queryClient.clear()
      
      // Redirect to login
      router.push('/login')
    },
    onError: (error) => {
      console.error('Logout error:', error)
      // Still clear auth data even if server logout fails
      clearAuthData()
      setAccessToken(null)
      setRefreshToken(null)
      setUser(null)
      setAuthError(null) // Also clear any errors
      router.push('/login')
    }
  })
}

// Refresh token mutation
export const useRefreshToken = () => {
  const queryClient = useQueryClient()
  const [, setLastRefresh] = useAtom(lastTokenRefreshAtom)
  const [, setAuthError] = useAtom(authErrorAtom)

  return useMutation({
    mutationFn: async (refreshToken: string) => {
      return await authApi.refreshToken(refreshToken)
    },
    onSuccess: (response) => {
      const { access_token, refresh_token } = response
      const rememberMe = localStorage.getItem('remember_me') === 'true'
      
      // Update cookies
      const cookieOptions = {
        expires: rememberMe ? 30 : 7,
        sameSite: 'lax' as const,
        secure: process.env.NODE_ENV === 'production'
      }
      
      Cookies.set('access_token', access_token, cookieOptions)
      if (refresh_token) {
        Cookies.set('refresh_token', refresh_token, {
          ...cookieOptions,
          expires: rememberMe ? 365 : 30
        })
      }
      
      setLastRefresh(Date.now())
      setAuthError(null)
      
      // Invalidate user query to refetch with new token
      queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEYS.profile })
    },
    onError: (error) => {
      console.error('Token refresh error:', error)
      setAuthError(error as Error)
      clearAuthData()
    }
  })
}

// Forgot password mutation
export const useForgotPassword = () => {
  return useMutation({
    mutationFn: async (data: ForgotPasswordData) => {
      return await authApi.forgotPassword(data.email)
    }
  })
}

// Reset password mutation
export const useResetPassword = () => {
  const router = useRouter()
  
  return useMutation({
    mutationFn: async (data: ResetPasswordData) => {
      return await authApi.resetPassword(data)
    },
    onSuccess: () => {
      router.push('/login?message=Password reset successful')
    }
  })
}


