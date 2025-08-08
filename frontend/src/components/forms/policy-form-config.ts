import { SubmitPolicyPayload } from '@/types/policy.types';

// Extract all field paths from the SubmitPolicyPayload type
export type PolicyFormFieldPath = keyof SubmitPolicyPayload | 'extracted_data.policy_number' | 'extracted_data.formatted_policy_number' | 'extracted_data.major_categorisation' | 'extracted_data.product_insurer_report' | 'extracted_data.product_type' | 'extracted_data.plan_type' | 'extracted_data.customer_name' | 'extracted_data.customer_phone_number' | 'extracted_data.gross_premium' | 'extracted_data.net_premium' | 'extracted_data.od_premium' | 'extracted_data.tp_premium' | 'extracted_data.gst_amount' | 'extracted_data.registration_number' | 'extracted_data.make_model' | 'extracted_data.model' | 'extracted_data.vehicle_variant' | 'extracted_data.gvw' | 'extracted_data.rto' | 'extracted_data.state' | 'extracted_data.fuel_type' | 'extracted_data.cc' | 'extracted_data.age_year' | 'extracted_data.ncb' | 'extracted_data.discount_percent' | 'extracted_data.business_type' | 'extracted_data.seating_capacity' | 'extracted_data.veh_wheels' | 'admin_input.booking_date' | 'admin_input.reporting_month' | 'admin_input.insurer_code' | 'admin_input.broker_code' | 'admin_input.agent_code' | 'admin_input.code_type' | 'admin_input.payment_by' | 'admin_input.payment_method' | 'admin_input.agent_commission_given_percent' | 'admin_input.agent_extra_percent' | 'admin_input.payment_by_office' | 'admin_input.admin_child_id' | 'notes' | 'cluster' | 'start_date' | 'end_date';

export interface PolicyFormFieldConfig {
  key: PolicyFormFieldPath;
  label: string;
  type: 'text' | 'number' | 'select' | 'date' | 'textarea' | 'checkbox';
  section: 'extracted' | 'admin' | 'policy' | 'vehicle' | 'financial';
  options?: { value: string; label: string }[];
  disabled?: boolean;
  required?: boolean;
  tag?: 'autofill' | 'autocalculated' | 'payment-method-dependent';
}

export const policyFormFields: PolicyFormFieldConfig[] = [
  // ✅ Extracted Data (PDF Extraction) - All have autofill tag
  { key: 'extracted_data.policy_number', label: 'Policy Number', type: 'text', section: 'extracted', required: true, tag: 'autofill' },
  { key: 'extracted_data.formatted_policy_number', label: 'Formatted Policy Number', type: 'text', section: 'extracted', tag: 'autofill' },
  { key: 'extracted_data.major_categorisation', label: 'Major Categorisation', type: 'select', section: 'extracted', tag: 'autofill' },
  { key: 'extracted_data.product_insurer_report', label: 'Product Insurer Report', type: 'text', section: 'extracted', tag: 'autofill' },
  { key: 'extracted_data.product_type', label: 'Product Type', type: 'text', section: 'extracted', tag: 'autofill' },
  { key: 'extracted_data.plan_type', label: 'Plan Type', type: 'select', section: 'extracted', tag: 'autofill' },
  { key: 'extracted_data.customer_name', label: 'Customer Name', type: 'text', section: 'extracted', required: true, tag: 'autofill' },
  { key: 'extracted_data.customer_phone_number', label: 'Customer Phone Number', type: 'text', section: 'extracted', tag: 'autofill' },
  
  // ✅ Vehicle Information
  { key: 'extracted_data.registration_number', label: 'Registration Number', type: 'text', section: 'vehicle', required: true, tag: 'autofill' },
  { key: 'extracted_data.make_model', label: 'Make & Model', type: 'text', section: 'vehicle', tag: 'autofill' },
  { key: 'extracted_data.model', label: 'Model', type: 'text', section: 'vehicle', tag: 'autofill' },
  { key: 'extracted_data.vehicle_variant', label: 'Vehicle Variant', type: 'text', section: 'vehicle', tag: 'autofill' },
  { key: 'extracted_data.gvw', label: 'GVW', type: 'number', section: 'vehicle', tag: 'autofill' },
  { key: 'extracted_data.rto', label: 'RTO', type: 'text', section: 'vehicle', tag: 'autofill' },
  { key: 'extracted_data.state', label: 'State', type: 'text', section: 'vehicle', tag: 'autofill' },
  { key: 'extracted_data.fuel_type', label: 'Fuel Type', type: 'select', section: 'vehicle', tag: 'autofill', options: [
    { value: 'petrol', label: 'Petrol' },
    { value: 'diesel', label: 'Diesel' },
    { value: 'cng', label: 'CNG' },
    { value: 'electric', label: 'Electric' },
    { value: 'hybrid', label: 'Hybrid' }
  ] },
  { key: 'extracted_data.cc', label: 'Engine CC', type: 'number', section: 'vehicle', tag: 'autofill' },
  { key: 'extracted_data.age_year', label: 'Vehicle Age (Years)', type: 'number', section: 'vehicle', tag: 'autofill' },
  { key: 'extracted_data.seating_capacity', label: 'Seating Capacity', type: 'number', section: 'vehicle', tag: 'autofill' },
  { key: 'extracted_data.veh_wheels', label: 'Number of Wheels', type: 'number', section: 'vehicle', tag: 'autofill' },
  { key: 'extracted_data.business_type', label: 'Business Type', type: 'select', section: 'vehicle', tag: 'autofill', options: [
    { value: 'new', label: 'New Business' },
    { value: 'renewal', label: 'Renewal' },
    { value: 'rollover', label: 'Rollover' }
  ] },
  
  // ✅ Premium Information
  { key: 'extracted_data.gross_premium', label: 'Gross Premium', type: 'number', section: 'financial', required: true, tag: 'autofill' },
  { key: 'extracted_data.net_premium', label: 'Net Premium', type: 'number', section: 'financial', tag: 'autofill' },
  { key: 'extracted_data.od_premium', label: 'OD Premium', type: 'number', section: 'financial', tag: 'autofill' },
  { key: 'extracted_data.tp_premium', label: 'TP Premium', type: 'number', section: 'financial', tag: 'autofill' },
  { key: 'extracted_data.gst_amount', label: 'GST Amount', type: 'number', section: 'financial', tag: 'autofill' },
  { key: 'extracted_data.ncb', label: 'NCB', type: 'text', section: 'financial', tag: 'autofill' },
  { key: 'extracted_data.discount_percent', label: 'Discount %', type: 'number', section: 'financial', tag: 'autofill' },
  
  // ✅ Admin Input
  { key: 'admin_input.booking_date', label: 'Booking Date', type: 'date', section: 'admin', required: true },
  { key: 'admin_input.reporting_month', label: 'Reporting Month', type: 'date', section: 'admin' },
  { key: 'admin_input.insurer_code', label: 'Insurer Code', type: 'select', section: 'admin' },
  { key: 'admin_input.broker_code', label: 'Broker Code', type: 'select', section: 'admin' },
  { key: 'admin_input.agent_code', label: 'Agent Code', type: 'select', section: 'admin' },
  { key: 'admin_input.code_type', label: 'Code Type', type: 'select', section: 'admin', options: [
    { value: 'agent', label: 'Agent' },
    { value: 'broker', label: 'Broker' },
    { value: 'direct', label: 'Direct' }
  ] },
  { key: 'admin_input.payment_by', label: 'Payment By', type: 'select', section: 'admin', options: [
    { value: 'customer', label: 'Customer' },
    { value: 'agent', label: 'Agent' },
    { value: 'broker', label: 'Broker' },
    { value: 'company', label: 'Company' }
  ] },
  { key: 'admin_input.payment_method', label: 'Payment Method', type: 'select', section: 'admin', tag: 'payment-method-dependent', options: [
    { value: 'cash', label: 'Cash' },
    { value: 'cheque', label: 'Cheque' },
    { value: 'online', label: 'Online Transfer' },
    { value: 'upi', label: 'UPI' },
    { value: 'card', label: 'Card' },
    { value: 'neft', label: 'NEFT' }
  ] },
  { key: 'admin_input.agent_commission_given_percent', label: 'Agent Commission %', type: 'number', section: 'admin' },
  { key: 'admin_input.payment_by_office', label: 'Payment By Office', type: 'number', section: 'admin', tag: 'payment-method-dependent' },
  { key: 'admin_input.admin_child_id', label: 'Child ID', type: 'select', section: 'admin', required: true },
  
  // ✅ Policy Specific Fields
  { key: 'cluster', label: 'Cluster', type: 'text', section: 'policy' },
  { key: 'notes', label: 'Notes', type: 'textarea', section: 'policy' },
  { key: 'start_date', label: 'Policy Start Date', type: 'date', section: 'policy', required: true },
  { key: 'end_date', label: 'Policy End Date', type: 'date', section: 'policy', required: true },
];

// Helper function to get fields by section
export const getPolicyFieldsBySection = (section: string) => {
  return policyFormFields.filter(field => field.section === section);
};

// Helper function to get required fields
export const getRequiredPolicyFields = () => {
  return policyFormFields.filter(field => field.required);
};
