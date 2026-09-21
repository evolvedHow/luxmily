import { cohortById } from '../data/benchmarks'
import { currentPersonalCpi } from '../pi/personalCpi'
import type { ResolvedBudget, ResolvedCategory, ResolvedTheme } from '../engine/types'

export interface ExportCategory {
  id: string
  label: string
  payFirst: boolean
  flex: boolean
  /** Pinned by the user — excluded from theme proration. */
  locked: boolean
  plan: number
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
  planTotal: number
  /** Locked subtotal inside the theme — its floor. */
  lockedTotal: number
  locked: boolean
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
    /** Localization (ZIP → area) when given, else null. */
    location: {
      zip: string
      metro: string
      cola: number
      rentFactor: number
      medianIncome: number
    } | null
    ok: boolean
    /** Cap − totalPlan. Positive = cash still to assign; negative = over cap. */
    unallocated: number
    totalPlan: number
  }
  /**
   * pII — personal Inflation index. Official BLS CPI-U rates reweighted by
   * this budget's own allocation. Optimizer-only: derived from the plan, never
   * from actual spending.
   */
  personalInflation: {
    /** Your allocation-weighted inflation rate (y/y, %). */
    piiPct: number | null
    /** Headline CPI-U all-items rate over the same window (%). */
    headlinePct: number | null
    /** Points above (+) or below (−) the headline. */
    vsHeadlinePts: number | null
    asOf: string | null
    /** Planned consumption the index is computed over ($/mo). */
    coveredPlan: number
    /** Savings held out of the basket ($/mo) — saving is not consumption. */
    excludedPlan: number
    source: string
    themes: {
      id: string
      label: string
      /** Your share of the covered basket (%). */
      weightPct: number
      /** CPI-U's own share of the same set (%). */
      cpiWeightPct: number | null
      /** This theme's dollar-weighted inflation (%). */
      inflationPct: number | null
      /** Points of your pII contributed by this theme. */
      contributionPts: number
    }[]
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
    locked: r.locked,
    plan: r.plan,
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
    planTotal: t.planTotal,
    lockedTotal: t.lockedTotal,
    locked: t.locked,
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
      location: r.location
        ? {
            zip: r.location.zip,
            metro: r.location.metro,
            cola: r.location.cola,
            rentFactor: r.location.rentFactor,
            medianIncome: r.location.medianIncome,
          }
        : null,
      ok: r.ok,
      unallocated: r.unallocated,
      totalPlan: r.totalPlan,
    },
    personalInflation: (() => {
      const p = currentPersonalCpi(r)
      return {
        piiPct: p.ratePct === null ? null : Math.round(p.ratePct * 100) / 100,
        headlinePct: p.officialPct === null ? null : Math.round(p.officialPct * 100) / 100,
        vsHeadlinePts:
          p.ratePct === null || p.officialPct === null
            ? null
            : Math.round((p.ratePct - p.officialPct) * 100) / 100,
        asOf: p.asOf,
        coveredPlan: p.coveredPlan,
        excludedPlan: p.excludedPlan,
        source: `BLS CPI-U · ${p.area} · ${p.population} · snapshot ${p.version}`,
        themes: p.themes.map((t) => ({
          id: t.themeId,
          label: t.label,
          weightPct: Math.round(t.weightPct * 10) / 10,
          cpiWeightPct: t.officialWeightPct === undefined ? null : Math.round(t.officialWeightPct * 10) / 10,
          inflationPct: t.inflationPct === null ? null : Math.round(t.inflationPct * 100) / 100,
          contributionPts: Math.round(t.contributionPts * 1000) / 1000,
        })),
      }
    })(),
    payYourselfFirst: r.payFirst.map(cat),
    themes: r.themes.map(theme),
  }
}

export function toJSON(r: ResolvedBudget, compact = false): string {
  const x = toExport(r)
  if (!compact) return JSON.stringify(x, null, 2)
  // Compact = minified + URL/note fields stripped (values the model can't use).
  // Used for small-token-budget providers (Groq free tier caps ~8k tok/request).
  return JSON.stringify({
    ...x,
    payYourselfFirst: x.payYourselfFirst.map((c) => ({
      ...c,
      benchMedianNote: undefined,
      sourceUrl: undefined,
    })),
    themes: x.themes.map((t) => ({
      ...t,
      sources: t.sources.map((s) => ({ label: s.label })),
      cats: t.cats.map((c) => ({
        ...c,
        benchMedianNote: undefined,
        sourceUrl: undefined,
      })),
    })),
  })
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
  rows.push([
    'Area (ZIP → metro)',
    m.meta.location
      ? `${m.meta.location.metro} (${m.meta.location.zip}) — ${m.meta.location.cola}× national cost of living, rent ${m.meta.location.rentFactor}×`
      : 'US average',
  ])
  rows.push(['Within cap', m.meta.ok ? 'yes' : 'no'])
  rows.push(['Unallocated (available to assign)', r.unallocated])
  rows.push([
    'pII (personal Inflation index)',
    m.personalInflation.piiPct === null ? 'n/a' : `${m.personalInflation.piiPct}%`,
  ])
  rows.push([
    'Headline CPI-U',
    m.personalInflation.headlinePct === null
      ? 'n/a'
      : `${m.personalInflation.headlinePct}% (as of ${m.personalInflation.asOf ?? 'n/a'})`,
  ])
  rows.push([])
  rows.push(['Theme', 'Category', 'Bench avg $/mo', 'Bench median $/mo', 'Plan $', 'Theme total $', 'Locked', 'Source', 'Source link'])
  for (const t of m.themes) {
    rows.push([`${t.label} (${t.sharePct}%)`, '', '', '', '', t.planTotal, t.locked ? 'theme locked' : '', t.source, ''])
    for (const c of t.cats) {
      rows.push([
        '',
        `${c.label}${c.payFirst ? ' ★' : ''}${c.flex ? ' (flex)' : ''}`,
        c.benchAvg,
        c.benchMedian ?? '',
        c.plan,
        '',
        c.locked ? 'locked' : '',
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