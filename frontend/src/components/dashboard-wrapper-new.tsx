'use client'

import { useRequireAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

interface DashboardWrapperProps {
  children: React.ReactNode
  requiredRole: 'admin' | 'agent' | 'superadmin'
}

export function DashboardWrapper({ children, requiredRole }: DashboardWrapperProps) {
  const { userRole, loading, isAuthenticated } = useRequireAuth(requiredRole)
  const router = useRouter()

  useEffect(() => {
    if (!loading) {
      if (!isAuthenticated) {
        router.push('/login')
        return
      }

      if (userRole !== requiredRole && userRole) {
        // Redirect to their correct dashboard
        if (userRole === 'admin') {
          router.push('/admin')
        } else if (userRole === 'agent') {
          router.push('/agent')
        } else if (userRole === 'superadmin') {
          router.push('/superadmin')
        }
        return
      }
    }
  }, [isAuthenticated, userRole, loading, requiredRole, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  if (!isAuthenticated || userRole !== requiredRole) {
    return null
  }

  return <>{children}</>
}
