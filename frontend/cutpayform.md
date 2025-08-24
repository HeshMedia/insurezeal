## InsureZeal – Create CutPay and Create Policy Forms: Complete Functional Explanation (Client Version)

This document explains, in plain language, exactly what our forms do today. It covers:
- Create CutPay transaction flow (all inputs, automatic calculations, if/else decisions, edge cases)
- Create Policy flow (agent-facing/admin mode, calculations, running balance impact)

All formulas shown are the ones currently used in the live form logic. Amounts are rounded to two decimals unless stated otherwise.

### Key terms (simple definitions)
- Gross Premium: Total premium including GST that is paid to the insurer.
- Net Premium: Premium base before our income; used for commission calculations.
- OD Premium: “Own Damage” part of the premium.
- TP Premium: “Third Party” part of the premium.
- Incoming Grid %: Our brokerage percentage (what InsureZeal earns) on the chosen payout basis.
- Extra Grid %: Additional brokerage percentage on top of the incoming grid.
- Agent Commission %: The commission percentage we pay to the agent.
- Agent Extra Grid %: Extra payout percentage for the agent on top of the main commission.
- Payout On: Which premium the payout is based on: OD, NP (Net Premium), or OD+TP (split calculation for OD and TP separately).
- Running Balance: Ongoing balance between InsureZeal and the Agent.
  - Positive running balance: InsureZeal owes money to the Agent.
  - Negative running balance: Agent owes money to InsureZeal.


## Part A: Create CutPay Form (Admin)

### Data sources
- Extracted Data: Auto-filled from the uploaded policy PDF (policy details, premiums, vehicle details).
- Admin Input: Selected/entered by the admin (payout basis, grids, who paid, etc.).
- Auto-calculated: Fields that the form computes from the above (broker receivable, agent payout, cut pay, running balance).

### Fields overview
1) Extracted (auto-filled from PDF)
   - Policy and customer details (policy number, plan, etc.)
   - Premiums: Gross, Net, OD, TP, GST amount
   - Vehicle details (registration number, make/model, variant, etc.)

2) Admin Input
   - Code Type: Direct or Broker
   - Insurer Code, Broker Code
   - Child ID, Agent Code
   - Payout On: OD, NP, OD+TP
   - Grids/Percentages (used depending on Payout On):
     - Incoming Grid % (InsureZeal)
     - Extra Grid % (InsureZeal)
     - Agent Commission % (Agent)
     - Agent Extra Grid % (Agent)
     - When Payout On = OD+TP, we use OD/TP-specific fields:
       - OD Incoming Grid %, TP Incoming Grid %
       - OD Incoming Extra Grid %, TP Incoming Extra Grid %
       - OD Agent Payout %, TP Agent Payout %
   - Payment By: Agent or InsureZeal
     - If InsureZeal is selected, we also use Payment Method, Payment Detail
     - Payment by Office amount is auto-set (see below)
   - Claimed By (who processed), Notes

3) Auto-calculated
   - Commissionable Premium
   - Receivable from Broker
   - Extra Amount Receivable from Broker
   - Total Receivable from Broker
   - Total Receivable from Broker with GST
   - Agent PO Amount (agent payout)
   - Agent Extra Amount
   - Total Agent PO Amount
   - Cut Pay Amount
   - Running Balance

4) Cutpay Received Status (InsureZeal payments only)
   - Status: No / Yes / Partial
   - Cutpay Received Amount: auto-filled or user-entered based on status


### Step-by-step logic and formulas

All amounts are rounded to 2 decimals.

1) Choose Payout Basis: “Payout On”
   - OD: use OD Premium for core calculations
   - NP: use Net Premium
   - OD+TP: calculate OD and TP parts separately and then add them together

2) Commissionable Premium
   - If Payout On = OD: Commissionable = OD Premium
   - If Payout On = NP: Commissionable = Net Premium
   - If Payout On = OD+TP: Commissionable = OD Premium + TP Premium
   - Fallback (when not set):
     - If product is Private Car and plan is Comprehensive or SAOD: use OD Premium
     - Otherwise: use Net Premium

   Formula (general):
   - CommissionablePremium = roundToTwo(value determined by rules above)

3) Receivable from Broker (InsureZeal’s brokerage income portion)
   - If Payout On = OD:
     - ReceivableFromBroker = OD Premium × (Incoming Grid % / 100)
   - If Payout On = NP:
     - ReceivableFromBroker = Net Premium × (Incoming Grid % / 100)
   - If Payout On = OD+TP:
     - For OD: ODReceivable = OD Premium × ((OD Incoming Grid % + OD Incoming Extra Grid %) / 100)
     - For TP: TPReceivable = TP Premium × ((TP Incoming Grid % + TP Incoming Extra Grid %) / 100)
     - ReceivableFromBroker = ODReceivable + TPReceivable
   - Fallback:
     - ReceivableFromBroker = CommissionablePremium × (Incoming Grid % / 100)

   Then we compute an “Extra Amount Receivable from Broker” on top:
   - ExtraAmountReceivable = CommissionablePremium × (Extra Grid % / 100)
   - TotalReceivable = ReceivableFromBroker + ExtraAmountReceivable
   - TotalReceivableWithGST = TotalReceivable × 1.18  (18% GST)

   All three values are rounded to 2 decimals.

4) Agent payout
   - Agent PO Amount (main payout):
     - If Payout On = OD:
       - AgentPO = OD Premium × (Agent Commission % / 100)
     - If Payout On = NP:
       - AgentPO = Net Premium × (Agent Commission % / 100)
     - If Payout On = OD+TP:
       - OD part: OD Premium × (OD Agent Payout % / 100)
       - TP part: TP Premium × (TP Agent Payout % / 100)
       - AgentPO = OD part + TP part
     - Fallback:
       - AgentPO = CommissionablePremium × (Agent Commission % / 100)

   - Agent Extra Amount:
     - AgentExtra = CommissionablePremium × (Agent Extra Grid % / 100)

   - Total Agent PO Amount:
     - TotalAgentPO = AgentPO + AgentExtra

   All agent values are rounded to 2 decimals.

5) Cut Pay Amount
   - If Payment By = Agent:
     - CutPay = 0
   - Else if Payment By = InsureZeal:
     - CutPay = Gross Premium − TotalAgentPO
   - Else (rare case, other payment sources): depends on Payout On
     - OD: CutPay = OD Premium − TotalAgentPO
     - NP: CutPay = Net Premium − TotalAgentPO
     - OD+TP: CutPay = (OD Premium + TP Premium) − TotalAgentPO
     - Fallback: CutPay = CommissionablePremium − TotalAgentPO

   Rounded to 2 decimals. If you manually edit CutPay, the system respects your figure (we won’t overwrite it unless your value is effectively the same as our computed result).

6) Cutpay Received Status and Amount (for InsureZeal payments)
   - Status = No → CutpayReceived = 0
   - Status = Yes or Partial → pre-fills CutpayReceived with CutPay (you can edit for partial receipts)

7) Payment By and Payment by Office
   - If Payment By = InsureZeal → PaymentByOffice is auto-set to Gross Premium
   - If Payment By = Agent → PaymentByOffice is auto-set to 0

8) Running Balance (ongoing settlement between InsureZeal and the Agent)
   - We also factor in “PO Paid to Agent” fetched from past records for that agent.
   - Formula:
     - RunningBalance = PaymentByOffice − TotalAgentPO − CutpayReceived + POPaidToAgent
   - Interpretation:
     - Positive RunningBalance → InsureZeal owes the Agent that amount
     - Negative RunningBalance → Agent owes InsureZeal that amount
   - Rounded to 2 decimals.


### Visibility rules (what shows/hides automatically)
- Payout On = OD+TP:
  - Hide the regular single-field grids (Incoming Grid %, Extra Grid %, Agent Commission %, Agent Extra Grid %)
  - Show OD/TP-specific fields: OD/TP Incoming Grid %, OD/TP Incoming Extra Grid %, OD/TP Agent Payout %
- Payment By = Agent:
  - Hide Payment Method and Payment Detail
  - Set PaymentByOffice = 0
  - CutPay = 0
- Payment Method not selected → Hide Payment Detail
- Code Type = Direct → Hide Broker Code


### Rounding rule
- Every monetary figure is rounded to two decimals at the time of calculation.


### Edge cases handled today
- OD+TP correctly splits OD and TP for both brokerage and agent payout, using separate percentages, and adds them.
- If Payout On isn’t chosen, we fall back to sensible defaults (Private Car Comprehensive/SAOD → OD; otherwise → Net Premium).
- “Cutpay Received” is controlled by the status and pre-filled only when helpful (Yes/Partial).
- Payment By = Agent forces CutPay = 0 and adjusts Running Balance accordingly.
- GST for “Total Receivable with GST” is a fixed 18% on Total Receivable.
- If values are missing, we treat them as 0 in computations to avoid errors.


### Worked examples

Example 1: Payment By = InsureZeal, Payout On = NP
- Inputs:
  - Net Premium = ₹50,000
  - Gross Premium = ₹59,000
  - Incoming Grid % = 10%
  - Extra Grid % = 2%
  - Agent Commission % = 8%
  - Agent Extra Grid % = 1%
  - Cutpay Received Status = Yes (received fully)
  - POPaidToAgent (historical) = ₹0
- Steps:
  1) CommissionablePremium = Net Premium = 50,000
  2) ReceivableFromBroker = 50,000 × 10% = 5,000
  3) ExtraAmountReceivable = 50,000 × 2% = 1,000
  4) TotalReceivable = 5,000 + 1,000 = 6,000
  5) TotalReceivableWithGST = 6,000 × 1.18 = 7,080
  6) AgentPO = 50,000 × 8% = 4,000
  7) AgentExtra = 50,000 × 1% = 500
  8) TotalAgentPO = 4,500
  9) PaymentBy = InsureZeal → CutPay = Gross − TotalAgentPO = 59,000 − 4,500 = 54,500
  10) CutpayReceived Status = Yes → CutpayReceived = 54,500
  11) PaymentByOffice = Gross = 59,000
  12) RunningBalance = 59,000 − 4,500 − 54,500 + 0 = 0 → “Account is balanced”.

Example 2: Payment By = Agent, Payout On = OD+TP
- Inputs:
  - OD Premium = ₹20,000; TP Premium = ₹6,000; Gross = ₹30,680 (for reference only)
  - OD Incoming Grid % = 7%; OD Incoming Extra Grid % = 1%
  - TP Incoming Grid % = 3%; TP Incoming Extra Grid % = 1%
  - OD Agent Payout % = 5%; TP Agent Payout % = 2%
  - Extra Grid % (global) = 1% (applied to commissionable premium)
  - Agent Extra Grid % = 0.5%
  - POPaidToAgent (historical) = ₹2,000
- Steps:
  1) CommissionablePremium = OD + TP = 20,000 + 6,000 = 26,000
  2) ReceivableFromBroker =
     - OD: 20,000 × (7% + 1%) = 20,000 × 8% = 1,600
     - TP: 6,000 × (3% + 1%) = 6,000 × 4% = 240
     - Sum = 1,600 + 240 = 1,840
  3) ExtraAmountReceivable = 26,000 × 1% = 260
  4) TotalReceivable = 1,840 + 260 = 2,100
  5) TotalReceivableWithGST = 2,100 × 1.18 = 2,478
  6) AgentPO = (20,000 × 5%) + (6,000 × 2%) = 1,000 + 120 = 1,120
  7) AgentExtra = 26,000 × 0.5% = 130
  8) TotalAgentPO = 1,120 + 130 = 1,250
  9) PaymentBy = Agent → CutPay = 0
  10) PaymentByOffice = 0 (because paid by Agent)
  11) RunningBalance = 0 − 1,250 − 0 + 2,000 = +750 → InsureZeal owes Agent ₹750


## Part B: Create Policy Form (Agent/Admin)

This form creates a policy record and, when InsureZeal pays, shows how the new policy affects Running Balance.

### Fields overview
- Extracted from PDF (auto-fill): policy number, plan, customer and vehicle details, premiums (Gross, Net, OD, TP), GST.
- Admin inputs: Code Type, Insurer/Broker, Agent Code, Child ID, Agent Commission %, Payment By/Method, Booking Date, Notes, Cluster, Start/End Dates.
- Auto-calculated (display): Total Agent Payout Amount; Running Balance impact when Payment By = InsureZeal.

### Policy formulas and flow
1) Total Agent Payout Amount
   - TotalAgentPayout = Net Premium × (Agent Commission % / 100)
2) If Payment By = InsureZeal, we compute the difference that affects Running Balance
   - Difference = TotalAgentPayout − Gross Premium
   - NewRunningBalance = OriginalRunningBalance + Difference
   - Interpretation:
     - Positive NewRunningBalance → InsureZeal owes Agent
     - Negative NewRunningBalance → Agent owes InsureZeal
3) If Payment By ≠ InsureZeal
   - We do not apply the above Running Balance adjustment in the policy form for this transaction.

All amounts are rounded to 2 decimals. The form shows simple text explanations for clarity (“InsureZeal owes …” or “Agent owes …” or “Account is balanced”).

### Visibility and defaults
- Start Date defaults to today; End Date defaults to one year ahead (both editable).
- Child ID selection is filtered based on chosen Insurer/Broker (so agents only see valid Child IDs).
- When Payment By = InsureZeal, we display the detailed calculation and the Running Balance message.

### Edge cases handled today
- Missing numbers default to 0 in calculations to avoid errors.
- Required fields (Policy Number, Policy Type, Start/End Dates, Agent Code, Child ID) must be filled to submit.

### Simple example (Policy)
- Inputs:
  - Net Premium = ₹40,000; Gross Premium = ₹47,200
  - Agent Commission % = 10%
  - Payment By = InsureZeal
  - Original Running Balance = ₹2,000 (InsureZeal already owed Agent ₹2,000)
- Steps:
  1) TotalAgentPayout = 40,000 × 10% = 4,000
  2) Difference = 4,000 − 47,200 = −43,200
  3) NewRunningBalance = 2,000 + (−43,200) = −41,200 → Agent owes InsureZeal ₹41,200


## Important notes for all forms
- Rounding: We round to two decimals to avoid confusing cents-level differences.
- Manual override: If you manually set Cut Pay Amount in CutPay, we keep your value unless it’s effectively identical to our computed value.
- Interpretation of Running Balance:
  - Positive → We owe the agent
  - Negative → Agent owes us
  - Zero → Balanced

This document reflects the current behavior of the forms in production and can be used as the source of truth for reviews and training.


