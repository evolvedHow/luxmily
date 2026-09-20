/**
 * Validation for PII profiles, scenarios and datasets.
 * Returns a human-readable list; callers decide how to surface warnings.
 */

import { blsSeriesById } from './blsMetadata'
import type { PiiProfile, PiiScenario, BlsDataset, Mapping } from './types'
import { coveredWeight } from './engine'

export interface PiiIssue {
  path: string
  level: 'error' | 'warn'
  message: string
}

const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/

function checkMapping(mapping: Mapping, path: string, out: PiiIssue[], series: Record<string, unknown>) {
  switch (mapping.kind) {
    case 'series':
      if (!series[mapping.seriesId]) out.push({ path, level: 'error', message: `Unknown BLS series ${mapping.seriesId}` })
      break
    case 'composite': {
      if (mapping.parts.length === 0) out.push({ path, level: 'error', message: 'Composite is empty' })
      for (const p of mapping.parts) {
        if (!series[p.seriesId]) out.push({ path, level: 'error', message: `Unknown BLS series ${p.seriesId} in composite` })
        if (!Number.isFinite(p.share) || p.share <= 0) out.push({ path, level: 'warn', message: 'Composite share must be positive' })
      }
      break
    }
    case 'custom':
      if (!Number.isFinite(mapping.rate) || mapping.rate < -100 || mapping.rate > 1000)
        out.push({ path, level: 'error', message: `Unexpected custom rate ${mapping.rate}%/yr` })
      break
    case 'excluded':
      break
  }
}

export function validateProfile(p: PiiProfile): PiiIssue[] {
  const out: PiiIssue[] = []
  if (!p.id || !p.label) out.push({ path: 'profile', level: 'error', message: 'Profile needs an id and label' })

  const ids = new Set<string>()
  for (const c of p.categories) {
    if (ids.has(c.id)) out.push({ path: 'categories', level: 'error', message: `Duplicate category id ${c.id}` })
    ids.add(c.id)
    if (c.parentId && !ids.has(c.parentId) && !p.categories.some((x) => x.id === c.parentId))
      out.push({ path: `categories.${c.id}`, level: 'warn', message: `Parent ${c.parentId} not found` })
    checkMapping(c.mapping, `categories.${c.id}.mapping`, out, blsSeriesById)
    if (c.passThrough.mode === 'custom' && !Number.isFinite(c.passThrough.rate))
      out.push({ path: `categories.${c.id}.passThrough`, level: 'error', message: 'Custom pass-through rate required' })
  }

  for (const [id, w] of Object.entries(p.weights)) {
    if (!ids.has(id)) out.push({ path: `weights.${id}`, level: 'error', message: 'Weight for unknown category' })
    if (!Number.isFinite(w) || w < 0 || w > 1) out.push({ path: `weights.${id}`, level: 'error', message: 'Weight must be 0..1' })
  }
  const covered = coveredWeight(p)
  if (Math.abs(covered - 1) > 0.02) out.push({ path: 'weights', level: 'warn', message: `Covered weights sum to ${covered.toFixed(2)}, not 1` })

  for (const [id, r] of Object.entries(p.future)) {
    if (!ids.has(id)) out.push({ path: `future.${id}`, level: 'error', message: 'Assumption for unknown category' })
    if (!Number.isFinite(r) || r < -99 || r > 500) out.push({ path: `future.${id}`, level: 'warn', message: `Odd assumption ${r}%/yr` })
  }
  for (const [id, s] of Object.entries(p.spending)) {
    if (!ids.has(id)) out.push({ path: `spending.${id}`, level: 'warn', message: 'Spend for unknown category' })
    if (!Number.isFinite(s) || s < 0) out.push({ path: `spending.${id}`, level: 'error', message: 'Spend must be ≥ 0' })
  }
  if (!PERIOD.test(p.basePeriod)) out.push({ path: 'basePeriod', level: 'warn', message: `Base period ${p.basePeriod} is not YYYY-MM` })
  if (p.version < 1) out.push({ path: 'version', level: 'error', message: 'Version must be ≥ 1' })

  return out
}

export function validateScenario(p: PiiProfile, s: PiiScenario): PiiIssue[] {
  const out: PiiIssue[] = []
  if (s.profileId !== p.id) out.push({ path: 'scenario.profileId', level: 'error', message: 'Scenario does not reference this profile' })
  const ids = new Set(p.categories.map((c) => c.id))
  for (const [id, w] of Object.entries(s.weightOverrides)) {
    if (!ids.has(id)) out.push({ path: `scenario.weight.${id}`, level: 'warn', message: 'Unknown category' })
    if (!Number.isFinite(w) || w < 0 || w > 1) out.push({ path: `scenario.weight.${id}`, level: 'error', message: 'Weight must be 0..1' })
  }
  for (const [id, r] of Object.entries(s.assumptionOverrides)) {
    if (!ids.has(id)) out.push({ path: `scenario.assumption.${id}`, level: 'warn', message: 'Unknown category' })
    if (!Number.isFinite(r)) out.push({ path: `scenario.assumption.${id}`, level: 'error', message: 'Rate must be a number' })
  }
  return out
}

export function validateDataset(d: BlsDataset): PiiIssue[] {
  const out: PiiIssue[] = []
  for (const [id, s] of Object.entries(d.series)) {
    if (!d.observations[id] || (d.observations[id] as unknown[]).length === 0)
      out.push({ path: `series.${id}`, level: 'warn', message: `No observations for ${s.label}` })
  }
  return out
}