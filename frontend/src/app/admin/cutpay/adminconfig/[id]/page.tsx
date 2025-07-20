'use client'

import { useParams, useRouter } from 'next/navigation'
import { useAgentConfigById, useUpdateAgentConfig } from '@/hooks/cutpayQuery'
import { AgentConfigForm } from '@/components/admin/cutpay/adminconfig'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'
import { format } from 'date-fns'
import { UpdateAgentConfigRequest } from '@/types/cutpay.types'

export default function EditAgentConfigPage() {
  const router = useRouter()
  const params = useParams()
  const configId = parseInt(params.id as string)

  const { data: config, isLoading, error } = useAgentConfigById(configId, !!configId)
  const updateMutation = useUpdateAgentConfig()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleSubmit = async (values: any) => {
    const requestData: UpdateAgentConfigRequest = {
      payment_mode: values.payment_mode,
      payment_mode_detail: values.payment_mode_detail,
      po_paid_to_agent: values.po_paid_to_agent,
    }

    await updateMutation.mutateAsync(
      { configId, data: requestData },
      {
        onSuccess: () => {
          toast.success('Agent configuration updated successfully.')
          router.push('/admin/cutpay')
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'Failed to update configuration.')
        },
      }
    )
  }

  if (isLoading) {
    return (
      <div className="p-4 md:p-8">
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="flex justify-end gap-2">
              <Skeleton className="h-10 w-24" />
              <Skeleton className="h-10 w-24" />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 md:p-8 text-center text-red-500">
        <p>Failed to load configuration: {error.message}</p>
        <Button variant="outline" onClick={() => router.back()} className="mt-4">
          Go Back
        </Button>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <CardTitle>Edit Agent Configuration</CardTitle>
              <CardDescription>
                Update the details for agent {config?.agent_code} on{' '}
                {config?.date ? format(new Date(config.date), 'PPP') : ''}.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {config && (
            <AgentConfigForm
              initialData={config}
              onSubmit={handleSubmit}
              isSubmitting={updateMutation.isPending}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}