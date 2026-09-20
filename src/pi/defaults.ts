/**
 * Default PII profile — seeded from the app's own benchmark categories (the
 * seven THEMES) mapped onto official BLS CPI-U series. The profile's starting
 * weights come from BLS CEX benchmark dollars (weightSource 'spend'), and are
 * a disclosure-heavy starting point the user adjusts or replaces via "seed from
 * budget".
 */

import { THEMES, cohortById, COHORTS } from '../data/benchmarks'
import { weightsFromSpend } from './engine'
import type { CostType, Mapping, PassThrough, PersonalCategory, PiiProfile } from './types'

export const DEFAULT_BASE_PERIOD = '2025-01'
export const DEFAULT_PROFILE_ID = 'default'
export const DEFAULT_SCALE_COHORT = 'c3'

/** Income anchors used to estimate pct-offset benchmark lines (k401, emergency). */
export const DEFAULT_GROSS_MONTHLY = 7_700
export const DEFAULT_TAKEHOME_MONTHLY = 5_700

type Override = {
  mapping?: Mapping
  cost?: CostType
  passThrough?: PassThrough
}

const M: Record<string, Override> = {
  'housing.shelter': { mapping: { kind: 'series', seriesId: 'CUUR0000SAH1' }, cost: 'contractual' },
  'housing.utilities': { mapping: { kind: 'series', seriesId: 'CUUR0000SAH2' }, cost: 'semi-variable' },
  'housing.home_maint': { mapping: { kind: 'series', seriesId: 'CUUR0000SAH3' }, cost: 'discretionary' },
  'housing.home_insurance': { mapping: { kind: 'custom', rate: 4 }, cost: 'fixed' },

  'food.groceries': { mapping: { kind: 'series', seriesId: 'CUUR0000SAF11' }, cost: 'variable' },
  'food.dining_out': { mapping: { kind: 'series', seriesId: 'CUUR0000SEFV' }, cost: 'discretionary' },

  'transport.vehicle_payment': {
    mapping: { kind: 'composite', parts: [{ seriesId: 'CUUR0000SETA01', share: 0.58 }, { seriesId: 'CUUR0000SETA02', share: 0.42 }] },
    cost: 'contractual',
  },
  'transport.vehicle_insurance': { mapping: { kind: 'series', seriesId: 'CUUR0000SETE' }, cost: 'fixed' },
  'transport.gas': { mapping: { kind: 'series', seriesId: 'CUUR0000SETB01' }, cost: 'variable' },
  'transport.maintenance': { mapping: { kind: 'series', seriesId: 'CUUR0000SETD' }, cost: 'semi-variable' },
  'transport.public_transit': { mapping: { kind: 'series', seriesId: 'CUUR0000SETG' }, cost: 'variable' },
  'transport.rideshare': {
    mapping: { kind: 'composite', parts: [{ seriesId: 'CUUR0000SETG', share: 0.5 }, { seriesId: 'CUUR0000SETB01', share: 0.5 }] },
    cost: 'discretionary',
  },
  'transport.parking_tolls': { mapping: { kind: 'custom', rate: 3 }, cost: 'fixed', passThrough: { mode: 'fixed' } },

  'healthcare.health_insurance': { mapping: { kind: 'series', seriesId: 'CUUR0000SAM1' }, cost: 'contractual' },
  'healthcare.medical_services': {
    mapping: { kind: 'composite', parts: [{ seriesId: 'CUUR0000SEMD01', share: 0.55 }, { seriesId: 'CUUR0000SEMC01', share: 0.45 }] },
    cost: 'semi-variable',
  },
  'healthcare.prescriptions': { mapping: { kind: 'series', seriesId: 'CUUR0000SEMF01' }, cost: 'variable' },
  'healthcare.dental_vision': { mapping: { kind: 'custom', rate: 4 }, cost: 'discretionary' },

  'savings.k401': { mapping: { kind: 'excluded' }, cost: 'fixed', passThrough: { mode: 'fixed' } },
  'savings.roth': { mapping: { kind: 'excluded' }, cost: 'fixed', passThrough: { mode: 'fixed' } },
  'savings.emergency': { mapping: { kind: 'excluded' }, cost: 'fixed', passThrough: { mode: 'fixed' } },
  'savings.life_insurance': { mapping: { kind: 'excluded' }, cost: 'fixed', passThrough: { mode: 'fixed' } },
  'savings.investments': { mapping: { kind: 'excluded' }, cost: 'fixed', passThrough: { mode: 'fixed' } },

  'travel.airfare': { mapping: { kind: 'series', seriesId: 'CUUR0000SETG01' }, cost: 'discretionary' },
  'travel.lodging': { mapping: { kind: 'series', seriesId: 'CUUR0000SEHB' }, cost: 'discretionary' },
  'travel.ground': { mapping: { kind: 'custom', rate: 3 }, cost: 'discretionary' },

  'other.entertainment': { mapping: { kind: 'series', seriesId: 'CUUR0000SAR' }, cost: 'discretionary' },
  'other.subscriptions': { mapping: { kind: 'custom', rate: 4 }, cost: 'fixed' },
  'other.mobile': { mapping: { kind: 'series', seriesId: 'CUUR0000SAE' }, cost: 'semi-variable' },
  'other.internet': { mapping: { kind: 'custom', rate: 3 }, cost: 'fixed' },
  'other.apparel': { mapping: { kind: 'series', seriesId: 'CUUR0000SAA' }, cost: 'discretionary' },
  'other.personal_care': { mapping: { kind: 'series', seriesId: 'CUUR0000SAG' }, cost: 'discretionary' },
  'other.misc': { mapping: { kind: 'series', seriesId: 'CUUR0000SA0' }, cost: 'discretionary' },
}

export function nowIso(): string {
  return new Date().toISOString()
}

function buildCategories(): PersonalCategory[] {
  const cats: PersonalCategory[] = []
  for (const theme of THEMES) {
    for (const cat of theme.cats) {
      const key = `${theme.id}.${cat.id}`
      const over = M[key]
      cats.push({
        id: key,
        label: cat.label,
        parentId: theme.id,
        mapping: over?.mapping ?? { kind: 'series', seriesId: 'CUUR0000SA0' },
        cost: over?.cost ?? 'variable',
        passThrough: over?.passThrough ?? { mode: 'market' },
      })
    }
  }
  return cats
}

/** Annual benchmark spend per category id, from the app's BLS CEX rails. */
export function benchmarkSpend(): Record<string, number> {
  const out: Record<string, number> = {}
  const cohort = cohortById(DEFAULT_SCALE_COHORT)
  for (const theme of THEMES) {
    for (const cat of theme.cats) {
      const key = `${theme.id}.${cat.id}`
      const b = cat.bench
      if (b.pctOf === 'gross') out[key] = (b.avg ?? 0.07) * DEFAULT_GROSS_MONTHLY * 12
      else if (b.pctOf === 'takehome') out[key] = (b.avg ?? 0.05) * DEFAULT_TAKEHOME_MONTHLY * 12
      else out[key] = (b.avg ?? 0) * 12
    }
  }
  // Bring the saved envelope in line with the cohort's published savings share.
  const scale = cohort.avgAnnualSpend / COHORTS.find((c) => c.id === 'c3')!.avgAnnualSpend
  out['savings.k401'] = (out['savings.k401'] ?? 0) * scale
  out['savings.emergency'] = (out['savings.emergency'] ?? 0) * scale
  return out
}

export function defaultCategories(): PersonalCategory[] {
  return buildCategories()
}

export function defaultProfile(): PiiProfile {
  const categories = buildCategories()
  const spend = benchmarkSpend()
  const { weights } = weightsFromSpend(categories, spend)
  const now = nowIso()
  return {
    id: DEFAULT_PROFILE_ID,
    label: 'My personal CPI',
    version: 1,
    createdAt: now,
    updatedAt: now,
    categories,
    weights,
    future: {},
    spending: spend,
    weightSource: 'spend',
    basePeriod: DEFAULT_BASE_PERIOD,
    notes:
      'Seeded from the app benchmark set (BLS Consumer Expenditure Survey 2024 averages) mapped onto official BLS CPI-U series. Edit any category or use “seed from budget” for your own spending shape.',
  }
}