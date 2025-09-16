import { z } from "zod";

// Comprehensive Policy Form Schema that matches the API requirements
export const PolicyFormSchema = z
  .object({
    // PDF and policy identification
    policy_number: z.string().min(1, "Policy number is required"),
    policy_type: z.string().min(1, "Policy type is required"),
    pdf_file_name: z.string().optional(),
    pdf_file_path: z.string().optional(),

    // Agent and organizational info
    agent_id: z.string().optional(),
    agent_code: z.string().optional(),
    child_id: z.string().min(1, "Child ID is required"),
    broker_name: z.string().optional(),
    insurance_company: z.string().optional(),

    // Policy details
    formatted_policy_number: z.string().optional(),
    major_categorisation: z.string().optional(),
    product_insurer_report: z.string().optional(),
    product_type: z.string().optional(),
    plan_type: z.string().optional(),
    customer_name: z.string().min(1, "Customer name is required"),
    customer_phone_number: z.string().optional(),
    insurance_type: z.string().optional(),
    vehicle_type: z.string().optional(),

    // Vehicle information
    registration_number: z.string().min(1, "Registration number is required"),
    vehicle_class: z.string().optional(),
    vehicle_segment: z.string().optional(),
    make_model: z.string().optional(),
    model: z.string().optional(),
    vehicle_variant: z.string().optional(),
    gvw: z.number().optional(),
    rto: z.string().optional(),
    state: z.string().optional(),
    fuel_type: z.string().optional(),
    cc: z.number().optional(),
    age_year: z.number().optional(),
    ncb: z.string().optional(),
    discount_percent: z.number().optional(),
    business_type: z.string().optional(),
    seating_capacity: z.number().optional(),
    veh_wheels: z.number().optional(),
    is_private_car: z.boolean().optional(),

    // Premium and financial information
    gross_premium: z.number().min(0, "Gross premium must be positive"),
    gst: z.number().optional(),
    gst_amount: z.number().optional(),
    net_premium: z.number().optional(),
    od_premium: z.number().optional(),
    tp_premium: z.number().optional(),

    // Commission and payout
    agent_commission_given_percent: z.number().optional(),
    agent_extra_percent: z.number().optional(),
    payment_by_office: z.number().optional(),
    total_agent_payout_amount: z.number().optional(),

    // Payment and processing info
    code_type: z.string().optional(),
    payment_by: z.string().optional(),
    payment_method: z.string().optional(),
    cluster: z.string().optional(),
    notes: z.string().optional(),

    // Dates
    start_date: z.string().min(1, "Start date is required"),
    end_date: z.string().min(1, "End date is required"),

    // AI and processing metadata
    ai_confidence_score: z.number().optional(),
    manual_override: z.boolean().optional(),

    // Nested extracted data structure for form compatibility
    extracted_data: z
      .object({
        policy_number: z.string().optional(),
        formatted_policy_number: z.string().optional(),
        major_categorisation: z.string().optional(),
        product_insurer_report: z.string().optional(),
        product_type: z.string().optional(),
        plan_type: z.string().optional(),
        customer_name: z.string().optional(),
        customer_phone_number: z.string().optional(),
        gross_premium: z.number().optional(),
        net_premium: z.number().optional(),
        od_premium: z.number().optional(),
        tp_premium: z.number().optional(),
        gst_amount: z.number().optional(),
        registration_number: z.string().optional(),
        make_model: z.string().optional(),
        model: z.string().optional(),
        vehicle_variant: z.string().optional(),
        gvw: z.number().optional(),
        rto: z.string().optional(),
        state: z.string().optional(),
        fuel_type: z.string().optional(),
        cc: z.number().optional(),
        age_year: z.number().optional(),
        ncb: z.string().optional(),
        discount_percent: z.number().optional(),
        business_type: z.string().optional(),
        seating_capacity: z.number().optional(),
        veh_wheels: z.number().optional(),
      })
      .optional(),

    // Admin input structure for form compatibility
    admin_input: z
      .object({
        reporting_month: z.string().optional(),
        booking_date: z.string().optional(),
        insurer_code: z.string().optional(),
        broker_code: z.string().optional(),
        agent_code: z.string().optional(),
        code_type: z.string().optional(),
        payment_by: z.string().optional(),
        payment_method: z.string().optional(),
        agent_commission_given_percent: z.number().optional(),
        agent_extra_percent: z.number().optional(),
        payment_by_office: z.number().optional(),
        admin_child_id: z.string().optional(),
      })
      .optional(),

    // Additional fields for compatibility
    policy_pdf_url: z.string().optional(),
  })
  .refine(
    (data) => {
      // Custom validation: end_date should be after start_date
      if (data.start_date && data.end_date) {
        return new Date(data.end_date) > new Date(data.start_date);
      }
      return true;
    },
    {
      message: "End date must be after start date",
      path: ["end_date"],
    }
  );

export type PolicyFormSchemaType = z.infer<typeof PolicyFormSchema>;
