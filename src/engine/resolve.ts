import { cohortById, cohortScale } from '../data/benchmarks'
import { combinePacing, pace, paceFixed } from './pacing'
import { allocate, boundsFor } from './solver'
import type {
  Budget,
  BudgetCategory,
  Pacing,
  ResolvedBudget,
  ResolvedCategory,
  ResolvedTheme,
} from './types'

function paceCat(c: BudgetCategory, planned: number, day: number, totalDays: number): Pacing {
  return c.fixedCadence ? paceFixed(planned, c.actual, day, totalDays) : pace(planned, c.actual, day, totalDays)
}

function benchDollars(c: BudgetCategory, income: number, takeHome: number, scale: number): number {
  if (c.pctOf === 'gross') return income * c.avg
  if (c.pctOf === 'takehome') return takeHome * c.avg
  return c.avg * scale
}

function medianDollars(c: BudgetCategory, income: number, takeHome: number, scale: number): number | undefined {
  if (c.median === undefined) return undefined
  if (c.pctOf === 'gross') return income * c.median
  if (c.pctOf === 'takehome') return takeHome * c.median
  return c.median * scale
}

/**
 * The single entry point the UI calls. Theme shares always sum to 1 — the solver
 * re-normalizes whichever theme the user drags so the percentages stay enforced
 * green. Dollars are the user's own: category plans over a theme's allocation and
 * actuals over plan are reported as red, never silently fixed.
 */
export function resolve(budget: Budget, day: number, totalDays: number): ResolvedBudget {
  const cap = Math.max(0, budget.takeHome)
  const cohort = cohortById(budget.cohortId)
  const scale = cohortScale(cohort)
  const income = Math.max(0, budget.incomeMonthly)

  const themeBounds = budget.themes.map((t) => boundsFor(t.id, 'elastic', Math.max(0, t.share)))
  const themeAlloc = allocate(1, themeBounds)

  const themes: ResolvedTheme[] = budget.themes.map((t) => {
    const share = themeAlloc.alloc[t.id] ?? 0
    const allocation = cap * share

    const cats: ResolvedCategory[] = t.cats.map((c) => {
      const plan = Math.max(0, c.plan)
      const actual = Math.max(0, c.actual)
      const median = medianDollars(c, income, cap, scale)
      return {
        id: c.id,
        themeId: t.id,
        label: c.label,
        lock: c.lock,
        plan,
        actual,
        benchAvg: Math.round(benchDollars(c, income, cap, scale)),
        benchMedian: median === undefined ? undefined : Math.round(median),
        benchMedianNote: c.medianNote,
        benchSource: c.source,
        payFirst: c.payFirst,
        flex: c.flex,
        fixedCadence: c.fixedCadence,
        pacing: paceCat(c, plan, day, totalDays),
        overPlan: Math.max(0, actual - plan),
      }
    })

    const planTotal = cats.reduce((s, c) => s + c.plan, 0)
    const actualTotal = cats.reduce((s, c) => s + c.actual, 0)
    return {
      id: t.id,
      label: t.label,
      payFirst: t.payFirst,
      targetShare: t.share,
      share,
      allocation,
      planTotal,
      actualTotal,
      planOver: Math.max(0, planTotal - allocation),
      spendOver: Math.max(0, actualTotal - planTotal),
      benchShare: t.benchShare,
      benchSource: t.benchSource,
      pacing: combinePacing(cats.map((c) => c.pacing), day, totalDays),
      cats,
    }
  })

  const totalPlan = themes.reduce((s, t) => s + t.planTotal, 0)
  const totalActual = themes.reduce((s, t) => s + t.actualTotal, 0)
  const totalPlanOver = themes.reduce((s, t) => s + t.planOver, 0)
  const totalSpendOver = themes.reduce((s, t) => s + t.spendOver, 0)
  const payFirst = themes.flatMap((t) => t.cats.filter((c) => c.payFirst))

  return {
    incomeMonthly: income,
    takeHome: cap,
    cap,
    cohortId: budget.cohortId,
    cohortLabel: budget.cohortLabel,
    themes,
    payFirst,
    totalPlan,
    totalActual,
    totalPlanOver,
    totalSpendOver,
    buffer: cap - totalPlan,
    ok: totalPlanOver === 0 && totalSpendOver === 0,
    day,
    totalDays,
  }
}