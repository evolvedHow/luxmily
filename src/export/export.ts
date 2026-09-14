import type { ResolvedBudget, ResolvedCategory, ResolvedTheme } from '../engine/types'

export interface ExportCategory {
  id: string
  label: string
  payFirst: boolean
  flex: boolean
  lock: string
  plan: number
  actual: number
  benchAvg: number
  benchMedian?: number
  benchSource: string
  overPlan: number
}

export interface ExportTheme {
  id: string
  label: string
  payFirst: boolean
  sharePct: number
  benchSharePct: number
  allocation: number
  planTotal: number
  actualTotal: number
  planOver: number
  spendOver: number
  source: string
  cats: ExportCategory[]
}

export interface ExportBudget {
  app: string
  exportedAt: string
  meta: {
    incomeMonthly: number
    takeHome: number
    cohortId: string
    cohortLabel: string
    day: number
    totalDays: number
    ok: boolean
    buffer: number
  }
  payYourselfFirst: ExportCategory[]
  themes: ExportTheme[]
  totals: { plan: number; actual: number; planOver: number; spendOver: number }
}

function cat(r: ResolvedCategory): ExportCategory {
  return {
    id: r.id,
    label: r.label,
    payFirst: r.payFirst,
    flex: r.flex,
    lock: r.lock,
    plan: r.plan,
    actual: r.actual,
    benchAvg: r.benchAvg,
    benchMedian: r.benchMedian,
    benchSource: r.benchSource,
    overPlan: r.overPlan,
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
    actualTotal: t.actualTotal,
    planOver: t.planOver,
    spendOver: t.spendOver,
    source: t.benchSource,
    cats: t.cats.map(cat),
  }
}

export function toExport(r: ResolvedBudget): ExportBudget {
  return {
    app: 'LuxMily Budget Optima',
    exportedAt: new Date().toISOString(),
    meta: {
      incomeMonthly: r.incomeMonthly,
      takeHome: r.takeHome,
      cohortId: r.cohortId,
      cohortLabel: r.cohortLabel,
      day: r.day,
      totalDays: r.totalDays,
      ok: r.ok,
      buffer: r.buffer,
    },
    payYourselfFirst: r.payFirst.map(cat),
    themes: r.themes.map(theme),
    totals: { plan: r.totalPlan, actual: r.totalActual, planOver: r.totalPlanOver, spendOver: r.totalSpendOver },
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

  rows.push(['LuxMily Budget Optima — export'])
  rows.push([])
  rows.push(['Income (before tax)', r.incomeMonthly])
  rows.push(['Take-home (Cap)', r.takeHome])
  rows.push(['Income cohort', r.cohortLabel])
  rows.push(['Budget OK (all green)', m.meta.ok ? 'yes' : 'no'])
  rows.push(['Cap - plan buffer', r.buffer])
  rows.push([])
  rows.push(['Theme', 'Category', 'Bench avg $/mo', 'Bench median $/mo', 'Plan $', 'Theme allocation $', 'Plan over $', 'Actual $', 'Actual over plan $', 'Lock', 'Source'])
  for (const t of m.themes) {
    rows.push([`${t.label} (${t.sharePct}%)`, '', '', '', t.planTotal, t.allocation, t.planOver, t.actualTotal, t.spendOver, '', t.source])
    for (const c of t.cats) {
      rows.push([
        '',
        `${c.label}${c.payFirst ? ' ★' : ''}${c.flex ? ' (flex)' : ''}`,
        c.benchAvg,
        c.benchMedian ?? '',
        c.plan,
        '',
        '',
        c.actual,
        c.overPlan,
        c.lock,
        c.benchSource,
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