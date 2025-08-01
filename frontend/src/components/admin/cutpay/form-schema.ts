import { z } from 'zod';

export const ExtractedPolicyDataSchema = z.object({
  policy_number: z.string().optional().nullable(),
  formatted_policy_number: z.string().optional().nullable(),
  major_categorisation: z.string().optional().nullable(),
  product_insurer_report: z.string().optional().nullable(),
  product_type: z.string().optional().nullable(),
  plan_type: z.string().optional().nullable(),
  customer_name: z.string().optional().nullable(),
  customer_phone_number: z.string().optional().nullable(),
  // Policy type and insurance details
  insurance_type: z.string().optional().nullable(),
  vehicle_type: z.string().optional().nullable(),
  // Premium details
  gross_premium: z.number().optional().nullable(),
  net_premium: z.number().optional().nullable(),
  od_premium: z.number().optional().nullable(),
  tp_premium: z.number().optional().nullable(),
  gst_amount: z.number().optional().nullable(),
  // Vehicle registration details
  registration_no: z.string().optional().nullable(),
  registration_number: z.string().optional().nullable(),
  // Vehicle details
  make_model: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  vehicle_variant: z.string().optional().nullable(),
  vehicle_class: z.string().optional().nullable(),
  vehicle_segment: z.string().optional().nullable(),
  gvw: z.number().optional().nullable(),
  rto: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  fuel_type: z.string().optional().nullable(),
  cc: z.number().optional().nullable(),
  age_year: z.number().optional().nullable(),
  ncb: z.string().optional().nullable(),
  discount_percent: z.number().optional().nullable(),
  business_type: z.string().optional().nullable(),
  seating_capacity: z.number().optional().nullable(),
  veh_wheels: z.number().optional().nullable(),
  is_private_car: z.boolean().optional().nullable(),
});

export const AdminInputDataSchema = z.object({
  child_id: z.string().min(1, "Child ID is required"),
  agent_code: z.string().min(1, "Agent code is required"),
  insurer_name: z.string().min(1, "Insurer name is required"),
  brokerage_amount: z.number().min(0, "Brokerage amount must be non-negative"),
  
  // Date fields with flexible validation
  start_date: z.union([
    z.date(),
    z.string().refine((val) => {
      const date = new Date(val);
      return !isNaN(date.getTime());
    }, "Invalid start date format")
  ]).optional().nullable(),
  
  end_date: z.union([
    z.date(),
    z.string().refine((val) => {
      const date = new Date(val);
      return !isNaN(date.getTime());
    }, "Invalid end date format")
  ]).optional().nullable(),
  
  // Policy periods
  policy_month: z.number().optional().nullable(),
  policy_period: z.string().optional().nullable(),
  
  // Admin fields
  cluster: z.string().optional().nullable(),
  
  // Optional audit fields
  created_by: z.string().optional().nullable(),
  updated_by: z.string().optional().nullable(),
});

export const CalculationResultSchema = z.object({
  receivable_from_broker: z.number().optional().nullable(),
  extra_amount_receivable_from_broker: z.number().optional().nullable(),
  total_receivable_from_broker: z.number().optional().nullable(),
  total_receivable_from_broker_with_gst: z.number().optional().nullable(),
  cut_pay_amount: z.number().optional().nullable(),
  agent_po_amt: z.number().optional().nullable(),
  agent_extra_amount: z.number().optional().nullable(),
  total_agent_po_amt: z.number().optional().nullable(),
  iz_total_po_percent: z.number().optional().nullable(),
  already_given_to_agent: z.number().optional().nullable(),
  broker_payout_amount: z.number().optional().nullable(),
});

export const CutPayFormSchema = z.object({
  policy_pdf_url: z.string().optional().nullable(),
  additional_documents: z.record(z.any()).optional(),
  extracted_data: ExtractedPolicyDataSchema.optional(),
  admin_input: z.object({
    reporting_month: z.string().optional().nullable(),
    booking_date: z.string().optional().nullable(), // Keep as string for API (YYYY-MM-DD format)
    agent_code: z.string().optional().nullable(),
    code_type: z.string().optional().nullable(),
    incoming_grid_percent: z.number().optional().nullable(),
    agent_commission_given_percent: z.number().optional().nullable(),
    extra_grid: z.number().optional().nullable(),
    commissionable_premium: z.number().optional().nullable(),
    payment_by: z.string().optional().nullable(),
    payment_method: z.string().optional().nullable(),
    payout_on: z.string().optional().nullable(),
    agent_extra_percent: z.number().optional().nullable(),
    payment_by_office: z.number().optional().nullable(),
    insurer_code: z.string().optional().nullable(),
    broker_code: z.string().optional().nullable(),
    admin_child_id: z.string().optional().nullable(),
    // New fields for OD+TP calculation - for frontend use only
    od_agent_payout_percent: z.number().nullable().optional(),
    tp_agent_payout_percent: z.number().nullable().optional(),
    od_incoming_grid_percent: z.number().nullable().optional(),
    tp_incoming_grid_percent: z.number().nullable().optional(),
  }),
  calculations: z.object({
    receivable_from_broker: z.number().optional().nullable(),
    extra_amount_receivable_from_broker: z.number().optional().nullable(),
    total_receivable_from_broker: z.number().optional().nullable(),
    total_receivable_from_broker_with_gst: z.number().optional().nullable(),
    cut_pay_amount: z.number().optional().nullable(),
    agent_po_amt: z.number().optional().nullable(),
    agent_extra_amount: z.number().optional().nullable(),
    total_agent_po_amt: z.number().optional().nullable(),
    iz_total_po_percent: z.number().optional().nullable(),
    already_given_to_agent: z.number().optional().nullable(),
    broker_payout_amount: z.number().optional().nullable(),
  }),
  claimed_by: z.string().optional().nullable(),
  running_bal: z.number().optional().nullable(),
  cutpay_received_status: z.enum(['Yes', 'No', 'Partial']).optional().nullable(), // Frontend only
  cutpay_received: z.number().optional().nullable(), // Amount field
  notes: z.string().optional().nullable(),
});

export type CutPayFormSchemaType = z.infer<typeof CutPayFormSchema>;
