/**
 * Proportional redistribution with locks.
 *
 * This replaced the old `solver.ts`, and the difference is the whole model
 * change: the solver normalized theme *shares* so they always summed to 1.0,
 * which meant dragging one theme silently moved every other one. Now category
 * dollars are the source of truth, a theme's share is simply its total over the
 * cap, and money that leaves a theme goes to the unallocated bucket rather than
 * being absorbed by its neighbours.
 *
 * Pure arithmetic — no React, no DOM, no store.
 */

/** Half a cent. Dollar comparisons below this are float noise, not money. */
export const EPS = 0.005

export interface ProrateItem {
  id: string
  value: number
  /** Locked items never move; the delta lands on everything else. */
  locked: boolean
}

export interface ProrateResult {
  /** New value per item id — locked items come back untouched. */
  value: Record<string, number>
  /** The total actually reached, which can differ from the target. */
  total: number
  /**
   * Dollars of the requested change that could not be applied: every
   * unlocked item hit its floor of 0, or everything was locked. The caller
   * decides what to do with it (we leave it in the unallocated bucket).
   */
  unapplied: number
}

/**
 * Scale `items` so they sum to `targetTotal`, holding locked items fixed and
 * moving the rest in proportion to their current size.
 *
 * Two floors apply. No item can go negative, and the total can never fall
 * below the locked subtotal — locking $1,600 of rent means the theme cannot be
 * dragged under $1,600, and the slider simply stops there.
 *
 * Rounds to whole dollars (the UI has no cents) and puts any rounding drift on
 * the largest unlocked item, where a $1 adjustment is least visible.
 */
export function prorate(items: ProrateItem[], targetTotal: number): ProrateResult {
  const value: Record<string, number> = {}
  for (const it of items) value[it.id] = Math.max(0, Math.round(it.value))

  const locked = items.filter((i) => i.locked)
  const open = items.filter((i) => !i.locked)
  const lockedTotal = locked.reduce((s, i) => s + value[i.id], 0)
  const currentTotal = items.reduce((s, i) => s + value[i.id], 0)

  // Everything is pinned — the theme cannot move at all.
  if (open.length === 0) {
    return { value, total: currentTotal, unapplied: targetTotal - currentTotal }
  }

  const wanted = Math.max(0, Math.round(targetTotal))
  // Locked money is untouchable, so it is the hard floor for the whole group.
  const feasible = Math.max(wanted, lockedTotal)
  const openTarget = feasible - lockedTotal
  const openCurrent = open.reduce((s, i) => s + value[i.id], 0)

  if (openCurrent > 0) {
    const f = openTarget / openCurrent
    for (const i of open) value[i.id] = Math.max(0, Math.round(value[i.id] * f))
  } else {
    // Degenerate: every unlocked line sits at zero, so there are no proportions
    // to preserve. Spread evenly rather than leaving them stuck at zero forever.
    const each = Math.floor(openTarget / open.length)
    for (const i of open) value[i.id] = each
  }

  // Rounding drift — push it onto the biggest unlocked line.
  const after = items.reduce((s, i) => s + value[i.id], 0)
  let drift = feasible - after
  if (drift !== 0) {
    const biggest = open.reduce((a, b) => (value[a.id] >= value[b.id] ? a : b))
    const adjusted = Math.max(0, value[biggest.id] + drift)
    drift -= adjusted - value[biggest.id]
    value[biggest.id] = adjusted
  }

  const total = items.reduce((s, i) => s + value[i.id], 0)
  return { value, total, unapplied: targetTotal - total }
}
