import { describe, expect, it } from 'vitest'
import { THEMES } from '../data/benchmarks'
import { buildBudget, scaffold } from './model'
import { resolve } from './resolve'

const near = (a: number, b: number, tol = 1) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol)

function built(cap = 6800, income = 10000, cohortId = 'c4') {
  const sc = scaffold(cap, income, cohortId)
  return buildBudget({ incomeMonthly: income, takeHome: cap, cohortId, ...sc })
}

describe('scaffold', () => {
  it('seeds theme shares that sum to 100% for any cohort', () => {
    for (const cid of ['c1', 'c2', 'c3', 'c4', 'c5', 'c6']) {
      const sc = scaffold(5000, 6000, cid)
      const total = THEMES.reduce((s, t) => s + (sc.share[t.id] ?? 0), 0)
      near(total, 1, 0.0001)
    }
  })

  it('fits plans inside each theme allocation on a fresh scaffold', () => {
    const sc = scaffold(6800, 10000, 'c4')
    const b = buildBudget({ incomeMonthly: 10000, takeHome: 6800, cohortId: 'c4', ...sc })
    const r = resolve(b, 15, 30)
    expect(r.ok).toBe(true)
    expect(r.totalPlanOver).toBe(0)
  })

  it('scales category averages to the income band', () => {
    const low = scaffold(3000, 3000, 'c1').plan['housing.shelter']
    const high = scaffold(12000, 24000, 'c6').plan['housing.shelter']
    expect(high).toBeGreaterThan(low)
  })
})

describe('resolve — cap, themes, categories', () => {
  const r = resolve(built(), 15, 30)

  it('allocates the full cap across themes', () => {
    near(r.cap, 6800)
    near(r.themes.reduce((s, t) => s + t.allocation, 0), 6800)
  })

  it('keeps shares summing to 100% even after a theme is dragged up', () => {
    const b = built()
    b.themes[0].share = 0.5 // housing demand spikes
    const rr = resolve(b, 15, 30)
    near(rr.themes.reduce((s, t) => s + t.share, 0), 1, 0.0001)
    expect(rr.themes[0].allocation).toBeGreaterThan(r.themes[0].allocation)
    expect(rr.themes.find((t) => t.id === 'food')!.allocation).toBeLessThan(
      r.themes.find((t) => t.id === 'food')!.allocation,
    )
  })

  it('checks the pay-yourself-first rails against the user income', () => {
    const k401 = r.payFirst.find((c) => c.id === 'k401')!
    const emergency = r.payFirst.find((c) => c.id === 'emergency')!
    near(k401.benchAvg, 10000 * 0.07)
    near(emergency.benchAvg, 6800 * 0.05)
    expect(k401.benchMedian).not.toBeUndefined()
  })

  it('turns red when a category plan overruns its theme allocation', () => {
    const b = built()
    const food = b.themes.find((t) => t.id === 'food')!
    food.cats[0].plan = 5000
    const rr = resolve(b, 15, 30)
    const rf = rr.themes.find((t) => t.id === 'food')!
    expect(rf.planOver).toBeGreaterThan(0)
    expect(rr.ok).toBe(false)
  })

  it('turns red when actuals outrun plans — never auto-fixed', () => {
    const b = built()
    const food = b.themes.find((t) => t.id === 'food')!
    food.cats[0].plan = 100
    food.cats[0].actual = 400
    const rr = resolve(b, 15, 30)
    // The whole theme has to overspend to go red — a lone category over its own
    // plan is a pacing flag, and plans/actuals are never rewritten here.
    expect(rr.totalSpendOver).toBeGreaterThan(0)
    expect(rr.ok).toBe(false)
    expect(rr.themes.find((t) => t.id === 'food')!.cats[0].overPlan).toBe(300)
  })

  it('reports a healthy buffer when nothing is red', () => {
    expect(r.buffer).toBeGreaterThanOrEqual(0)
    expect(r.totalPlanOver).toBe(0)
  })

  it('marks median as absent where BLS publishes only a mean', () => {
    const food = r.themes.find((t) => t.id === 'food')!
    expect(food.cats.find((c) => c.id === 'groceries')!.benchMedian).toBeUndefined()
  })
})