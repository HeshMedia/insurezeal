'use client'

import { DashboardWrapper } from '@/components/dashboard-wrapper'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Settings, Database, Users, Shield } from "lucide-react"

export default function SettingsPage() {
  return (
    <DashboardWrapper requiredRole="admin">
      <div className="space-y-6">
        {/* Page Header */}
        <div className="bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <Settings className="h-8 w-8" />
            <div>
              <h1 className="text-2xl font-bold">Settings</h1>
              <p className="text-red-100 text-sm">
                Configure system settings and preferences
              </p>
            </div>
          </div>
        </div>

        {/* Settings Sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* System Settings */}
          <Card className="border border-gray-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-600" />
                System Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h3 className="font-medium text-gray-900">Platform Configuration</h3>
                <p className="text-sm text-gray-600">
                  Manage core platform settings and configurations
                </p>
              </div>
              <div className="text-sm text-gray-500">
                Coming soon...
              </div>
            </CardContent>
          </Card>

          {/* User Management */}
          <Card className="border border-gray-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Users className="h-5 w-5 text-green-600" />
                User Management
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h3 className="font-medium text-gray-900">Access Control</h3>
                <p className="text-sm text-gray-600">
                  Manage user roles and permissions
                </p>
              </div>
              <div className="text-sm text-gray-500">
                Coming soon...
              </div>
            </CardContent>
          </Card>

          {/* Database Settings */}
          <Card className="border border-gray-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Database className="h-5 w-5 text-purple-600" />
                Database Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h3 className="font-medium text-gray-900">Data Management</h3>
                <p className="text-sm text-gray-600">
                  Configure database settings and maintenance
                </p>
              </div>
              <div className="text-sm text-gray-500">
                Coming soon...
              </div>
            </CardContent>
          </Card>

          {/* API Settings */}
          <Card className="border border-gray-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Settings className="h-5 w-5 text-orange-600" />
                API Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h3 className="font-medium text-gray-900">External Integrations</h3>
                <p className="text-sm text-gray-600">
                  Manage API keys and external service configurations
                </p>
              </div>
              <div className="text-sm text-gray-500">
                Coming soon...
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardWrapper>
  )
}
