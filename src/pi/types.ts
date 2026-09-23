/**
 * Shared reference types for the embedded BLS CPI-U dataset only. The personal
 * CPI calculator lives in `src/pi/personalCpi.ts`; the budget itself stays in
 * the engine. No React/DOM imports — pure data, testable in isolation.
 */

/** "YYYY-MM" — published granularity of BLS CPI observations. */
export type Period = string

/** A BLS CPI-U series. Ids are authoritative — never match on titles. */
export interface BlsSeries {
  id: string
  /** Official BLS title, e.g. "Shelter in U.S. city average, all urban consumers…" */
  title: string
  /** Short display label, e.g. "Shelter". */
  label: string
  /** Major CPI-U group. */
  group: string
  /** Taxonomy parent series id. */
  parentId?: string
  /** Depth in the item hierarchy (0 = all items). */
  level: number
  /** Share of all-item CPI-U expenditure, fraction 0..1 (display context only). */
  relImportance?: number
  /** Provenance / approximation note for the relative importance figure. */
  sourceNote?: string
}