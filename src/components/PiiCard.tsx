import { useMemo, useState } from 'react'
import { HelpCircle } from 'lucide-react'
import { currentPersonalCpi } from '../pi/personalCpi'
import { C, money } from '../theme/tokens'
import { Card } from './ui'
import { PiiSheet } from './PiiSheet'
import type { ResolvedBudget } from '../engine/types'

const rate = (n: number | null | undefined, decimals = 2) =>
  n == null ? '—' : `${n >= 0 ? '' : '−'}${Math.abs(n).toFixed(decimals)}%`

/**
 * pII — personal Inflation index.
 *
 * The headline CPI is a national basket: ~41% of it is housing, whether or not
 * you have a mortgage. pII replaces those national weights with *your* theme
 * allocations and reprices the same official BLS series against them. Own your
 * home outright and put 6% into housing? Shelter inflation barely reaches you,
 * and your number drops below the headline.
 *
 * Optimizer-only: this reads the plan, never actual spending.
 */
export function PiiCard({ r, baseline }: { r: ResolvedBudget; baseline: ResolvedBudget }) {
  const [helpOpen, setHelpOpen] = useState(false)
  // Both are pure functions of their budget and memoised, so this stays live
  // as you drag — no Calculate button needed.
  const p = useMemo(() => currentPersonalCpi(r), [r])
  const seed = useMemo(() => currentPersonalCpi(baseline), [baseline])

  const gap = p.ratePct != null && p.officialPct != null ? p.ratePct - p.officialPct : null
  // Above the headline = your basket is inflating faster than the nation's.
  const tone = gap == null ? C.muted : gap > 0.05 ? C.red : gap < -0.05 ? C.green : C.text

  // How far your edits have moved the number away from the benchmark seeding.
  const drift = p.ratePct != null && seed.ratePct != null ? p.ratePct - seed.ratePct : null
  const moved = drift != null && Math.abs(drift) >= 0.005

  return (
    <>
      <Card accent={C.border}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.16em]" style={{ color: C.muted }}>
              pII · personal Inflation index
            </div>
            <div
              className="tnum text-[30px] font-semibold leading-none mt-1"
              style={{ color: tone }}
              role="status"
              aria-label="pII rate"
            >
              {rate(p.ratePct)}
            </div>
            <div className="text-[11px] mt-1" style={{ color: C.muted }}>
              as seeded <span className="tnum">{rate(seed.ratePct)}</span>
              {moved && (
                <span style={{ color: drift! > 0 ? C.red : C.green }}>
                  {' '}
                  ({drift! > 0 ? '+' : '−'}
                  {Math.abs(drift!).toFixed(2)} from your edits)
                </span>
              )}
            </div>
            <div className="text-[11px]" style={{ color: C.muted }}>
              headline CPI-U <span className="tnum">{rate(p.officialPct)}</span>
              {gap != null && (
                <>
                  {' · you are '}
                  <span style={{ color: tone }}>
                    {Math.abs(gap) < 0.05
                      ? 'in line with it'
                      : `${rate(Math.abs(gap))} ${gap > 0 ? 'above' : 'below'}`}
                  </span>
                </>
              )}
            </div>
          </div>
          <button
            onClick={() => setHelpOpen(true)}
            aria-label="How pII is calculated"
            title="How pII is calculated"
            className="w-7 h-7 rounded-full border flex items-center justify-center shrink-0"
            style={{ borderColor: C.border, color: C.muted }}
          >
            <HelpCircle size={14} />
          </button>
        </div>

        {/* Your weight vs the national basket's weight, per theme. This is the
            whole idea in one table: same official rates, different weights. */}
        {p.themes.length > 0 && (
          <div className="mt-3 border-t pt-2" style={{ borderColor: C.border }}>
            <div className="flex items-baseline text-[9.5px] uppercase tracking-[0.14em] pb-1" style={{ color: C.muted }}>
              <span className="flex-1">Theme</span>
              <span className="w-14 text-right">You</span>
              <span className="w-14 text-right">CPI</span>
              <span className="w-16 text-right">Rate</span>
            </div>
            {p.themes.map((t) => {
              const heavier = t.officialWeightPct != null && t.weightPct - t.officialWeightPct > 1
              return (
                <div key={t.themeId} className="flex items-baseline text-[11.5px] py-[3px]">
                  <span className="flex-1 truncate" style={{ color: C.text }}>
                    {t.label}
                  </span>
                  <span className="tnum w-14 text-right" style={{ color: heavier ? C.cap : C.muted }}>
                    {t.weightPct.toFixed(0)}%
                  </span>
                  <span className="tnum w-14 text-right" style={{ color: C.muted }}>
                    {t.officialWeightPct != null ? `${t.officialWeightPct.toFixed(0)}%` : '—'}
                  </span>
                  <span
                    className="tnum w-16 text-right"
                    style={{ color: t.inflationPct == null ? C.muted : t.inflationPct > 5 ? C.red : C.text }}
                  >
                    {rate(t.inflationPct, 1)}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        <p className="text-[10px] mt-2.5 leading-snug" style={{ color: C.muted }}>
          Official BLS CPI-U rates ({p.asOf ?? 'n/a'}), reweighted by your allocation across{' '}
          {money(p.coveredPlan)}/mo of planned consumption. {money(p.excludedPlan)}/mo of savings is held out —
          saving is not consumption, so it carries no inflation.
        </p>
      </Card>

      <PiiSheet open={helpOpen} onClose={() => setHelpOpen(false)} result={p} />
    </>
  )
}
