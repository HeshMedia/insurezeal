'use client'

import { DashboardWrapper } from '@/components/dashboard-wrapper'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { User, Mail, Calendar, Shield } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { useProfile } from "@/hooks/profileQuery"

export default function ProfilePage() {
  const { user } = useAuth()
  const { data: profile } = useProfile()

  const getInitials = (firstName?: string, lastName?: string, username?: string) => {
    if (firstName && lastName) {
      return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
    }
    if (firstName) {
      return firstName.charAt(0).toUpperCase()
    }
    if (username) {
      return username.charAt(0).toUpperCase()
    }
    return 'SA'
  }
  
  const getDisplayName = () => {
    if (user?.first_name && user?.last_name) {
      return `${user.first_name} ${user.last_name}`
    }
    if (user?.first_name) {
      return user.first_name
    }
    return user?.username || 'Super Admin'
  }

  return (
    <DashboardWrapper requiredRole="admin">
      <div className="space-y-6">
        {/* Page Header */}
        <div className="bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <User className="h-8 w-8" />
            <div>
              <h1 className="text-2xl font-bold">Profile</h1>
              <p className="text-red-100 text-sm">
                Manage your account settings and information
              </p>
            </div>
          </div>
        </div>

        {/* Profile Info */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Card */}
          <Card className="border border-gray-200 shadow-sm">
            <CardHeader className="text-center">
              <div className="flex flex-col items-center space-y-4">
                <Avatar className="h-24 w-24 ring-4 ring-red-100">
                  <AvatarImage 
                    src={profile?.avatar_url} 
                    alt={getDisplayName()}
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-gradient-to-br from-red-600 to-red-700 text-white text-xl font-bold">
                    {getInitials(user?.first_name, user?.last_name, user?.username)}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  <CardTitle className="text-xl font-bold text-gray-900">
                    {getDisplayName()}
                  </CardTitle>
                  <Badge variant="secondary" className="bg-red-100 text-red-700 border-red-200">
                    Super Admin
                  </Badge>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Account Details */}
          <Card className="lg:col-span-2 border border-gray-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Shield className="h-5 w-5 text-red-600" />
                Account Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-500 flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Full Name
                  </label>
                  <p className="text-gray-900 font-medium">
                    {getDisplayName()}
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-500 flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email Address
                  </label>
                  <p className="text-gray-900 font-medium">
                    {user?.email || 'Not provided'}
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-500">
                    Username
                  </label>
                  <p className="text-gray-900 font-medium">
                    {user?.username || 'Not provided'}
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-500">
                    Role
                  </label>
                  <Badge variant="secondary" className="bg-red-100 text-red-700 border-red-200">
                    Super Administrator
                  </Badge>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-500 flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Account Created
                  </label>
                  <p className="text-gray-900 font-medium">
                    Recently
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-500">
                    Status
                  </label>
                  <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">
                    Active
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Permissions */}
        <Card className="border border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Shield className="h-5 w-5 text-green-600" />
              Permissions & Access
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { name: 'Broker Management', granted: true },
                { name: 'Insurer Management', granted: true },
                { name: 'Child ID Management', granted: true },
                { name: 'System Settings', granted: true },
                { name: 'User Management', granted: true },
                { name: 'API Access', granted: true },
                { name: 'Database Management', granted: true },
                { name: 'Platform Administration', granted: true },
              ].map((permission) => (
                <div key={permission.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">{permission.name}</span>
                  <Badge 
                    variant="secondary" 
                    className={permission.granted 
                      ? "bg-green-100 text-green-700 border-green-200" 
                      : "bg-gray-100 text-gray-700 border-gray-200"
                    }
                  >
                    {permission.granted ? 'Granted' : 'Denied'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardWrapper>
  )
}
