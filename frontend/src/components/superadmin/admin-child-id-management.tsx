"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { PasswordInput } from "@/components/ui/password-input"
import { Database, Plus, Search, Edit, Trash2, AlertTriangle } from "lucide-react"
import { 
  useAdminChildIdList, 
  useCreateAdminChildId, 
  useUpdateAdminChildId,
  useDeleteAdminChildId,
  useBrokersInsurersList 
} from "@/hooks/superadminQuery"
import { Skeleton } from "@/components/ui/skeleton"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import type { AdminChildId, CreateAdminChildIdRequest, UpdateAdminChildIdRequest } from "@/types/superadmin.types"

const adminChildIdFormSchema = z.object({
  child_id: z.string().min(1, "Child ID is required"),
  branch_code: z.string().min(1, "Branch code is required"),
  region: z.string().min(1, "Region is required"),
  manager_name: z.string().min(1, "Manager name is required"),
  manager_email: z.string().email("Valid email is required"),
  admin_notes: z.string().optional(),
  code_type: z.string().min(1, "Code type is required"),
  insurer_code: z.string().min(1, "Insurer is required"),
  broker_code: z.string().optional(),
  password: z.string().min(6, "Password must be at least 6 characters").optional(),
  is_active: z.boolean().optional(),
  is_suspended: z.boolean().optional(),
})

type AdminChildIdFormValues = z.infer<typeof adminChildIdFormSchema>

export function AdminChildIdManagement() {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedChildId, setSelectedChildId] = useState<AdminChildId | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogType, setDialogType] = useState<'create' | 'edit'>('create')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [childIdToDelete, setChildIdToDelete] = useState<AdminChildId | null>(null)

  const { data: adminChildIds, isLoading, error } = useAdminChildIdList()
  const { data: brokersInsurers, isLoading: brokersInsurersLoading } = useBrokersInsurersList()
  const createMutation = useCreateAdminChildId()
  const updateMutation = useUpdateAdminChildId()
  const deleteMutation = useDeleteAdminChildId()

  const form = useForm<AdminChildIdFormValues>({
    resolver: zodResolver(adminChildIdFormSchema),
    defaultValues: {
      child_id: "",
      branch_code: "",
      region: "",
      manager_name: "",
      manager_email: "",
      admin_notes: "",
      code_type: "",
      insurer_code: "",
      broker_code: "no-broker",
      password: "",
      is_active: true,
      is_suspended: false,
    },
  })

  const filteredChildIds = adminChildIds?.filter(childId =>
    childId.child_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    childId.branch_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    childId.region.toLowerCase().includes(searchTerm.toLowerCase()) ||
    childId.manager_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    childId.insurer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (childId.broker && childId.broker.name.toLowerCase().includes(searchTerm.toLowerCase()))
  ) || []

  const handleCreateChildId = () => {
    setDialogType('create')
    setSelectedChildId(null)
    form.reset({
      child_id: "",
      branch_code: "",
      region: "",
      manager_name: "",
      manager_email: "",
      admin_notes: "",
      code_type: "",
      insurer_code: "",
      broker_code: "no-broker",
      password: "",
      is_active: true,
      is_suspended: false,
    })
    setDialogOpen(true)
  }

  const handleEditChildId = (childId: AdminChildId) => {
    setDialogType('edit')
    setSelectedChildId(childId)
    form.reset({
      child_id: childId.child_id,
      branch_code: childId.branch_code,
      region: childId.region,
      manager_name: childId.manager_name,
      manager_email: childId.manager_email,
      admin_notes: childId.admin_notes || "",
      code_type: childId.code_type,
      insurer_code: childId.insurer.insurer_code,
      broker_code: childId.broker?.broker_code || "no-broker",
      password: "", // Don't populate existing password for security
      is_active: childId.is_active,
      is_suspended: childId.is_suspended,
    })
    setDialogOpen(true)
  }

  const handleDeleteClick = (childId: AdminChildId) => {
    setChildIdToDelete(childId)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!childIdToDelete) return

    try {
      await deleteMutation.mutateAsync(childIdToDelete.id)
      toast.success('Admin Child ID deleted successfully')
      setDeleteDialogOpen(false)
      setChildIdToDelete(null)
    } catch (error: unknown) {
      toast.error(`Failed to delete child ID: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const onSubmit = async (data: AdminChildIdFormValues) => {
    try {
      if (dialogType === 'create') {
        if (!data.password || data.password.length < 6) {
          form.setError("password", { message: "Password is required and must be at least 6 characters." });
          return;
        }
        const createData: CreateAdminChildIdRequest = {
          child_id: data.child_id,
          branch_code: data.branch_code,
          region: data.region,
          manager_name: data.manager_name,
          manager_email: data.manager_email,
          admin_notes: data.admin_notes,
          code_type: data.code_type,
          insurer_code: data.insurer_code,
          broker_code: data.broker_code === 'no-broker' ? undefined : data.broker_code,
          password: data.password,
        }
        await createMutation.mutateAsync(createData)
        toast.success('Admin Child ID created successfully')
      } else if (dialogType === 'edit' && selectedChildId) {
        const updateData: UpdateAdminChildIdRequest = {
          child_id: data.child_id,
          branch_code: data.branch_code,
          region: data.region,
          manager_name: data.manager_name,
          manager_email: data.manager_email,
          admin_notes: data.admin_notes,
          code_type: data.code_type,
          insurer_code: data.insurer_code,
          broker_code: data.broker_code && data.broker_code !== "no-broker" ? data.broker_code : undefined,
          password: data.password,
          is_active: data.is_active,
          is_suspended: data.is_suspended,
        }
        await updateMutation.mutateAsync({
          childIdId: selectedChildId.id,
          data: updateData,
        })
        toast.success('Admin Child ID updated successfully')
      }
      setDialogOpen(false)
      form.reset()
    } catch (error: unknown) {
      toast.error(`Failed to ${dialogType} child ID: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const isLoading_mutation = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-6">
          <div className="text-center">
            <Database className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-red-900 mb-2">Failed to load admin child IDs</h3>
            <p className="text-red-700">
              {error instanceof Error ? error.message : 'An unexpected error occurred'}
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Child ID Management</h1>
          <p className="text-gray-600">Manage administrative child IDs for insurers and brokers</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleCreateChildId} className="bg-red-600 hover:bg-red-700">
              <Plus className="h-4 w-4 mr-2" />
              Add Child ID
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {dialogType === 'create' ? 'Create New Admin Child ID' : 'Edit Admin Child ID'}
              </DialogTitle>
              <DialogDescription>
                {dialogType === 'create' 
                  ? 'Add a new administrative child ID to the system'
                  : 'Update admin child ID information'
                }
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="child_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Child ID</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter child ID" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="branch_code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Branch Code</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter branch code" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="region"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Region</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter region" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="code_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Code Type</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter code type" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="manager_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Manager Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter manager name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="manager_email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Manager Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="Enter manager email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="insurer_code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Insurer</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select an insurer" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {brokersInsurers?.insurers?.map((insurer) => (
                              insurer.insurer_code && insurer.insurer_code.trim() !== "" ? (
                                <SelectItem key={insurer.id} value={insurer.insurer_code}>
                                  {insurer.name}
                                </SelectItem>
                              ) : null
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="broker_code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Broker (Optional)</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a broker (optional)" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="no-broker">No Broker</SelectItem>
                            {brokersInsurers?.brokers?.map((broker) => (
                              broker.broker_code && broker.broker_code.trim() !== "" ? (
                                <SelectItem key={broker.id} value={broker.broker_code}>
                                  {broker.name}
                                </SelectItem>
                              ) : null
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="admin_notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Admin Notes</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Enter admin notes (optional)" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password {dialogType === 'edit' ? '(Leave empty to keep existing)' : ''}</FormLabel>
                      <FormControl>
                        <PasswordInput placeholder="Enter password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {dialogType === 'edit' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="is_active"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Active Status</FormLabel>
                            <p className="text-sm text-gray-600">
                              Enable or disable this child ID
                            </p>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="is_suspended"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Suspended Status</FormLabel>
                            <p className="text-sm text-gray-600">
                              Suspend or unsuspend this child ID
                            </p>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                )}
                <DialogFooter>
                  <Button type="submit" disabled={isLoading_mutation || brokersInsurersLoading}>
                    {isLoading_mutation ? 'Saving...' : (dialogType === 'create' ? 'Create Child ID' : 'Update Child ID')}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border border-gray-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Child IDs</CardTitle>
            <Database className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{adminChildIds?.length || 0}</div>
          </CardContent>
        </Card>
        <Card className="border border-gray-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <Database className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {adminChildIds?.filter(c => c.is_active && !c.is_suspended).length || 0}
            </div>
          </CardContent>
        </Card>
        <Card className="border border-gray-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Suspended</CardTitle>
            <Database className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {adminChildIds?.filter(c => c.is_suspended).length || 0}
            </div>
          </CardContent>
        </Card>
        <Card className="border border-gray-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inactive</CardTitle>
            <Database className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {adminChildIds?.filter(c => !c.is_active).length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card className="border border-gray-200 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search by child ID, branch code, region, manager, insurer, or broker..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Child IDs Table */}
      <Card className="border border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle>All Admin Child IDs</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Child ID</TableHead>
                    <TableHead>Branch Code</TableHead>
                    <TableHead>Region</TableHead>
                    <TableHead>Manager</TableHead>
                    <TableHead>Insurer</TableHead>
                    <TableHead>Broker</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredChildIds.map((childId) => (
                    <TableRow key={childId.id}>
                      <TableCell className="font-medium">{childId.child_id}</TableCell>
                      <TableCell>{childId.branch_code}</TableCell>
                      <TableCell>{childId.region}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{childId.manager_name}</p>
                          <p className="text-xs text-gray-600">{childId.manager_email}</p>
                        </div>
                      </TableCell>
                      <TableCell>{childId.insurer.name}</TableCell>
                      <TableCell>{childId.broker?.name || '-'}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {childId.is_suspended ? (
                            <Badge variant="secondary" className="bg-orange-100 text-orange-700 border-orange-200">
                              Suspended
                            </Badge>
                          ) : childId.is_active ? (
                            <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-red-100 text-red-700 border-red-200">
                              Inactive
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditChildId(childId)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteClick(childId)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle className="flex items-center gap-2">
                                  <AlertTriangle className="h-5 w-5 text-red-600" />
                                  Delete Admin Child ID
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete the child ID &ldquo;{childIdToDelete?.child_id}&rdquo;? 
                                  This action cannot be undone and will permanently remove all associated data.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={handleDeleteConfirm}
                                  className="bg-red-600 hover:bg-red-700"
                                  disabled={deleteMutation.isPending}
                                >
                                  {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredChildIds.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                        {searchTerm ? 'No child IDs found matching your search' : 'No child IDs available'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
