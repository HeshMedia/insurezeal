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
import { Switch } from "@/components/ui/switch"
import { Building, Plus, Search, Edit } from "lucide-react"
import { useInsurerList, useCreateInsurer, useUpdateInsurer } from "@/hooks/superadminQuery"
import { Skeleton } from "@/components/ui/skeleton"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import type { Insurer, CreateInsurerRequest, UpdateInsurerRequest } from "@/types/superadmin.types"

const insurerFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  is_active: z.boolean().optional(),
})

type InsurerFormValues = z.infer<typeof insurerFormSchema>

export function InsurerManagement() {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedInsurer, setSelectedInsurer] = useState<Insurer | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogType, setDialogType] = useState<'create' | 'edit'>('create')

  const { data: insurers, isLoading, error } = useInsurerList()
  const createMutation = useCreateInsurer()
  const updateMutation = useUpdateInsurer()

  const form = useForm<InsurerFormValues>({
    resolver: zodResolver(insurerFormSchema),
    defaultValues: {
      name: "",
      is_active: true,
    },
  })

  const filteredInsurers = insurers?.filter(insurer =>
    insurer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    insurer.insurer_code.toLowerCase().includes(searchTerm.toLowerCase())
  ) || []

  const handleCreateInsurer = () => {
    setDialogType('create')
    setSelectedInsurer(null)
    form.reset({
      name: "",
      is_active: true,
    })
    setDialogOpen(true)
  }

  const handleEditInsurer = (insurer: Insurer) => {
    setDialogType('edit')
    setSelectedInsurer(insurer)
    form.reset({
      name: insurer.name,
      is_active: insurer.is_active,
    })
    setDialogOpen(true)
  }

  const onSubmit = async (data: InsurerFormValues) => {
    try {
      if (dialogType === 'create') {
        const createData: CreateInsurerRequest = {
          name: data.name,
        }
        await createMutation.mutateAsync(createData)
        toast.success('Insurer created successfully')
      } else if (selectedInsurer) {
        const updateData: UpdateInsurerRequest = {
          name: data.name,
          is_active: data.is_active,
        }
        await updateMutation.mutateAsync({
          insurerId: selectedInsurer.id,
          data: updateData,
        })
        toast.success('Insurer updated successfully')
      }
      setDialogOpen(false)
      form.reset()
    } catch (error: unknown) {
      toast.error(`Failed to ${dialogType} insurer: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const isLoading_mutation = createMutation.isPending || updateMutation.isPending

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-6">
          <div className="text-center">
            <Building className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-red-900 mb-2">Failed to load insurers</h3>
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
          <h1 className="text-2xl font-bold text-gray-900">Insurer Management</h1>
          <p className="text-gray-600">Manage insurance companies and their information</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleCreateInsurer} className="bg-red-600 hover:bg-red-700">
              <Plus className="h-4 w-4 mr-2" />
              Add Insurer
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {dialogType === 'create' ? 'Create New Insurer' : 'Edit Insurer'}
              </DialogTitle>
              <DialogDescription>
                {dialogType === 'create' 
                  ? 'Add a new insurance company to the system'
                  : 'Update insurer information'
                }
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Insurer Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter insurer name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {dialogType === 'edit' && (
                  <FormField
                    control={form.control}
                    name="is_active"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Active Status</FormLabel>
                          <p className="text-sm text-gray-600">
                            Enable or disable this insurer
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
                )}
                <DialogFooter>
                  <Button type="submit" disabled={isLoading_mutation}>
                    {isLoading_mutation ? 'Saving...' : (dialogType === 'create' ? 'Create Insurer' : 'Update Insurer')}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border border-gray-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Insurers</CardTitle>
            <Building className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{insurers?.length || 0}</div>
          </CardContent>
        </Card>
        <Card className="border border-gray-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Insurers</CardTitle>
            <Building className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {insurers?.filter(i => i.is_active).length || 0}
            </div>
          </CardContent>
        </Card>
        <Card className="border border-gray-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inactive Insurers</CardTitle>
            <Building className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {insurers?.filter(i => !i.is_active).length || 0}
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
                placeholder="Search insurers by name or code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Insurers Table */}
      <Card className="border border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle>All Insurers</CardTitle>
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
                    <TableHead>Insurer Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInsurers.map((insurer) => (
                    <TableRow key={insurer.id}>
                      <TableCell className="font-medium">{insurer.insurer_code}</TableCell>
                      <TableCell>{insurer.name}</TableCell>
                      <TableCell>
                        <Badge 
                          variant="secondary"
                          className={insurer.is_active 
                            ? "bg-green-100 text-green-700 border-green-200" 
                            : "bg-red-100 text-red-700 border-red-200"
                          }
                        >
                          {insurer.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(insurer.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {new Date(insurer.updated_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditInsurer(insurer)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredInsurers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                        {searchTerm ? 'No insurers found matching your search' : 'No insurers available'}
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
