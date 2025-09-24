"use client";

import { ReconciliationReportsTable } from "@/components/superadmin/reconciliation-reports-table";

export default function ReconciliationPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-6">
      <div className="space-y-8">
        {/* Header Section */}
        <div className="text-center space-y-3">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
            Reconciliation Reports
          </h1>
          <p className="text-base md:text-lg text-slate-600 max-w-2xl mx-auto">
            View comprehensive reconciliation reports with field-specific variation tracking for all uploaded data.
          </p>
        </div>

        {/* Table Component */}
        <ReconciliationReportsTable />
      </div>
    </div>
  );
}
