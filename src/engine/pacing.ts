import type { Pacing } from './types'

/** Tolerance band before we call something off-pace, as a share of expected. */
const ON_PACE_BAND = 0.05

function classify(expected: number, actual: number, deltaPct: number): Pacing['status'] {
  if (expected <= 0) return actual > 0 ? 'over' : 'on-pace'
  if (deltaPct > ON_PACE_BAND) return 'over'
  if (deltaPct < -ON_PACE_BAND) return 'under'
  return 'on-pace'
}

function build(planned: number, actual: number, expected: number, dayFraction: number): Pacing {
  const delta = actual - expected
  const deltaPct = expected > 0 ? delta / expected : 0
  return {
    planned,
    actual,
    expected,
    delta,
    deltaPct,
    projected: dayFraction > 0 ? actual / dayFraction : 0,
    status: classify(expected, actual, deltaPct),
    dayFraction,
  }
}

export function dayFractionOf(day: number, totalDays: number): number {
  return totalDays > 0 ? Math.min(1, Math.max(0, day / totalDays)) : 0
}

/**
 * Pacing for variable spending — dining, travel, discretionary. Straight-line:
 * by day 26 of 31 you'd expect ~84% of plan consumed.
 *
 * `status` is directionless on purpose — "over" means above the expected line,
 * which is bad for LIVE and good for SAVE. The caller decides how to colour it.
 */
export function pace(planned: number, actual: number, day: number, totalDays: number): Pacing {
  const f = dayFractionOf(day, totalDays)
  return build(planned, actual, planned * f, f)
}

/**
 * Pacing for fixed-cadence items — rent, insurance, loan payments, payroll
 * contributions. These land in full on a due date rather than accruing daily, so
 * straight-lining them reports a ~40% overrun on day 26 every single month. The
 * expectation is simply the full planned amount.
 */
export function paceFixed(planned: number, actual: number, day: number, totalDays: number): Pacing {
  const f = dayFractionOf(day, totalDays)
  return build(planned, actual, planned, f)
}

/**
 * Roll child pacing up to a container. Expectations are summed from the children
 * rather than recomputed from the parent total, so a group of mixed fixed and
 * variable items reports an honest expectation instead of an averaged fiction.
 */
export function combinePacing(children: Pacing[], day: number, totalDays: number): Pacing {
  const f = dayFractionOf(day, totalDays)
  const planned = children.reduce((s, c) => s + c.planned, 0)
  const actual = children.reduce((s, c) => s + c.actual, 0)
  const expected = children.reduce((s, c) => s + c.expected, 0)
  return build(planned, actual, expected, f)
}
