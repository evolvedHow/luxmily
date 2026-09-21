import { currentPersonalCpi } from '../pi/personalCpi'
import { C, money, pct } from '../theme/tokens'
import type { ResolvedBudget, ResolvedCategory } from '../engine/types'

/**
 * Print-only report. The app shell is hidden with .no-print; this block renders
 * only in the print media so "Print / Save as PDF" produces a clean one-pager.
 * It reports the OPTIMIZER angles: plan vs benchmark, % of cap. Nothing here
 * tracks time or real spending.
 */
export function PrintSheet({ r }: { r: ResolvedBudget }) {
  return (
    <div className="print-only" style={{ color: '#111' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Luxmi.ly — Budget Optima</div>
          <div style={{ fontSize: 10, color: '#555' }}>Top-down · benchmark-guided budget optimizer</div>
        </div>
        <div style={{ fontSize: 10, color: '#555' }}>{new Date().toLocaleDateString()}</div>
      </div>

      <div style={{ display: 'flex', gap: 24, margin: '14px 0', fontSize: 10.5 }}>
        <Meta label="Monthly income" value={money(r.incomeMonthly)} />
        <Meta label="Take-home (Cap)" value={money(r.cap)} bold />
        <Meta label="Planned" value={money(r.totalPlan)} />
        <Meta label="Unallocated" value={money(r.unallocated)} />
        <Meta label="Cohort" value={r.cohortLabel} />
        <Meta label="Status" value={r.ok ? 'Within cap' : 'Over cap'} />
      </div>

      <PiiBlock r={r} />

      {r.payFirst.length > 0 && (
        <Section title="Pay yourself first — mandatory" note="benchmarks: Vanguard · FRED PSAVERT · BLS CEX 2024">
          <PlanTable rows={r.payFirst} cap={r.cap} />
        </Section>
      )}

      {/* Benchmark basis — the "where every average comes from" note at the top of
          the themes (page 2). Averages are keyed to this income cohort, not global. */}
      <div
        style={{
          margin: '12px 0 4px',
          padding: '8px 10px',
          border: '1px solid #ccc',
          borderRadius: 6,
          fontSize: 9.5,
          color: '#333',
          background: '#f7f7f7',
        }}
      >
        <strong>Benchmark basis</strong>
        {r.location && (
          <>
            {' '}— localized for <strong>{r.location.metro}</strong> ({r.location.zip}) at{' '}
            {r.location.cola.toFixed(2)}× national cost of living, with the Rent/Mortgage rail at{' '}
            {r.location.rentFactor.toFixed(2)}× its national level.
          </>
        )}{' '}
        Every average below is the typical spend for your income cohort (
        {r.cohortLabel}): category averages from <strong>BLS Consumer Expenditure Survey 2024</strong> by income
        quintile, savings/retirement rails from <strong>FRED PSAVERT</strong> and <strong>Vanguard How America
        Saves</strong>, Travel from the Luxmi.ly discretionary guide. Averages steer the starting plan — they are
        reference rails, not a mandate; your plan sets your envelope.
      </div>

      {r.themes.map((t) => (
        <Section
          key={t.id}
          title={`${t.label} · ${pct(t.share, 0)}`}
          note={`bench ${pct(t.benchShare, 0)} · ${t.benchSource}`}
        >
          <PlanTable
            rows={t.cats}
            cap={r.cap}
            desc={`Planned ${money(t.planTotal)}${t.lockedTotal > 0 ? ` · ${money(t.lockedTotal)} locked` : ''}`}
          />
        </Section>
      ))}

      <div style={{ marginTop: 12, fontSize: 10, color: r.ok ? '#1d7a3f' : C.red, fontWeight: 700 }}>
        {r.ok
          ? r.unallocated > 0
            ? `Within cap — ${money(r.unallocated)} still available to allocate.`
            : 'Within cap — every dollar of take-home is assigned.'
          : `Over cap by ${money(Math.abs(r.unallocated))} — trim a category or pull one back.`}
      </div>

      <div style={{ fontSize: 8.5, color: '#888', marginTop: 8 }}>
        Averages from BLS Consumer Expenditure Survey 2024 by income cohort; savings rails from FRED PSAVERT and Vanguard How America Saves; Travel is a Luxmi.ly discretionary guide. Averages steer the starting plan — your plan sets your envelope. Medians shown only where published.
      </div>
    </div>
  )
}

/** pII on the report — the number and the weights that produced it. */
function PiiBlock({ r }: { r: ResolvedBudget }) {
  const p = currentPersonalCpi(r)
  if (p.ratePct === null) return null
  const fmt = (n: number | null | undefined, d = 2) =>
    n == null ? '—' : `${n >= 0 ? '' : '−'}${Math.abs(n).toFixed(d)}%`

  return (
    <div style={{ margin: '10px 0', pageBreakInside: 'avoid' } as React.CSSProperties}>
      <div style={{ fontWeight: 700, fontSize: 11.5 }}>
        pII · personal Inflation index — {fmt(p.ratePct)}
      </div>
      <div style={{ fontSize: 8.5, color: '#777', margin: '2px 0 4px' }}>
        headline CPI-U {fmt(p.officialPct)} as of {p.asOf ?? 'n/a'} · official BLS CPI-U rates reweighted by this
        plan's allocation over {money(p.coveredPlan)}/mo of consumption ({money(p.excludedPlan)}/mo of savings
        excluded)
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', fontSize: 10, padding: '4px 8px', borderBottom: '1px solid #444' }}>Theme</th>
            <th style={{ textAlign: 'left', fontSize: 10, padding: '4px 8px', borderBottom: '1px solid #444' }}>Your weight</th>
            <th style={{ textAlign: 'left', fontSize: 10, padding: '4px 8px', borderBottom: '1px solid #444' }}>CPI weight</th>
            <th style={{ textAlign: 'left', fontSize: 10, padding: '4px 8px', borderBottom: '1px solid #444' }}>Inflation</th>
          </tr>
        </thead>
        <tbody>
          {p.themes.map((t) => (
            <tr key={t.themeId}>
              <td style={{ fontSize: 10.5, padding: '3px 8px', borderBottom: '1px solid #ddd' }}>{t.label}</td>
              <td style={{ fontSize: 10.5, padding: '3px 8px', borderBottom: '1px solid #ddd' }}>{t.weightPct.toFixed(1)}%</td>
              <td style={{ fontSize: 10.5, padding: '3px 8px', borderBottom: '1px solid #ddd' }}>
                {t.officialWeightPct != null ? `${t.officialWeightPct.toFixed(1)}%` : '—'}
              </td>
              <td style={{ fontSize: 10.5, padding: '3px 8px', borderBottom: '1px solid #ddd' }}>{fmt(t.inflationPct, 1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PlanTable({ rows, cap, desc }: { rows: ResolvedCategory[]; cap: number; desc?: string }) {
  const th: React.CSSProperties = { textAlign: 'left', fontSize: 10, padding: '4px 8px', borderBottom: '1px solid #444' }
  const td: React.CSSProperties = { fontSize: 10.5, padding: '3px 8px', borderBottom: '1px solid #ddd' }

  return (
    <>
      {desc && <div style={{ fontSize: 9, color: '#666', margin: '2px 0 4px' }}>{desc}</div>}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={th}>Category</th>
            <th style={th}>Bench avg</th>
            <th style={th}>Bench median</th>
            <th style={th}>Plan</th>
            <th style={th}>Plan % of cap</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c, i) => (
            <tr key={i}>
              <td style={td}>{c.label}</td>
              <td style={td}>{money(c.benchAvg)}/mo</td>
              <td style={td}>{c.benchMedian !== undefined ? `${money(c.benchMedian)}/mo` : '—'}</td>
              <td style={td}>{money(c.plan)}</td>
              <td style={td}>{cap > 0 ? pct(c.plan / cap, 1) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

function Meta({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 9, color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: 12, fontWeight: bold ? 700 : 500 }}>{value}</div>
    </div>
  )
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div style={{ margin: '10px 0', pageBreakInside: 'avoid' } as React.CSSProperties}>
      <div style={{ fontWeight: 700, fontSize: 11.5 }}>{title}</div>
      {note && <div style={{ fontSize: 8.5, color: '#777', margin: '2px 0 4px' }}>{note}</div>}
      {children}
    </div>
  )
}