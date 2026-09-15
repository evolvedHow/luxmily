import { ExternalLink, Info, X } from 'lucide-react'
import { COHORT_STANDING, US_NET_WORTH, US_STANDING_SOURCES } from '../data/context'
import { useResolved } from '../store/useBudget'
import { C, money } from '../theme/tokens'

/**
 * About popup — the one-screen pitch for the optimizer philosophy, so the UI
 * and navigation read as intended. Explains the top-down method, pay-yourself-
 * first priority, why the averages are only reference rails keyed to the user's
 * cohort, and (approximated, clearly labelled) where they stand in the US.
 */

const PRINCIPLES: { k: string; v: string }[] = [
  { k: 'Top-down, not bottom-up', v: 'You never guess line items first. One number — your take-home — is the hard cap; themes get shares of it; categories fit inside their themes. Everything is solvable because everything has an envelope.' },
  { k: 'Pay yourself first', v: '401(k) / Roth / emergency sit on their own mandatory strip with benchmark rails. Savings is decided before spending, never the leftover.' },
  { k: 'No credit-card debt', v: 'If you carry high-interest balances, pay them off before growing anything else — no plan that borrows against the future is a plan.' },
  { k: 'Red is information, not shame', v: 'Over-plan and over-observed never auto-rewrite anything. They tell you what to trim or where to fund from — take it from elsewhere, consciously.' },
  { k: 'Averages are for reference', v: 'The benchmark numbers steer the starting point and the “is this sane?” rail. They are your income cohort’s typical spending — not a must, not a maximum. Your plan is yours.' },
]

const SOURCES = [
  { label: 'BLS Consumer Expenditure Survey 2024 — category spend by income quintile', url: 'https://www.bls.gov/cex/tables.htm' },
  { label: 'FRED PSAVERT — U.S. personal saving rate ~3.8%', url: 'https://fred.stlouisfed.org/series/PSAVERT' },
  { label: 'Vanguard How America Saves — 401(k)/IRA contribution rails', url: 'https://institutional.vanguard.com/HAS/How-America-Saves.html' },
]

export function AboutSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const r = useResolved()
  const standing = COHORT_STANDING[r.cohortId]

  if (!open) return null

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-md md:max-w-2xl max-h-[85dvh] rounded-t-3xl border-x border-t flex flex-col"
        style={{ background: C.bg, borderColor: C.border }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-title"
      >
        {/* Head */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b shrink-0" style={{ borderColor: C.border }}>
          <div className="flex items-center gap-2">
            <Info size={16} style={{ color: C.cap }} />
            <div id="about-title" className="text-[14px] font-semibold" style={{ color: C.text }}>
              About Luxmi.ly — how the optimizer thinks
            </div>
          </div>
          <button onClick={onClose} aria-label="Close about" className="w-8 h-8 rounded-full border flex items-center justify-center" style={{ borderColor: C.border, color: C.muted }}>
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          <p className="text-[12.5px] leading-relaxed" style={{ color: C.text }}>
            Luxmi.ly is a <strong>budget optimizer, not an expense tracker</strong>. It never records your day-to-day
            spending. You tell it one number you can live within — your take-home pay — and it shows you what a
            benchmark-guided, balanced plan looks like inside that number, and what your discovered spending actually
            means.
          </p>

          {PRINCIPLES.map((p) => (
            <div key={p.k}>
              <div className="text-[12.5px] font-semibold" style={{ color: C.cap }}>
                {p.k}
              </div>
              <div className="text-[12px] leading-relaxed mt-0.5" style={{ color: C.muted }}>
                {p.v}
              </div>
            </div>
          ))}

          {/* Where you stand */}
          <div className="rounded-2xl border p-3" style={{ borderColor: C.border, background: C.surface }}>
            <div className="text-[11px] uppercase tracking-[0.16em] mb-2" style={{ color: C.muted }}>
              Where you stand (approximate)
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-[16px] font-semibold" style={{ color: C.cap }}>
                {standing ? standing.label : '—'}
              </span>
              <span className="text-[11px]" style={{ color: C.muted }}>
                by household income
              </span>
            </div>
            <div className="text-[11px] mt-1" style={{ color: C.muted }}>
              {standing?.note ?? 'Enter income to rank your cohort.'} · income bands, not net worth
            </div>

            <div className="mt-2.5 space-y-1 border-t pt-2" style={{ borderColor: C.border }}>
              {US_NET_WORTH.map((t) => (
                <div key={t.label} className="flex items-baseline justify-between">
                  <span className="text-[11.5px]" style={{ color: C.text }}>
                    {t.label}
                  </span>
                  <span className="tnum text-[12px] font-semibold" style={{ color: C.text }}>
                    {t.value}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[10px] mt-2 leading-snug" style={{ color: C.muted }}>
              Net worth thresholds are US reference markers — your money lives in the plan above, and this app never
              asks your net worth. Approximations; not financial advice.
            </p>
            <div className="mt-1.5 space-y-0.5">
              {US_STANDING_SOURCES.map((s) => (
                <div key={s.url} className="flex items-start gap-1.5">
                  <span className="text-[10px] leading-snug" style={{ color: C.muted }}>
                    {s.label}
                  </span>
                  <a href={s.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center shrink-0 mt-px" style={{ color: C.cap }}>
                    <ExternalLink size={9} />
                  </a>
                </div>
              ))}
            </div>
          </div>

          {/* Sources */}
          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] mb-1.5" style={{ color: C.muted }}>
              Where every average comes from
            </div>
            {SOURCES.map((s) => (
              <div key={s.label} className="flex items-start gap-1.5 mt-1">
                <span className="text-[11.5px] leading-snug" style={{ color: C.muted }}>
                  {s.label}
                </span>
                <a href={s.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-0.5 shrink-0 mt-px" style={{ color: C.cap }}>
                  <ExternalLink size={10} />
                </a>
              </div>
            ))}
            <div className="text-[10.5px] mt-2" style={{ color: C.muted }}>
              Averages are seeded for the cohort your income selects ({r.cohortLabel}, <span className="tnum">{money(r.cap * 12)}/yr</span> band) — tailored reference, not a mandate.
            </div>
          </div>
        </div>

        <div className="px-4 pb-4 shrink-0">
          <button
            onClick={onClose}
            className="w-full rounded-2xl py-3 text-[14px] font-semibold"
            style={{ background: C.cap, color: '#1b1b1d' }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}