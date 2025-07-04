import { SuperAdminSidebar } from "@/components/superadmin/sidebar"
import { SuperAdminHeader } from "@/components/superadmin/superadmin-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

interface SuperAdminLayoutProps {
  children: React.ReactNode
}

export default function SuperAdminLayout({ children }: SuperAdminLayoutProps) {
  return (
    <SidebarProvider 
      style={{
        "--sidebar-width": "15rem",
        "--sidebar-width-icon": "3.5rem",
      } as React.CSSProperties}
    >
      <SuperAdminSidebar />
      <SidebarInset>
        <SuperAdminHeader />
        
        {/* Main Content */}
        <div className="flex flex-1 flex-col gap-3 p-3 bg-gray-50/30">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
