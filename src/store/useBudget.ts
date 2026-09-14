import { useMemo } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { cohortForIncome } from '../data/benchmarks'
import { buildBudget, scaffold } from '../engine/model'
import { resolve } from '../engine/resolve'
import type { LockMode, ResolvedBudget, Viewpoint } from '../engine/types'

interface BudgetState {
  initialized: boolean
  /** The two onboarding answers. */
  incomeMonthly: number
  takeHome: number
  cohortId: string
  day: number
  totalDays: number
  view: Viewpoint
  /** Theme target shares, keyed by theme id. */
  share: Record<string, number>
  /** Category plan $ / lock / actual, keyed `${theme}.${cat}`. */
  plan: Record<string, number>
  catLock: Record<string, LockMode>
  actual: Record<string, number>
}

interface Actions {
  onboard: (incomeMonthly: number, takeHome: number) => void
  setDay: (d: number) => void
  setView: (v: Viewpoint) => void
  setShare: (themeId: string, share: number) => void
  setPlan: (key: string, value: number) => void
  setActual: (key: string, value: number) => void
  setCatLock: (key: string, lock: LockMode) => void
  reset: () => void
  editIncome: () => void
}

const initial: BudgetState = {
  initialized: false,
  incomeMonthly: 0,
  takeHome: 0,
  cohortId: 'c3',
  day: 15,
  totalDays: 30,
  view: 'top-down',
  share: {},
  plan: {},
  catLock: {},
  actual: {},
}

function seeded(cap: number, incomeMonthly: number) {
  const cohortId = cohortForIncome(incomeMonthly).id
  const s = scaffold(cap, incomeMonthly, cohortId)
  return {
    cohortId,
    share: s.share,
    plan: s.plan,
    catLock: s.catLock,
    actual: s.actual,
  }
}

export const useBudget = create<BudgetState & Actions>()(
  persist(
    (set, get) => ({
      ...initial,

      onboard: (incomeMonthly, takeHome) =>
        set({ initialized: true, incomeMonthly, takeHome, ...seeded(takeHome, incomeMonthly) }),

      setDay: (day) => set({ day }),
      setView: (view) => set({ view }),

      setShare: (themeId, share) =>
        set({ share: { ...get().share, [themeId]: Math.min(1, Math.max(0, share)) } }),

      setPlan: (key, value) => set({ plan: { ...get().plan, [key]: Math.max(0, value) } }),
      setActual: (key, value) => set({ actual: { ...get().actual, [key]: Math.max(0, value) } }),
      setCatLock: (key, lock) => set({ catLock: { ...get().catLock, [key]: lock } }),

      reset: () => {
        const s = get()
        set({ ...seeded(s.takeHome, s.incomeMonthly) })
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
  const share = useBudget((s) => s.share)
  const plan = useBudget((s) => s.plan)
  const actual = useBudget((s) => s.actual)
  const catLock = useBudget((s) => s.catLock)
  const day = useBudget((s) => s.day)
  const totalDays = useBudget((s) => s.totalDays)

  return useMemo(
    () => resolve(buildBudget({ incomeMonthly, takeHome, cohortId, share, plan, actual, catLock }), day, totalDays),
    [incomeMonthly, takeHome, cohortId, share, plan, actual, catLock, day, totalDays],
  )
}