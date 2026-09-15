import { useMemo } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { cohortForIncome } from '../data/benchmarks'
import { locationForZip } from '../data/metro-cola'
import { buildBudget, scaffold } from '../engine/model'
import { resolve } from '../engine/resolve'
import type { LockMode, ResolvedBudget, Viewpoint } from '../engine/types'

interface BudgetState {
  initialized: boolean
  /** The two onboarding answers. */
  incomeMonthly: number
  takeHome: number
  cohortId: string
  /** Optional ZIP the benchmarks are localized to (NYC rent ≠ Marietta rent). */
  zip: string
  view: Viewpoint
  /** Theme target shares, keyed by theme id. */
  share: Record<string, number>
  /** Category plan $ / lock / observed spend, keyed `${theme}.${cat}`. */
  plan: Record<string, number>
  catLock: Record<string, LockMode>
  /** What the user has discovered they actually spend per month. 0 = unentered. */
  observed: Record<string, number>
}

interface Actions {
  onboard: (incomeMonthly: number, takeHome: number, zip: string) => void
  setView: (v: Viewpoint) => void
  setShare: (themeId: string, share: number) => void
  setPlan: (key: string, value: number) => void
  setObserved: (key: string, value: number) => void
  setCatLock: (key: string, lock: LockMode) => void
  setZip: (zip: string) => void
  reset: () => void
  editIncome: () => void
}

const initial: BudgetState = {
  initialized: false,
  incomeMonthly: 0,
  takeHome: 0,
  cohortId: 'c3',
  zip: '',
  view: 'top-down',
  share: {},
  plan: {},
  catLock: {},
  observed: {},
}

function seeded(cap: number, incomeMonthly: number, zip = '') {
  const cohortId = cohortForIncome(incomeMonthly).id
  const loc = locationForZip(zip) ?? undefined
  const s = scaffold(cap, incomeMonthly, cohortId, loc)
  return {
    cohortId,
    zip,
    share: s.share,
    plan: s.plan,
    catLock: s.catLock,
    observed: s.observed,
  }
}

export const useBudget = create<BudgetState & Actions>()(
  persist(
    (set, get) => ({
      ...initial,

      onboard: (incomeMonthly, takeHome, zip) =>
        set({ initialized: true, incomeMonthly, takeHome, ...seeded(takeHome, incomeMonthly, zip) }),

      setView: (view) => set({ view }),

      setShare: (themeId, share) =>
        set({ share: { ...get().share, [themeId]: Math.min(1, Math.max(0, share)) } }),

      setPlan: (key, value) => set({ plan: { ...get().plan, [key]: Math.max(0, value) } }),
      setObserved: (key, value) => set({ observed: { ...get().observed, [key]: Math.max(0, value) } }),
      setCatLock: (key, lock) => set({ catLock: { ...get().catLock, [key]: lock } }),
      setZip: (zip) => set({ zip }),

      reset: () => {
        const s = get()
        set({ ...seeded(s.takeHome, s.incomeMonthly, s.zip) })
      },

      editIncome: () => set({ initialized: false }),
    }),
    {
      name: 'luxmily-budget-v1',
    },
  ),
)

export function useResolved(): ResolvedBudget {
  const incomeMonthly = useBudget((s) => s.incomeMonthly)
  const takeHome = useBudget((s) => s.takeHome)
  const cohortId = useBudget((s) => s.cohortId)
  const zip = useBudget((s) => s.zip ?? '')
  const share = useBudget((s) => s.share)
  const plan = useBudget((s) => s.plan)
  const observed = useBudget((s) => s.observed)
  const catLock = useBudget((s) => s.catLock)

  return useMemo(() => {
    const loc = locationForZip(zip) ?? undefined
    return resolve(buildBudget({ incomeMonthly, takeHome, cohortId, share, plan, observed, catLock }, loc))
  }, [incomeMonthly, takeHome, cohortId, zip, share, plan, observed, catLock])
}