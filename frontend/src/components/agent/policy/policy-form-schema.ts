"use client";

import { z } from "zod";

// Minimal schema for the new policy review form (Step 3)
export const PolicyReviewFormSchema = z.object({
  // Extracted fields (editable)
  policy_number: z.string().min(1, "Policy number is required"),

  // Admin input fields
  code_type: z.enum(["Direct", "Broker"], {
    required_error: "Select code type",
  }),
  insurer_code: z.string().min(1, "Insurer is required"),
  broker_code: z.string().nullable().optional(),
  child_id: z.string().min(1, "Child ID is required"),
  payment_by: z.enum(["Agent", "InsureZeal"], {
    required_error: "Select payment by",
  }),
  payment_method: z.string().nullable().optional(),
  payment_by_office: z.number().nullable().optional(),
  agent_commission_given_percent: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export type PolicyReviewFormSchemaType = z.infer<typeof PolicyReviewFormSchema>;


