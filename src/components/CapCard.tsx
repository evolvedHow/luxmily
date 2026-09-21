import { useBudget } from '../store/useBudget'
import { COHORT_STANDING } from '../data/context'
import { C, money, pct } from '../theme/tokens'
import { Card, Pill, Row } from './ui'
import type { ResolvedBudget } from '../engine/types'

/**
 * The one hard number, and the holding bucket under it.
 *
 * Trimming a category does not shrink your money — it frees it. That freed
 * cash lands in "Available to allocate" and waits there until you spend it on
 * another line or sweep it into the emergency buffer. Only overshooting the
 * cap is red, because only that is actually a problem.
 */
export function CapCard({ r }: { r: ResolvedBudget }) {
  const editIncome = useBudget((s) => s.editIncome)
  const sweepToEmergency = useBudget((s) => s.sweepToEmergency)
  const standing = COHORT_STANDING[r.cohortId]

  const planShare = r.cap > 0 ? Math.min(1, r.totalPlan / r.cap) : 0
  const loc = r.location
  const areaPct =
    loc && loc.medianIncome > 0 ? Math.round((r.incomeMonthly * 12 * 100) / loc.medianIncome) : 0
  const k = (n: number) => (n >= 1000 ? `$${Math.round(n / 1000)}k` : money(n))

  const over = r.unallocated < 0
  const spare = r.unallocated > 0
  const bucketColor = over ? C.red : spare ? C.green : C.muted

  return (
    <Card accent={r.ok ? C.green : C.red}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.16em]" style={{ color: C.muted }}>
            Take-home · the Cap
          </div>
          <div className="tnum text-[34px] font-semibold leading-none mt-1" style={{ color: r.ok ? C.text : C.red }}>
            {money(r.cap)}
          </div>
          <div className="text-[11px] mt-1" style={{ color: C.muted }}>
            Income <span className="tnum">{money(r.incomeMonthly)}</span>/mo · cohort {r.cohortLabel}
          </div>
          {standing && (
            <div className="text-[11px]" style={{ color: C.cap }}>
              {standing.label} by US household income
            </div>
          )}
          {loc && (
            <div className="text-[11px] leading-snug" style={{ color: C.muted }}>
              Localized for {loc.metro} ({loc.zip}) · {loc.cola.toFixed(2)}× US cost of living · ≈{areaPct}% of the
              local median income ({k(loc.medianIncome)}/yr)
            </div>
          )}
        </div>
        <Pill tone={r.ok ? 'green' : 'red'}>{r.ok ? 'within cap' : 'over cap'}</Pill>
      </div>

      <div className="mt-3.5 space-y-1.5">
        <Row label="Allocated to themes" value={money(r.totalPlan)} strong />
      </div>

      {/* The holding bucket — the point of the whole reallocation loop. */}
      <div
        className="mt-2.5 rounded-2xl border px-3 py-2.5"
        style={{ borderColor: `${bucketColor}55`, background: `${bucketColor}12` }}
      >
        <div className="flex items-baseline justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.14em]" style={{ color: bucketColor }}>
              {over ? 'Over the cap' : 'Available to allocate'}
            </div>
            <div
              className="tnum text-[22px] font-semibold leading-none mt-0.5"
              style={{ color: bucketColor }}
              role="status"
              aria-label="Unallocated"
            >
              {money(Math.abs(r.unallocated))}
            </div>
          </div>
          {spare && (
            <button
              onClick={sweepToEmergency}
              aria-label="Sweep available cash to emergency buffer"
              className="text-[11px] rounded-xl border px-2.5 py-1.5 shrink-0 transition-opacity hover:opacity-80"
              style={{ borderColor: C.green, color: C.green }}
            >
              → Emergency buffer
            </button>
          )}
        </div>
        <p className="text-[10px] mt-1.5 leading-snug" style={{ color: C.muted }}>
          {over
            ? 'Your plan asks for more than you take home. Trim a category or unlock one and pull it back.'
            : spare
              ? 'Take-home your cohort benchmarks do not spend, plus anything you have trimmed. Raise a category, or bank it.'
              : 'Every dollar of take-home is assigned.'}
        </p>
      </div>

      <div className="mt-3 space-y-1.5">
        <Bar label="Plan vs cap" share={planShare} color={over ? C.red : C.cap} />
      </div>

      <div className="flex items-center justify-between mt-3">
        <span className="text-[10.5px] leading-snug max-w-[70%]" style={{ color: C.muted }}>
          Plans are seeded from your income cohort's averages — your envelope sets the final numbers.
        </span>
        <button
          onClick={editIncome}
          className="text-[11px] underline underline-offset-2 shrink-0 ml-3"
          style={{ color: C.cap }}
        >
          Edit income →
        </button>
      </div>
    </Card>
  )
}

function Bar({ label, share, color }: { label: string; share: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] w-24 shrink-0" style={{ color: C.muted }}>
        {label}
      </span>
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: C.bg }}>
        <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(1, share)) * 100}%`, background: color }} />
      </div>
      <span className="tnum text-[11px] w-14 text-right" style={{ color }}>
        {pct(Math.min(1, share), 0)}
      </span>
    </div>
  )
}
