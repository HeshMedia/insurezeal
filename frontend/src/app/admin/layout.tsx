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
        "--sidebar-width": "15rem",
        "--sidebar-width-icon": "3.5rem",
      } as React.CSSProperties}
    >
      <AdminSidebar />
      <SidebarInset>
        <AdminHeader />
        
        {/* Main Content */}
        <div className="flex flex-1 flex-col gap-3 bg-gray-50/30 ">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}