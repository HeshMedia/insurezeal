"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { DashboardWrapper } from "@/components/dashboard-wrapper";
import EditForm from "@/components/forms/edit-form";
import { Button } from "@/components/ui/button";
import Loading from "@/app/loading";
import { useCutPayByPolicy } from "@/hooks/cutpayQuery";
import type { CreateCutpayTransactionCutpayPostRequest } from "@/types/cutpay.types";

const CutPayEditPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const policyNumber = searchParams.get("policy") ?? "";
  const quarterParam = searchParams.get("q");
  const yearParam = searchParams.get("y");

  const quarter = quarterParam ? Number(quarterParam) : undefined;
  const year = yearParam ? Number(yearParam) : undefined;

  const { data: policyData, isLoading } = useCutPayByPolicy(
    policyNumber,
    quarter,
    year,
    true
  );

  const initialRecord = useMemo(() => {
    if (!policyData?.policy_data) return null;
    
    // Extract from the new API response format
    const policy = policyData.policy_data;
    return {
      policy_pdf_url: policy.policy_pdf_url ?? null,
      additional_documents: policy.additional_documents ?? null,
      extracted_data: policy.extracted_data ?? null,
      admin_input: policy.admin_input ?? null,
      calculations: policy.calculations ?? null,
      claimed_by: policy.claimed_by ?? null,
      running_bal: policy.running_bal ?? 0,
      cutpay_received: policy.cutpay_received ?? null,
      notes: policy.notes ?? null,
    } as CreateCutpayTransactionCutpayPostRequest;
  }, [policyData]);

  if (!policyNumber || !quarter || !year) {
    return (
      <DashboardWrapper requiredRole="admin">
        <div className="px-6 py-10">
          <p className="text-sm text-red-500">
            Missing policy, quarter, or year query parameters.
          </p>
          <Button className="mt-4" variant="outline" onClick={() => router.back()}>
            Go Back
          </Button>
        </div>
      </DashboardWrapper>
    );
  }

  if (isLoading) {
    return <Loading />;
  }

  if (!policyData) {
    return (
      <DashboardWrapper requiredRole="admin">
        <div className="px-6 py-10">
          <p className="text-sm text-muted-foreground">
            No cutpay transaction found for policy {policyNumber}.
          </p>
          <Button className="mt-4" variant="outline" onClick={() => router.back()}>
            Go Back
          </Button>
        </div>
      </DashboardWrapper>
    );
  }

  return (
    <DashboardWrapper requiredRole="admin">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" className="gap-2" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">
            Editing policy {policyNumber} - Q{quarter} {year}
          </p>
        </div>
      </div>

      <EditForm
        initialDbRecord={initialRecord ?? undefined}
        policyNumber={policyNumber}
        quarter={quarter}
        year={year}
        policyPdfUrl={policyData?.policy_data?.policy_pdf_url ?? null}
      />
    </DashboardWrapper>
  );
};

export default CutPayEditPage;
