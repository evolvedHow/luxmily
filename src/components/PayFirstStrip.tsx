import { useBudget } from '../store/useBudget'
import { C, money } from '../theme/tokens'
import { BenchTag, Card, MoneyInput, StatusDot } from './ui'
import type { ResolvedCategory, Viewpoint } from '../engine/types'

/**
 * Pay yourself first: 401(k) / Roth / savings are mandatory rows, each with its
 * benchmark rail so the "right range" is visible rather than guessed.
 */
export function PayFirstStrip({ rows, view }: { rows: ResolvedCategory[]; view: Viewpoint }) {
  const setPlan = useBudget((s) => s.setPlan)
  const setActual = useBudget((s) => s.setActual)

  const total = rows.reduce((s, c) => s + c.plan, 0)

  return (
    <Card accent={C.green}>
      <div className="flex items-baseline justify-between">
        <div className="text-[11px] uppercase tracking-[0.16em]" style={{ color: C.green }}>
          Pay yourself first — mandatory
        </div>
        <span className="tnum text-[13px]" style={{ color: C.text }}>
          {money(total)}/mo
        </span>
      </div>

      <div className="mt-2.5 space-y-2.5">
        {rows.map((c) => (
          <div key={c.id} className="flex items-center gap-2.5">
            <StatusDot ok={c.overPlan === 0} />
            <div className="flex-1 min-w-0">
              <div className="text-[13px] flex items-baseline gap-2" style={{ color: C.text }}>
                {c.label}
              </div>
              <BenchTag avg={c.benchAvg} median={c.benchMedian} medianNote={c.benchMedianNote} source={c.benchSource} />
            </div>
            {view === 'bottom-up' ? (
              <MoneyInput value={c.actual} onChange={(v) => setActual(keyOf(c), v)} label={`${c.label} actual`} accent={c.overPlan > 0 ? C.red : C.text} />
            ) : (
              <MoneyInput value={c.plan} onChange={(v) => setPlan(keyOf(c), v)} label={`${c.label} plan`} />
            )}
            {view === 'bottom-up' && (
              <span className="tnum text-[11px] w-10 text-right" style={{ color: c.overPlan > 0 ? C.red : C.muted }}>
                {c.overPlan > 0 ? `+${Math.round(c.overPlan)}` : ''}
              </span>
            )}
          </div>
        ))}
      </div>
    </Card>
  )
}

export function keyOf(c: ResolvedCategory): string {
  return `${c.themeId}.${c.id}`
}