import { C, money, pct } from '../theme/tokens'
import type { ResolvedBudget } from '../engine/types'

/**
 * Print-only report. The app shell is hidden with .no-print; this block renders
 * only in the print media so "Print / Save as PDF" produces a clean one-pager.
 */
export function PrintSheet({ r }: { r: ResolvedBudget }) {
  const th: React.CSSProperties = { textAlign: 'left', fontSize: 10, padding: '4px 8px', borderBottom: '1px solid #444' }
  const td: React.CSSProperties = { fontSize: 10.5, padding: '3px 8px', borderBottom: '1px solid #ddd' }

  return (
    <div className="print-only" style={{ color: '#111' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>LuxMily Budget Optima</div>
          <div style={{ fontSize: 10, color: '#555' }}>Top-down · benchmark-guided budget report</div>
        </div>
        <div style={{ fontSize: 10, color: '#555' }}>
          {new Date().toLocaleDateString()} · MTD day {r.day}/{r.totalDays}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 24, margin: '14px 0', fontSize: 10.5 }}>
        <Meta label="Monthly income" value={money(r.incomeMonthly)} />
        <Meta label="Take-home (Cap)" value={money(r.cap)} bold />
        <Meta label="Planned" value={money(r.totalPlan)} />
        <Meta label="Spent MTD" value={money(r.totalActual)} />
        <Meta label="Cohort" value={r.cohortLabel} />
        <Meta label="Status" value={r.ok ? 'Balanced' : 'Over budget'} />
      </div>

      {r.payFirst.length > 0 && (
        <Section title="Pay yourself first — mandatory" note="avg / median from BLS CEX 2024 · FRED · Vanguard">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Field</th>
                <th style={th}>Bench avg</th>
                <th style={th}>Bench median</th>
                <th style={th}>Plan</th>
                <th style={th}>Actual</th>
                <th style={th}>Over plan</th>
              </tr>
            </thead>
            <tbody>
              {r.payFirst.map((c) => (
                <tr key={c.id}>
                  <td style={td}>{c.label}</td>
                  <td style={td}>{money(c.benchAvg)}/mo</td>
                  <td style={td}>{c.benchMedian !== undefined ? `${money(c.benchMedian)}/mo` : '—'}</td>
                  <td style={td}>{money(c.plan)}</td>
                  <td style={{ ...td, color: c.overPlan > 0 ? C.red : '#111' }}>{money(c.actual)}</td>
                  <td style={td}>{c.overPlan > 0 ? money(c.overPlan) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {r.themes.map((t) => (
        <Section key={t.id} title={`${t.label} · ${pct(t.share, 0)}`} note={`bench ${pct(t.benchShare, 0)} · ${t.benchSource}`}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Category</th>
                <th style={th}>Bench avg</th>
                <th style={th}>Bench median</th>
                <th style={th}>Plan</th>
                <th style={th}>Actual</th>
                <th style={th}>Over plan</th>
              </tr>
            </thead>
            <tbody>
              {t.cats.map((c) => (
                <tr key={c.id}>
                  <td style={{ ...td, opacity: c.flex ? 0.6 : 1 }}>
                    {c.label}
                    {c.flex ? ' (flex)' : ''}
                  </td>
                  <td style={td}>{money(c.benchAvg)}/mo</td>
                  <td style={td}>{c.benchMedian !== undefined ? `${money(c.benchMedian)}/mo` : '—'}</td>
                  <td style={td}>{money(c.plan)}</td>
                  <td style={{ ...td, color: c.overPlan > 0 ? C.red : '#111' }}>{money(c.actual)}</td>
                  <td style={td}>{c.overPlan > 0 ? money(c.overPlan) : '—'}</td>
                </tr>
              ))}
              <tr>
                <td style={{ ...td, fontWeight: 700 }}>Theme total</td>
                <td style={td}></td>
                <td style={td}></td>
                <td style={td}>{money(t.planTotal)}</td>
                <td style={{ ...td, color: t.spendOver > 0 ? C.red : '#111' }}>{money(t.actualTotal)}</td>
                <td style={td}>{t.planOver > 0 ? `${money(t.planOver)} above alloc` : '—'}</td>
              </tr>
            </tbody>
          </table>
        </Section>
      ))}

      <div style={{ marginTop: 12, fontSize: 10, color: r.ok ? '#1d6' : C.red, fontWeight: 700 }}>
        {r.ok
          ? 'Budget balanced — plans fit inside the cap.'
          : `Over budget: plans exceed their themes by ${money(r.totalPlanOver)}; actuals exceed plans by ${money(r.totalSpendOver)}.`}
      </div>
      <div style={{ fontSize: 8.5, color: '#888', marginTop: 8 }}>
        Averages from BLS Consumer Expenditure Survey 2024 by income cohort; savings rails from FRED PSAVERT and Vanguard data. Medians shown only where published. Guide only — your plan sets your envelope.
      </div>
    </div>
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