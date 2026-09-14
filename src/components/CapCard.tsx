import { useBudget } from '../store/useBudget'
import { C, money, pct } from '../theme/tokens'
import { Card, Pill, Row } from './ui'
import type { ResolvedBudget } from '../engine/types'

/**
 * The one hard number. The plan sits against the cap; the Observed line says what
 * you have discovered over time; the gap back is what you can reallocate — this
 * app optimizes, it does not track.
 */
export function CapCard({ r }: { r: ResolvedBudget }) {
  const editIncome = useBudget((s) => s.editIncome)

  const planShare = r.cap > 0 ? Math.min(1, r.totalPlan / r.cap) : 0

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
        </div>
        <Pill tone={r.ok ? 'green' : 'red'}>{r.ok ? 'optimized' : 'over plan'}</Pill>
      </div>

      <div className="mt-3.5 space-y-1.5">
        <Row label="Planned this month" value={money(r.totalPlan)} strong color={r.totalPlanOver > 0 ? C.red : C.text} />
        <Row
          label="Your observed spend"
          value={money(r.totalObserved)}
          color={r.observedOverPlan > 0 ? C.red : C.muted}
        />
        <Row
          label="Free to reallocate"
          value={r.reallocatable > 0 ? money(r.reallocatable) : '— '}
          color={r.reallocatable > 0 ? C.green : C.muted}
        />
        <Row label="Cap buffer" value={money(r.buffer)} color={r.buffer < 0 ? C.red : C.green} />
      </div>

      <div className="mt-3 space-y-1.5">
        <Bar label="Plan vs cap" share={planShare} color={r.totalPlanOver > 0 ? C.red : C.cap} />
      </div>

      <div className="flex items-center justify-between mt-3">
        <span className="text-[10.5px] leading-snug max-w-[70%]" style={{ color: C.muted }}>
          Enter what you actually spend per line in the Observed view — Luxmi.ly then shows what that means
          as a % of the cap and what it is worth elsewhere.
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