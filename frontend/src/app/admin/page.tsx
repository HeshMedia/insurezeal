'use client'

import { DashboardWrapper } from '@/components/dashboard-wrapper'
import { useAuth } from '@/lib/auth-context'

export default function AdminDashboard() {
  const { user, logout } = useAuth()

  return (
    <DashboardWrapper requiredRole="admin">
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <h1 className="text-xl font-semibold">Admin Dashboard</h1>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-700">Welcome, {user?.first_name || user?.username}</span>
                <button
                  onClick={logout}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="border-4 border-dashed border-gray-200 rounded-lg h-96 flex items-center justify-center">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Admin Dashboard</h2>
                <p className="text-gray-600">Welcome to the admin panel. You have admin privileges.</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </DashboardWrapper>
  )
}
