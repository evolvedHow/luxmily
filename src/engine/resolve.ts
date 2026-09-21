import { cohortById, cohortScale } from '../data/benchmarks'
import type { Budget, BudgetCategory, BudgetTheme } from './types'
import { EPS } from './prorate'
import type { ResolvedBudget, ResolvedCategory, ResolvedTheme } from './types'

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

/** Distinct sources backing this theme's rows (theme-level + each category). */
function distinctSources(t: BudgetTheme): { label: string; url?: string }[] {
  const seen = new Map<string, { label: string; url?: string }>()
  const add = (label: string, url?: string) => {
    if (!label) return
    if (!seen.has(label)) seen.set(label, { label, url })
  }
  add(t.benchSource, undefined)
  for (const c of t.cats) add(c.source, c.url)
  return [...seen.values()]
}

/**
 * The single entry point the UI calls.
 *
 * Dollars are the model. A theme's share is derived from what its categories
 * plan, not the other way round, so a theme can never "overrun its allocation"
 * — it simply is its allocation. The only line that can be crossed is the Cap,
 * and crossing it shows up as a negative `unallocated` bucket.
 *
 * Nothing is ever rewritten here. Redistribution happens in the store (via
 * `prorate`) in response to a deliberate user action; `resolve` only reports.
 */
export function resolve(budget: Budget): ResolvedBudget {
  const cap = Math.max(0, budget.takeHome)
  const cohort = cohortById(budget.cohortId)
  const scale = cohortScale(cohort)
  const income = Math.max(0, budget.incomeMonthly)

  const themes: ResolvedTheme[] = budget.themes.map((t) => {
    const cats: ResolvedCategory[] = t.cats.map((c) => {
      const plan = Math.max(0, c.plan)
      const median = medianDollars(c, income, cap, scale)
      return {
        id: c.id,
        themeId: t.id,
        label: c.label,
        locked: c.locked,
        plan,
        benchAvg: Math.round(benchDollars(c, income, cap, scale)),
        benchMedian: median === undefined ? undefined : Math.round(median),
        benchMedianNote: c.medianNote,
        benchSource: c.source,
        benchUrl: c.url,
        payFirst: c.payFirst,
        flex: c.flex,
      }
    })

    const planTotal = cats.reduce((s, c) => s + c.plan, 0)
    const lockedTotal = cats.filter((c) => c.locked).reduce((s, c) => s + c.plan, 0)

    return {
      id: t.id,
      label: t.label,
      payFirst: t.payFirst,
      locked: t.locked,
      share: cap > 0 ? planTotal / cap : 0,
      planTotal,
      lockedTotal,
      fullyLocked: cats.length > 0 && cats.every((c) => c.locked),
      benchShare: t.benchShare,
      benchSource: t.benchSource,
      sources: distinctSources(t),
      cats,
    }
  })

  const totalPlan = themes.reduce((s, t) => s + t.planTotal, 0)
  const payFirst = themes.flatMap((t) => t.cats.filter((c) => c.payFirst))
  const unallocated = cap - totalPlan

  return {
    incomeMonthly: income,
    takeHome: cap,
    cap,
    cohortId: budget.cohortId,
    cohortLabel: budget.cohortLabel,
    ...(budget.location ? { location: budget.location } : {}),
    themes,
    payFirst,
    totalPlan,
    unallocated,
    ok: unallocated >= -EPS,
  }
}
