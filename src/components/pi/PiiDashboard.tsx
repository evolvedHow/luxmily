import { useMemo } from 'react'
import { Alert, Card, Row } from '../ui'
import { C, pct } from '../../theme/tokens'
import { useActiveProfile, usePii, usePiiDataset } from '../../store/usePii'
import { calcPersonalInflation, personalIndexSeries, budgetInflation } from '../../pi/engine'
import { ALL_ITEMS_ID } from '../../pi/blsMetadata'
import { shift } from '../../pi/period'
import { PiiChart } from './PiiChart'

const SPANS = [
  { label: '12 mo', months: 12 },
  { label: '3 yr', months: 36 },
  { label: '5 yr', months: 60 },
  { label: '10 yr', months: 120 },
  { label: 'Since 2000', months: 320 },
]

export function PiiDashboard() {
  const profile = useActiveProfile()
  const dataset = usePiiDataset()
  const from = usePii((s) => s.from)
  const to = usePii((s) => s.to)
  const setFrom = usePii((s) => s.setFrom)
  const setTo = usePii((s) => s.setTo)
  const refreshing = usePii((s) => s.refreshing)
  const refreshError = usePii((s) => s.refreshError)
  const lastRefresh = usePii((s) => s.lastRefresh)
  const refreshData = usePii((s) => s.refreshData)
  const setBasePeriod = usePii((s) => s.setBasePeriod)

  const latest = useMemo(() => {
    let l = to
    for (const arr of Object.values(dataset.observations)) {
      const x = arr[arr.length - 1]?.period
      if (x && x > l) l = x
    }
    return l
  }, [dataset, to])

  const r = useMemo(() => {
    if (!profile) return null
    return calcPersonalInflation({ profile, dataset, from, to })
  }, [profile, dataset, from, to])

  const officialRate = useMemo(() => {
    const a = dataset.observations[ALL_ITEMS_ID]
    const b = a.find((o) => o.period === from) ?? a[0]
    const t = a.find((o) => o.period === to) ?? a[a.length - 1]
    if (!b || !t) return null
    return { change: t.index / b.index - 1, from: b.period, to: t.period }
  }, [dataset, from, to])

  const budget = useMemo(() => {
    if (!profile) return null
    return budgetInflation(profile, dataset, from, to)
  }, [profile, dataset, from, to])

  const series = useMemo(() => {
    if (!profile) return []
    return personalIndexSeries(profile, dataset, from, to)
  }, [profile, dataset, from, to])

  if (!profile) return null

  return (
    <div className="mt-3 space-y-3">
      <Card>
        <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: C.muted }}>
          Period
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {SPANS.map((s) => {
            const f = shift(latest, -s.months)
            const active = from === f && to === latest
            return (
              <button
                key={s.label}
                onClick={() => {
                  setFrom(f)
                  setTo(latest)
                }}
                className="text-[11.5px] px-3 py-1 rounded-full border transition-colors"
                style={{
                  background: active ? `${C.cap}1a` : C.surface,
                  borderColor: active ? C.cap : C.border,
                  color: active ? C.cap : C.muted,
                }}
              >
                {s.label}
              </button>
            )
          })}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <MonthInput value={from} onChange={setFrom} label="Start" />
          <span style={{ color: C.muted }}>→</span>
          <MonthInput value={to} onChange={setTo} label="End" />
          <button
            onClick={() => {
              setBasePeriod(from)
            }}
            className="ml-auto text-[11px] underline underline-offset-2"
            style={{ color: C.muted }}
            title="Use the start month as the profile's base period for index calculations"
          >
            set base
          </button>
        </div>
      </Card>

      <Card accent={C.cap}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: C.muted }}>
              Personal
            </div>
            <div className="tnum text-[34px] leading-none mt-1.5" style={{ color: C.cap }}>
              {r ? pct(r.total) : '—'}
            </div>
            <div className="text-[11.5px] mt-1" style={{ color: C.muted }}>
              {r ? `annualized ${pct(r.annualized)}` : 'not available'}
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: C.muted }}>
              Official CPI
            </div>
            <div className="tnum text-[34px] leading-none mt-1.5" style={{ color: C.text }}>
              {officialRate ? pct(officialRate.change) : '—'}
            </div>
            <div className="text-[11.5px] mt-1" style={{ color: C.muted }}>
              all items · U.S. city avg
            </div>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t" style={{ borderColor: C.border }}>
          <Row
            label="Your spending"
            value={`${r ? pct(r.total - (officialRate?.change ?? 0)) : '—'} vs official`}
            strong
            color={r && officialRate && r.total > officialRate.change ? C.red : C.green}
          />
          <div className="text-[10.5px] mt-1" style={{ color: C.muted }}>
            {from} → {to} · coverage {r ? pct(r.covered, 0) : '—'} of spending{r?.assumptions ? ' · includes user assumptions' : ''}
          </div>
        </div>
      </Card>

      {refreshError && <Alert>{refreshError}</Alert>}

      <Card>
        <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: C.muted }}>
          Your index vs official
        </div>
        <PiiChart series={series} />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[10.5px]" style={{ color: C.muted }}>
            base 100 at {from}
          </span>
          <button
            onClick={refreshData}
            className="text-[11px] underline underline-offset-2"
            style={{ color: C.muted }}
          >
            {refreshing ? 'refreshing…' : lastRefresh ? `refresh data · ${lastRefresh}` : 'refresh data'}
          </button>
        </div>
      </Card>

      {r && r.contributions.length > 0 && (
        <Card>
          <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: C.muted }}>
            What’s moving your number
          </div>
          <div className="mt-2 space-y-1.5">
            {r.contributions.slice(0, 8).map((c) => {
              const pos = c.contributionPts >= 0
              return (
                <div key={c.categoryId} className="flex items-center justify-between">
                  <span className="text-[12px]" style={{ color: C.text }}>
                    {c.label}
                  </span>
                  <span className="tnum text-[12px]" style={{ color: pos ? C.red : C.green }}>
                    {c.weight > 0 ? `${(c.weight * 100).toFixed(1)}% w · ` : ''}
                    {pos ? '+' : ''}
                    {(c.contributionPts * 100).toFixed(2)}pp
                  </span>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {budget && (
        <Card>
          <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: C.muted }}>
            Budget inflation
          </div>
          <div className="mt-1.5">
            <Row label="Your cash requirement" value={pct(budget.total)} strong />
            <Row label="Annualized" value={pct(budget.annualized)} />
            <div className="text-[10.5px] mt-1.5 leading-snug" style={{ color: C.muted }}>
              Personal CPI answers “prices”; budget inflation answers “my money”. Fixed lines
              (savings, some fees) don’t follow the CPI, so the two rarely match.
            </div>
          </div>
          <div className="mt-2 space-y-1">
            {budget.lines.slice(0, 5).map((l) => (
              <div key={l.categoryId} className="flex items-center justify-between text-[11.5px]">
                <span style={{ color: C.muted }}>{l.label}</span>
                <span className="tnum" style={{ color: l.rate >= 0 ? C.red : C.green }}>
                  {l.weight * 100 < 0.5 ? '<0.5%' : `${(l.weight * 100).toFixed(1)}% · ${pct(l.rate)}`}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

function MonthInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <label className="flex items-center gap-1.5">
      <span className="text-[10.5px] uppercase tracking-wider" style={{ color: C.muted }}>
        {label}
      </span>
      <input
        type="month"
        aria-label={label}
        value={value}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className="tnum rounded-xl border bg-transparent px-2 py-1.5 text-[12px] outline-none"
        style={{ borderColor: C.border, color: C.text }}
      />
    </label>
  )
}