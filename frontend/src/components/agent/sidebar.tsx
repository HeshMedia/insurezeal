"use client"

import { 
  BarChart3,  
  Shield, 
  User, 
  CheckCircle
} from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useAtom } from "jotai"
import { userAtom } from "@/lib/atoms/auth"
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

const agentNavItems = [
  {
    title: "Dashboard",
    url: "/agent",
    icon: BarChart3,
  },
  {
    title: "Child ID",
    url: "/agent/child-id",
    icon: CheckCircle,
  },

  {
    title: "Policies",
    url: "/agent/policies",
    icon: Shield,
  },
  {
    title: "Profile",
    url: "/agent/profile",
    icon: User,
  },
]

export function AgentSidebar({ ...props }) {
  const [user] = useAtom(userAtom)
  const { data: profile } = useProfile()
  const router = useRouter()
  const pathname = usePathname()

  const handleProfileClick = () => {
    router.push('/agent/profile')
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
    return 'A'
  }

  const getDisplayName = () => {
    if (user?.first_name && user?.last_name) {
      return `${user.first_name} ${user.last_name}`
    }
    if (user?.first_name) {
      return user.first_name
    }
    return user?.username || 'Agent User'
  }
  
  return (
    <Sidebar 
      collapsible="icon" 
      className="border-r border-gray-200 bg-white"
      {...props}
    >
      <SidebarHeader className="border-b border-gray-200 p-4">
        <div className="flex items-center gap-3">
          <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-sm shrink-0">
            <Shield className="size-4" />
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight min-w-0">
            <span className="truncate font-semibold text-gray-900">Agent Portal</span>
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
              {agentNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={pathname === item.url}
                    tooltip={item.title}
                    className="h-7 px-2 hover:bg-blue-50 hover:text-blue-900 data-[active=true]:bg-blue-100 data-[active=true]:text-blue-900 data-[active=true]:font-medium transition-all duration-200 rounded-md"
                  >
                    <Link href={item.url} className="flex items-center gap-2.5">
                      <item.icon className="size-4 shrink-0 text-blue-600" />
                      <span className="font-medium text-sm truncate">{item.title}</span>
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
              <Avatar className="h-7 w-7 rounded-md ring-1 ring-gray-200 shrink-0">
                <AvatarImage 
                  src={profile?.avatar_url} 
                  alt={getDisplayName()}
                  className="object-cover"
                />
                <AvatarFallback className="bg-gradient-to-br from-blue-600 to-blue-700 text-white text-xs font-medium rounded-md">
                  {getInitials(user?.first_name, user?.last_name, user?.username)}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight min-w-0">
                <span className="truncate font-medium text-gray-900">
                  {getDisplayName()}
                </span>
                <span className="truncate text-xs text-gray-500">
                  {user?.email || 'agent@company.com'}
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
