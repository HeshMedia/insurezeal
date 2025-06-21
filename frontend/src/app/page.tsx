'use client'

import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function Home() {
  const { user, loading, checkAuth } = useAuth()
  const router = useRouter()

  useEffect(() => {
    const handleRouting = async () => {
      if (loading) return

      // If no user, try to check auth again (in case of page refresh)
      if (!user) {
        await checkAuth()
        return
      }

      // Route based on user role
      if (user.user_role === 'admin') {
        router.replace('/admin')
      } else if (user.user_role === 'agent') {
        router.replace('/agent')
      } else {
        router.replace('/login')
      }
    }

    handleRouting()
  }, [user, loading, router, checkAuth])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">InsureZeal</h1>
        <p className="text-gray-600">Redirecting...</p>
      </div>
    </div>
  )
}
