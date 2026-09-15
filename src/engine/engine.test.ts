import { describe, expect, it } from 'vitest'
import { THEMES } from '../data/benchmarks'
import { locationForZip } from '../data/metro-cola'
import { buildBudget, scaffold } from './model'
import { resolve } from './resolve'

const near = (a: number, b: number, tol = 1) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol)

function built(cap = 6800, income = 10000, cohortId = 'c4') {
  const sc = scaffold(cap, income, cohortId)
  return buildBudget({ incomeMonthly: income, takeHome: cap, cohortId, ...sc })
}

describe('scaffold', () => {
  it('seeds theme shares that sum to 100% for any cohort (incl. Travel)', () => {
    for (const cid of ['c1', 'c2', 'c3', 'c4', 'c5', 'c6']) {
      const sc = scaffold(5000, 6000, cid)
      const total = THEMES.reduce((s, t) => s + (sc.share[t.id] ?? 0), 0)
      near(total, 1, 0.0001)
    }
  })

  it('fits plans inside each theme allocation on a fresh scaffold', () => {
    const sc = scaffold(6800, 10000, 'c4')
    const b = buildBudget({ incomeMonthly: 10000, takeHome: 6800, cohortId: 'c4', ...sc })
    const r = resolve(b)
    expect(r.ok).toBe(true)
    expect(r.totalPlanOver).toBe(0)
  })

  it('scales category averages to the income band', () => {
    const low = scaffold(3000, 3000, 'c1').plan['housing.shelter']
    const high = scaffold(12000, 24000, 'c6').plan['housing.shelter']
    expect(high).toBeGreaterThan(low)
  })
})

describe('localization (ZIP → cost of living)', () => {
  const cat = (b: ReturnType<typeof built>, themeId: string, catId: string) =>
    resolve(b).themes.find((t) => t.id === themeId)!.cats.find((c) => c.id === catId)!

  it('scales every dollar benchmark with the area COL, and the rent rail with the rent factor too', () => {
    const nyc = locationForZip('10001')
    expect(nyc).not.toBeNull()
    const national = built()
    const ny = buildBudget(
      { incomeMonthly: 10000, takeHome: 6800, cohortId: 'c4', ...scaffold(6800, 10000, 'c4', nyc!) },
      nyc!,
    )
    // shelter: national × cola × rentFactor
    near(cat(ny, 'housing', 'shelter').benchAvg, cat(national, 'housing', 'shelter').benchAvg * nyc!.cola * nyc!.rentFactor, 4)
    // non-shelter dollar lines: × cola only
    near(cat(ny, 'food', 'groceries').benchAvg, cat(national, 'food', 'groceries').benchAvg * nyc!.cola, 4)
    // percent-of-income rails (401k) untouched by area
    const rny = resolve(ny)
    expect(rny.themes.find((t) => t.id === 'savings')!.cats.find((c) => c.id === 'k401')!.benchAvg).toBe(
      cat(national, 'savings', 'k401').benchAvg,
    )
  })

  it('keeps percent-of-income benchmarks as fractions, not rounded dollars', () => {
    const nyc = locationForZip('10001')!
    const b = buildBudget({ incomeMonthly: 10000, takeHome: 6800, cohortId: 'c4', ...scaffold(6800, 10000, 'c4', nyc) }, nyc)
    const k401 = b.themes.find((t) => t.id === 'savings')!.cats.find((c) => c.id === 'k401')!
    expect(k401.avg).toBe(0.07)
    expect(k401.median).toBe(0.07)
  })

  it('carries the location onto the resolved budget', () => {
    const nyc = locationForZip('10001')!
    const r = resolve(buildBudget({ incomeMonthly: 10000, takeHome: 6800, cohortId: 'c4', ...scaffold(6800, 10000, 'c4', nyc) }, nyc))
    expect(r.location?.metro).toBe('New York City')
    expect(r.location?.zip).toBe('10001')
  })

  it('stays at national defaults when no ZIP is given', () => {
    const r = resolve(built())
    expect(r.location).toBeUndefined()
    const nyc = locationForZip('10001')!
    const r2 = resolve(built(6800, 10000, 'c4'))
    expect(r2.location).toBeUndefined()
    expect(nyc.cola).toBeGreaterThan(1)
    expect(nyc.rentFactor).toBeGreaterThan(1)
  })

  it('includes rideshare in Transportation as a 7-theme structure', () => {
    const t = THEMES.find((x) => x.id === 'transport')!
    expect(t.cats.some((c) => c.id === 'rideshare')).toBe(true)
  })
})

describe('resolve — cap, themes, categories', () => {
  const r = resolve(built())

  it('allocates the full cap across all 7 themes', () => {
    near(r.cap, 6800)
    near(r.themes.reduce((s, t) => s + t.allocation, 0), 6800)
    expect(r.themes.map((t) => t.id)).toContain('travel')
    expect(r.themes.find((t) => t.id === 'travel')!.cats.length).toBe(3)
  })

  it('keeps shares summing to 100% even after a theme is dragged up', () => {
    const b = built()
    b.themes[0].share = 0.5 // housing demand spikes
    const rr = resolve(b)
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
    const rr = resolve(b)
    const rf = rr.themes.find((t) => t.id === 'food')!
    expect(rf.planOver).toBeGreaterThan(0)
    expect(rr.ok).toBe(false)
  })

  it('explains what an observed spend means: % of cap, delta, and what it frees up', () => {
    const b = built()
    const food = b.themes.find((t) => t.id === 'food')!
    const groceries = food.cats[0]
    groceries.observed = 300 // discovered spend, below the ~$448 plan
    const rr = resolve(b)
    const rg = rr.themes.find((t) => t.id === 'food')!.cats[0]

    expect(rr.totalObserved).toBe(300)
    expect(rg.observedPct).toBeCloseTo(300 / 6800, 5) // "what 6K means as a % of the cap"
    expect(rg.delta).toBeCloseTo(300 - 448, 0)
    expect(rg.surplus).toBeCloseTo(448 - 300, 0)
    expect(rr.themes.find((t) => t.id === 'food')!.reallocatable).toBeCloseTo(148, 0)
    expect(rr.reallocatable).toBeCloseTo(148, 0)
  })

  it('flags spending above plan without ever rewriting the plan', () => {
    const b = built()
    const food = b.themes.find((t) => t.id === 'food')!
    food.cats[0].plan = 100
    food.cats[0].observed = 400
    const rr = resolve(b)
    const rf = rr.themes.find((t) => t.id === 'food')!

    expect(rr.observedOverPlan).toBeCloseTo(300, 0)
    expect(rf.observedOverPlan).toBeCloseTo(300, 0)
    expect(rf.cats[0].plan).toBe(100) // untouched — we only advise
    expect(rf.cats[0].observedPct).toBeCloseTo(400 / 6800, 5)
  })

  it('marks median as absent where BLS publishes only a mean', () => {
    const food = r.themes.find((t) => t.id === 'food')!
    expect(food.cats.find((c) => c.id === 'groceries')!.benchMedian).toBeUndefined()
  })

  it('lists every distinct source used inside a theme, with its link', () => {
    const savings = r.themes.find((t) => t.id === 'savings')!
    const labels = savings.sources.map((s) => s.label).join(' ')
    expect(labels).toContain('Vanguard')
    expect(labels).toContain('FRED')
    expect(labels).toContain('BLS')
    expect(savings.sources.filter((s) => s.url).length).toBeGreaterThanOrEqual(3)
    const travel = r.themes.find((t) => t.id === 'travel')!
    expect(travel.sources[0].label).toContain('LuxMily guide')
  })
})