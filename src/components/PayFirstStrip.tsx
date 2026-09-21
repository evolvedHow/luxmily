import { useBudget } from '../store/useBudget'
import { C, money } from '../theme/tokens'
import { BenchTag, Card, MoneyInput } from './ui'
import type { ResolvedCategory } from '../engine/types'

export function catKeyOf(c: ResolvedCategory): string {
  return `${c.themeId}.${c.id}`
}

/**
 * Pay yourself first: 401(k) / Roth / savings are mandatory rows, each with its
 * benchmark rail so the "right range" is visible rather than guessed.
 */
export function PayFirstStrip({ rows }: { rows: ResolvedCategory[] }) {
  const setPlan = useBudget((s) => s.setPlan)

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
            <div className="flex-1 min-w-0">
              <div className="text-[13px] flex items-baseline gap-2" style={{ color: C.text }}>
                {c.label}
              </div>
              <BenchTag avg={c.benchAvg} median={c.benchMedian} medianNote={c.benchMedianNote} source={c.benchSource} url={c.benchUrl} />
            </div>
            <MoneyInput value={c.plan} onChange={(v) => setPlan(catKeyOf(c), v)} label={`${c.label} plan`} />
          </div>
        ))}
      </div>

      <p className="text-[10px] mt-2 leading-snug" style={{ color: C.muted }}>
        Aim to hit or beat these rails first — every dollar here is future-you's. What the savings
        envelope has left goes to Investments inside the Savings &amp; Retirement theme.
      </p>
    </Card>
  )
}