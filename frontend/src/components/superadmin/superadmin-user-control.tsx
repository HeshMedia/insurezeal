/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import type { Agent, AgentListParams } from '@/types/superadmin.types';
import { cn } from '@/lib/utils';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Table, 
  TableHeader, 
  TableBody, 
  TableHead, 
  TableRow, 
  TableCell 
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Users, 
  Crown, 
  Search, 
  UserPlus, 
  Shield, 
  ChevronLeft, 
  ChevronRight,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Filter,
  UserCheck,
  Clock
} from 'lucide-react';
import { useAgentList, usePromoteAgentToAdmin } from '@/hooks/superadminQuery';

interface SuperadminUserControlProps {
  className?: string;
}

function SuperadminUserControl({ className }: SuperadminUserControlProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [showPromoteDialog, setShowPromoteDialog] = useState(false);
  const pageSize = 10;

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Search parameters for API
  const searchParams = useMemo((): AgentListParams => ({
    page: currentPage,
    page_size: pageSize,
    search: debouncedSearch.trim() || undefined,
  }), [currentPage, debouncedSearch]);

  // Fetch agents using custom hook
  const {
    data: agentsData,
    isLoading,
    error,
    refetch,
    isFetching
  } = useAgentList(searchParams);

  // Promote agent mutation using custom hook
  const promoteAgentMutation = usePromoteAgentToAdmin();

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

  // Event handlers
  const handlePromoteAgent = useCallback((agent: Agent) => {
    setSelectedAgent(agent);
    setShowPromoteDialog(true);
  }, []);

  const handleConfirmPromotion = useCallback(() => {
    if (selectedAgent) {
      promoteAgentMutation.mutate(selectedAgent.user_id, {
        onSuccess: (data) => {
          toast.success(`${selectedAgent.first_name} ${selectedAgent.last_name} promoted to admin successfully!`);
          setShowPromoteDialog(false);
          setSelectedAgent(null);
        },
        onError: (error: Error) => {
          toast.error(`Failed to promote agent: ${error.message || 'Unknown error'}`);
        },
      });
    }
  }, [selectedAgent, promoteAgentMutation]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
  }, []);

  const handleRefresh = useCallback(() => {
    refetch();
    toast.info('Agent data refreshed');
  }, [refetch]);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    setDebouncedSearch('');
  }, []);

  // Computed values
  const eligibleAgents = useMemo(() => {
    return agentsData?.agents?.filter(agent => agent.user_role === 'agent') || [];
  }, [agentsData?.agents]);

  const adminCount = useMemo(() => {
    return agentsData?.agents?.filter(agent => agent.user_role === 'admin').length || 0;
  }, [agentsData?.agents]);

  // Pagination
  const totalPages = Math.ceil((agentsData?.total_count || 0) / pageSize);
  const hasNextPage = currentPage < totalPages;
  const hasPrevPage = currentPage > 1;
  const startIndex = (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, agentsData?.total_count || 0);

  // Utility functions
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase();
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'agent':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'superadmin':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Error state
  if (error) {
    return (
      <Card className={cn('w-full', className)}>
        <CardContent className="flex flex-col items-center justify-center p-8">
          <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Agents</h3>
          <p className="text-gray-600 text-center mb-4">
            {(error as Error)?.message || 'Failed to load agents data'}
          </p>
          <Button onClick={handleRefresh} variant="outline" className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn('w-full space-y-6', className)}>
      {/* Main Card */}
      <Card className="shadow-lg">
        <CardHeader className="pb-4 border-b border-gray-100">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Title and Description */}
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-r from-purple-500 to-blue-600 rounded-lg">
                <Crown className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-gray-900">
                  Agent Management
                </CardTitle>
                <p className="text-sm text-gray-600 mt-1">
                  Promote agents to admin role and manage user permissions
                </p>
              </div>
            </div>
            
            {/* Search and Actions */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="relative">
                <Input
                  placeholder="Search by name, email, or agent code..."
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="w-80 pl-10 pr-10"
                />
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearSearch}
                    className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 hover:bg-gray-100"
                  >
                    ×
                  </Button>
                )}
              </div>
              <Button
                onClick={handleRefresh}
                variant="outline"
                size="sm"
                disabled={isLoading || isFetching}
                className="flex items-center gap-2"
              >
                <RefreshCw className={cn('h-4 w-4', (isLoading || isFetching) && 'animate-spin')} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 p-6 bg-gradient-to-r from-gray-50 to-blue-50 border-b">
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900 mb-1">
                {agentsData?.total_count || 0}
              </div>
              <div className="text-sm font-medium text-gray-600 flex items-center justify-center gap-1">
                <Users className="h-4 w-4" />
                Total Agents
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600 mb-1">
                {eligibleAgents.length}
              </div>
              <div className="text-sm font-medium text-gray-600 flex items-center justify-center gap-1">
                <UserPlus className="h-4 w-4" />
                Eligible for Promotion
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600 mb-1">
                {adminCount}
              </div>
              <div className="text-sm font-medium text-gray-600 flex items-center justify-center gap-1">
                <Shield className="h-4 w-4" />
                Current Admins
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600 mb-1">
                {Math.round((adminCount / (agentsData?.total_count || 1)) * 100)}%
              </div>
              <div className="text-sm font-medium text-gray-600 flex items-center justify-center gap-1">
                <UserCheck className="h-4 w-4" />
                Admin Ratio
              </div>
            </div>
          </div>

          {/* Search Results Info */}
          {debouncedSearch && (
            <div className="px-6 py-3 bg-blue-50 border-b border-blue-100">
              <div className="flex items-center gap-2 text-sm text-blue-800">
                <Filter className="h-4 w-4" />
                Showing {agentsData?.agents?.length || 0} results for &quot;{debouncedSearch}&quot;
                {agentsData?.agents?.length === 0 && (
                  <span className="ml-2 text-blue-600">- Try different search terms</span>
                )}
              </div>
            </div>
          )}

          {/* Agents Table */}
          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="p-6 space-y-4">
                {Array.from({ length: pageSize }).map((_, i) => (
                  <div key={i} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg animate-pulse">
                    <Skeleton className="h-12 w-12 rounded-full bg-gray-200" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-48 bg-gray-200" />
                      <Skeleton className="h-3 w-32 bg-gray-200" />
                    </div>
                    <Skeleton className="h-6 w-20 bg-gray-200" />
                    <Skeleton className="h-9 w-32 bg-gray-200" />
                  </div>
                ))}
              </div>
            ) : !agentsData?.agents?.length ? (
              <div className="text-center py-16">
                <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {debouncedSearch ? 'No agents found' : 'No agents registered'}
                </h3>
                <p className="text-gray-600 max-w-md mx-auto">
                  {debouncedSearch 
                    ? 'Try adjusting your search criteria or check if the agent exists.'
                    : 'No agents are registered in the system yet. New registrations will appear here.'
                  }
                </p>
                {debouncedSearch && (
                  <Button 
                    variant="outline" 
                    onClick={handleClearSearch}
                    className="mt-4"
                  >
                    Clear Search
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-gray-200 bg-gray-50">
                    <TableHead className="text-left font-semibold text-gray-900">Agent Details</TableHead>
                    <TableHead className="text-left font-semibold text-gray-900">Agent Code</TableHead>
                    <TableHead className="text-left font-semibold text-gray-900">Role</TableHead>
                    <TableHead className="text-left font-semibold text-gray-900">Joined</TableHead>
                    <TableHead className="text-right font-semibold text-gray-900">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agentsData?.agents?.map((agent, index) => (
                    <TableRow 
                      key={agent.id} 
                      className={cn(
                        'border-b border-gray-100 hover:bg-gray-50 transition-colors',
                        index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                      )}
                    >
                      <TableCell className="py-4">
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-12 w-12">
                            <AvatarFallback className="bg-gradient-to-br from-blue-400 to-purple-500 text-white font-semibold text-sm">
                              {getInitials(agent.first_name, agent.last_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="font-medium text-gray-900 truncate">
                              {agent.first_name} {agent.last_name}
                            </div>
                            <div className="text-sm text-gray-600 truncate">
                              {agent.email || 'No email provided'}
                            </div>
                            {agent.mobile_number && (
                              <div className="text-xs text-gray-500">
                                {agent.mobile_number}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="font-mono text-sm bg-gray-100 px-3 py-1 rounded-md border">
                          {agent.agent_code}
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <Badge 
                          className={cn('border font-medium', getRoleColor(agent.user_role))}
                        >
                          {agent.user_role === 'admin' && <Shield className="h-3 w-3 mr-1" />}
                          {agent.user_role === 'superadmin' && <Crown className="h-3 w-3 mr-1" />}
                          {agent.user_role.charAt(0).toUpperCase() + agent.user_role.slice(1)}
                        </Badge>
                      </TableCell>
                      
                      <TableCell className="text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(agent.created_at)}
                        </div>
                      </TableCell>
                      
                      <TableCell className="text-right">
                        {agent.user_role === 'agent' ? (
                          <Button
                            onClick={() => handlePromoteAgent(agent)}
                            size="sm"
                            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-md hover:shadow-lg transition-all"
                            disabled={promoteAgentMutation.isPending}
                          >
                            {promoteAgentMutation.isPending && selectedAgent?.id === agent.id ? (
                              <>
                                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                Promoting...
                              </>
                            ) : (
                              <>
                                <UserPlus className="h-4 w-4 mr-2" />
                                Promote to Admin
                              </>
                            )}
                          </Button>
                        ) : (
                          <div className="flex items-center text-green-600 text-sm font-medium bg-green-50 px-3 py-1 rounded-md border border-green-200">
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            {agent.user_role === 'admin' ? 'Admin' : 'Super Admin'}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Pagination */}
          {!isLoading && agentsData && totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 bg-gray-50 border-t">
              <div className="text-sm text-gray-700">
                Showing <span className="font-medium">{startIndex}</span> to{' '}
                <span className="font-medium">{endIndex}</span> of{' '}
                <span className="font-medium">{agentsData.total_count}</span> agents
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  onClick={() => setCurrentPage(prev => prev - 1)}
                  disabled={!hasPrevPage || isLoading}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                
                <div className="flex items-center gap-2">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const pageNumber = i + 1;
                    const isCurrentPage = pageNumber === currentPage;
                    
                    return (
                      <Button
                        key={pageNumber}
                        onClick={() => setCurrentPage(pageNumber)}
                        variant={isCurrentPage ? "default" : "outline"}
                        size="sm"
                        className={cn(
                          'w-8 h-8 p-0',
                          isCurrentPage && 'bg-blue-600 hover:bg-blue-700'
                        )}
                      >
                        {pageNumber}
                      </Button>
                    );
                  })}
                  
                  {totalPages > 5 && (
                    <>
                      <span className="text-gray-400">...</span>
                      <span className="text-sm text-gray-600 px-2">
                        {currentPage} / {totalPages}
                      </span>
                    </>
                  )}
                </div>
                
                <Button
                  onClick={() => setCurrentPage(prev => prev + 1)}
                  disabled={!hasNextPage || isLoading}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Promotion Confirmation Dialog */}
      <Dialog open={showPromoteDialog} onOpenChange={setShowPromoteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Crown className="h-5 w-5 text-purple-600" />
              Promote Agent to Admin
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              This action will grant administrative privileges to the selected agent. 
              They will be able to manage other agents and access admin features.
            </DialogDescription>
          </DialogHeader>
          
          {selectedAgent && (
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-4 my-4 border border-purple-100">
              <div className="flex items-center space-x-3">
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="bg-gradient-to-br from-purple-400 to-blue-500 text-white font-semibold">
                    {getInitials(selectedAgent.first_name, selectedAgent.last_name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-semibold text-gray-900">
                    {selectedAgent.first_name} {selectedAgent.last_name}
                  </div>
                  <div className="text-sm text-gray-600">
                    {selectedAgent.email} • {selectedAgent.agent_code}
                  </div>
                  <div className="text-xs text-purple-600 font-medium mt-1">
                    Current Role: Agent → New Role: Admin
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowPromoteDialog(false)}
              disabled={promoteAgentMutation.isPending}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmPromotion}
              disabled={promoteAgentMutation.isPending}
              className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            >
              {promoteAgentMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Promoting...
                </>
              ) : (
                <>
                  <Crown className="h-4 w-4 mr-2" />
                  Confirm Promotion
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default SuperadminUserControl;
