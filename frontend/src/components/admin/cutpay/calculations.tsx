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
  const tp_premium = useWatch({ control, name: 'extracted_data.tp_premium' }) || 0;
  const gross_premium = useWatch({ control, name: 'extracted_data.gross_premium' }) || 0;
  const product_type = useWatch({ control, name: 'extracted_data.product_type' });
  const plan_type = useWatch({ control, name: 'extracted_data.plan_type' });
  const commissionable_premium = useWatch({ control, name: 'admin_input.commissionable_premium' }) || 0;
  const incoming_grid_percent = useWatch({ control, name: 'admin_input.incoming_grid_percent' }) || 0;
  const agent_commission_given_percent = useWatch({ control, name: 'admin_input.agent_commission_given_percent' }) || 0;
  const extra_grid = useWatch({ control, name: 'admin_input.extra_grid' }) || 0;
  const agent_extra_percent = useWatch({ control, name: 'admin_input.agent_extra_percent' }) || 0;
  const payment_by = useWatch({ control, name: 'admin_input.payment_by' });
  const payout_on = useWatch({ control, name: 'admin_input.payout_on' });
  const od_agent_payout_percent = useWatch({ control, name: 'admin_input.od_agent_payout_percent' }) || 0;
  const tp_agent_payout_percent = useWatch({ control, name: 'admin_input.tp_agent_payout_percent' }) || 0;
  const od_incoming_grid_percent = useWatch({ control, name: 'admin_input.od_incoming_grid_percent' }) || 0;
  const tp_incoming_grid_percent = useWatch({ control, name: 'admin_input.tp_incoming_grid_percent' }) || 0;
  const od_incoming_extra_grid = useWatch({ control, name: 'admin_input.od_incoming_extra_grid' }) || 0;
  const tp_incoming_extra_grid = useWatch({ control, name: 'admin_input.tp_incoming_extra_grid' }) || 0;
  const payment_by_office = useWatch({ control, name: 'admin_input.payment_by_office' }) || 0;
  const cutpay_received = useWatch({ control, name: 'cutpay_received' }) || 0;
  const cutpay_received_status = useWatch({ control, name: 'cutpay_received_status' });
  const agent_code = useWatch({ control, name: 'admin_input.agent_code' });
  const current_cut_pay_amount = useWatch({ control, name: 'calculations.cut_pay_amount' }) || 0;

  // Get PO Paid to Agent data
  const { data: poPaidData } = useAgentPoPaid(agent_code || '', !!agent_code);
  const poPaidAmount = poPaidData?.total_po_paid || 0;

  // Auto-calculate commissionable premium based on payout_on selection (for reporting)
  useEffect(() => {
    let calculatedCommissionablePremium = 0;
    
    switch (payout_on) {
      case 'OD':
        calculatedCommissionablePremium = od_premium;
        break;
      case 'NP':
        calculatedCommissionablePremium = net_premium;
        break;
      case 'OD+TP':
        calculatedCommissionablePremium = (od_premium || 0) + (tp_premium || 0);
        break;
      default:
        // Fallback to original logic if payout_on is not set
        if (product_type?.toLowerCase().includes('private') && product_type?.toLowerCase().includes('car')) {
          if (
            plan_type?.toLowerCase().includes('comprehensive') ||
            plan_type?.toLowerCase().includes('saod')
          ) {
            calculatedCommissionablePremium = od_premium;
          } else {
            calculatedCommissionablePremium = net_premium;
          }
        } else {
          calculatedCommissionablePremium = net_premium;
        }
        break;
    }

    const roundedCalculatedCommissionablePremium = roundToTwo(calculatedCommissionablePremium);
    if (roundedCalculatedCommissionablePremium !== commissionable_premium) {
      setValue('admin_input.commissionable_premium', roundedCalculatedCommissionablePremium, { shouldValidate: true });
    }
  }, [payout_on, product_type, plan_type, od_premium, net_premium, tp_premium, commissionable_premium, setValue]);

  // Main calculations
  useEffect(() => {
    let receivable_from_broker = 0;
    let agent_po_amt = 0;

    // Use commissionable_premium as the base for extra percentages
    const base_for_extras = commissionable_premium;

    switch (payout_on) {
      case 'OD':
        receivable_from_broker = roundToTwo(od_premium * (incoming_grid_percent / 100));
        agent_po_amt = roundToTwo(od_premium * (agent_commission_given_percent / 100));
        break;
      case 'NP':
        receivable_from_broker = roundToTwo(net_premium * (incoming_grid_percent / 100));
        agent_po_amt = roundToTwo(net_premium * (agent_commission_given_percent / 100));
        break;
      case 'OD+TP':
        // If extra percent exists, add them; otherwise, just use the base.
        const final_od_percent = od_incoming_grid_percent + (od_incoming_extra_grid || 0);
        const final_tp_percent = tp_incoming_grid_percent + (tp_incoming_extra_grid || 0);

        const od_receivable = od_premium * (final_od_percent / 100);
        const tp_receivable = tp_premium * (final_tp_percent / 100);
        receivable_from_broker = roundToTwo(od_receivable + tp_receivable);

        // Similarly for agent payout:
        const od_agent_payout = od_premium * (od_agent_payout_percent / 100);
        const tp_agent_payout = tp_premium * (tp_agent_payout_percent / 100);
        agent_po_amt = roundToTwo(od_agent_payout + tp_agent_payout);
        break;
      default:
        // Fallback to using the auto-calculated commissionable_premium
        receivable_from_broker = roundToTwo(commissionable_premium * (incoming_grid_percent / 100));
        agent_po_amt = roundToTwo(commissionable_premium * (agent_commission_given_percent / 100));
        break;
    }

    const extra_amount_receivable_from_broker = roundToTwo(base_for_extras * (extra_grid / 100));
    const total_receivable_from_broker = roundToTwo(receivable_from_broker + extra_amount_receivable_from_broker);
    const total_receivable_from_broker_with_gst = roundToTwo(total_receivable_from_broker * 1.18);
    
    const agent_extra_amount = roundToTwo(base_for_extras * (agent_extra_percent / 100));
    const total_agent_po_amt = roundToTwo(agent_po_amt + agent_extra_amount);

    // Calculate cut pay amount based on payment mode and cutpay received status
    let cut_pay_amount = 0;
    
    if (payment_by === 'Agent' || cutpay_received_status === 'No') {
      cut_pay_amount = 0; // Zero cutpay for agent payment mode or when cutpay received is "No"
    } else if (payment_by === 'InsureZeal') {
      // Cut Pay amount should be Gross Premium minus the total calculated agent payout
      cut_pay_amount = roundToTwo(gross_premium - total_agent_po_amt);
    } else {
      // For other payment modes, use the appropriate premium based on payout_on
      switch (payout_on) {
        case 'OD':
          cut_pay_amount = roundToTwo(od_premium - total_agent_po_amt);
          break;
        case 'NP':
          cut_pay_amount = roundToTwo(net_premium - total_agent_po_amt);
          break;
        case 'OD+TP':
          cut_pay_amount = roundToTwo((od_premium + tp_premium) - total_agent_po_amt);
          break;
        default:
          // Fallback to using commissionable premium
          cut_pay_amount = roundToTwo(commissionable_premium - total_agent_po_amt);
          break;
      }
    }

    // Check if the current cutpay amount is close to the calculated value (indicating it hasn't been manually edited)
    const existingCutPayAmount = current_cut_pay_amount || 0;
    const isCloseToCalculated = Math.abs(cut_pay_amount - existingCutPayAmount) < 0.01;
    
    // Only update if the value is close to calculated (not manually edited) or if it's currently 0/null
    if (isCloseToCalculated || existingCutPayAmount === 0) {
      setValue('calculations.cut_pay_amount', cut_pay_amount, { shouldValidate: true });
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
  }, [od_premium, net_premium, gross_premium, commissionable_premium, incoming_grid_percent, extra_grid, agent_commission_given_percent, agent_extra_percent, payment_by, payment_by_office, cutpay_received, cutpay_received_status, poPaidAmount, setValue, payout_on, tp_premium, product_type, plan_type, od_agent_payout_percent, tp_agent_payout_percent, od_incoming_grid_percent, tp_incoming_grid_percent, od_incoming_extra_grid, tp_incoming_extra_grid, current_cut_pay_amount]);

  return (
    <>
      {/* This is a logic-only component, it doesn't render anything */}
    </>
  );
};

export default Calculations;
