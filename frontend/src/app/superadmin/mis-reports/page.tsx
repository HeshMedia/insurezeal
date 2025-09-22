'use client'

import React, { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { FileSpreadsheet, BarChart3 } from "lucide-react"
import { MasterSheetTableWrapper } from '@/components/mistable/admin-mis-table.config'
import { ReportsDashboard } from '@/components/superadmin/reports/reports-dashboard'
import { useGoogleSheetsMIS } from '@/hooks/useGoogleSheetsMIS'

function MISReportsPage() {
  const [activeTab, setActiveTab] = useState("mis")
  const { clientFiltering, loading, isReady, data } = useGoogleSheetsMIS()

  return (
    <div className="h-[calc(100vh-80px)] min-h-0 flex flex-col bg-gray-50 p-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg p-6 shadow-sm mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2 flex items-center gap-3">
              <BarChart3 className="h-6 w-6" />
              MIS & Reports
            </h1>
            <p className="text-red-100 text-sm">
              Manage MIS data and generate comprehensive reports across the platform
            </p>
          </div>
          <div className="hidden md:flex items-center gap-4">
            <Badge variant="secondary" className="bg-red-100 text-red-800 border-red-200">
              Super Admin Access
            </Badge>
          </div>
        </div>
      </div>

      {/* Tabs Container */}
      <div className="flex-1 min-h-0 bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full min-h-0 flex flex-col">
          <div className="border-b border-gray-200 px-6 pt-4">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger 
                value="mis" 
                className="flex items-center gap-2 data-[state=active]:bg-red-100 data-[state=active]:text-red-900"
              >
                <FileSpreadsheet className="h-4 w-4" />
                MIS Data
              </TabsTrigger>
              <TabsTrigger 
                value="reports"
                className="flex items-center gap-2 data-[state=active]:bg-red-100 data-[state=active]:text-red-900"
              >
                <BarChart3 className="h-4 w-4" />
                Reports
              </TabsTrigger>
            </TabsList>
          </div>

          {/* MIS Tab Content */}
          <TabsContent value="mis" className="flex-1 min-h-0 p-0 m-0 data-[state=active]:flex data-[state=active]:flex-col">
            <div className="flex-1 min-h-0 overflow-hidden">
              <MasterSheetTableWrapper />
            </div>
          </TabsContent>

          {/* Reports Tab Content */}
          <TabsContent value="reports" className="flex-1 min-h-0 p-0 m-0 data-[state=active]:flex data-[state=active]:flex-col">
            <div className="flex-1 min-h-0 overflow-auto">
              <ReportsDashboard 
                data={clientFiltering.rawData || []} 
                loading={loading.masterSheetData || !isReady}
                selectedSheet={data?.sheetName || 'Master Sheet'}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default MISReportsPage
