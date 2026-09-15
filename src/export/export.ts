import { cohortById } from '../data/benchmarks'
import type { ResolvedBudget, ResolvedCategory, ResolvedTheme } from '../engine/types'

export interface ExportCategory {
  id: string
  label: string
  payFirst: boolean
  flex: boolean
  lock: string
  plan: number
  observed: number
  observedPct: number
  delta: number
  deltaPct: number
  surplus: number
  benchAvg: number
  benchMedian?: number
  benchMedianNote?: string
  benchSource: string
  sourceUrl?: string
}

export interface ExportTheme {
  id: string
  label: string
  payFirst: boolean
  sharePct: number
  benchSharePct: number
  allocation: number
  planTotal: number
  observedTotal: number
  planOver: number
  reallocatable: number
  observedOverPlan: number
  source: string
  sources: { label: string; url?: string }[]
  cats: ExportCategory[]
}

export interface ExportBudget {
  app: string
  exportedAt: string
  meta: {
    incomeMonthly: number
    takeHome: number
    cap: number
    cohortId: string
    cohortLabel: string
    cohortAvgAnnualSpend: number
    cohortBand: string
    ok: boolean
    buffer: number
    totalPlan: number
    totalObserved: number
    totalPlanOver: number
    observedOverPlan: number
    totalReallocatable: number
  }
  payYourselfFirst: ExportCategory[]
  themes: ExportTheme[]
}

function cat(r: ResolvedCategory): ExportCategory {
  return {
    id: r.id,
    label: r.label,
    payFirst: r.payFirst,
    flex: r.flex,
    lock: r.lock,
    plan: r.plan,
    observed: r.observed,
    observedPct: Math.round(r.observedPct * 1000) / 10,
    delta: Math.round(r.delta),
    deltaPct: r.deltaPct > 0 && r.delta === 0 ? 0 : Math.round(r.deltaPct * 1000) / 10,
    surplus: Math.round(r.surplus),
    benchAvg: r.benchAvg,
    benchMedian: r.benchMedian,
    benchMedianNote: r.benchMedianNote,
    benchSource: r.benchSource,
    sourceUrl: r.benchUrl,
  }
}

function theme(t: ResolvedTheme): ExportTheme {
  return {
    id: t.id,
    label: t.label,
    payFirst: t.payFirst,
    sharePct: Math.round(t.share * 1000) / 10,
    benchSharePct: Math.round(t.benchShare * 1000) / 10,
    allocation: t.allocation,
    planTotal: t.planTotal,
    observedTotal: t.observedTotal,
    planOver: t.planOver,
    reallocatable: t.reallocatable,
    observedOverPlan: t.observedOverPlan,
    source: t.benchSource,
    sources: t.sources,
    cats: t.cats.map(cat),
  }
}

export function toExport(r: ResolvedBudget): ExportBudget {
  const cohort = cohortById(r.cohortId)
  return {
    app: 'Luxmi.ly',
    exportedAt: new Date().toISOString(),
    meta: {
      incomeMonthly: r.incomeMonthly,
      takeHome: r.takeHome,
      cap: r.cap,
      cohortId: r.cohortId,
      cohortLabel: r.cohortLabel,
      cohortAvgAnnualSpend: cohort.avgAnnualSpend,
      cohortBand: cohort.incomeMin === 0 ? `up to ${cohort.incomeMax.toFixed(0)}/mo` : `${cohort.incomeMin.toFixed(0)}–${cohort.incomeMax === Infinity ? '+' : cohort.incomeMax.toFixed(0)}/mo`,
      ok: r.ok,
      buffer: r.buffer,
      totalPlan: r.totalPlan,
      totalObserved: r.totalObserved,
      totalPlanOver: r.totalPlanOver,
      observedOverPlan: r.observedOverPlan,
      totalReallocatable: r.reallocatable,
    },
    payYourselfFirst: r.payFirst.map(cat),
    themes: r.themes.map(theme),
  }
}

export function toJSON(r: ResolvedBudget): string {
  return JSON.stringify(toExport(r), null, 2)
}

function esc(v: string | number | undefined | null): string {
  const s = v === undefined || v === null ? '' : `${v}`
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Flat table ready for import into Google Sheets / Excel. */
export function toCSV(r: ResolvedBudget): string {
  const rows: (string | number | null | undefined)[][] = []
  const m = toExport(r)

  rows.push(['Luxmi.ly — optimizer export'])
  rows.push([])
  rows.push(['Income (before tax)', r.incomeMonthly])
  rows.push(['Take-home (Cap)', r.takeHome])
  rows.push(['Income cohort', r.cohortLabel])
  rows.push(['Optimized (all green)', m.meta.ok ? 'yes' : 'no'])
  rows.push(['Cap - plan buffer', r.buffer])
  rows.push(['Observed spend', r.totalObserved])
  rows.push(['Free to reallocate', r.reallocatable])
  rows.push([])
  rows.push(['Theme', 'Category', 'Bench avg $/mo', 'Bench median $/mo', 'Plan $', 'Theme alloc $', 'Plan over $', 'Observed $', 'Observed % of cap', 'vs plan $', 'Reallocate $', 'Lock', 'Source', 'Source link'])
  for (const t of m.themes) {
    rows.push([`${t.label} (${t.sharePct}%)`, '', '', '', t.planTotal, t.allocation, t.planOver, t.observedTotal, '', '', t.reallocatable, '', t.source, ''])
    for (const c of t.cats) {
      rows.push([
        '',
        `${c.label}${c.payFirst ? ' ★' : ''}${c.flex ? ' (flex)' : ''}`,
        c.benchAvg,
        c.benchMedian ?? '',
        c.plan,
        '',
        '',
        c.observed,
        `${c.observedPct}%`,
        c.delta === 0 ? '' : c.delta,
        c.surplus,
        c.lock,
        c.benchSource,
        c.sourceUrl ?? '',
      ])
    }
  }
  return rows.map((rrow) => rrow.map(esc).join(',')).join('\n')
}

function download(filename: string, content: string, type: string): void {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function downloadJSON(r: ResolvedBudget): void {
  download('luxmily-budget.json', toJSON(r), 'application/json')
}

export function downloadCSV(r: ResolvedBudget): void {
  download('luxmily-budget.csv', toCSV(r), 'text/csv;charset=utf-8')
}

/** Print / Save as PDF — the report is the print sheet. */
export function printReport(): void {
  window.print()
}