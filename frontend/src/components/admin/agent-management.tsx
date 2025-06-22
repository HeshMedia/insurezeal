"use client"

import { useState } from "react"
import { useAtom } from "jotai"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { AgentSummary } from "@/types/admin.types"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { useAgentList } from "@/hooks/adminQuery"
import { agentListParamsAtom, selectedAgentIdAtom, isAgentDialogOpenAtom } from "@/lib/atoms/admin"
import { formatDate } from "@/lib/utils"
import { 
  Search, 
  MoreHorizontal,   Eye,
  Mail,
  Phone,  Users
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function AgentManagement() {
  const [params, setParams] = useAtom(agentListParamsAtom)
  const [, setSelectedId] = useAtom(selectedAgentIdAtom)
  const [, setDialogOpen] = useAtom(isAgentDialogOpenAtom)
  const [searchQuery, setSearchQuery] = useState("")

  const { data: agentData, isLoading, error } = useAgentList(params)

  const handleSearch = () => {
    setParams(prev => ({ ...prev, search: searchQuery, page: 1 }))
  }

  const handlePageChange = (newPage: number) => {
    setParams(prev => ({ ...prev, page: newPage }))
  }

  const handleViewDetails = (agentId: string) => {
    setSelectedId(agentId)
    setDialogOpen(true)
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-6">
          <p className="text-red-600">Failed to load agent data: {error.message}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">Agent Management</h2>
          <p className="text-gray-600">Manage insurance agents and their information</p>
        </div>
      </div>      {/* Stats Summary */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" />
            <span className="text-sm font-medium text-gray-700">Total Agents: {agentData?.total_count || 0}</span>
          </div>
          <div className="text-sm text-gray-500">
            Showing {agentData?.agents?.length || 0} agents
          </div>
        </div>
      </div>

      {/* Agent List */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-lg">Agent Directory</CardTitle>
              <CardDescription>
                Browse and manage all registered insurance agents
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Search agents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="w-64"
                />                <Button onClick={handleSearch} variant="outline" size="sm">
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <AgentTableSkeleton />
          ) : (
            <AgentTable 
              data={agentData?.agents || []} 
              onViewDetails={handleViewDetails}
            />
          )}
          
          {/* Pagination */}
          {agentData && agentData.total_count > 0 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-gray-600">
                Showing {((params.page || 1) - 1) * (params.page_size || 20) + 1} to{' '}
                {Math.min((params.page || 1) * (params.page_size || 20), agentData.total_count)} of{' '}
                {agentData.total_count} agents
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange((params.page || 1) - 1)}
                  disabled={(params.page || 1) <= 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange((params.page || 1) + 1)}
                  disabled={(params.page || 1) * (params.page_size || 20) >= agentData.total_count}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function AgentTable({ 
  data, 
  onViewDetails 
}: {
  data: AgentSummary[]
  onViewDetails: (id: string) => void
}) {  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    if (firstName && lastName) {
      return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
    }
    if (firstName) {
      return firstName.charAt(0).toUpperCase()
    }
    return 'A'
  }
  const getDisplayName = (agent: AgentSummary) => {
    if (agent.first_name && agent.last_name) {
      return `${agent.first_name} ${agent.last_name}`
    }
    if (agent.first_name) {
      return agent.first_name
    }
    return agent.email
  }

  const getRoleColor = (role: string) => {
    switch (role.toLowerCase()) {
      case 'admin':
        return 'bg-red-100 text-red-700'
      case 'agent':
        return 'bg-blue-100 text-blue-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50">
            <TableHead className="font-semibold">Agent</TableHead>
            <TableHead className="font-semibold">Agent Code</TableHead>
            <TableHead className="font-semibold">Contact</TableHead>
            <TableHead className="font-semibold">Role</TableHead>
            <TableHead className="font-semibold">Joined</TableHead>
            <TableHead className="font-semibold text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((agent) => (
            <TableRow key={agent.id} className="hover:bg-gray-50">
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src="" alt={getDisplayName(agent)} />
                    <AvatarFallback className="bg-blue-100 text-blue-700 text-xs">
                      {getInitials(agent.first_name, agent.last_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-gray-900">{getDisplayName(agent)}</p>
                    <p className="text-sm text-gray-500">{agent.email}</p>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                {agent.agent_code ? (
                  <Badge variant="outline" className="font-mono">
                    {agent.agent_code}
                  </Badge>
                ) : (
                  <span className="text-gray-400 text-sm">Not assigned</span>
                )}
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-sm">
                    <Mail className="h-3 w-3 text-gray-400" />
                    <span className="text-gray-600">{agent.email}</span>
                  </div>
                  {agent.mobile_number && (
                    <div className="flex items-center gap-1 text-sm">
                      <Phone className="h-3 w-3 text-gray-400" />
                      <span className="text-gray-600">{agent.mobile_number}</span>
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <Badge className={`text-xs ${getRoleColor(agent.user_role)}`}>
                  {agent.user_role}
                </Badge>
              </TableCell>
              <TableCell>
                {agent.created_at ? (
                  <span className="text-sm text-gray-600">
                    {formatDate(agent.created_at)}
                  </span>
                ) : (
                  <span className="text-gray-400 text-sm">-</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onViewDetails(agent.id)}>
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function AgentTableSkeleton() {
  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50">
            <TableHead>Agent</TableHead>
            <TableHead>Agent Code</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                </div>
              </TableCell>
              <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
              <TableCell>
                <div className="space-y-1">
                  <Skeleton className="h-3 w-36" />
                  <Skeleton className="h-3 w-28" />
                </div>
              </TableCell>
              <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
              <TableCell><Skeleton className="h-4 w-20" /></TableCell>
              <TableCell className="text-right">
                <Skeleton className="h-8 w-8 rounded ml-auto" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
