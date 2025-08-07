import { AgentSidebar } from "@/components/agent/sidebar"
import { AgentHeader } from "@/components/agent/agent-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

interface AgentLayoutProps {
  children: React.ReactNode
}

export default function AgentLayout({ children }: AgentLayoutProps) {
  return (
    <SidebarProvider 
      style={{
        "--sidebar-width": "15rem",
        "--sidebar-width-icon": "3.5rem",
      } as React.CSSProperties}
    >
      <AgentSidebar />
      <SidebarInset>
        <AgentHeader />
        
        {/* Main Content */}
        <div className="flex flex-1 flex-col gap-3 p-6 mr-15 bg-gray-50/30 ">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
