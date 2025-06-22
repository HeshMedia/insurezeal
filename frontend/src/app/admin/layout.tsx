import { AdminSidebar } from "@/components/admin/sidebar"
import { AdminHeader } from "@/components/admin/admin-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

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
      <AdminSidebar />      <SidebarInset>
        <AdminHeader />
        
        {/* Main Content */}
        <div className="flex flex-1 flex-col gap-4 p-6 bg-gray-50">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}