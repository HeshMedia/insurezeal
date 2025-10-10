import { useEffect, useState } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { createClient } from '@/lib/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { getUserRole, getDefaultRedirectPath } from '@/lib/utils/auth'
import { signOut } from '@/lib/utils/supabase/auth'
import { useMutation, useQueryClient } from '@tanstack/react-query'

interface UserProfile {
  id: string
  email: string | undefined
  username?: string
  first_name?: string
  last_name?: string
  role: string
  avatar_url?: string
  created_at: string
  updated_at?: string
}

/**
 * Hook to get current auth state with real-time updates
 */
export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    }

    getInitialSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email)
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [supabase.auth])

  const userRole = getUserRole(user)

  return {
    user,
    session,
    loading,
    userRole,
    isAuthenticated: !!user,
  }
}

/**
 * Hook to handle redirects based on authentication state
 */
export function useAuthRedirect() {
  const { user, loading, userRole } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading) {
      if (user && userRole) {
        const currentPath = window.location.pathname
        
        // If user is on auth pages, redirect to dashboard
        if (['/login', '/register', '/verify-email'].includes(currentPath)) {
          const defaultPath = getDefaultRedirectPath(userRole)
          router.push(defaultPath)
        }
      } else if (!user) {
        const currentPath = window.location.pathname
        
        // If user is not authenticated and on protected route, redirect to login
        const publicRoutes = ['/', '/login', '/register', '/reset-password', '/verify-email', '/verify-email/success', '/auth/confirm', '/error']
        if (!publicRoutes.includes(currentPath) && !currentPath.startsWith('/auth/')) {
          router.push('/login')
        }
      }
    }
  }, [user, loading, userRole, router])

  return { user, loading, userRole }
}

/**
 * Hook to require authentication for a page
 */
export function useRequireAuth(requiredRole?: string) {
  const { user, loading, userRole } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login')
        return
      }

      if (requiredRole && userRole !== requiredRole) {
        // Redirect to appropriate dashboard if user doesn't have required role
        const defaultPath = userRole ? getDefaultRedirectPath(userRole) : '/login'
        router.push(defaultPath)
        return
      }
    }
  }, [user, loading, userRole, requiredRole, router])

  return {
    user,
    userRole,
    loading,
    isAuthenticated: !!user && (!requiredRole || userRole === requiredRole),
  }
}

/**
 * Hook for extracting role from JWT token (Supabase format)
 */
export function useUserRole() {
  const { user } = useAuth()
  return getUserRole(user)
}

/**
 * Hook to get user profile data from Supabase
 */
export function useProfile() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function getProfile() {
      if (!user) {
        setProfile(null)
        setLoading(false)
        return
      }

      try {
        // You can extend this to fetch from your profiles table
        // For now, we'll use the user metadata
        setProfile({
          id: user.id,
          email: user.email,
          username: user.user_metadata?.username,
          first_name: user.user_metadata?.first_name,
          last_name: user.user_metadata?.last_name,
          role: user.user_metadata?.role || user.app_metadata?.role || 'agent',
          avatar_url: user.user_metadata?.avatar_url,
          created_at: user.created_at,
          updated_at: user.updated_at,
        })
      } catch (error) {
        console.error('Error fetching profile:', error)
      } finally {
        setLoading(false)
      }
    }

    getProfile()
  }, [user, supabase])

  return { profile, loading }
}

/**
 * Hook for logout functionality
 */
export function useLogout() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const logout = async () => {
    setIsLoading(true)
    try {
      const result = await signOut()

      if (result?.error) {
        console.warn('Logout error:', result.error)
        router.push('/login')
      }
      // On success, signOut already triggers a redirect to login
    } catch (error) {
      console.error('Logout error:', error)
      // Even if logout fails, redirect to login
      router.push('/login')
    } finally {
      setIsLoading(false)
    }
  }

  return { logout, isLoading }
}

// ===== REACT QUERY MUTATIONS =====

/**
 * Login mutation with React Query
 */
export const useLogin = () => {
  const router = useRouter()
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      const userRole = getUserRole(data.user)
      const redirectPath = userRole ? getDefaultRedirectPath(userRole) : '/'
      
      // Invalidate all queries to refresh data
      queryClient.invalidateQueries()
      
      router.push(redirectPath)
    },
    onError: (error) => {
      console.error('Login error:', error)
    }
  })
}

/**
 * Register mutation with React Query
 */
export const useRegister = () => {
  const router = useRouter()
  const supabase = createClient()

  return useMutation({
    mutationFn: async ({ 
      email, 
      password, 
      username, 
      first_name, 
      last_name 
    }: { 
      email: string
      password: string
      username: string
      first_name?: string
      last_name?: string 
    }) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
            first_name,
            last_name,
            role: 'agent' // Default role
          }
        }
      })

      if (error) throw error
      return data
    },
    onSuccess: (data, variables) => {
      router.push(`/verify-email?email=${encodeURIComponent(variables.email)}`)
    },
    onError: (error) => {
      console.error('Register error:', error)
    }
  })
}

/**
 * Logout mutation with React Query
 */
export const useLogoutMutation = () => {
  const router = useRouter()
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    },
    onSuccess: () => {
      // Clear all queries
      queryClient.clear()
      router.push('/login')
    },
    onError: (error) => {
      console.error('Logout error:', error)
      // Even if logout fails, redirect to login
      queryClient.clear()
      router.push('/login')
    }
  })
}

/**
 * Forgot password mutation with React Query
 */
export const useForgotPassword = () => {
  const supabase = createClient()

  return useMutation({
    mutationFn: async ({ email }: { email: string }) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      
      if (error) throw error
    },
    onError: (error) => {
      console.error('Forgot password error:', error)
    }
  })
}

/**
 * Reset password mutation with React Query
 */
export const useResetPassword = () => {
  const router = useRouter()
  const supabase = createClient()

  return useMutation({
    mutationFn: async ({ password }: { password: string }) => {
      const { error } = await supabase.auth.updateUser({
        password: password
      })
      
      if (error) throw error
    },
    onSuccess: () => {
      router.push('/login?message=Password reset successful')
    },
    onError: (error) => {
      console.error('Reset password error:', error)
    }
  })
}

/**
 * Resend verification email mutation
 */
export const useResendVerification = () => {
  const supabase = createClient()

  return useMutation({
    mutationFn: async ({ email }: { email: string }) => {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email
      })
      
      if (error) throw error
    },
    onError: (error) => {
      console.error('Resend verification error:', error)
    }
  })
}
