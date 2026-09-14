import { useBudget } from '../store/useBudget'
import { C, money, pct } from '../theme/tokens'
import { Card, Pill, Row } from './ui'
import type { ResolvedBudget } from '../engine/types'

/**
 * The one hard number. Plan and actual each get a bar against the cap so the
 * whole-budget state is a glance, not a sum.
 */
export function CapCard({ r }: { r: ResolvedBudget }) {
  const editIncome = useBudget((s) => s.editIncome)
  const setDay = useBudget((s) => s.setDay)
  const day = useBudget((s) => s.day)
  const totalDays = useBudget((s) => s.totalDays)

  const planShare = r.cap > 0 ? Math.min(1.3, r.totalPlan / r.cap) : 0
  const actShare = r.cap > 0 ? Math.min(1.3, r.totalActual / r.cap) : 0

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
        <Pill tone={r.ok ? 'green' : 'red'}>{r.ok ? 'balanced' : 'over budget'}</Pill>
      </div>

      <div className="mt-3.5 space-y-1.5">
        <Row label="Planned this month" value={money(r.totalPlan)} strong color={r.totalPlanOver > 0 ? C.red : C.text} />
        <Row label="Spent MTD" value={money(r.totalActual)} color={r.totalSpendOver > 0 ? C.red : C.muted} />
        <Row label="Buffer" value={money(r.buffer)} color={r.buffer < 0 ? C.red : C.green} />
      </div>

      <div className="mt-3 space-y-1.5">
        <Bar label="Plan vs cap" share={planShare} tone={r.totalPlanOver > 0 ? 'red' : 'cap'} />
        <Bar label="Actual vs cap" share={actShare} tone={r.totalSpendOver > 0 ? 'red' : 'muted'} />
      </div>

      <div className="flex items-baseline justify-between mt-3">
        <span className="text-[11px]" style={{ color: C.muted }}>
          Day of month {day} / {totalDays}
        </span>
        <button
          onClick={editIncome}
          className="text-[11px] underline underline-offset-2"
          style={{ color: C.cap }}
        >
          Edit income →
        </button>
      </div>
      <input
        type="range"
        min={1}
        max={totalDays}
        value={day}
        onChange={(e) => setDay(Number(e.target.value))}
        className="lever w-full mt-1.5"
        style={{ ['--accent' as string]: C.muted }}
        aria-label="Day of month"
      />
    </Card>
  )
}

function Bar({ label, share, tone }: { label: string; share: number; tone: 'red' | 'cap' | 'muted' }) {
  const color = tone === 'red' ? C.red : tone === 'cap' ? C.cap : C.muted
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