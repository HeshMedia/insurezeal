"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function AnalyticsCharts() {
  // Temporarily disabled due to API endpoint returning 500 error
  return (
    <Card>
      <CardHeader>
        <CardTitle>Analytics Charts</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center py-8">
          <p className="text-muted-foreground">Analytics charts temporarily unavailable</p>
          <p className="text-sm text-muted-foreground">Cutpay stats API is being fixed</p>
        </div>
      </CardContent>
    </Card>
  )
}
