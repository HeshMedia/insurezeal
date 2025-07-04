"use client"

import * as React from "react"
import { User, Settings, BarChart3, Users, FileText, Shield, DollarSign, MessageSquare, Database } from "lucide-react"
import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { useProfile } from "@/hooks/profileQuery"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"

const navigationItems = [
  {
    title: "Dashboard",
    url: "/admin",
    icon: BarChart3,
  },
  {
    title: "Agents",
    url: "/admin/agents",
    icon: Users,
  },
  {
    title: "Child Requests",
    url: "/admin/child-requests",
    icon: MessageSquare,
  },
  {
    title: "CutPay",
    url: "/admin/cutpay",
    icon: DollarSign,
  },
  {
    title: "Universal Records",
    url: "/admin/universal-records",
    icon: Database,
  },
  {
    title: "Reports",
    url: "/admin/reports",
    icon: FileText,
  },
  {
    title: "Settings",
    url: "/admin/settings",
    icon: Settings,
  },
]

export function AdminSidebar({ ...props }) {
  const { user } = useAuth()
  const { data: profile } = useProfile()
  const router = useRouter()
  const pathname = usePathname()

  const handleProfileClick = () => {
    router.push('/admin/profile')
  }

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
    return 'U'
  }
  const getDisplayName = () => {
    if (user?.first_name && user?.last_name) {
      return `${user.first_name} ${user.last_name}`
    }
    if (user?.first_name) {
      return user.first_name
    }
    return user?.username || 'Admin User'
  }
  
  return (
    <Sidebar 
      collapsible="icon" 
      className="border-r border-gray-200 bg-white"
      {...props}
    >
      <SidebarHeader className="border-b border-gray-200 p-4">
        <div className="flex items-center gap-3">
          <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-gradient-to-br from-slate-700 to-slate-800 text-white shadow-sm shrink-0">
            <Shield className="size-4" />
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight min-w-0">
            <span className="truncate font-semibold text-gray-900">Admin Panel</span>
            <span className="truncate text-xs text-gray-500">Insurance Management</span>
          </div>
        </div>
      </SidebarHeader>
        <SidebarContent className="p-3">
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 px-2">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5">
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={pathname === item.url}
                    tooltip={item.title}
                    className="h-7 px-2 hover:bg-gray-50 hover:text-gray-900 data-[active=true]:bg-slate-100 data-[active=true]:text-slate-900 data-[active=true]:font-medium transition-all duration-200 rounded-md"
                  >
                    <Link href={item.url} className="flex items-center gap-2.5">
                      <item.icon className="size-4 shrink-0 text-slate-600" />
                      <span className="font-medium text-sm truncate">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>      <SidebarFooter className="border-t border-gray-200 p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton 
              onClick={handleProfileClick}
              size="lg"
              className="h-10 px-2 data-[state=open]:bg-gray-50 data-[state=open]:text-gray-900 hover:bg-gray-50 transition-all duration-200 flex items-center gap-2.5 rounded-md"
              tooltip={`Profile - ${getDisplayName()}`}
            >
              <Avatar className="h-7 w-7 rounded-md ring-1 ring-gray-200 shrink-0">
                <AvatarImage 
                  src={profile?.avatar_url} 
                  alt={getDisplayName()}
                  className="object-cover"
                />
                <AvatarFallback className="bg-gradient-to-br from-slate-700 to-slate-800 text-white text-xs font-medium rounded-md">
                  {getInitials(user?.first_name, user?.last_name, user?.username)}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight min-w-0">
                <span className="truncate font-medium text-gray-900">
                  {getDisplayName()}
                </span>
                <span className="truncate text-xs text-gray-500">
                  {user?.email || 'admin@company.com'}
                </span>
              </div>
              <User className="ml-auto size-3.5 text-gray-400 shrink-0" />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      
      <SidebarRail />
    </Sidebar>
  )
}