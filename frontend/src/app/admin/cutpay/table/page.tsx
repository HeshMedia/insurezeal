'use client'
import { CutPayTable } from '@/components/admin/cutpay/cutpay-table'
import React from 'react'

function CutPayTablePage() {
  return (
    <div >
      <h1 className="text-2xl font-bold pl-7 ">CutPay Transactions</h1>
      <CutPayTable />
    </div>
  )
}

export default CutPayTablePage