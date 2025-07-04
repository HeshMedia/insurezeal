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
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Building2, Plus, Search, Edit } from "lucide-react"
import { useBrokerList, useCreateBroker, useUpdateBroker } from "@/hooks/superadminQuery"
import { Skeleton } from "@/components/ui/skeleton"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import type { Broker, CreateBrokerRequest, UpdateBrokerRequest } from "@/types/superadmin.types"

const brokerFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  address: z.string().min(1, "Address is required"),
  rm: z.string().min(1, "RM is required"),
  gst: z.string().min(1, "GST is required"),
  is_active: z.boolean().optional(),
})

type BrokerFormValues = z.infer<typeof brokerFormSchema>

export function BrokerManagement() {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedBroker, setSelectedBroker] = useState<Broker | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogType, setDialogType] = useState<'create' | 'edit'>('create')

  const { data: brokers, isLoading, error } = useBrokerList()
  const createMutation = useCreateBroker()
  const updateMutation = useUpdateBroker()

  const form = useForm<BrokerFormValues>({
    resolver: zodResolver(brokerFormSchema),
    defaultValues: {
      name: "",
      address: "",
      rm: "",
      gst: "",
      is_active: true,
    },
  })

  const filteredBrokers = brokers?.filter(broker =>
    broker.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    broker.broker_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    broker.gst.toLowerCase().includes(searchTerm.toLowerCase())
  ) || []

  const handleCreateBroker = () => {
    setDialogType('create')
    setSelectedBroker(null)
    form.reset({
      name: "",
      address: "",
      rm: "",
      gst: "",
      is_active: true,
    })
    setDialogOpen(true)
  }

  const handleEditBroker = (broker: Broker) => {
    setDialogType('edit')
    setSelectedBroker(broker)
    form.reset({
      name: broker.name,
      address: broker.address,
      rm: broker.rm,
      gst: broker.gst,
      is_active: broker.is_active,
    })
    setDialogOpen(true)
  }

  const onSubmit = async (data: BrokerFormValues) => {
    try {
      if (dialogType === 'create') {
        const createData: CreateBrokerRequest = {
          name: data.name,
          address: data.address,
          rm: data.rm,
          gst: data.gst,
        }
        await createMutation.mutateAsync(createData)
        toast.success('Broker created successfully')
      } else if (selectedBroker) {
        const updateData: UpdateBrokerRequest = {
          name: data.name,
          address: data.address,
          rm: data.rm,
          gst: data.gst,
          is_active: data.is_active,
        }
        await updateMutation.mutateAsync({
          brokerId: selectedBroker.id,
          data: updateData,
        })
        toast.success('Broker updated successfully')
      }
      setDialogOpen(false)
      form.reset()
    } catch (error: unknown) {
      toast.error(`Failed to ${dialogType} broker: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const isLoading_mutation = createMutation.isPending || updateMutation.isPending

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-6">
          <div className="text-center">
            <Building2 className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-red-900 mb-2">Failed to load brokers</h3>
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
          <h1 className="text-2xl font-bold text-gray-900">Broker Management</h1>
          <p className="text-gray-600">Manage insurance brokers and their information</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleCreateBroker} className="bg-red-600 hover:bg-red-700">
              <Plus className="h-4 w-4 mr-2" />
              Add Broker
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {dialogType === 'create' ? 'Create New Broker' : 'Edit Broker'}
              </DialogTitle>
              <DialogDescription>
                {dialogType === 'create' 
                  ? 'Add a new broker to the system'
                  : 'Update broker information'
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
                      <FormLabel>Broker Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter broker name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Enter broker address" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="rm"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>RM (Relationship Manager)</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter RM name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="gst"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>GST Number</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter GST number" {...field} />
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
                            Enable or disable this broker
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
                    {isLoading_mutation ? 'Saving...' : (dialogType === 'create' ? 'Create Broker' : 'Update Broker')}
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
            <CardTitle className="text-sm font-medium">Total Brokers</CardTitle>
            <Building2 className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{brokers?.length || 0}</div>
          </CardContent>
        </Card>
        <Card className="border border-gray-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Brokers</CardTitle>
            <Building2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {brokers?.filter(b => b.is_active).length || 0}
            </div>
          </CardContent>
        </Card>
        <Card className="border border-gray-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inactive Brokers</CardTitle>
            <Building2 className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {brokers?.filter(b => !b.is_active).length || 0}
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
                placeholder="Search brokers by name, code, or GST..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Brokers Table */}
      <Card className="border border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle>All Brokers</CardTitle>
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
                    <TableHead>Broker Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>RM</TableHead>
                    <TableHead>GST</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBrokers.map((broker) => (
                    <TableRow key={broker.id}>
                      <TableCell className="font-medium">{broker.broker_code}</TableCell>
                      <TableCell>{broker.name}</TableCell>
                      <TableCell>{broker.rm}</TableCell>
                      <TableCell>{broker.gst}</TableCell>
                      <TableCell>
                        <Badge 
                          variant="secondary"
                          className={broker.is_active 
                            ? "bg-green-100 text-green-700 border-green-200" 
                            : "bg-red-100 text-red-700 border-red-200"
                          }
                        >
                          {broker.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(broker.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditBroker(broker)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredBrokers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                        {searchTerm ? 'No brokers found matching your search' : 'No brokers available'}
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
