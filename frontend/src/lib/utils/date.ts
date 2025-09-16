// utils/date.ts
import { getQuarter, parse } from 'date-fns'

export type Quarter = 1 | 2 | 3 | 4

export function getCurrentYearQuarter(d: Date = new Date()): { year: number; quarter: Quarter } {
  const year = d.getFullYear() // integer like 2025
  const quarter = getQuarter(d) as Quarter // 1..4
  return { year, quarter }
}

export function getYearQuarterFromMonth(value: string): { year: number; quarter: Quarter } {
  // value like "YYYY-MM" (from <input type="month">)
  const date = parse(value, 'yyyy-MM', new Date())
  if (isNaN(date.getTime())) {
    throw new Error('Invalid month string. Expected "YYYY-MM".')
  }
  const year = date.getFullYear()
  const quarter = getQuarter(date) as Quarter
  return { year, quarter }
}
