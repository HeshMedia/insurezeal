"use client"

import { Button } from "@/components/ui/button"
import { LogOut } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { SidebarTrigger } from "@/components/ui/sidebar"

export function AdminHeader() {
  const { logout } = useAuth()

  const handleLogout = async () => {
    await logout()
  }

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-2 px-4 bg-white border-b shadow-sm">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="-ml-1 hover:bg-gray-100" />
        <h1 className="text-lg font-semibold text-gray-900">Admin Dashboard</h1>
      </div>
      
      <Button 
        onClick={handleLogout}
        variant="outline"
        size="sm"
        className="flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 hover:border-red-300 transition-colors"
      >
        <LogOut className="h-4 w-4" />
        Logout
      </Button>
    </header>
  )
}
