import { describe, expect, it } from 'vitest'
import { buildBudget, scaffold } from '../engine/model'
import { resolve } from '../engine/resolve'
import { currentPersonalCpi, latestPublishedPeriod, seriesRate } from './personalCpi'
import { ALL_ITEMS_ID } from './blsMetadata'
import type { ResolvedBudget } from '../engine/types'

/** A resolved budget with an optional per-category plan override. */
function budget(overrides: Record<string, number> = {}): ResolvedBudget {
  const sc = scaffold(6800, 10000, 'c4')
  return resolve(
    buildBudget({
      incomeMonthly: 10000,
      takeHome: 6800,
      cohortId: 'c4',
      plan: { ...sc.plan, ...overrides },
      locked: {},
    }),
  )
}

describe('pII — personal Inflation index', () => {
  it('produces a rate against the headline, from the embedded BLS snapshot', () => {
    const p = currentPersonalCpi(budget())
    expect(p.asOf).toBe(latestPublishedPeriod())
    expect(p.ratePct).not.toBeNull()
    expect(p.officialPct).toBeCloseTo(seriesRate(ALL_ITEMS_ID, p.asOf!)!, 10)
    // Sane band — this is an inflation rate, not an index level.
    expect(p.ratePct!).toBeGreaterThan(-20)
    expect(p.ratePct!).toBeLessThan(40)
  })

  it('is exactly the sum of its per-line contributions', () => {
    const p = currentPersonalCpi(budget())
    const summed = p.contributions.reduce((s, c) => s + c.contributionPts, 0)
    expect(p.ratePct!).toBeCloseTo(summed, 10)
  })

  it('weights sum to 100% on both the personal and the CPI side', () => {
    const p = currentPersonalCpi(budget())
    expect(p.contributions.reduce((s, c) => s + c.weightPct, 0)).toBeCloseTo(100, 6)
    const official = p.contributions.reduce((s, c) => s + (c.officialWeightPct ?? 0), 0)
    // Custom-rate lines have no CPI counterpart, so the official side covers
    // most but not all of the basket — it must never exceed 100%.
    expect(official).toBeGreaterThan(50)
    expect(official).toBeLessThanOrEqual(100.000001)
  })

  it('theme rollup reconciles with the line-level contributions', () => {
    const p = currentPersonalCpi(budget())
    expect(p.themes.reduce((s, t) => s + t.contributionPts, 0)).toBeCloseTo(p.ratePct!, 10)
    expect(p.themes.reduce((s, t) => s + t.weightPct, 0)).toBeCloseTo(100, 6)
    for (const t of p.themes) {
      const lines = p.contributions.filter((c) => c.themeId === t.themeId)
      expect(t.plan).toBeCloseTo(lines.reduce((s, c) => s + c.plan, 0), 6)
    }
  })

  it('holds savings out of the basket — saving is not consumption', () => {
    const p = currentPersonalCpi(budget())
    expect(p.excludedPlan).toBeGreaterThan(0)
    expect(p.contributions.some((c) => c.themeId === 'savings')).toBe(false)
    expect(p.themes.some((t) => t.themeId === 'savings')).toBe(false)
  })

  it('reweighting is the whole mechanism: the same rates give a different number', () => {
    // Gasoline is the fastest-rising line in the snapshot. A budget dominated
    // by it must land above one that barely touches it — without any rate
    // changing, only the weights.
    const light = currentPersonalCpi(budget({ 'transport.gas': 20 }))
    const heavy = currentPersonalCpi(budget({ 'transport.gas': 4000 }))

    const gasRate = (p: ReturnType<typeof currentPersonalCpi>) =>
      p.contributions.find((c) => c.catId === 'gas')!.inflationPct
    expect(gasRate(heavy)).toBeCloseTo(gasRate(light)!, 10) // same rate…
    expect(heavy.ratePct!).toBeGreaterThan(light.ratePct!) // …different index
  })

  it("a low-housing budget feels less of the nation's shelter inflation", () => {
    const p = currentPersonalCpi(budget({ 'housing.shelter': 100 }))
    const shelter = p.contributions.find((c) => c.catId === 'shelter')!
    // The user's own weight collapses while the national basket's does not —
    // this gap is precisely what pII exists to express.
    expect(shelter.weightPct).toBeLessThan(shelter.officialWeightPct!)
  })

  it('no single line carries an absurd share of the official basket', () => {
    // Guards the `other.misc` regression: it maps to the All-items series,
    // whose published relative importance is 1.0 (the entire basket).
    const p = currentPersonalCpi(budget())
    for (const c of p.contributions) {
      expect(c.officialWeightPct ?? 0).toBeLessThan(50)
    }
  })

  it('degrades to zero-plan budgets without throwing', () => {
    // buildBudget seeds benchmark defaults for any absent plan key, so an
    // empty `plan` map is NOT an empty budget — zero every line explicitly.
    const b = buildBudget({ incomeMonthly: 0, takeHome: 0, cohortId: 'c3', plan: {}, locked: {} })
    for (const t of b.themes) for (const c of t.cats) c.plan = 0
    const p = currentPersonalCpi(resolve(b))
    expect(p.coveredPlan).toBe(0)
    expect(p.contributions).toHaveLength(0)
    expect(p.themes).toHaveLength(0)
    expect(p.ratePct).toBeNull()
  })
})
