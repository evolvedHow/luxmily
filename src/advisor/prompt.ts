import type { ResolvedBudget } from '../engine/types'
import { toExport, toJSON } from '../export/export'
import { advisorSystem } from './config'

/**
 * The inputs handed to Luxmi.
 *
 * The USER prompt is the exact JSON document the app downloads (toJSON) —
 * the same "total picture" the user can save. It carries every user input
 * (income, take-home/cap, cohort, theme shares, per-category plans, locks)
 * plus every derived parameter the app computes (% of cap, benchmark rails,
 * sources). Nothing else is invented by the client; the model works only
 * from this JSON. Real spending is never in there — it's a planner.
 *
 * The SYSTEM prompt is the private YAML config (src/advisor/luxmi.yaml) —
 * owned by the operator, compiled in at build time, never shown in the UI.
 */

/** Private system prompt from the YAML config. */
export function buildLuxmiSystem(): string {
  return advisorSystem()
}

/**
 * User prompt = the exact JSON the user can download, framed for the model.
 * When `compact` is true (token-budget providers like Groq free tier), the
 * JSON is minified and URL/note fields are stripped — same numbers, safely
 * smaller. Bracket-agnostic: uses ```json fences, keeps the JSON verbatim.
 */
export function buildLuxmiUserPrompt(r: ResolvedBudget, compact = false): string {
  const json = toJSON(r, compact)
  const x = toExport(r)
  return [
    `Here is my complete budget as a JSON document — the same file the app exports${compact ? ' (condensed for size: minified, source links stripped)' : ''}. It holds ALL of my inputs and every computed parameter:`,
    `- income ${Math.round(r.incomeMonthly).toLocaleString()}/mo, take-home cap ${Math.round(r.cap).toLocaleString()}, cohort "${r.cohortLabel}".`,
    `- Adviser context: cohort avg annual spend, total planned, unallocated cash (negative = over cap), ok flag.`,
    `- ${x.themes.length} themes, each with its share of the cap vs the cohort benchmark share, plan total, locked subtotal, and its distinct sources (with URLs).`,
    `- ${x.payYourselfFirst.length} pay-yourself-first rails and every category: plan $, lock, benchmark avg/median and source.`,
    `- pII (personal Inflation index): this allocation's own inflation rate vs the headline CPI-U, with each theme's weight beside the national basket's weight.`,
    '',
    '```json',
    json,
    '```',
    '',
    'Read the JSON carefully. Build the full narrative from it — balance, cohort comparison per theme, pay-yourself-first health, anomalies, whether the cap is overrun or cash is sitting unallocated, what the pII says about how this particular basket is inflating, and concrete numbered tips with dollar figures. Only use numbers present in this JSON.',
  ].join('\n')
}