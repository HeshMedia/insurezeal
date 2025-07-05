"use client"

import {
  BarChart3,
  Building,
  Settings,
  Shield,
  User,
  Users,
} from "lucide-react"

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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { useProfile } from "@/hooks/profileQuery"

const superAdminNavItems = [
  {
    title: "Dashboard",
    url: "/superadmin",
    icon: BarChart3,
  },
  {
    title: "Brokers",
    url: "/superadmin/brokers",
    icon: Users,
  },
  {
    title: "Insurers",
    url: "/superadmin/insurers",
    icon: Building,
  },
  {
    title: "Admin Child IDs",
    url: "/superadmin/admin-child-ids",
    icon: Shield,
  },
  {
    title: "Settings",
    url: "/superadmin/settings",
    icon: Settings,
  },
]

export function SuperAdminSidebar({ ...props }) {
  const { user } = useAuth()
  const { data: profile } = useProfile()
  const router = useRouter()
  const pathname = usePathname()

  const handleProfileClick = () => {
    router.push('/superadmin/profile')
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
    <Sidebar 
      collapsible="icon" 
      className="border-r border-gray-200 bg-white"
      {...props}
    >
      <SidebarHeader className="border-b border-gray-200 p-4">
        <div className="flex items-center gap-3">
          <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-gradient-to-br from-red-600 to-red-700 text-white shadow-sm shrink-0">
            <Shield className="size-4" />
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight min-w-0">
            <span className="truncate font-semibold text-gray-900">Super Admin</span>
            <span className="truncate text-xs text-gray-500">System Management</span>
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
              {superAdminNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={pathname === item.url}
                    className="h-9 px-2 data-[state=open]:bg-red-50 data-[state=open]:text-red-900 hover:bg-red-50 hover:text-red-900 transition-all duration-200 data-[active=true]:bg-red-100 data-[active=true]:text-red-900 data-[active=true]:font-medium"
                    tooltip={item.title}
                  >
                    <Link href={item.url} className="flex items-center gap-2.5 w-full">
                      <item.icon className="size-4 shrink-0" />
                      <span className="truncate">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarFooter className="border-t border-gray-200 p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton 
              onClick={handleProfileClick}
              size="lg"
              className="h-10 px-2 data-[state=open]:bg-gray-50 data-[state=open]:text-gray-900 hover:bg-gray-50 transition-all duration-200 flex items-center gap-2.5 rounded-md"
              tooltip={`Profile - ${getDisplayName()}`}
            >
              <Avatar className="h-6 w-6 shrink-0">
                <AvatarImage 
                  src={profile?.avatar_url} 
                  alt={getDisplayName()}
                  className="object-cover"
                />
                <AvatarFallback className="bg-gradient-to-br from-red-600 to-red-700 text-white text-xs font-medium">
                  {getInitials(user?.first_name, user?.last_name, user?.username)}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight min-w-0">
                <span className="truncate font-medium text-gray-900">{getDisplayName()}</span>
                <span className="truncate text-xs text-gray-500">Super Admin</span>
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
