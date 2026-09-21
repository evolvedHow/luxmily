/**
 * Period (CalendarPeriod) arithmetic. Periods are "YYYY-MM" strings — the
 * published granularity of BLS CPI observations. Kept dependency-free.
 */

import type { Period } from './types'

export function toY(period: Period): number {
  return Number(period.slice(0, 4))
}

export function toM(period: Period): number {
  return Number(period.slice(5, 7))
}

export function make(y: number, m: number): Period {
  return `${Math.trunc(y).toString().padStart(4, '0')}-${Math.trunc(m)
    .toString()
    .padStart(2, '0')}`
}

/** Move a period by an integer number of months (can be negative). */
export function shift(period: Period, months: number): Period {
  const total = toY(period) * 12 + (toM(period) - 1) + months
  const y = Math.floor(total / 12)
  const m = (total % 12) + 1
  return make(y, m)
}

export function addMonths(period: Period, months: number): Period {
  return shift(period, months)
}

/** Whole months from a to b (negative when b precedes a). */
export function monthDiff(a: Period, b: Period): number {
  return toY(b) * 12 + toM(b) - (toY(a) * 12 + toM(a))
}

export function clamp(y: number, lo = 1, hi = 12): number {
  return Math.max(lo, Math.min(hi, y))
}

export const MONTHS_BETWEEN = (a: Period, b: Period): number => monthDiff(a, b)

export function latest(periods: Iterable<Period>): Period | null {
  let out: Period | null = null
  for (const p of periods) if (out === null || p > out) out = p
  return out
}

export function earliest(periods: Iterable<Period>): Period | null {
  let out: Period | null = null
  for (const p of periods) if (out === null || p < out) out = p
  return out
}