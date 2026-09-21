import { describe, expect, it } from 'vitest'
import { THEMES } from '../data/benchmarks'
import { locationForZip } from '../data/metro-cola'
import { buildBudget, scaffold } from './model'
import { resolve } from './resolve'

const near = (a: number, b: number, tol = 1) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol)

function built(cap = 6800, income = 10000, cohortId = 'c4') {
  const sc = scaffold(cap, income, cohortId)
  return buildBudget({ incomeMonthly: income, takeHome: cap, cohortId, ...sc, locked: {} })
}

describe('scaffold', () => {
  it('never seeds a plan that overruns the cap, for any cohort', () => {
    for (const cid of ['c1', 'c2', 'c3', 'c4', 'c5', 'c6']) {
      const sc = scaffold(5000, 6000, cid)
      const total = THEMES.reduce(
        (s, t) => s + t.cats.reduce((x, c) => x + (sc.plan[`${t.id}.${c.id}`] ?? 0), 0),
        0,
      )
      expect(total).toBeGreaterThan(0)
      expect(total).toBeLessThanOrEqual(5000)
    }
  })

  it('leaves a fresh scaffold inside the cap, with any shortfall in the bucket', () => {
    const sc = scaffold(6800, 10000, 'c4')
    const r = resolve(buildBudget({ incomeMonthly: 10000, takeHome: 6800, cohortId: 'c4', ...sc, locked: {} }))
    expect(r.ok).toBe(true)
    // Benchmarks can seed under the cap — that surplus is real money and
    // belongs in the unallocated bucket, not quietly rounded away.
    expect(r.unallocated).toBeGreaterThanOrEqual(0)
    expect(r.unallocated).toBeLessThan(r.cap * 0.05)
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
      { incomeMonthly: 10000, takeHome: 6800, cohortId: 'c4', ...scaffold(6800, 10000, 'c4', nyc!), locked: {} },
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
    const b = buildBudget({ incomeMonthly: 10000, takeHome: 6800, cohortId: 'c4', ...scaffold(6800, 10000, 'c4', nyc), locked: {} }, nyc)
    const k401 = b.themes.find((t) => t.id === 'savings')!.cats.find((c) => c.id === 'k401')!
    expect(k401.avg).toBe(0.07)
    expect(k401.median).toBe(0.07)
  })

  it('carries the location onto the resolved budget', () => {
    const nyc = locationForZip('10001')!
    const r = resolve(buildBudget({ incomeMonthly: 10000, takeHome: 6800, cohortId: 'c4', ...scaffold(6800, 10000, 'c4', nyc), locked: {} }, nyc))
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

  it('spreads the cap across all 7 themes', () => {
    near(r.cap, 6800)
    expect(r.themes.length).toBe(7)
    near(r.themes.reduce((s, t) => s + t.planTotal, 0), 6800, 6800 * 0.05)
    expect(r.themes.map((t) => t.id)).toContain('travel')
    expect(r.themes.find((t) => t.id === 'travel')!.cats.length).toBe(3)
  })

  it('derives a theme share from its categories, never the reverse', () => {
    const b = built()
    const food = b.themes.find((t) => t.id === 'food')!
    const before = resolve(b).themes.find((t) => t.id === 'food')!.share
    food.cats[0].plan += 500
    const after = resolve(b).themes.find((t) => t.id === 'food')!.share
    near(after - before, 500 / 6800, 0.0001)
  })

  it('does NOT renormalize other themes when one grows — that is the bucket now', () => {
    const b = built()
    const housingBefore = resolve(b).themes.find((t) => t.id === 'housing')!.planTotal
    const foodBefore = resolve(b).themes.find((t) => t.id === 'food')!.planTotal

    b.themes.find((t) => t.id === 'housing')!.cats[0].plan += 800
    const rr = resolve(b)

    expect(rr.themes.find((t) => t.id === 'housing')!.planTotal).toBe(housingBefore + 800)
    // The old solver would have shrunk Food to keep shares at 100%. It must not.
    expect(rr.themes.find((t) => t.id === 'food')!.planTotal).toBe(foodBefore)
    expect(rr.unallocated).toBeCloseTo(resolve(built()).unallocated - 800, 6)
  })

  it('checks the pay-yourself-first rails against the user income', () => {
    const k401 = r.payFirst.find((c) => c.id === 'k401')!
    const emergency = r.payFirst.find((c) => c.id === 'emergency')!
    near(k401.benchAvg, 10000 * 0.07)
    near(emergency.benchAvg, 6800 * 0.05)
    expect(k401.benchMedian).not.toBeUndefined()
  })

  it('goes over-cap (not over-theme) and never rewrites the plan', () => {
    const b = built()
    const food = b.themes.find((t) => t.id === 'food')!
    food.cats[0].plan = 9000
    const rr = resolve(b)

    // A theme can no longer overrun itself — it *is* its own total. The only
    // line that can be crossed is the cap.
    expect(rr.unallocated).toBeLessThan(0)
    expect(rr.ok).toBe(false)
    expect(rr.themes.find((t) => t.id === 'food')!.cats[0].plan).toBe(9000) // untouched
  })

  it('frees money into the bucket when a category is trimmed', () => {
    const b = built()
    const before = resolve(b).unallocated
    b.themes.find((t) => t.id === 'food')!.cats[0].plan -= 300
    expect(resolve(b).unallocated).toBeCloseTo(before + 300, 6)
  })

  it('reports each theme locked subtotal and whether it can move at all', () => {
    const b = built()
    const food = b.themes.find((t) => t.id === 'food')!
    food.cats[0].locked = true
    const rf = resolve(b).themes.find((t) => t.id === 'food')!
    expect(rf.lockedTotal).toBe(food.cats[0].plan)
    expect(rf.fullyLocked).toBe(false)
    for (const c of food.cats) c.locked = true
    expect(resolve(b).themes.find((t) => t.id === 'food')!.fullyLocked).toBe(true)
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