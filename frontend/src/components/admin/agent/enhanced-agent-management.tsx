"use client"

import { useState } from "react"
import { useAtom } from "jotai"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAgentList, useDeleteAgent } from "@/hooks/adminQuery"
import { agentListParamsAtom } from "@/lib/atoms/admin"
import { AgentSummary } from "@/types/admin.types"
import { cn } from "@/lib/utils"
import { 
  Search, 
  MoreHorizontal, 
  Eye, 
  Edit,
  Users,
  Mail,
  Phone,
  Calendar,
  ArrowLeft,
  ArrowRight,
  Trash2,
  Grid3x3,
  List
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"

function AgentCard({ agent, onViewDetails, onDelete }: { 
  agent: AgentSummary; 
  onViewDetails: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    if (firstName && lastName) {
      return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
    }
    if (firstName) {
      return firstName.charAt(0).toUpperCase()
    }
    return 'A'
  }

  const getDisplayName = () => {
    if (agent.first_name && agent.last_name) {
      return `${agent.first_name} ${agent.last_name}`
    }
    if (agent.first_name) {
      return agent.first_name
    }
    return 'Unknown Agent'
  }

  return (
    <Card className="bg-white hover:shadow-lg transition-all duration-200 border border-gray-200 shadow-sm rounded-xl">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14 border-2 border-white shadow-md">
              <AvatarImage src="" alt={getDisplayName()} />
              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-semibold text-lg">
                {getInitials(agent.first_name, agent.last_name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-lg font-semibold text-gray-900 mb-1">
                {getDisplayName()}
              </CardTitle>
              <div className="flex items-center gap-2">
                {agent.agent_code && (
                  <Badge variant="outline" className="font-mono text-xs bg-gray-50 text-gray-700 border-gray-200">
                    {agent.agent_code}
                  </Badge>
                )}
                <Badge 
                  className={cn(
                    "text-xs font-medium",
                    agent.user_role === 'admin' 
                      ? "bg-purple-100 text-purple-700 border-purple-200" 
                      : "bg-blue-100 text-blue-700 border-blue-200"
                  )}
                >
                  {agent.user_role}
                </Badge>
              </div>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-gray-100">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={() => onViewDetails(agent.id)}
                className="cursor-pointer"
              >
                <Eye className="h-4 w-4 mr-2" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer">
                <Edit className="h-4 w-4 mr-2" />
                Edit Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDelete(agent.id)}
                className="cursor-pointer text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Agent
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-3 text-gray-600">
            <div className="p-1.5 bg-gray-100 rounded-md">
              <Mail className="h-3.5 w-3.5 text-gray-500" />
            </div>
            <span className="truncate">{agent.email}</span>
          </div>
          {agent.mobile_number && (
            <div className="flex items-center gap-3 text-gray-600">
              <div className="p-1.5 bg-gray-100 rounded-md">
                <Phone className="h-3.5 w-3.5 text-gray-500" />
              </div>
              <span>{agent.mobile_number}</span>
            </div>
          )}
          <div className="flex items-center gap-3 text-gray-600">
            <div className="p-1.5 bg-gray-100 rounded-md">
              <Calendar className="h-3.5 w-3.5 text-gray-500" />
            </div>
            <span>
              Joined {agent.created_at ? new Date(agent.created_at).toLocaleDateString('en-IN', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              }) : 'Unknown'}
            </span>
          </div>
        </div>
        <div className="mt-5 pt-4 border-t border-gray-100">
          <Button
            onClick={() => onViewDetails(agent.id)}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-sm"
            size="sm"
          >
            <Eye className="h-4 w-4 mr-2" />
            View Profile
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export function EnhancedAgentManagement() {
  const router = useRouter()
  const [params, setParams] = useAtom(agentListParamsAtom)
  const [searchQuery, setSearchQuery] = useState("")
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [agentToDelete, setAgentToDelete] = useState<string | null>(null)

  const { data: agentData, isLoading, error } = useAgentList(params)
  const deleteAgentMutation = useDeleteAgent()

  const handleSearch = () => {
    setParams(prev => ({ ...prev, search: searchQuery, page: 1 }))
  }

  const handlePageChange = (newPage: number) => {
    setParams(prev => ({ ...prev, page: newPage }))
  }

  const handleViewDetails = (agentId: string) => {
    router.push(`/admin/agents/${agentId}`)
  }

  const handleDeleteClick = (agentId: string) => {
    setAgentToDelete(agentId)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!agentToDelete) return

    try {
      await deleteAgentMutation.mutateAsync(agentToDelete)
      toast.success('Agent deleted successfully')
      setDeleteDialogOpen(false)
      setAgentToDelete(null)    } catch (error: unknown) {
      toast.error(`Failed to delete agent: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handlePageSizeChange = (newPageSize: string) => {
    setParams(prev => ({ ...prev, page_size: parseInt(newPageSize), page: 1 }))
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-6">
          <p className="text-red-600">Failed to load agent data: {error instanceof Error ? error.message : 'Unknown error'}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className=" mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Agent Management</h1>
            <p className="text-gray-600 mt-1">Manage insurance agents and their profiles</p>
          </div>
          <div className="flex gap-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <Search className="h-4 w-4 mr-2" />
                  Search
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="end">
                <div className="space-y-3">
                  <h4 className="font-medium text-sm">Search Agents</h4>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Search by name, email, agent code..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      className="pl-10"
                    />
                  </div>
                  <Button onClick={handleSearch} className="w-full" size="sm">
                    Search
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
            
            <Button variant="outline" size="sm" onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}>
              {viewMode === 'grid' ? (
                <>
                  <List className="h-4 w-4 mr-2" />
                  List View
                </>
              ) : (
                <>
                  <Grid3x3 className="h-4 w-4 mr-2" />
                  Grid View
                </>
              )}
            </Button>
            <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white">
              <Users className="h-4 w-4 mr-2" />
              Add Agent
            </Button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-white border border-gray-200 shadow-sm rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Total Agents</CardTitle>
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold text-gray-900">
              {agentData?.total_count || 0}
            </div>
            <p className="text-xs text-gray-500 mt-1">Registered agents</p>
          </CardContent>
        </Card>

        <Card className="bg-white border border-gray-200 shadow-sm rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Active Agents</CardTitle>
            <div className="p-2 bg-green-100 rounded-lg">
              <Users className="h-4 w-4 text-green-600" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold text-gray-900">
              {agentData?.agents?.filter(a => a.agent_code).length || 0}
            </div>
            <p className="text-xs text-gray-500 mt-1">With agent codes</p>
          </CardContent>
        </Card>

        <Card className="bg-white border border-gray-200 shadow-sm rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Recent Joins</CardTitle>
            <div className="p-2 bg-purple-100 rounded-lg">
              <Calendar className="h-4 w-4 text-purple-600" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold text-gray-900">
              {agentData?.agents?.filter(a => {
                if (!a.created_at) return false
                const joinDate = new Date(a.created_at)
                const thirtyDaysAgo = new Date()
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
                return joinDate > thirtyDaysAgo
              }).length || 0}
            </div>
            <p className="text-xs text-gray-500 mt-1">Last 30 days</p>
          </CardContent>
        </Card>
      </div>

      {/* Agents Grid/List */}
      <Card className="border border-gray-200 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold text-gray-900">Agents</CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Show</span>
              <Select
                value={params.page_size?.toString() || "20"}
                onValueChange={handlePageSizeChange}
              >
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-gray-500">entries</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className={cn(
              "grid gap-4",
              viewMode === 'grid' ? "md:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"
            )}>
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-12 w-12 rounded-full" />
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-3/4" />
                      <Skeleton className="h-8 w-full mt-4" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : agentData?.agents?.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-2">
                <Users className="h-12 w-12 mx-auto" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-1">No agents found</h3>
              <p className="text-gray-500">No agents match your current search criteria.</p>
            </div>
          ) : (
            <div className={cn(
              "grid gap-4",
              viewMode === 'grid' ? "md:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"
            )}>
              {agentData?.agents?.map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  onViewDetails={handleViewDetails}
                  onDelete={handleDeleteClick}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {agentData && agentData.agents.length > 0 && (
            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-gray-500">
                Showing {((agentData.page - 1) * agentData.page_size) + 1} to{' '}
                {Math.min(agentData.page * agentData.page_size, agentData.total_count)} of{' '}
                {agentData.total_count} agents
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(agentData.page - 1)}
                  disabled={agentData.page <= 1}
                >
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <span className="text-sm text-gray-600">
                  Page {agentData.page} of {Math.ceil(agentData.total_count / agentData.page_size)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(agentData.page + 1)}
                  disabled={agentData.page >= Math.ceil(agentData.total_count / agentData.page_size)}
                >
                  Next
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Agent</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this agent? This action cannot be undone and will permanently 
              remove the agent&apos;s profile, documents, and all associated data from the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setAgentToDelete(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteAgentMutation.isPending}
            >
              {deleteAgentMutation.isPending ? 'Deleting...' : 'Delete Agent'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
