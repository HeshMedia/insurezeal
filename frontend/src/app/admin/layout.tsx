import { AdminSidebar } from "@/components/admin/sidebar"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"

interface AdminLayoutProps {
  children: React.ReactNode
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <SidebarProvider 
      style={{
        "--sidebar-width": "16rem",
        "--sidebar-width-icon": "4rem",
      } as React.CSSProperties}
    >
      <AdminSidebar />
      <SidebarInset>
        {/* Header with collapse button */}
        <header className="flex h-16 shrink-0 items-center gap-2 px-4 bg-white border-b shadow-sm">
          <SidebarTrigger className="-ml-1 hover:bg-gray-100" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-gray-900">Admin Dashboard</h1>
          </div>
        </header>
        
        {/* Main Content */}
        <div className="flex flex-1 flex-col gap-4 p-6 bg-gray-50">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}