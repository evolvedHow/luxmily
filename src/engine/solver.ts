import type { LockMode } from './types'

export const EPS = 0.005 // half a cent

/**
 * A single item's participation in a constrained allocation.
 *
 * `tier` encodes appetite, not priority of survival:
 *   tier 1 — elastic and ceiling items. Hungry: they actively absorb surplus.
 *   tier 2 — floor items. Satisfied at their minimum; they only grow once every
 *            hungry item is full. This is the difference between "healthcare must
 *            never drop below $750" and "give healthcare all the spare money."
 * Hard items sit in tier 2 with zero headroom, so they never move.
 */
export interface Bound {
  id: string
  min: number
  max: number
  weight: number
  tier: 1 | 2
}

export function boundsFor(id: string, lock: LockMode, value: number): Bound {
  const v = Math.max(0, value)
  switch (lock) {
    case 'hard':
      return { id, min: v, max: v, weight: 0, tier: 2 }
    case 'floor':
      return { id, min: v, max: Infinity, weight: v, tier: 2 }
    case 'ceiling':
      return { id, min: 0, max: v, weight: v, tier: 1 }
    case 'elastic':
      return { id, min: 0, max: Infinity, weight: v, tier: 1 }
  }
}

export interface AllocationResult {
  alloc: Record<string, number>
  /** Dollars the mins overran the pool by. Bottom-up wins; this is the overrun. */
  tension: number
  /** Surplus nothing could absorb (everything hit a ceiling). Flows downstream. */
  released: number
  /** Items pinned against a bound — used for the UI's "clamped" affordance. */
  clamped: Set<string>
}

/**
 * Clamped proportional allocation.
 *
 * Every item starts at its floor. If the floors alone overrun the pool the
 * allocation is infeasible — we honour the floors anyway (committed money is
 * committed) and report the overrun as tension rather than silently understating
 * what is actually spoken for. Otherwise the surplus is shared pro-rata by weight,
 * re-distributing whenever an item pins against its ceiling.
 *
 * Terminates: each inner pass either exhausts the surplus or clamps at least one
 * item, so it runs at most n times.
 */
export function allocate(pool: number, items: Bound[]): AllocationResult {
  const alloc: Record<string, number> = {}
  const clamped = new Set<string>()
  let used = 0

  for (const it of items) {
    alloc[it.id] = it.min
    used += it.min
  }

  if (used > pool + EPS) {
    for (const it of items) if (it.min > 0) clamped.add(it.id)
    return { alloc, tension: used - pool, released: 0, clamped }
  }

  let surplus = pool - used
  for (const tier of [1, 2] as const) {
    if (surplus <= EPS) break
    surplus = distribute(surplus, items.filter((i) => i.tier === tier), alloc)
  }

  for (const it of items) {
    if (it.max !== Infinity && alloc[it.id] >= it.max - EPS) clamped.add(it.id)
    if (it.min > 0 && alloc[it.id] <= it.min + EPS) clamped.add(it.id)
  }

  return { alloc, tension: 0, released: surplus, clamped }
}

function distribute(surplus: number, items: Bound[], alloc: Record<string, number>): number {
  let pool = surplus
  let open = items.filter((i) => alloc[i.id] < i.max - EPS)
  let guard = 0

  while (pool > EPS && open.length > 0 && guard++ < 64) {
    const totalW = open.reduce((s, i) => s + i.weight, 0)
    // Degenerate case: a bucket of zero-valued elastics (e.g. an untouched
    // DESIRES fund). Weight-proportional would starve them forever, so split evenly.
    const equal = totalW <= EPS
    let consumed = 0
    const next: Bound[] = []

    for (const i of open) {
      const share = equal ? pool / open.length : pool * (i.weight / totalW)
      const give = Math.min(share, i.max - alloc[i.id])
      alloc[i.id] += give
      consumed += give
      if (alloc[i.id] < i.max - EPS) next.push(i)
    }

    pool -= consumed
    if (consumed <= EPS) break
    open = next
  }

  return pool
}
