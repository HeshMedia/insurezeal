'use client'

import { useEffect } from 'react';
import { useWatch, Control, UseFormSetValue } from 'react-hook-form';

import { CutPayFormSchemaType } from './form-schema';

interface CalculationProps {
  control: Control<CutPayFormSchemaType>;
  setValue: UseFormSetValue<CutPayFormSchemaType>;
}

const Calculations: React.FC<CalculationProps> = ({ control, setValue }) => {

  const od_premium = useWatch({ control, name: 'extracted_data.od_premium' }) || 0;
  const commissionable_premium = useWatch({ control, name: 'admin_input.commissionable_premium' }) || 0;
  const incoming_grid_percent = useWatch({ control, name: 'admin_input.incoming_grid_percent' }) || 0;
  const agent_commission_given_percent = useWatch({ control, name: 'admin_input.agent_commission_given_percent' }) || 0;
  const extra_grid = useWatch({ control, name: 'admin_input.extra_grid' }) || 0;
  const agent_extra_percent = useWatch({ control, name: 'admin_input.agent_extra_percent' }) || 0;

  useEffect(() => {
    const receivable_from_broker = commissionable_premium * (incoming_grid_percent / 100);
    const extra_amount_receivable_from_broker = commissionable_premium * (extra_grid / 100);
    const total_receivable_from_broker = receivable_from_broker + extra_amount_receivable_from_broker;
    const total_receivable_from_broker_with_gst = total_receivable_from_broker * 1.18;
    const agent_po_amt = commissionable_premium * (agent_commission_given_percent / 100);
    const agent_extra_amount = commissionable_premium * (agent_extra_percent / 100);
    const total_agent_po_amt = agent_po_amt + agent_extra_amount;
    const cut_pay_amount = od_premium - total_agent_po_amt;

    setValue('calculations.receivable_from_broker', receivable_from_broker, { shouldValidate: true });
    setValue('calculations.extra_amount_receivable_from_broker', extra_amount_receivable_from_broker, { shouldValidate: true });
    setValue('calculations.total_receivable_from_broker', total_receivable_from_broker, { shouldValidate: true });
    setValue('calculations.total_receivable_from_broker_with_gst', total_receivable_from_broker_with_gst, { shouldValidate: true });
    setValue('calculations.cut_pay_amount', cut_pay_amount, { shouldValidate: true });
    setValue('calculations.agent_po_amt', agent_po_amt, { shouldValidate: true });
    setValue('calculations.agent_extra_amount', agent_extra_amount, { shouldValidate: true });
    setValue('calculations.total_agent_po_amt', total_agent_po_amt, { shouldValidate: true });
  }, [od_premium, commissionable_premium, incoming_grid_percent, extra_grid, agent_commission_given_percent, agent_extra_percent, setValue]);

    return (
    <>
      {/* This is a logic-only component, it doesn't render anything */}
    </>
  );
};

export default Calculations;
