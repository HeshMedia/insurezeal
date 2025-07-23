'use client'

import { useEffect } from 'react';
import { useWatch, Control, UseFormSetValue } from 'react-hook-form';
import { useAgentPoPaid } from '@/hooks/cutpayQuery';

import { CutPayFormSchemaType } from './form-schema';

interface CalculationProps {
  control: Control<CutPayFormSchemaType>;
  setValue: UseFormSetValue<CutPayFormSchemaType>;
}

const roundToTwo = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;

const Calculations: React.FC<CalculationProps> = ({ control, setValue }) => {

  // Watch all necessary fields for calculations
  const od_premium = useWatch({ control, name: 'extracted_data.od_premium' }) || 0;
  const net_premium = useWatch({ control, name: 'extracted_data.net_premium' }) || 0;
  const gross_premium = useWatch({ control, name: 'extracted_data.gross_premium' }) || 0;
  const product_type = useWatch({ control, name: 'extracted_data.product_type' });
  const plan_type = useWatch({ control, name: 'extracted_data.plan_type' });
  const commissionable_premium = useWatch({ control, name: 'admin_input.commissionable_premium' }) || 0;
  const incoming_grid_percent = useWatch({ control, name: 'admin_input.incoming_grid_percent' }) || 0;
  const agent_commission_given_percent = useWatch({ control, name: 'admin_input.agent_commission_given_percent' }) || 0;
  const extra_grid = useWatch({ control, name: 'admin_input.extra_grid' }) || 0;
  const agent_extra_percent = useWatch({ control, name: 'admin_input.agent_extra_percent' }) || 0;
  const payment_by = useWatch({ control, name: 'admin_input.payment_by' });
  const payment_by_office = useWatch({ control, name: 'admin_input.payment_by_office' }) || 0;
  const cutpay_received = useWatch({ control, name: 'cutpay_received' }) || 0;
  const agent_code = useWatch({ control, name: 'admin_input.agent_code' });

  // Get PO Paid to Agent data
  const { data: poPaidData } = useAgentPoPaid(agent_code || '', !!agent_code);
  const poPaidAmount = poPaidData?.total_po_paid || 0;

  // Auto-calculate commissionable premium based on product type and plan type
  useEffect(() => {
    let calculatedCommissionablePremium = 0;
    
    // Check if product is private car and plan type is comprehensive
    if (product_type?.toLowerCase().includes('private') && product_type?.toLowerCase().includes('car')) {
      if (plan_type?.toLowerCase().includes('comp') || plan_type?.toLowerCase().includes('comprehensive')) {
        // For comprehensive private car, use total OD amount
        calculatedCommissionablePremium = od_premium;
      } else {
        // For other types (STP, SAOD), use net premium (F)
        calculatedCommissionablePremium = net_premium;
      }
    } else {
      // For non-private car products, default to net premium (F)
      calculatedCommissionablePremium = net_premium;
    }

    const roundedCalculatedCommissionablePremium = roundToTwo(calculatedCommissionablePremium);
    if (roundedCalculatedCommissionablePremium !== commissionable_premium) {
      setValue('admin_input.commissionable_premium', roundedCalculatedCommissionablePremium, { shouldValidate: true });
    }
  }, [product_type, plan_type, od_premium, net_premium, commissionable_premium, setValue]);

  // Main calculations
  useEffect(() => {
    const receivable_from_broker = roundToTwo(commissionable_premium * (incoming_grid_percent / 100));
    const extra_amount_receivable_from_broker = roundToTwo(commissionable_premium * (extra_grid / 100));
    const total_receivable_from_broker = roundToTwo(receivable_from_broker + extra_amount_receivable_from_broker);
    const total_receivable_from_broker_with_gst = roundToTwo(total_receivable_from_broker * 1.18);
    const agent_po_amt = roundToTwo(commissionable_premium * (agent_commission_given_percent / 100));
    const agent_extra_amount = roundToTwo(commissionable_premium * (agent_extra_percent / 100));
    const total_agent_po_amt = roundToTwo(agent_po_amt + agent_extra_amount);

    // Calculate cut pay amount based on payment mode
    let cut_pay_amount = 0;
    if (payment_by === 'Agent') {
      cut_pay_amount = 0; // Zero cutpay for agent payment mode
    } else if (payment_by === 'InsureZeal') {
      // Cut Pay amount = gross premium - (net premium * agent payout%)
      const agent_payout_percentage = agent_commission_given_percent / 100;
      cut_pay_amount = roundToTwo(gross_premium - (net_premium * agent_payout_percentage));
    } else {
      // Default calculation for other payment modes
      cut_pay_amount = roundToTwo(od_premium - total_agent_po_amt);
    }

    // New calculations for backend payload
    const iz_total_po_percent = roundToTwo(incoming_grid_percent + extra_grid);
    const already_given_to_agent = 0; // Defaulted to 0 for new transactions
    // broker_payout_amount is set to 0 as broker_po_percent is not available in the form
    const broker_payout_amount = 0;

    // Calculate running balance: Payment by Office - Total Agent Payout Amount - Cutpay Amount Received + PO Paid to Agent
    const running_balance = roundToTwo(payment_by_office - total_agent_po_amt - cutpay_received + poPaidAmount);

    setValue('calculations.receivable_from_broker', receivable_from_broker, { shouldValidate: true });
    setValue('calculations.extra_amount_receivable_from_broker', extra_amount_receivable_from_broker, { shouldValidate: true });
    setValue('calculations.total_receivable_from_broker', total_receivable_from_broker, { shouldValidate: true });
    setValue('calculations.total_receivable_from_broker_with_gst', total_receivable_from_broker_with_gst, { shouldValidate: true });
    setValue('calculations.cut_pay_amount', cut_pay_amount, { shouldValidate: true });
    setValue('calculations.agent_po_amt', agent_po_amt, { shouldValidate: true });
    setValue('calculations.agent_extra_amount', agent_extra_amount, { shouldValidate: true });
    setValue('calculations.total_agent_po_amt', total_agent_po_amt, { shouldValidate: true });
    setValue('calculations.iz_total_po_percent', iz_total_po_percent, { shouldValidate: true });
    setValue('calculations.already_given_to_agent', already_given_to_agent, { shouldValidate: true });
    setValue('calculations.broker_payout_amount', broker_payout_amount, { shouldValidate: true });
    setValue('running_bal', running_balance, { shouldValidate: true });
  }, [
    od_premium, 
    net_premium, 
    gross_premium, 
    commissionable_premium, 
    incoming_grid_percent, 
    extra_grid, 
    agent_commission_given_percent, 
    agent_extra_percent, 
    payment_by, 
    payment_by_office, 
    cutpay_received, 
    poPaidAmount, 
    setValue
  ]);

  return (
    <>
      {/* This is a logic-only component, it doesn't render anything */}
    </>
  );
};

export default Calculations;
