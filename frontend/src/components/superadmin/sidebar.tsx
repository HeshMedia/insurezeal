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
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import Link from "next/link"
import { usePathname } from "next/navigation"

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
  {
    title: "Profile",
    url: "/superadmin/profile",
    icon: User,
  },
]

export function SuperAdminSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar variant="inset">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Super Admin</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {superAdminNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={pathname === item.url}>
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
