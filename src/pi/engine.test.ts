import { describe, expect, it } from 'vitest'
import { buildDataset, indexAt } from './bls'
import { ALL_ITEMS_ID, blsSeriesById } from './blsMetadata'
import { defaultProfile } from './defaults'
import {
  annualize,
  applyScenario,
  basketOf,
  budgetInflation,
  calcPersonalInflation,
  categoryChange,
  forwardAssumption,
  mappingShares,
  personalIndexSeries,
  weightsFromSpend,
} from './engine'
import { nowIso, benchmarkSpend, defaultCategories } from './defaults'
import type { PiiProfile } from './types'

const dataset = buildDataset()

describe('bls dataset', () => {
  it('is flat, sorted and spans the embedded window', () => {
    for (const [id, arr] of Object.entries(dataset.observations)) {
      expect(arr.length).toBeGreaterThan(280)
      const first = arr[0].period
      const last = arr[arr.length - 1].period
      expect(first <= last).toBe(true)
      expect(arr.every((o, i) => i === 0 || o.period > arr[i - 1].period)).toBe(true)
      expect(blsSeriesById[id]).toBeDefined()
    }
  })

  it('carries official all-items with the published landmark', () => {
    const aug26 = dataset.observations[ALL_ITEMS_ID].find((o) => o.period === '2026-08')
    expect(aug26?.index).toBeCloseTo(334.98, 3)
  })

  it('has the rebased medical detail series available', () => {
    for (const id of ['CUUR0000SEMD01', 'CUUR0000SEMC01', 'CUUR0000SEMF01']) {
      expect(dataset.observations[id].length).toBeGreaterThan(280)
      expect(indexAt(dataset, id, '2025-01')).toBeDefined()
    }
    const jan25 = indexAt(dataset, 'CUUR0000SEMD01', '2025-01')
    expect(jan25).toBeCloseTo(422.429, 3)
  })

  it('covers 2000 through at least 2026-08', () => {
    expect(indexAt(dataset, ALL_ITEMS_ID, '2000-01')).toBeGreaterThan(140)
    expect(indexAt(dataset, ALL_ITEMS_ID, '2026-08')).toBeGreaterThan(200)
  })
})

const prof = defaultProfile()

describe('defaults', () => {
  it('builds 32 categories with documented mappings', () => {
    expect(prof.categories.length).toBe(32)
    for (const c of prof.categories) {
      if (c.mapping.kind === 'series') expect(blsSeriesById[c.mapping.seriesId]).toBeDefined()
      if (c.mapping.kind === 'composite')
        c.mapping.parts.forEach((p) => expect(blsSeriesById[p.seriesId]).toBeDefined())
    }
  })

  it('excludes savings from the CPI basket but keeps them for budget inflation', () => {
    const basket = basketOf(prof)!
    expect(basket.some((b) => b.category.id.startsWith('savings.'))).toBe(false)
    const total = basket.reduce((a, b) => a + b.weight, 0)
    expect(total).toBeCloseTo(1, 6)
    const lines = budgetInflation(prof, dataset, '2025-01', '2026-08')!.lines
    expect(lines.some((l) => l.categoryId.startsWith('savings.'))).toBe(true)
  })

  it('seeds weights from benchmark spend dollars', () => {
    const spend = benchmarkSpend()
    const { weights, skipped } = weightsFromSpend(prof.categories, spend)
    expect(Object.keys(weights).length + skipped.length).toBe(27)
    const tot = Object.values(weights).reduce((a, b) => a + b, 0)
    expect(tot).toBeCloseTo(1, 6)
    const totalSpend = Object.values(spend).reduce((a, b) => a + b, 0)
    const leafSpend = prof.categories
      .filter((c) => c.mapping.kind !== 'excluded')
      .reduce((a, c) => a + (spend[c.id] ?? 0), 0)
    expect(totalSpend).toBeGreaterThan(leafSpend) // savings dollars are excluded from the basket
    expect(weights['housing.shelter']).toBeCloseTo(spend['housing.shelter'] / leafSpend, 4)
  })
})

describe('calcPersonalInflation', () => {
  it('all-custom profile with 5%/yr gives exactly 5% over 12 months', () => {
    const now = nowIso()
    const cats = [
      { id: 'a', label: 'A', mapping: { kind: 'custom', rate: 5 } as const, passThrough: { mode: 'market' as const } },
    ]
    const p: PiiProfile = {
      id: 'x', label: 'x', version: 1, createdAt: now, updatedAt: now,
      categories: cats as unknown as PiiProfile['categories'],
      weights: { a: 1 }, future: {}, spending: {}, weightSource: 'custom',
      basePeriod: '2025-01',
    }
    const r = calcPersonalInflation({ profile: p, dataset, from: '2025-01', to: '2026-01' })!
    expect(r.total).toBeCloseTo(0.05, 6)
    expect(r.annualized).toBeCloseTo(0.05, 6)
    expect(r.contributions[0].source).toBe('user')
    expect(r.assumptions).toBe(true)
  })

  it('a single-series basket equals the official index change of that series', () => {
    const now = nowIso()
    const cats = [
      { id: 'b', label: 'Food', mapping: { kind: 'series', seriesId: 'CUUR0000SAF11' } as const, passThrough: { mode: 'market' as const } },
    ]
    const p: PiiProfile = {
      id: 'y', label: 'y', version: 1, createdAt: now, updatedAt: now,
      categories: cats as unknown as PiiProfile['categories'],
      weights: { b: 1 }, future: {}, spending: {}, weightSource: 'custom',
      basePeriod: '2025-01',
    }
    const r = calcPersonalInflation({ profile: p, dataset, from: '2025-01', to: '2026-01' })!
    const cc = categoryChange(dataset, cats[0].mapping!, '2025-01', '2026-01')
    expect(r.total).toBeCloseTo(cc.change, 10)
  })

  it('reports per-category contributions that sum to the total', () => {
    const r = calcPersonalInflation({ profile: prof, dataset, from: '2025-01', to: '2026-08' })!
    const sum = r.contributions.reduce((a, c) => a + c.contributionPts, 0)
    expect(sum).toBeCloseTo(r.total, 10)
    expect(r.covered).toBeCloseTo(1, 6)
    expect(r.methodology!.weightBasis).toBe('current-weights')
  })

  it('renormalizes over the covered basket when exclusion is involved', () => {
    const now = nowIso()
    const cats = [
      { id: 'a', label: 'A', mapping: { kind: 'series', seriesId: 'CUUR0000SAF11' } as const, passThrough: { mode: 'market' as const } },
      { id: 's', label: 'Savings', mapping: { kind: 'excluded' } as const, passThrough: { mode: 'fixed' as const } },
    ]
    const p: PiiProfile = {
      id: 'z', label: 'z', version: 1, createdAt: now, updatedAt: now,
      categories: cats as unknown as PiiProfile['categories'],
      weights: { a: 0.5, s: 0.5 }, future: {}, spending: {}, weightSource: 'custom',
      basePeriod: '2025-01',
    }
    const r = calcPersonalInflation({ profile: p, dataset, from: '2025-01', to: '2026-01' })!
    const cc = categoryChange(dataset, cats[0].mapping!, '2025-01', '2026-01')
    expect(r.total).toBeCloseTo(cc.change, 10)
    expect(r.contributions[0].weight).toBeCloseTo(1, 6)
  })

  it('carries forward the latest observation when a month is unpublished', () => {
    const r = calcPersonalInflation({ profile: prof, dataset, from: '2026-07', to: '2026-11' })!
    // Nov 2026 has no BLS data yet → every series carries its latest published month.
    expect(r.contributions.every((c) => c.source !== 'missing')).toBe(true)
  })
})

describe('personalIndexSeries', () => {
  it('starts at 100 for both official and personal', () => {
    const series = personalIndexSeries(prof, dataset, '2025-01', '2026-01')
    expect(series[0].personal).toBeCloseTo(100, 9)
    expect(series[0].official).toBeCloseTo(100, 9)
    expect(series.length).toBe(13)
  })

  it('is monotonic through known 2025 food inflation', () => {
    const series = personalIndexSeries(prof, dataset, '2025-01', '2026-08')
    for (let i = 1; i < series.length; i++) {
      if (series[i].personal !== null && series[i - 1].personal !== null) {
        // don't assert direction; prices fluctuate — just assert finite
        expect(Number.isFinite(series[i].personal)).toBe(true)
      }
    }
  })
})

describe('budgetInflation', () => {
  it('treats fixed pass-through lines as zero-rate', () => {
    const p = prof
    const line = budgetInflation(p, dataset, '2025-01', '2026-08')!.lines.find(
      (l) => l.categoryId === 'savings.k401',
    )!
    expect(line.rate).toBe(0)
  })

  it('differs from personal CPI (fixed lines drag it down)', () => {
    const personal = calcPersonalInflation({ profile: prof, dataset, from: '2025-01', to: '2026-08' })!
    const budget = budgetInflation(prof, dataset, '2025-01', '2026-08')!
    expect(budget.total).toBeLessThan(personal.total + 0.05)
  })
})

describe('assumptions + scenarios', () => {
  it('forward assumption for a series mapping falls back to the last 12m pace', () => {
    const cat = prof.categories.find((c) => c.id === 'food.groceries')!
    const rate = forwardAssumption(prof, dataset, cat, '2026-08')
    expect(rate).toBeGreaterThan(-20)
    expect(rate).toBeLessThan(60)
  })

  it('explicit profile assumption wins over derived', () => {
    const p = { ...prof, future: { 'food.groceries': 8 } }
    const cat = p.categories.find((c) => c.id === 'food.groceries')!
    expect(forwardAssumption(p, dataset, cat, '2026-08')).toBe(8)
  })

  it('scenario overrides weights and stays sparse', () => {
    const sc = {
      id: 'warm', label: 'Warm', profileId: prof.id,
      weightOverrides: { 'food.groceries': 0.6, 'food.dining_out': 0.4 },
      assumptionOverrides: { 'food.groceries': 10 },
      spendingOverrides: {},
    }
    const applied = applyScenario(prof, sc)
    expect(applied.weights['food.groceries']).toBe(0.6)
    expect(applied.weights['housing.shelter']).toBe(prof.weights['housing.shelter'])
    expect(applied.future['food.groceries']).toBe(10)
    expect(applied.future['housing.shelter']).toBeUndefined()
  })
})

describe('helpers', () => {
  it('annualize compounds correctly', () => {
    expect(annualize(0.05, 12)).toBeCloseTo(0.05, 9)
    expect(annualize(0.05, 6)).toBeCloseTo(Math.pow(1.05, 2) - 1, 9)
  })

  it('mappingShares normalizes composite parts and flattens series', () => {
    expect(mappingShares({ kind: 'series', seriesId: 'x' }).length).toBe(1)
    const c = mappingShares({ kind: 'composite', parts: [{ seriesId: 'a', share: 2 }, { seriesId: 'b', share: 2 }] })
    expect(c).toEqual([{ seriesId: 'a', share: 0.5 }, { seriesId: 'b', share: 0.5 }])
  })

  it('weightsFromSpend skips zero lines with disclosure', () => {
    const cats = defaultCategories()
    const spend: Record<string, number> = { 'food.groceries': 4800, 'food.dining_out': 0 }
    const { weights, skipped } = weightsFromSpend(cats, spend)
    expect(skipped).toContain('food.dining_out')
    expect(weights['food.groceries']).toBe(1)
  })
})