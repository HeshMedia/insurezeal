"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Car,
  User,
  Calendar,
  CreditCard,
  FileText,
  Shield,
  Download,
  Edit,
  Phone,
  MapPin,
  Fuel,
  Settings,
} from "lucide-react"

export interface PolicyData {
  policy_number: string
  quarter: number
  year: number
  quarter_sheet_name: string
  policy_details: {
    agent_code: string
    booking_date: string
    policy_start_date: string
    policy_end_date: string
    created_at: string
    updated_at: string
  }
  policy_info: {
    reporting_month: string
    child_id: string
    major_categorisation: string
    product: string
    product_type: string
    plan_type: string
    gross_premium: string
    gst_amount: string
    net_premium: string
    od_premium: string
    tp_premium: string
    registration_no: string
    make_model: string
    model: string
    vehicle_variant: string
    gvw: string
    rto: string
    state: string
    fuel_type: string
    cc: string
    age_year: string
    ncb: string
    discount_percent: string
    business_type: string
    seating_capacity: string
    veh_wheels: string
    customer_name: string
    customer_number: string
    commissionable_premium: string
    incoming_grid_percent: string
    receivable_from_broker: string
    extra_grid: string
    extra_amount_receivable: string
    total_receivable: string
    claimed_by: string
    payment_by: string
    payment_mode: string
    agent_code: string
  }
  metadata: {
    fetched_at: string
    search_quarter: string
    database_search_completed: boolean
    sheets_search_completed: boolean
  }
}

interface PolicyDashboardProps {
  data: PolicyData
  onEdit?: () => void
  onDownload?: () => void
}

export function PolicyDashboard({ data, onEdit, onDownload }: PolicyDashboardProps) {
  const formatCurrency = (amount: string) => {
    if (!amount) return "₹0"
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(Number.parseFloat(amount))
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return "—"
    const d = new Date(dateString)
    if (isNaN(d.getTime())) return dateString
    return d.toLocaleDateString("en-IN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-balance">Insurance Policy Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Policy #{data.policy_number} • {data.quarter_sheet_name}
          </p>
        </div>
        <div className="flex gap-3">
          {onEdit && (
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Edit className="w-4 h-4 mr-2" />
              Edit Policy
            </Button>
          )}
          <Button size="sm" onClick={onDownload}>
            <Download className="w-4 h-4 mr-2" />
            Download PDF
          </Button>
        </div>
      </div>

      {/* Status Badge */}
      <div className="flex gap-2">
        <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
          <Shield className="w-3 h-3 mr-1" />
          Active Policy
        </Badge>
        <Badge variant="outline">{data.policy_info.major_categorisation} Insurance</Badge>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customer Information */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              Customer Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Name</p>
              <p className="font-semibold">{data.policy_info.customer_name || "—"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Phone Number</p>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <p className="font-mono">{data.policy_info.customer_number || "—"}</p>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Customer ID</p>
              <p className="font-mono">{data.policy_info.child_id || "—"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Business Type</p>
              <Badge variant="outline">{data.policy_info.business_type || "—"}</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Vehicle Details */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Car className="w-5 h-5 text-primary" />
              Vehicle Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Make & Model</p>
                  <p className="font-semibold text-lg">{data.policy_info.make_model || "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Registration Number</p>
                  <p className="font-mono text-lg font-bold text-primary">{data.policy_info.registration_no || "—"}</p>
                </div>
                <div className="flex gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Engine CC</p>
                    <p className="font-semibold">{data.policy_info.cc ? `${data.policy_info.cc} CC` : "—"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Age</p>
                    <p className="font-semibold">{data.policy_info.age_year ? `${data.policy_info.age_year} Years` : "—"}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">RTO & State</p>
                    <p className="font-semibold">
                      {data.policy_info.rto || "—"} • {data.policy_info.state || "—"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Fuel className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Fuel Type</p>
                    <p className="font-semibold">{data.policy_info.fuel_type || "—"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Seating Capacity</p>
                    <p className="font-semibold">{data.policy_info.seating_capacity ? `${data.policy_info.seating_capacity} Seats` : "—"}</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Policy Information */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Policy Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Product</p>
                  <p className="font-semibold">{data.policy_info.product || "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Plan Type</p>
                  <Badge variant="secondary">{data.policy_info.plan_type || "—"}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Policy Period</p>
                    <p className="font-semibold">
                      {formatDate(data.policy_details.policy_start_date)} - {formatDate(data.policy_details.policy_end_date)}
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Agent Code</p>
                  <p className="font-mono">{data.policy_details.agent_code || "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Booking Date</p>
                  <p className="font-semibold">{formatDate(data.policy_details.booking_date)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">NCB Discount</p>
                  <p className="font-semibold text-accent">{data.policy_info.discount_percent ? `${data.policy_info.discount_percent}%` : "—"}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Premium Breakdown */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" />
              Premium Breakdown
            </CardTitle>
          </CardHeader>
        	<CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Net Premium</span>
                <span className="font-semibold">{formatCurrency(data.policy_info.net_premium)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">GST Amount</span>
                <span className="font-semibold">{formatCurrency(data.policy_info.gst_amount)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg">
                <span className="font-semibold">Gross Premium</span>
                <span className="font-bold text-primary">{formatCurrency(data.policy_info.gross_premium)}</span>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">OD Premium</span>
                <span className="font-semibold">{formatCurrency(data.policy_info.od_premium)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">TP Premium</span>
                <span className="font-semibold">{formatCurrency(data.policy_info.tp_premium)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment Information */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" />
              Payment & Commission Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-4">
                <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Payment Info</h4>
                <div>
                  <p className="text-sm text-muted-foreground">Payment By</p>
                  <p className="font-semibold">{data.policy_info.payment_by || "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Payment Mode</p>
                  <p className="font-semibold">{data.policy_info.payment_mode || "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Claimed By</p>
                  <p className="font-mono">{data.policy_info.claimed_by || "—"}</p>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Commission</h4>
                <div>
                  <p className="text-sm text-muted-foreground">Commissionable Premium</p>
                  <p className="font-semibold">{formatCurrency(data.policy_info.commissionable_premium)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Incoming Grid %</p>
                  <p className="font-semibold text-accent">{data.policy_info.incoming_grid_percent ? `${data.policy_info.incoming_grid_percent}%` : "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Receivable from Broker</p>
                  <p className="font-semibold">{formatCurrency(data.policy_info.receivable_from_broker)}</p>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Additional</h4>
                <div>
                  <p className="text-sm text-muted-foreground">Extra Grid</p>
                  <p className="font-semibold">{data.policy_info.extra_grid ? `${data.policy_info.extra_grid}%` : "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Extra Amount</p>
                  <p className="font-semibold">{formatCurrency(data.policy_info.extra_amount_receivable)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Receivable</p>
                  <p className="font-bold text-primary">{formatCurrency(data.policy_info.total_receivable)}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-sm text-muted-foreground">
            <div>
              <p>Last updated: {formatDate(data.policy_details.updated_at)}</p>
              <p>Data fetched: {formatDate(data.metadata.fetched_at)}</p>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline" className="text-xs">
                Database: {data.metadata.database_search_completed ? "Synced" : "Pending"}
              </Badge>
              <Badge variant="outline" className="text-xs">
                Sheets: {data.metadata.sheets_search_completed ? "Synced" : "Pending"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}


