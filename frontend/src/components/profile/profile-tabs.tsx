'use client'

import React from 'react'
import { useAtom } from 'jotai'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { activeProfileTabAtom } from '@/lib/atoms/profile'

export function ProfileTabs() {
  const [activeTab, setActiveTab] = useAtom(activeProfileTabAtom)

  return (
    <div className="border-b border-gray-200 dark:border-gray-700 px-6 pt-6">
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'details' | 'documents')}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="details" className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Your Details
          </TabsTrigger>
          <TabsTrigger value="documents" className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            Documents
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  )
}
