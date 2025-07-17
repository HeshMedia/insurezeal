"use client"

import { Button } from "@/components/ui/button"
import { LogOut } from "lucide-react"
import { useLogout } from "@/hooks/authQuery"
import { SidebarTrigger } from "@/components/ui/sidebar"

export function SuperAdminHeader() {
  const logoutMutation = useLogout()

  const handleLogout = () => {
    logoutMutation.mutate()
  }

  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-2 px-4 bg-white border-b border-gray-100">
      <div className="flex items-center gap-3">
        <SidebarTrigger className="-ml-1 hover:bg-gray-50 rounded-md p-1.5" />
        <div className="h-3 w-px bg-gray-200" />
        <h1 className="text-sm font-medium text-gray-700">Super Admin Dashboard</h1>
      </div>
      
      <Button 
        onClick={handleLogout}
        variant="ghost"
        size="sm"
        className="h-7 px-2.5 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors"
      >
        <LogOut className="h-3 w-3 mr-1" />
        Logout
      </Button>
    </header>
  )
}
