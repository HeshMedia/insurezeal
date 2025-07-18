'use client'

import { useAtom } from 'jotai'
import { userAtom } from '@/lib/atoms/auth'
import { useAuthUser } from '@/hooks/authQuery'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

interface DashboardWrapperProps {
  children: React.ReactNode
  requiredRole: 'admin' | 'agent' | 'superadmin'
}

export function DashboardWrapper({ children, requiredRole }: DashboardWrapperProps) {
  const [user] = useAtom(userAtom)
  const { isLoading, isFetching } = useAuthUser()
  const loading = isLoading || isFetching
  const router = useRouter()

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login')
        return
      }

      if (user.user_role !== requiredRole) {
        // Redirect to their correct dashboard
        if (user.user_role === 'admin') {
          router.push('/admin')
        } else if (user.user_role === 'agent') {
          router.push('/agent')
        } else if (user.user_role === 'superadmin') {
          router.push('/superadmin')
        }
        return
      }
    }
  }, [user, loading, requiredRole, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  if (!user || user.user_role !== requiredRole) {
    return null
  }

  return <>{children}</>
}
