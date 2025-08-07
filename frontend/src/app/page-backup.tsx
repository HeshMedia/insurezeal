'use client'

import { useAuth } from '@/hooks/useAuth'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getDefaultRedirectPath } from '@/lib/utils/auth'

export default function Home() {
  const { user, loading, userRole } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user && userRole) {
      // Redirect authenticated users to their dashboard
      const redirectPath = getDefaultRedirectPath(userRole)
      router.push(redirectPath)
    }
  }, [user, userRole, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            InsureZeal
          </h1>
          <p className="text-gray-600 mb-8">
            Insurance Management Platform
          </p>
          
          <div className="space-y-4">
            <a 
              href="/login"
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors block text-center"
            >
              Sign In
            </a>
            <a 
              href="/register"
              className="w-full border border-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-50 transition-colors block text-center"
            >
              Create Account
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
