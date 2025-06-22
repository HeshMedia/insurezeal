'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Download, Calendar as CalendarIcon, FileText } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { useExportCutPayCsv } from '@/hooks/adminQuery'
import { toast } from 'sonner'

interface CutPayExportProps {
  className?: string
}

export function CutPayExport({ className }: CutPayExportProps) {
  const [startDate, setStartDate] = useState<Date>()
  const [endDate, setEndDate] = useState<Date>()
  const [startDateOpen, setStartDateOpen] = useState(false)
  const [endDateOpen, setEndDateOpen] = useState(false)

  const exportMutation = useExportCutPayCsv()

  const handleExport = async () => {
    try {
      const startDateStr = startDate ? format(startDate, 'yyyy-MM-dd') : undefined
      const endDateStr = endDate ? format(endDate, 'yyyy-MM-dd') : undefined

      const blob = await exportMutation.mutateAsync({
        startDate: startDateStr,
        endDate: endDateStr
      })

      // Create download link
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      
      // Generate filename
      let filename = 'cutpay_transactions'
      if (startDateStr && endDateStr) {
        filename += `_${startDateStr}_${endDateStr}`
      } else if (startDateStr) {
        filename += `_from_${startDateStr}`
      } else if (endDateStr) {
        filename += `_until_${endDateStr}`
      }
      filename += '.csv'
      
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      toast.success('CutPay transactions exported successfully!')
    } catch (error: any) {
      toast.error(`Export failed: ${error.message}`)
    }
  }

  const handleClear = () => {
    setStartDate(undefined)
    setEndDate(undefined)
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-blue-600" />
          Export CutPay Transactions
        </CardTitle>
        <p className="text-sm text-gray-600">
          Export CutPay transaction data to CSV format for analysis and reporting
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Date Range Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="start-date">Start Date (Optional)</Label>
            <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !startDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, "PPP") : "Select start date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={(date) => {
                    setStartDate(date)
                    setStartDateOpen(false)
                  }}                  disabled={(date) => {
                    const today = new Date()
                    today.setHours(23, 59, 59, 999) // Set to end of today
                    return date > today || Boolean(endDate && date > endDate)
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="end-date">End Date (Optional)</Label>
            <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !endDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, "PPP") : "Select end date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={(date) => {
                    setEndDate(date)
                    setEndDateOpen(false)
                  }}                  disabled={(date) => {
                    const today = new Date()
                    today.setHours(23, 59, 59, 999) // Set to end of today
                    return date > today || Boolean(startDate && date < startDate)
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Export Options */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">Export Information</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Export includes all transaction details (amounts, dates, agent info)</li>
            <li>• If no dates selected, all transactions will be exported</li>
            <li>• Date range is inclusive of both start and end dates</li>
            <li>• File will be downloaded in CSV format for Excel/Google Sheets</li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-4">
          <Button
            onClick={handleExport}
            disabled={exportMutation.isPending}
            className="flex-1"
          >
            <Download className="h-4 w-4 mr-2" />
            {exportMutation.isPending ? 'Exporting...' : 'Export to CSV'}
          </Button>
          
          {(startDate || endDate) && (
            <Button variant="outline" onClick={handleClear}>
              Clear Filters
            </Button>
          )}
        </div>

        {/* Status */}
        {(startDate || endDate) && (
          <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
            <strong>Export Range:</strong>{' '}
            {startDate && endDate ? (
              <>From {format(startDate, 'PPP')} to {format(endDate, 'PPP')}</>
            ) : startDate ? (
              <>From {format(startDate, 'PPP')} onwards</>
            ) : endDate ? (
              <>Up to {format(endDate, 'PPP')}</>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
