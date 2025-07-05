'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { DashboardWrapper } from '@/components/dashboard-wrapper'
import { ChildIdRequestForm } from '@/components/agent/child-id-request-form'
import { ChildIdStatus } from '@/components/agent/child-id-status'
import { ActiveChildIds } from '@/components/agent/active-child-ids'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, List, Award } from 'lucide-react'

function AgentChildIdContent() {
  const [searchTerm, setSearchTerm] = useState("")
  const [activeTab, setActiveTab] = useState("active")
  const searchParams = useSearchParams()

  // Handle URL tab parameter with error handling
  useEffect(() => {
    try {
      const tab = searchParams?.get('tab')
      if (tab && ['active', 'requests', 'new-request'].includes(tab)) {
        setActiveTab(tab)
      }
    } catch (error) {
      console.error('Error reading search params:', error)
      // Fall back to default tab
      setActiveTab('active')
    }
  }, [searchParams])

  return (
    <DashboardWrapper requiredRole="agent">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Child ID Management</h1>
          <p className="text-gray-600">Request and manage your child ID applications</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-fit grid-cols-3">
            <TabsTrigger value="active" className="flex items-center gap-2">
              <Award className="h-4 w-4" />
              Active IDs
            </TabsTrigger>
            <TabsTrigger value="requests" className="flex items-center gap-2">
              <List className="h-4 w-4" />
              My Requests
            </TabsTrigger>
            <TabsTrigger value="new-request" className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              New Request
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-4">
            <ActiveChildIds />
          </TabsContent>

          <TabsContent value="requests" className="space-y-4">
            <ChildIdStatus 
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
            />
          </TabsContent>

          <TabsContent value="new-request" className="space-y-4">
            {(() => {
              try {
                return <ChildIdRequestForm />
              } catch (error) {
                console.error('Error rendering ChildIdRequestForm:', error)
                return (
                  <div className="text-center py-8">
                    <p className="text-red-600 mb-2">Error loading form</p>
                    <p className="text-sm text-gray-600">Please refresh the page to try again</p>
                  </div>
                )
              }
            })()}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardWrapper>
  )
}

export default function AgentChildIdPage() {
  return (
    <Suspense fallback={
      <DashboardWrapper requiredRole="agent">
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Child ID Management</h1>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      </DashboardWrapper>
    }>
      {(() => {
        try {
          return <AgentChildIdContent />
        } catch (error) {
          console.error('Error in AgentChildIdPage:', error)
          return (
            <DashboardWrapper requiredRole="agent">
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Child ID Management</h1>
                  <div className="mt-4 text-center py-8">
                    <p className="text-red-600 mb-2">An error occurred</p>
                    <p className="text-sm text-gray-600">Please refresh the page to try again</p>
                  </div>
                </div>
              </div>
            </DashboardWrapper>
          )
        }
      })()}
    </Suspense>
  )
}
