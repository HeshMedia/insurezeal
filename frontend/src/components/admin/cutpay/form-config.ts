/* eslint-disable @typescript-eslint/no-explicit-any */
import { AdminInputData, CalculationResult, ExtractedPolicyData } from '@/types/cutpay.types';

// Utility type to create a union of paths from a prefixed object type 
type ObjectToPaths<T, P extends string> = {
  [K in keyof T & string]: `${P}.${K}`;
}[keyof T & string];

// Generate paths for each section
type ExtractedDataPaths = ObjectToPaths<ExtractedPolicyData, 'extracted_data'>;
type AdminInputPaths = ObjectToPaths<AdminInputData, 'admin_input'>;
type CalculationPaths = ObjectToPaths<CalculationResult, 'calculations'>;

// Root level fields
type RootFields = 'claimed_by' | 'running_bal' | 'cutpay_received' | 'notes';

// Combine all valid field paths
export type FormFieldPath = ExtractedDataPaths | AdminInputPaths | CalculationPaths | RootFields;

export interface FormFieldConfig {
  key: FormFieldPath;
  label: string;
  type: 'text' | 'number' | 'select' | 'date' | 'textarea';
  section: 'extracted' | 'admin' | 'calculation';
  options?: { value: string; label: string }[];
  disabled?: boolean;
  tag?: 'autofill' | 'autocalculated' | 'payment-method-dependent';
}

export const formFields: FormFieldConfig[] = [
  //  Extracted Data (in order) - All have autofill tag
  { key: 'extracted_data.policy_number', label: 'Policy Number', type: 'text', section: 'extracted', tag: 'autofill' },
  { key: 'extracted_data.formatted_policy_number', label: 'Formatted Policy Number', type: 'text', section: 'extracted', tag: 'autofill' },
  { key: 'extracted_data.major_categorisation', label: 'Major Categorisation', type: 'select', section: 'extracted', tag: 'autofill' },
  { key: 'extracted_data.product_insurer_report', label: 'Product Insurer Report', type: 'text', section: 'extracted', tag: 'autofill' },
  { key: 'extracted_data.product_type', label: 'Product Type', type: 'select', section: 'extracted', tag: 'autofill', options: [
    { value: 'Vehicle Type', label: 'Vehicle Type' },
    { value: 'Ambulance', label: 'Ambulance' },
    { value: 'Bike', label: 'Bike' },
    { value: 'GCV', label: 'GCV' },
    { value: 'GCV - 3W', label: 'GCV - 3W' },
    { value: 'Misc D', label: 'Misc D' },
    { value: 'Private Car', label: 'Private Car' },
    { value: 'PCV - 3W', label: 'PCV - 3W' },
    { value: 'PCV - 4W', label: 'PCV - 4W' },
    { value: 'Route Bus', label: 'Route Bus' },
    { value: 'School Bus', label: 'School Bus' },
    { value: 'Scooter', label: 'Scooter' },
    { value: 'Staff Bus', label: 'Staff Bus' },
    { value: 'Tractor', label: 'Tractor' }
  ] },
  { key: 'extracted_data.plan_type', label: 'Plan Type', type: 'select', section: 'extracted', tag: 'autofill' },
  { key: 'extracted_data.customer_name', label: 'Customer Name', type: 'text', section: 'extracted', tag: 'autofill' },
  { key: 'extracted_data.customer_phone_number', label: 'Customer Phone Number', type: 'text', section: 'extracted', tag: 'autofill' },
  { key: 'extracted_data.gross_premium', label: 'Gross Premium', type: 'number', section: 'extracted', tag: 'autofill' },
  { key: 'extracted_data.net_premium', label: 'Net Premium', type: 'number', section: 'extracted', tag: 'autofill' },
  { key: 'extracted_data.od_premium', label: 'OD Premium', type: 'number', section: 'extracted', tag: 'autofill' },
  { key: 'extracted_data.tp_premium', label: 'TP Premium', type: 'number', section: 'extracted', tag: 'autofill' },
  { key: 'extracted_data.gst_amount', label: 'GST Amount', type: 'number', section: 'extracted', tag: 'autofill' },
  { key: 'extracted_data.registration_number', label: 'Registration Number', type: 'text', section: 'extracted', tag: 'autofill' },
  { key: 'extracted_data.make_model', label: 'Make & Model', type: 'text', section: 'extracted', tag: 'autofill' },
  { key: 'extracted_data.model', label: 'Model', type: 'text', section: 'extracted', tag: 'autofill' },
  { key: 'extracted_data.vehicle_variant', label: 'Vehicle Variant', type: 'text', section: 'extracted', tag: 'autofill' },
  { key: 'extracted_data.gvw', label: 'GVW', type: 'number', section: 'extracted', tag: 'autofill' },
  { key: 'extracted_data.rto', label: 'RTO', type: 'text', section: 'extracted', tag: 'autofill' },
  { key: 'extracted_data.state', label: 'State', type: 'text', section: 'extracted', tag: 'autofill' },
  { key: 'extracted_data.fuel_type', label: 'Fuel Type', type: 'select', section: 'extracted', tag: 'autofill' },
  { key: 'extracted_data.cc', label: 'CC', type: 'number', section: 'extracted', tag: 'autofill' },
  { key: 'extracted_data.age_year', label: 'Age (Year)', type: 'number', section: 'extracted', tag: 'autofill' },
  { key: 'extracted_data.ncb', label: 'NCB', type: 'text', section: 'extracted', tag: 'autofill' },
  { key: 'extracted_data.discount_percent', label: 'Discount %', type: 'number', section: 'extracted', tag: 'autofill' },
  { key: 'extracted_data.business_type', label: 'Business Type', type: 'text', section: 'extracted', tag: 'autofill' },
  { key: 'extracted_data.seating_capacity', label: 'Seating Capacity', type: 'number', section: 'extracted', tag: 'autofill' },
  { key: 'extracted_data.veh_wheels', label: 'Number of Wheels', type: 'number', section: 'extracted', tag: 'autofill' },
  { key: 'extracted_data.start_date', label: 'Policy Start Date', type: 'date', section: 'extracted', tag: 'autofill' },
  { key: 'extracted_data.end_date', label: 'Policy End Date', type: 'date', section: 'extracted', tag: 'autofill' },
  //  Admin Input (in order) - Some have autocalculated tag
  { key: 'admin_input.booking_date', label: 'Booking Date', type: 'date', section: 'admin' },
  { key: 'admin_input.reporting_month', label: 'Reporting Month', type: 'date', section: 'admin' },

  { key: 'admin_input.code_type', label: 'Code Type', type: 'select', section: 'admin' },
  { key: 'admin_input.insurer_code', label: 'Insurer Code', type: 'select', section: 'admin' },
  { key: 'admin_input.broker_code', label: 'Broker Code', type: 'select', section: 'admin' },
  { key: 'admin_input.admin_child_id', label: 'Child ID', type: 'select', section: 'admin' },
  { key: 'admin_input.agent_code', label: 'Agent Code', type: 'select', section: 'admin' },
  { key: 'admin_input.payout_on', label: 'Payout On', type: 'select', section: 'admin' },
  { key: 'admin_input.incoming_grid_percent', label: 'Incoming Grid %', type: 'number', section: 'admin' },
  { key: 'admin_input.extra_grid', label: 'Incoming Extra Grid %', type: 'number', section: 'admin' },
  { key: 'admin_input.agent_commission_given_percent', label: 'Agent Commission %', type: 'number', section: 'admin' },
  { key: 'admin_input.agent_extra_percent', label: 'Agent Extra Grid %', type: 'number', section: 'admin', disabled: true, tag: 'autocalculated' },

  // OD+TP specific percentage fields - only shown when payout_on = "OD+TP"
  { key: 'admin_input.od_incoming_grid_percent', label: 'OD Incoming Grid %', type: 'number', section: 'admin' },
  { key: 'admin_input.tp_incoming_grid_percent', label: 'TP Incoming Grid %', type: 'number', section: 'admin' },
  { key: 'admin_input.od_incoming_extra_grid', label: 'OD Incoming Extra Grid %', type: 'number', section: 'admin' },
  { key: 'admin_input.tp_incoming_extra_grid', label: 'TP Incoming Extra Grid %', type: 'number', section: 'admin' },
  { key: 'admin_input.od_agent_payout_percent', label: 'OD Agent Payout %', type: 'number', section: 'admin' },
  { key: 'admin_input.tp_agent_payout_percent', label: 'TP Agent Payout %', type: 'number', section: 'admin' },
  
  { key: 'admin_input.commissionable_premium', label: 'Commissionable Premium', type: 'number', section: 'calculation', tag: 'autocalculated' },
  { key: 'admin_input.payment_by', label: 'Payment By', type: 'select', section: 'admin' },
  { key: 'admin_input.payment_method', label: 'Payment Method', type: 'select', section: 'admin', tag: 'payment-method-dependent' },
  { key: 'admin_input.payment_detail', label: 'Payment Detail', type: 'text', section: 'admin', tag: 'payment-method-dependent' },
  { key: 'admin_input.payment_by_office', label: 'Payment By Office', type: 'number', section: 'admin', tag: 'payment-method-dependent' },
  { key: 'claimed_by', label: 'Claimed By', type: 'select', section: 'admin' },
  // { key: 'running_bal', label: 'Running Balance', type: 'number', section: 'admin', tag: 'autocalculated' },
  { key: 'notes', label: 'Notes', type: 'textarea', section: 'admin' },

  // ✅ Calculation (in order) - All have autocalculated tag
  { key: 'calculations.receivable_from_broker', label: 'Receivable from Broker', type: 'number', section: 'calculation', disabled: true, tag: 'autocalculated' },
  { key: 'calculations.extra_amount_receivable_from_broker', label: 'Extra Amount Receivable from Broker', type: 'number', section: 'calculation', disabled: true, tag: 'autocalculated' },
  { key: 'calculations.total_receivable_from_broker', label: 'Total Receivable from Broker', type: 'number', section: 'calculation', disabled: true, tag: 'autocalculated' },
  { key: 'calculations.total_receivable_from_broker_with_gst', label: 'Total Receivable with GST', type: 'number', section: 'calculation', disabled: true, tag: 'autocalculated' },
  { key: 'calculations.cut_pay_amount', label: 'Cut Pay Amount', type: 'number', section: 'calculation', tag: 'autocalculated' },
  { key: 'calculations.agent_po_amt', label: 'Agent PO Amount', type: 'number', section: 'calculation', disabled: true, tag: 'autocalculated' },
  { key: 'calculations.agent_extra_amount', label: 'Agent Extra Amount', type: 'number', section: 'calculation', disabled: true, tag: 'autocalculated' },
  { key: 'calculations.total_agent_po_amt', label: 'Total Agent PO Amount', type: 'number', section: 'calculation', disabled: true, tag: 'autocalculated' },
];

// Generate field mappings automatically from form fields
export const generateEditModeFieldMappings = () => {
  const mappings: Record<string, string> = {};
  
  formFields.forEach(field => {
    // Extract the last part of the path as the API field name
    const pathParts = field.key.split('.');
    const apiFieldName = pathParts[pathParts.length - 1];
    
    // Map API field to form field path
    mappings[apiFieldName] = field.key;
  });
  
  return mappings;
};

// Use the generated mappings
export const editModeFieldMappings = generateEditModeFieldMappings();

// Special field mappings that need transformation or different target fields
export const specialFieldMappings: Record<string, { 
  target: string; 
  transform?: (value: any) => any 
}> = {
  payment_by_office: { 
    target: "admin_input.payment_by_office", 
    transform: (value) => Number(value) 
  },
  insurer_broker_code: { 
    target: "admin_input.insurer_code" 
  },
  // Add other special cases as needed
};

//Function to get all available field mappings for debugging
export const getAllFieldMappings = () => {
  console.log('Generated field mappings:', editModeFieldMappings);
  console.log('Special field mappings:', specialFieldMappings);
  return { editModeFieldMappings, specialFieldMappings };
};
