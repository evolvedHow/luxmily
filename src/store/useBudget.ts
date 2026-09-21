import { useMemo } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { THEMES, cohortForIncome } from '../data/benchmarks'
import { locationForZip } from '../data/metro-cola'
import { buildBudget, catKey, scaffold } from '../engine/model'
import { prorate } from '../engine/prorate'
import { resolve } from '../engine/resolve'
import type { ResolvedBudget } from '../engine/types'

/**
 * Category dollars are the single source of truth. A theme's percentage is
 * derived from them, never stored — which is why there is no `share` here.
 * Money not assigned to any category sits in the unallocated bucket
 * (`ResolvedBudget.unallocated`), it is not silently absorbed by other themes.
 */
interface BudgetState {
  initialized: boolean
  /** The two onboarding answers. */
  incomeMonthly: number
  takeHome: number
  cohortId: string
  /** Optional ZIP the benchmarks are localized to (NYC rent ≠ Marietta rent). */
  zip: string
  /** Category plan $, keyed `${theme}.${cat}`. */
  plan: Record<string, number>
  /** Locks, keyed by theme id AND `${theme}.${cat}`. Absent = unlocked. */
  locked: Record<string, boolean>
}

interface Actions {
  onboard: (incomeMonthly: number, takeHome: number, zip: string) => void
  /** Edit one category directly. The delta lands in the unallocated bucket. */
  setPlan: (key: string, value: number) => void
  /** Resize a whole theme — prorated across its unlocked categories. */
  setThemeTotal: (themeId: string, total: number) => void
  toggleLock: (key: string) => void
  /** Restore one theme to its pristine benchmark seeding. */
  resetTheme: (themeId: string) => void
  /** Move the unallocated bucket into the emergency cash buffer. */
  sweepToEmergency: () => void
  setZip: (zip: string) => void
  reset: () => void
  editIncome: () => void
}

const EMERGENCY_KEY = catKey('savings', 'emergency')

const initial: BudgetState = {
  initialized: false,
  incomeMonthly: 0,
  takeHome: 0,
  cohortId: 'c3',
  zip: '',
  plan: {},
  locked: {},
}

/**
 * The pristine benchmark seeding for the current answers. Pure and cheap, so
 * both "Reset theme" and the pII baseline recompute it on demand rather than
 * freezing a copy at onboarding (which would go stale the moment income or ZIP
 * changed).
 */
export function baselinePlan(cap: number, incomeMonthly: number, zip: string): Record<string, number> {
  const cohortId = cohortForIncome(incomeMonthly).id
  return scaffold(cap, incomeMonthly, cohortId, locationForZip(zip) ?? undefined).plan
}

function seeded(cap: number, incomeMonthly: number, zip = '') {
  return {
    cohortId: cohortForIncome(incomeMonthly).id,
    zip,
    plan: baselinePlan(cap, incomeMonthly, zip),
    locked: {},
  }
}

const themeById = (id: string) => THEMES.find((t) => t.id === id)

export const useBudget = create<BudgetState & Actions>()(
  persist(
    (set, get) => ({
      ...initial,

      onboard: (incomeMonthly, takeHome, zip) =>
        set({ initialized: true, incomeMonthly, takeHome, ...seeded(takeHome, incomeMonthly, zip) }),

      setPlan: (key, value) => set({ plan: { ...get().plan, [key]: Math.max(0, Math.round(value)) } }),

      setThemeTotal: (themeId, total) => {
        const t = themeById(themeId)
        const s = get()
        // A locked theme is immovable as a unit, whatever its categories say.
        if (!t || s.locked[themeId]) return

        const items = t.cats.map((c) => {
          const key = catKey(themeId, c.id)
          return { id: key, value: s.plan[key] ?? 0, locked: !!s.locked[key] }
        })
        set({ plan: { ...s.plan, ...prorate(items, total).value } })
      },

      toggleLock: (key) => {
        const locked = { ...get().locked }
        if (locked[key]) delete locked[key]
        else locked[key] = true
        set({ locked })
      },

      resetTheme: (themeId) => {
        const t = themeById(themeId)
        const s = get()
        if (!t) return
        const pristine = baselinePlan(s.takeHome, s.incomeMonthly, s.zip)
        const plan = { ...s.plan }
        const locked = { ...s.locked }
        for (const c of t.cats) {
          const key = catKey(themeId, c.id)
          plan[key] = pristine[key] ?? 0
          // A reset that left locks in place would immediately re-pin the
          // values the user just discarded. Clear the theme's locks with it.
          delete locked[key]
        }
        delete locked[themeId]
        set({ plan, locked })
      },

      sweepToEmergency: () => {
        const s = get()
        const r = resolve(
          buildBudget(
            {
              incomeMonthly: s.incomeMonthly,
              takeHome: s.takeHome,
              cohortId: s.cohortId,
              plan: s.plan,
              locked: s.locked,
            },
            locationForZip(s.zip) ?? undefined,
          ),
        )
        // Only ever sweeps a surplus. An overdraft is the user's to resolve —
        // we are not going to raid the emergency buffer to paper over it.
        if (r.unallocated <= 0 || s.locked[EMERGENCY_KEY]) return
        set({
          plan: {
            ...s.plan,
            [EMERGENCY_KEY]: Math.round((s.plan[EMERGENCY_KEY] ?? 0) + r.unallocated),
          },
        })
      },

      setZip: (zip) => set({ zip }),

      reset: () => {
        const s = get()
        set({ ...seeded(s.takeHome, s.incomeMonthly, s.zip) })
      },

      editIncome: () => set({ initialized: false }),
    }),
    {
      // v2: `share`/`catLock`/`view` are gone and dollars are authoritative, so
      // a v1 payload cannot be migrated meaningfully — start clean instead.
      name: 'luxmily-budget-v2',
    },
  ),
)

export function useResolved(): ResolvedBudget {
  const incomeMonthly = useBudget((s) => s.incomeMonthly)
  const takeHome = useBudget((s) => s.takeHome)
  const cohortId = useBudget((s) => s.cohortId)
  const zip = useBudget((s) => s.zip ?? '')
  const plan = useBudget((s) => s.plan)
  const locked = useBudget((s) => s.locked)

  return useMemo(() => {
    const loc = locationForZip(zip) ?? undefined
    return resolve(buildBudget({ incomeMonthly, takeHome, cohortId, plan, locked }, loc))
  }, [incomeMonthly, takeHome, cohortId, zip, plan, locked])
}

/** The same budget as it was seeded from benchmarks — the pII baseline. */
export function useBaselineResolved(): ResolvedBudget {
  const incomeMonthly = useBudget((s) => s.incomeMonthly)
  const takeHome = useBudget((s) => s.takeHome)
  const cohortId = useBudget((s) => s.cohortId)
  const zip = useBudget((s) => s.zip ?? '')

  return useMemo(() => {
    const loc = locationForZip(zip) ?? undefined
    return resolve(
      buildBudget(
        { incomeMonthly, takeHome, cohortId, plan: baselinePlan(takeHome, incomeMonthly, zip), locked: {} },
        loc,
      ),
    )
  }, [incomeMonthly, takeHome, cohortId, zip])
}
