/**
 * PII store — the user's personal CPI profiles, scenarios and analysis window.
 * Persisted to localStorage (`luxmily-pii-v1`), independent of the budget store
 * except for one-way "seed from budget" imports.
 */

import { useMemo } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { buildDataset, refreshBLS, spanOf, embeddedSpan } from '../pi/bls'
import { defaultProfile, nowIso } from '../pi/defaults'
import { weightsFromSpend } from '../pi/engine'
import { shift } from '../pi/period'
import type { Mapping, PersonalCategory, PiiProfile, PiiScenario, Period } from '../pi/types'
import { useBudget } from './useBudget'

export interface PiiState {
  initialized: boolean
  profiles: PiiProfile[]
  scenarios: PiiScenario[]
  activeProfileId: string
  /** Analysis window (start / end of the historical calculation). */
  from: Period
  to: Period
  /** Bumped whenever the BLS cache is refreshed so memoized dataset rebuilds. */
  dataTick: number
  refreshing: boolean
  refreshError: string | null
  lastRefresh: string | null

  init: () => void
  setActiveProfile: (id: string) => void
  updateProfile: (patch: Partial<PiiProfile>) => void
  setWeight: (catId: string, w: number) => void
  setSpending: (catId: string, amount: number) => void
  setFuture: (catId: string, rate: number) => void
  setMapping: (catId: string, mapping: Mapping) => void
  setPassThrough: (catId: string, mode: 'market' | 'fixed' | 'custom', rate?: number) => void
  addCategory: (label: string, parentId?: string) => void
  removeCategory: (catId: string) => void
  setFrom: (p: Period) => void
  setTo: (p: Period) => void
  setBasePeriod: (p: Period) => void
  seedFromBudget: (source: 'observed' | 'planned' | 'best') => void
  addScenario: (label: string) => void
  updateScenario: (id: string, patch: Partial<PiiScenario>) => void
  removeScenario: (id: string) => void
  refreshData: () => Promise<void>
  resetAll: () => void
}

const nowIsoShort = () => new Date().toISOString().slice(0, 10)

function latestAvailable(): Period {
  const d = buildDataset()
  let latest = ''
  for (const id of Object.keys(d.observations)) {
    const sp = spanOf(d, id)
    if (sp && sp.to > latest) latest = sp.to
  }
  return latest || '2026-08'
}

function initialWindow(): { from: Period; to: Period } {
  const to = latestAvailable()
  return { to, from: shift(to, -12) }
}

export const usePii = create<PiiState>()(
  persist(
    (set, get) => ({
      initialized: false,
      profiles: [],
      scenarios: [],
      activeProfileId: 'default',
      ...initialWindow(),
      dataTick: 0,
      refreshing: false,
      refreshError: null,
      lastRefresh: null,

      init: () => {
        const s = get()
        if (s.initialized) return
        const profiles = s.profiles.length > 0 ? s.profiles : [defaultProfile()]
        set({ initialized: true, profiles })
      },

      setActiveProfile: (id) => set({ activeProfileId: id }),

      updateProfile: (patch) =>
        set((s) => ({
          profiles: s.profiles.map((p) =>
            p.id === s.activeProfileId ? { ...p, ...patch, updatedAt: nowIso() } : p,
          ),
        })),

      setWeight: (catId, w) =>
        set((s) => ({
          profiles: s.profiles.map((p) =>
            p.id === s.activeProfileId
              ? { ...p, weights: { ...p.weights, [catId]: Math.max(0, Math.min(1, w)) }, updatedAt: nowIso() }
              : p,
          ),
        })),

      setSpending: (catId, amount) =>
        set((s) => ({
          profiles: s.profiles.map((p) =>
            p.id === s.activeProfileId
              ? { ...p, spending: { ...p.spending, [catId]: Math.max(0, amount) }, updatedAt: nowIso() }
              : p,
          ),
        })),

      setFuture: (catId, rate) =>
        set((s) => ({
          profiles: s.profiles.map((p) =>
            p.id === s.activeProfileId
              ? { ...p, future: { ...p.future, [catId]: Number.isFinite(rate) ? rate : 0 }, updatedAt: nowIso() }
              : p,
          ),
        })),

      setMapping: (catId, mapping) =>
        set((s) => ({
          profiles: s.profiles.map((p) =>
            p.id === s.activeProfileId
              ? {
                  ...p,
                  version: p.version + 1,
                  categories: p.categories.map((c) => (c.id === catId ? { ...c, mapping } : c)),
                  updatedAt: nowIso(),
                }
              : p,
          ),
        })),

      setPassThrough: (catId, mode, rate) =>
        set((s) => ({
          profiles: s.profiles.map((p) =>
            p.id === s.activeProfileId
              ? {
                  ...p,
                  categories: p.categories.map((c) =>
                    c.id === catId
                      ? { ...c, passThrough: mode === 'custom' ? { mode, rate: rate ?? 3 } : { mode } }
                      : c,
                  ),
                  updatedAt: nowIso(),
                }
              : p,
          ),
        })),

      addCategory: (label, parentId) =>
        set((s) => {
          const id = `custom-${Math.random().toString(36).slice(2, 8)}`
          const from = s.from
          return {
            profiles: s.profiles.map((p) => {
              if (p.id !== s.activeProfileId) return p
              const cat: PersonalCategory = {
                id,
                label,
                parentId,
                mapping: { kind: 'series', seriesId: 'CUUR0000SA0' },
                passThrough: { mode: 'market' },
              }
              return {
                ...p,
                version: p.version + 1,
                categories: [...p.categories, cat],
                weights: { ...p.weights, [id]: 0 },
                spending: { ...p.spending, [id]: 0 },
                future: { ...p.future, [id]: 0 },
                updatedAt: nowIso(),
              }
            }),
            from,
          }
        }),

      removeCategory: (catId) =>
        set((s) => ({
          profiles: s.profiles.map((p) =>
            p.id === s.activeProfileId
              ? {
                  ...p,
                  version: p.version + 1,
                  categories: p.categories.filter((c) => c.id !== catId),
                  weights: Object.fromEntries(Object.entries(p.weights).filter(([k]) => k !== catId)),
                  spending: Object.fromEntries(Object.entries(p.spending).filter(([k]) => k !== catId)),
                  future: Object.fromEntries(Object.entries(p.future).filter(([k]) => k !== catId)),
                  updatedAt: nowIso(),
                }
              : p,
          ),
        })),

      setFrom: (from) => set({ from }),
      setTo: (to) => set({ to }),

      setBasePeriod: (basePeriod) => get().updateProfile({ basePeriod }),

      seedFromBudget: (source) => {
        const budget = useBudget.getState()
        const annual: Record<string, number> = {}
        const s = get()
        const profile = s.profiles.find((p) => p.id === s.activeProfileId)
        if (!profile) return
        for (const cat of profile.categories) {
          const [theme, cid] = cat.id.split('.')
          const okey = `${theme}.${cid}`
          const observed = budget.observed[okey] ?? 0
          const planned = budget.plan[okey] ?? 0
          let monthly = 0
          if (source === 'observed' || source === 'best') {
            if (observed > 0) monthly = observed
            else if (source === 'best' && planned > 0) monthly = planned
          } else if (planned > 0) monthly = planned
          else if (observed > 0) monthly = observed
          annual[cat.id] = monthly * 12
        }
        // Income lines the budget stores per-month too (cap decision).
        const { weights } = weightsFromSpend(profile.categories, annual)
        set((st) => ({
          profiles: st.profiles.map((p) =>
            p.id === s.activeProfileId
              ? {
                  ...p,
                  weights,
                  spending: annual,
                  weightSource: 'budget',
                  notes: `Weights seeded from your budget (${source}). Categories with no planned or observed amount were dropped from the basket.`,
                  updatedAt: nowIso(),
                }
              : p,
          ),
        }))
      },

      addScenario: (label) =>
        set((s) => {
          const id = `sc-${Math.random().toString(36).slice(2, 8)}`
          const sc: PiiScenario = {
            id,
            label,
            profileId: s.activeProfileId,
            weightOverrides: {},
            assumptionOverrides: {},
            spendingOverrides: {},
          }
          return { scenarios: [...s.scenarios, sc] }
        }),

      updateScenario: (id, patch) =>
        set((s) => ({ scenarios: s.scenarios.map((sc) => (sc.id === id ? { ...sc, ...patch } : sc)) })),

      removeScenario: (id) => set((s) => ({ scenarios: s.scenarios.filter((sc) => sc.id !== id) })),

      refreshData: async () => {
        const s = get()
        set({ refreshing: true, refreshError: null })
        try {
          const ids = new Set<string>()
          for (const p of s.profiles) {
            for (const c of p.categories) {
              if (c.mapping.kind === 'series') ids.add(c.mapping.seriesId)
              else if (c.mapping.kind === 'composite') c.mapping.parts.forEach((x) => ids.add(x.seriesId))
            }
          }
          ids.add('CUUR0000SA0')
          const toYear = Number(s.to.slice(0, 4))
          const res = await refreshBLS(Array.from(ids), toYear)
          set((st) => ({
            dataTick: st.dataTick + 1,
            lastRefresh: res.asOf || nowIsoShort(),
            refreshError: res.failed.length ? `No fresh data for: ${res.failed.join(', ')}` : null,
          }))
        } catch (e) {
          set({ refreshError: e instanceof Error ? e.message : 'Refresh failed' })
        } finally {
          set({ refreshing: false })
        }
      },

      resetAll: () => {
        const { from, to } = initialWindow()
        set({
          profiles: [defaultProfile()],
          scenarios: [],
          activeProfileId: 'default',
          from,
          to,
        })
      },
    }),
    {
      name: 'luxmily-pii-v1',
    },
  ),
)

/** Dataset view rebuilt whenever the cache changes. Cheap: embedded read + merge. */
export function usePiiDataset() {
  const dataTick = usePii((s) => s.dataTick)
  return useMemo(() => buildDataset(), [dataTick])
}

export function useActiveProfile(): PiiProfile | null {
  return usePii((s) => s.profiles.find((p) => p.id === s.activeProfileId) ?? s.profiles[0] ?? null)
}

/** Latest month present in the embedded (or cached) data for a series. */
export function useSeriesLatest(seriesId: string): Period | null {
  const dataset = usePiiDataset()
  return useMemo(() => spanOf(dataset, seriesId)?.to ?? null, [dataset, seriesId])
}

/** Latest month present in the embedded snapshot, regardless of cache. */
export function embeddedLatest(seriesId: string): string | undefined {
  return embeddedSpan(seriesId).to
}

/** Does the cache already reach into this year for the profile's series? */
export function needsRefresh(): boolean {
  try {
    const raw = localStorage.getItem('luxmily-bls-cache-v1')
    if (!raw) return true
    const c = JSON.parse(raw) as { asOf?: string }
    if (!c.asOf) return true
    const now = nowIsoShort()
    return c.asOf.slice(0, 7) !== now.slice(0, 7)
  } catch {
    return true
  }
}