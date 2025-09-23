'use client'

import { DashboardWrapper } from '@/components/dashboard-wrapper'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Settings, Database, Users, Shield, Crown, UserPlus } from "lucide-react"
import SuperadminUserControl from '@/components/superadmin/superadmin-user-control'

export default function SettingsPage() {
  return (
    <DashboardWrapper requiredRole="superadmin">
      <div className="space-y-6">
        {/* Page Header */}
        <div className="bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <Settings className="h-8 w-8" />
            <div>
              <h1 className="text-2xl font-bold">SuperAdmin Settings</h1>
              <p className="text-red-100 text-sm">
                Configure system settings and manage platform users
              </p>
            </div>
          </div>
        </div>

        {/* Tabbed Interface */}
        <Tabs defaultValue="user-management" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="user-management" className="flex items-center gap-2">
              <Crown className="h-4 w-4" />
              User Management
            </TabsTrigger>
            <TabsTrigger value="system" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              System
            </TabsTrigger>
            <TabsTrigger value="database" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              Database
            </TabsTrigger>
            <TabsTrigger value="api" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              API
            </TabsTrigger>
            <TabsTrigger value="permissions" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Permissions
            </TabsTrigger>
          </TabsList>

          {/* User Management Tab */}
          <TabsContent value="user-management" className="mt-6">
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-blue-800 mb-2">
                  <UserPlus className="h-5 w-5" />
                  <h3 className="font-semibold">Agent Promotion Management</h3>
                </div>
                <p className="text-sm text-blue-700">
                  Promote agents to admin role and manage user permissions. 
                  Admins can access administrative features and manage other agents.
                </p>
              </div>
              
              <SuperadminUserControl />
            </div>
          </TabsContent>

          {/* System Settings Tab */}
          <TabsContent value="system" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="border border-gray-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Shield className="h-5 w-5 text-blue-600" />
                    Platform Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <h3 className="font-medium text-gray-900">Core Settings</h3>
                    <p className="text-sm text-gray-600">
                      Manage core platform settings and configurations
                    </p>
                  </div>
                  <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded-md">
                    Coming soon...
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-gray-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Settings className="h-5 w-5 text-green-600" />
                    System Monitoring
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <h3 className="font-medium text-gray-900">Health Checks</h3>
                    <p className="text-sm text-gray-600">
                      Monitor system health and performance metrics
                    </p>
                  </div>
                  <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded-md">
                    Coming soon...
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Database Settings Tab */}
          <TabsContent value="database" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="border border-gray-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Database className="h-5 w-5 text-purple-600" />
                    Data Management
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <h3 className="font-medium text-gray-900">Database Operations</h3>
                    <p className="text-sm text-gray-600">
                      Configure database settings and maintenance tasks
                    </p>
                  </div>
                  <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded-md">
                    Coming soon...
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-gray-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Database className="h-5 w-5 text-indigo-600" />
                    Backup & Recovery
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <h3 className="font-medium text-gray-900">Data Protection</h3>
                    <p className="text-sm text-gray-600">
                      Manage database backups and recovery procedures
                    </p>
                  </div>
                  <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded-md">
                    Coming soon...
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* API Settings Tab */}
          <TabsContent value="api" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                  <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded-md">
                    Coming soon...
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-gray-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Shield className="h-5 w-5 text-red-600" />
                    API Security
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <h3 className="font-medium text-gray-900">Rate Limiting & Auth</h3>
                    <p className="text-sm text-gray-600">
                      Configure API security settings and rate limits
                    </p>
                  </div>
                  <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded-md">
                    Coming soon...
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Permissions Tab */}
          <TabsContent value="permissions" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="border border-gray-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Users className="h-5 w-5 text-green-600" />
                    Role Management
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <h3 className="font-medium text-gray-900">User Roles</h3>
                    <p className="text-sm text-gray-600">
                      Define and manage user roles and their capabilities
                    </p>
                  </div>
                  <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded-md">
                    Coming soon...
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-gray-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Shield className="h-5 w-5 text-yellow-600" />
                    Access Control
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <h3 className="font-medium text-gray-900">Permissions Matrix</h3>
                    <p className="text-sm text-gray-600">
                      Fine-grained permission control for different features
                    </p>
                  </div>
                  <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded-md">
                    Coming soon...
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardWrapper>
  )
}
