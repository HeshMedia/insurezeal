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
         <div className="flex flex-1 min-h-0 flex-col gap-3 p-3 bg-gray-50/30 overflow-hidden w-full max-w-[calc(100vw-15rem)]">
          <div className="w-full max-w-none overflow-x-auto">
            {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
