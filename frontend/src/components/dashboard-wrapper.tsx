'use client'

import Loading from '@/app/loading'
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
    return <Loading />
  }

  if (!isAuthenticated || userRole !== requiredRole) {
    return null
  }

  return <>{children}</>
}
