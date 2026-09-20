/**
 * BLS CPI-U reference data: embeds an offline snapshot of the official series
 * and augments it at runtime through the public BLS API (anonymous tier: 10
 * years per request). The merged result is a `BlsDataset`.
 *
 * Policy:
 *  - The offline snapshot is the default of truth. Runtime refresh only extends
 *    coverage for the newest months (since the snapshot's last observation) so
 *    quota stays irrelevant.
 *  - Refreshed observations are cached in localStorage by series + period and
 *    merged idempotently (never duplicates, never rewrites a published value
 *    once present).
 *  - Nothing here requires a network call on first paint.
 */

import type { BlsDataset, BlsObservation, Period } from './types'
import { blsSeriesById } from './blsMetadata'
import { shift as shiftPeriod } from './period'

/* ------------------------------ embedded snapshot ------------------------------ */

import {
  embedded as embeddedRows,
  BLS_DATA_VERSION as embeddedVersion,
  BLS_DATA_ASOF as embeddedAsOf,
  BLS_SCOPE as embeddedScope,
} from './bls/data'

export const CACHE_KEY = 'luxmily-bls-cache-v1'

interface BlsCache {
  asOf: string
  /** seriesId → { period: index } */
  obs: Record<string, Record<Period, number>>
}

export function readCache(): BlsCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? (JSON.parse(raw) as BlsCache) : null
  } catch {
    return null
  }
}

export function writeCache(c: BlsCache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(c))
  } catch {
    /* storage full — ignore, embedded snapshot still works */
  }
}

/** Parse the compact embedded rows into { seriesId → SortedMap period -> index }. */
function parseEmbedded(): Map<string, Map<Period, number>> {
  const out = new Map<string, Map<Period, number>>()
  for (const [id, { from, v }] of Object.entries(embeddedRows)) {
    const m = new Map<Period, number>()
    for (let i = 0; i < v.length; i++) {
      const x = v[i]
      if (x !== null) m.set(shiftPeriod(from, i), x)
    }
    out.set(id, m)
  }
  return out
}

/** Build the full dataset = embedded snapshot dated `asOf` merged with any cache. */
export function buildDataset(): BlsDataset {
  const emb = parseEmbedded()
  const cache = readCache()

  if (cache) {
    for (const [id, per] of Object.entries(cache.obs)) {
      let m = emb.get(id)
      if (!m) {
        m = new Map<Period, number>()
        emb.set(id, m)
      }
      for (const [p, x] of Object.entries(per)) m.set(p, x)
    }
  }

  const asOf = cache && cache.asOf > embeddedAsOf ? cache.asOf : embeddedAsOf
  const version = cache && cache.asOf > embeddedAsOf ? `${embeddedVersion}+r${cache.asOf}` : embeddedVersion

  const observations: Record<string, BlsObservation[]> = {}
  for (const [id, m] of emb) {
    observations[id] = Array.from(m.entries())
      .map(([period, index]) => ({ period, index }))
      .sort((a, b) => (a.period < b.period ? -1 : 1))
  }
  return { version, scope: embeddedScope, series: { ...blsSeriesById }, observations, asOf }
}

/** Last period with an embedded observation for a series (for deciding refresh need). */
export function embeddedSpan(id: string): { from?: Period; to?: Period } {
  const d = parseEmbedded()
  const m = d.get(id)
  if (!m || m.size === 0) return {}
  const ps = Array.from(m.keys()).sort()
  return { from: ps[0], to: ps[ps.length - 1] }
}

/* ------------------------------ runtime refresh ------------------------------ */

export interface RefreshResult {
  fetched: string[]
  failed: string[]
  asOf: string
}

export async function fetchBlsYears(
  ids: string[],
  startYear: number,
  endYear: number,
  signal?: AbortSignal,
): Promise<Map<string, Map<Period, number>>> {
  const out = new Map<string, Map<Period, number>>()
  await Promise.all(
    ids.map(async (id) => {
      const url =
        `https://api.bls.gov/publicAPI/v1/timeseries/data/${id}?` +
        `startyear=${startYear}&endyear=${endYear}`
      const res = await fetch(url, { signal })
      if (!res.ok) return
      const json = (await res.json()) as {
        status?: string
        Results?: { series?: { data?: { year: string; period: string; value: string }[] }[] }
      }
      const data = json?.Results?.series?.[0]?.data
      if (!data) return
      const m = new Map<Period, number>()
      for (const row of data) {
        const period = `${row.year}-${row.period.replace('M', '')}`
        const val = Number(row.value)
        if (!Number.isNaN(val)) m.set(period, val)
      }
      if (m.size) out.set(id, m)
    }),
  )
  return out
}

/**
 * Refresh latest-month coverage for `ids`: fetch 3 years ending `endYear`,
 * merge into the cache, and return what changed. Safe to call from a button.
 */
export async function refreshBLS(ids: string[], endYear: number, signal?: AbortSignal): Promise<RefreshResult> {
  const goal = endYear
  const merged = await fetchBlsYears(ids, goal - 2, goal, signal)
  const cache = readCache() ?? { asOf: '', obs: {} }

  // Track which ids genuinely gained newer data.
  const gained: string[] = []
  const failed: string[] = []
  const nowIso = new Date().toISOString().slice(0, 10)

  for (const id of merged.keys()) {
    const before = cache.obs[id]
    const beforeMax = before
      ? Math.max(...Object.keys(before).map((p) => Number(p.replace('-', ''))))
      : 0
    const afterMax = Math.max(...Array.from(merged.get(id)!.keys()).map((p) => Number(p.replace('-', ''))))
    const oldCount = before ? Object.keys(before).length : 0
    cache.obs[id] = { ...(before ?? {}), ...Object.fromEntries(merged.get(id)!) }
    if (afterMax > beforeMax || Object.keys(cache.obs[id]).length > oldCount) gained.push(id)
  }
  for (const id of ids) {
    if (!merged.has(id)) failed.push(id)
  }

  writeCache({ ...cache, asOf: cache.asOf > nowIso ? cache.asOf : nowIso })
  return { fetched: Array.from(merged.keys()), failed, asOf: cache.asOf }
}

/* ------------------------------ lookup helpers ------------------------------ */

/** Map of period → index for a series (merged view). */
export function obsFor(dataset: BlsDataset, seriesId: string): Map<Period, number> | undefined {
  const arr = dataset.observations[seriesId]
  if (!arr) return undefined
  const m = new Map<Period, number>()
  for (const o of arr) m.set(o.period, o.index)
  return m
}

/** Exact lookup. */
export function indexAt(dataset: BlsDataset, seriesId: string, period: Period): number | undefined {
  return obsFor(dataset, seriesId)?.get(period)
}

/** Value at or before `period` (carry-forward of the latest published value).
 *  `maxLookbackMonths` bounds how far back it will reach. */
export function indexAtOrBefore(
  dataset: BlsDataset,
  seriesId: string,
  period: Period,
  maxLookbackMonths = 18,
): { period: Period; index: number } | undefined {
  const m = obsFor(dataset, seriesId)
  if (!m) return undefined
  const wanted = Number(period.replace('-', ''))
  let best: { period: Period; index: number } | undefined
  for (const [p, x] of m) {
    const v = Number(p.replace('-', ''))
    if (v <= wanted && (best === undefined || Number(best.period.replace('-', '')) < v)) best = { period: p, index: x }
  }
  if (!best) return undefined
  const back = Number(period.replace('-', '')) - Number(best.period.replace('-', ''))
  if (back > maxLookbackMonths * 100 + maxLookbackMonths) return undefined
  return best
}

/** Coverage window of a series within the dataset. */
export function spanOf(dataset: BlsDataset, seriesId: string): { from: Period; to: Period; n: number } | undefined {
  const arr = dataset.observations[seriesId]
  if (!arr || arr.length === 0) return undefined
  return { from: arr[0].period, to: arr[arr.length - 1].period, n: arr.length }
}