import type { ResolvedBudget } from '../engine/types'
import { toExport, toJSON } from '../export/export'
import { advisorSystem } from './config'

/**
 * The inputs handed to Luxmi.
 *
 * The USER prompt is the exact JSON document the app downloads (toJSON) —
 * the same "total picture" the user can save. It carries every user input
 * (income, take-home/cap, cohort, theme shares, per-category plans, locks,
 * observed spend) plus every derived parameter the app computes (% of cap,
 * deltas, surplus, reallocatable, benchmark rails, sources). Nothing else is
 * invented by the client; the model works only from this JSON.
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
    `- Adviser context: cohort avg annual spend, totals (plan / observed / reallocatable / over-plan), cap buffer, ok flag.`,
    `- ${x.themes.length} themes, each with share vs cohort benchmark share, allocation, plan total, observed total, plan over-runs, reallocatable, and its distinct sources (with URLs).`,
    `- ${x.payYourselfFirst.length} pay-yourself-first rails and every category: plan, observed, % of cap, delta vs plan, delta % — plus benchmark avg/median and source.`,
    '',
    '```json',
    json,
    '```',
    '',
    'Read the JSON carefully. Build the full narrative from it — balance, cohort comparison per theme, pay-yourself-first health, anomalies (plan over-runs, observed over plan, freed-up reallocation), and concrete numbered tips with dollar figures. Only use numbers present in this JSON.',
  ].join('\n')
}