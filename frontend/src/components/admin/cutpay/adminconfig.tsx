'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { format } from 'date-fns'
import { CalendarIcon, MoreHorizontal, PlusCircle, Trash2 } from 'lucide-react'

import {
  useAgentConfigList,
  useCreateAgentConfig,
  useDeleteAgentConfig,
} from '@/hooks/cutpayQuery'
import { useAgentList } from '@/hooks/adminQuery'
import { AgentConfig, CreateAgentConfigRequest } from '@/types/cutpay.types'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

const agentConfigSchema = z.object({
  agent_code: z.string().min(1, 'Agent code is required'),
  config_date: z.date({ required_error: 'Configuration date is required' }),
  payment_mode: z.string().min(1, 'Payment mode is required'),
  payment_mode_detail: z.string().min(1, 'Payment mode detail is required'),
  po_paid_to_agent: z.coerce.number().min(0, 'PO paid must be a non-negative number'),
})

type AgentConfigFormValues = z.infer<typeof agentConfigSchema>

interface AgentConfigFormProps {
  initialData?: AgentConfig
  onSubmit: (values: AgentConfigFormValues) => void
  isSubmitting: boolean
  onClose?: () => void
}

export function AgentConfigForm({
  initialData,
  onSubmit,
  isSubmitting,
  onClose,
}: AgentConfigFormProps) {
  const { data: agentsResponse, isLoading: isLoadingAgents } = useAgentList({
    page: 1,
    page_size: 100,
  })

  const form = useForm<AgentConfigFormValues>({
    resolver: zodResolver(agentConfigSchema),
    defaultValues: {
      agent_code: initialData?.agent_code || '',
      config_date: initialData?.date ? new Date(initialData.date) : new Date(),
      payment_mode: initialData?.payment_mode || '',
      payment_mode_detail: initialData?.payment_mode_detail || '',
      po_paid_to_agent: initialData?.po_paid_to_agent || 0,
    },
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="agent_code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Agent</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  disabled={!!initialData || isLoadingAgents}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue
                        placeholder={isLoadingAgents ? 'Loading agents...' : 'Select an agent'}
                      />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {agentsResponse?.agents
                      ?.filter((agent) => agent.agent_code) // Filter out agents without an agent_code
                      .map((agent) => (
                        <SelectItem key={agent.agent_code!} value={agent.agent_code!}>
                          {`${agent.first_name || ''} ${agent.last_name || ''} (${
                            agent.agent_code
                          })`}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="config_date"
            render={({ field }) => (
              <FormItem className="flex flex-col pt-2">
                <FormLabel>Configuration Date</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={'outline'}
                        className={cn(
                          'w-full pl-3 text-left font-normal',
                          !field.value && 'text-muted-foreground'
                        )}
                        disabled={!!initialData}
                      >
                        {field.value ? format(field.value, 'PPP') : <span>Pick a date</span>}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      disabled={(date) => date > new Date() || !!initialData}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="payment_mode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Payment Mode</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Bank Transfer, Cheque" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="payment_mode_detail"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Payment Mode Detail</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Bank Name, Cheque No." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="po_paid_to_agent"
            render={({ field }) => (
              <FormItem>
                <FormLabel>PO Paid to Agent</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="Enter amount" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <DialogFooter>
          {onClose && (
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  )
}

export function AgentConfigManagement() {
  const router = useRouter()
  const [isCreateDialogOpen, setCreateDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [configToDelete, setConfigToDelete] = useState<number | null>(null)

  const { data: configs, isLoading, error } = useAgentConfigList()
  const createMutation = useCreateAgentConfig()
  const deleteMutation = useDeleteAgentConfig()

  const handleCreateSubmit = async (values: AgentConfigFormValues) => {
    const requestData: CreateAgentConfigRequest = {
      ...values,
      config_date: format(values.config_date, 'yyyy-MM-dd'),
    }

    await createMutation.mutateAsync(requestData, {
      onSuccess: () => {
        toast.success('Agent configuration created successfully.')
        setCreateDialogOpen(false)
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : 'Failed to create configuration.')
      },
    })
  }

  const handleDelete = async () => {
    if (!configToDelete) return
    await deleteMutation.mutateAsync(configToDelete, {
      onSuccess: () => {
        toast.success('Agent configuration deleted successfully.')
        setDeleteDialogOpen(false)
        setConfigToDelete(null)
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : 'Failed to delete configuration.')
        setDeleteDialogOpen(false)
        setConfigToDelete(null)
      },
    })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Agent Configurations</CardTitle>
            <CardDescription>Manage agent payment configurations.</CardDescription>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" /> Create Config
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[625px]">
              <DialogHeader>
                <DialogTitle>Create New Agent Configuration</DialogTitle>
                <DialogDescription>
                  Fill in the details to add a new agent configuration.
                </DialogDescription>
              </DialogHeader>
              <AgentConfigForm
                onSubmit={handleCreateSubmit}
                isSubmitting={createMutation.isPending}
                onClose={() => setCreateDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Agent Code</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Payment Mode</TableHead>
              <TableHead>PO Paid</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={5}>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : error ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-red-500">
                  Failed to load configurations: {error.message}
                </TableCell>
              </TableRow>
            ) : configs && configs.length > 0 ? (
              configs.map((config) => (
                <TableRow key={config.id}>
                  <TableCell className="font-medium">{config.agent_code}</TableCell>
                  <TableCell>{format(new Date(config.date), 'dd MMM yyyy')}</TableCell>
                  <TableCell>{config.payment_mode}</TableCell>
                  <TableCell>
                    {new Intl.NumberFormat('en-IN', {
                      style: 'currency',
                      currency: 'INR',
                    }).format(config.po_paid_to_agent)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button aria-haspopup="true" size="icon" variant="ghost">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Toggle menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem
                          onSelect={() => router.push(`/admin/cutpay/adminconfig/${config.id}`)}
                        >
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600 hover:!text-red-600 hover:!bg-red-50"
                          onSelect={() => {
                            setConfigToDelete(config.id)
                            setDeleteDialogOpen(true)
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center">
                  No agent configurations found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the agent configuration.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfigToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}