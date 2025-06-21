'use client'

import { DashboardWrapper } from '@/components/dashboard-wrapper'
import { useAuth } from '@/lib/auth-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users, FileText, BarChart3, Shield } from 'lucide-react'

export default function AdminDashboard() {
  const { user } = useAuth()

  const stats = [
    {
      title: "Total Users",
      value: "1,234",
      description: "Active users in system",
      icon: Users,
      change: "+12%",
      changeType: "positive" as const,
    },
    {
      title: "Active Policies",
      value: "856",
      description: "Policies currently active",
      icon: Shield,
      change: "+8%",
      changeType: "positive" as const,
    },
    {
      title: "Monthly Reports",
      value: "42",
      description: "Reports generated this month",
      icon: FileText,
      change: "+23%",
      changeType: "positive" as const,
    },
    {
      title: "Revenue",
      value: "$54,321",
      description: "Total revenue this month",
      icon: BarChart3,
      change: "+15%",
      changeType: "positive" as const,
    },
  ]

  return (
    <DashboardWrapper requiredRole="admin">
      <div className="space-y-6">
        {/* Welcome Section */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Welcome back, {user?.first_name || user?.username}!</h1>
          <p className="text-muted-foreground">
            Here's what's happening with your insurance platform today.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                  <span>{stat.description}</span>
                  <Badge 
                    variant={stat.changeType === 'positive' ? 'default' : 'destructive'}
                    className="text-xs"
                  >
                    {stat.change}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Recent Activity */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="col-span-4">
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>
                Latest activities in your admin panel.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center">
                  <div className="ml-4 space-y-1">
                    <p className="text-sm font-medium leading-none">
                      New user registration
                    </p>
                    <p className="text-sm text-muted-foreground">
                      John Doe registered 2 minutes ago
                    </p>
                  </div>
                  <div className="ml-auto font-medium">Just now</div>
                </div>
                <div className="flex items-center">
                  <div className="ml-4 space-y-1">
                    <p className="text-sm font-medium leading-none">
                      Policy claim submitted
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Claim #12345 for review
                    </p>
                  </div>
                  <div className="ml-auto font-medium">5m ago</div>
                </div>
                <div className="flex items-center">
                  <div className="ml-4 space-y-1">
                    <p className="text-sm font-medium leading-none">
                      Monthly report generated
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Insurance report for November
                    </p>
                  </div>
                  <div className="ml-auto font-medium">1h ago</div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="col-span-3">
            <CardHeader>
              <CardTitle>Quick Stats</CardTitle>
              <CardDescription>
                Your admin performance overview.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Active Sessions</span>
                  <span className="text-sm font-bold">23</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Pending Approvals</span>
                  <span className="text-sm font-bold">7</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">System Health</span>
                  <Badge variant="default">Excellent</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Last Backup</span>
                  <span className="text-sm text-muted-foreground">2h ago</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardWrapper>
  )
}
