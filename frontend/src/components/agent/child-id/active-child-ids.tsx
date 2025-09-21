"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CheckCircle, Building, MapPin, Phone, Mail, User, Copy, Download, Key } from "lucide-react"
import { useActiveChildIds } from "@/hooks/agentQuery"
import { toast } from "sonner"

export function ActiveChildIds() {
  const { data: activeChildIds, isLoading, error } = useActiveChildIds()

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast.success(`${label} copied to clipboard`)
  }

  if (error) {
    return (
      <Card className="border border-red-200">
        <CardContent className="p-8 text-center">
          <div className="text-red-600">Error loading active child IDs: {error.message}</div>
        </CardContent>
      </Card>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i} className="border border-gray-200">
            <CardContent className="p-4">
              <div className="animate-pulse space-y-3">
                <div className="h-6 bg-gray-200 rounded w-1/3"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!activeChildIds || activeChildIds.length === 0) {
    return (
      <Card className="border border-gray-200">
        <CardContent className="p-8 text-center">
          <CheckCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Child IDs</h3>
          <p className="text-gray-600">
            You don&apos;t have any approved child IDs yet. Submit a request to get started.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Active Child IDs</h2>
          <p className="text-sm text-gray-600 mt-1">
            {activeChildIds.length} active child ID{activeChildIds.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Export Report
        </Button>
      </div>

      <div className="grid gap-6">
        {activeChildIds.map((childId) => (
          <Card key={childId.id} className="border border-green-200 shadow-sm">
             <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <CardTitle className="text-lg">
                      Child ID: {childId.child_id}
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(childId.child_id || '', 'Child ID')}
                      className="h-6 w-6 p-0 cursor-pointer"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                {childId.password && (
                  <div className="flex items-center gap-2 ">
                    <Key className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-mono bg-gray-50 px-2 py-1 rounded">
                      {childId.password}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(childId.password || '', 'Password')}
                      className="h-6 w-6 p-0 cursor-pointer"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                </div>
                {/* RIGHT = Status badge */}
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-100 text-green-700 border-green-200">
                    Active
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Business Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Code Type</p>
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4 text-gray-500" />
                    <span className="text-sm">{childId.code_type}</span>
                  </div>
                </div>

                {childId.insurer && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Insurer</p>
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4 text-gray-500" />
                      <span className="text-sm">{childId.insurer.name}</span>
                    </div>
                  </div>
                )}

                {childId.broker_relation && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Broker</p>
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4 text-gray-500" />
                      <span className="text-sm">{childId.broker_relation.name}</span>
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Location</p>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-gray-500" />
                    <span className="text-sm">{childId.location}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Phone</p>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-gray-500" />
                    <span className="text-sm">{childId.phone_number}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Email</p>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-gray-500" />
                    <span className="text-sm">{childId.email}</span>
                  </div>
                </div>
              </div>

              {/* Assignment Details */}
              {(childId.branch_code || childId.region || childId.manager_name) && (
                <div className="border-t pt-4">
                  <p className="text-sm font-medium text-gray-900 mb-3">Assignment Details</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {childId.branch_code && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Branch Code</p>
                        <span className="text-sm font-mono bg-gray-50 px-2 py-1 rounded">
                          {childId.branch_code}
                        </span>
                      </div>
                    )}

                    {childId.region && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Region</p>
                        <span className="text-sm">{childId.region}</span>
                      </div>
                    )}

                    {childId.manager_name && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Manager</p>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-500" />
                          <span className="text-sm">{childId.manager_name}</span>
                        </div>
                      </div>
                    )}

                    {childId.manager_email && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Manager Email</p>
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-gray-500" />
                          <span className="text-sm">{childId.manager_email}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Footer with timestamps */}
              <div className="flex justify-between text-xs text-gray-500 pt-4 border-t">
                <span>Approved: {childId.approved_at ? new Date(childId.approved_at).toLocaleDateString() : 'N/A'}</span>
                <span>Created: {new Date(childId.created_at).toLocaleDateString()}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
