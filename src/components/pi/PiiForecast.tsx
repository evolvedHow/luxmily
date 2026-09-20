import { useMemo, useState } from 'react'
import { Card, Row } from '../ui'
import { C, money, pct } from '../../theme/tokens'
import { useActiveProfile, usePii, usePiiDataset } from '../../store/usePii'
import { forwardForecast, applyScenario, budgetInflation } from '../../pi/engine'

const HORIZONS = [1, 3, 5, 10]

export function PiiForecast() {
  const profile = useActiveProfile()
  const dataset = usePiiDataset()
  const from = usePii((s) => s.from)
  const to = usePii((s) => s.to)
  const scenarios = usePii((s) => s.scenarios)
  const setBasePeriod = usePii((s) => s.setBasePeriod)
  const [years, setYears] = useState(5)

  const baseSpend = useMemo(() => {
    if (!profile) return 0
    const fromSpending = Object.values(profile.spending).reduce((a, b) => a + b, 0)
    return fromSpending > 0 ? fromSpending : 0
  }, [profile])

  if (!profile) return null

  const fwd = forwardForecast(profile, dataset, to, baseSpend, years)
  const budget = budgetInflation(profile, dataset, from, to)

  const scenarioLines = scenarios
    .filter((s) => s.profileId === profile.id)
    .map((s) => {
      const applied = applyScenario(profile, s)
      const fc = forwardForecast(applied, dataset, to, baseSpend, years)
      return { sc: s, fc }
    })

  return (
    <div className="mt-3 space-y-3">
      <Card>
        <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: C.muted }}>
          Forward assumptions
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {HORIZONS.map((h) => (
            <button
              key={h}
              onClick={() => setYears(h)}
              className="text-[11.5px] px-3 py-1 rounded-full border transition-colors"
              style={{
                background: years === h ? `${C.cap}1a` : C.surface,
                borderColor: years === h ? C.cap : C.border,
                color: years === h ? C.cap : C.muted,
              }}
            >
              {h} yr
            </button>
          ))}
        </div>
        <div className="mt-2 text-[10.5px] leading-snug" style={{ color: C.muted }}>
          Per-category “assumed %/yr” (set in Categories) wins; otherwise the line uses the latest 12-month official
          BLS pace for its mapped series, or your custom rate. All items pace is the fallback.
        </div>
      </Card>

      {fwd && fwd.length > 0 && (
        <Card accent={C.cap}>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider" style={{ color: C.muted }}>
                  <th className="py-1 pr-2">Year</th>
                  <th className="py-1 pr-2">CPI vs today</th>
                  <th className="py-1 pr-2">Spend/yr</th>
                  <th className="py-1 text-right">$/yr added</th>
                </tr>
              </thead>
              <tbody>
                {fwd.map((f) => {
                  const prev = fwd.find((x) => x.year === f.year - 1)
                  const delta = prev ? f.cash - prev.cash : f.cash - baseSpend
                  return (
                    <tr key={f.year} className="border-t" style={{ borderColor: `${C.border}55` }}>
                      <td className="tnum py-2 pr-2 text-[12px]" style={{ color: C.text }}>{f.year}</td>
                      <td className="tnum py-2 pr-2 text-[12px]" style={{ color: C.cap }}>
                        {pct(f.change)} <span className="text-[10px]" style={{ color: C.muted }}>cum</span>
                      </td>
                      <td className="tnum py-2 pr-2 text-[12px]" style={{ color: C.text }}>{money(Math.round(f.cash))}</td>
                      <td className="tnum py-2 text-right text-[12px]" style={{ color: C.muted }}>
                        {delta >= 0 ? '+' : ''}{money(Math.round(delta))}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {scenarioLines.map(({ sc, fc }) => (
        <Card key={sc.id}>
          <Row label={sc.label} value={fc && fc.length ? `${pct(fc[fc.length - 1].change)} through ${fc[fc.length - 1].year}` : '—'} strong />
          <div className="text-[10.5px] mt-1" style={{ color: C.muted }}>
            against {pct(fwd?.[fwd.length - 1]?.change ?? 0)} base — edit overrides in Scenarios.
          </div>
        </Card>
      ))}

      {budget && (
        <Card>
          <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: C.muted }}>
            Budget inflation over the period
          </div>
          <div className="mt-1.5">
            <Row label={`Cash requirement ${from} → ${to}`} value={pct(budget.total)} strong />
            <Row label="Annualized" value={pct(budget.annualized)} />
            <Row label="Fixed (no CPI) lines" value={`${budget.lines.filter((l) => l.rate === 0).length}`} />
          </div>
          <div className="mt-2 text-[10.5px] leading-snug" style={{ color: C.muted }}>
            {profile.spending && baseSpend > 0
              ? `At these rates, ${money(Math.round(baseSpend))}/yr of current spending compounds into about ${money(
                  Math.round(baseSpend * (1 + budget.annualized)),
                )}/yr in a typical next year.`
              : 'Add annual spend per category (Categories tab) to project dollars.'}
          </div>
        </Card>
      )}

      <Card>
        <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: C.muted }}>
          Methodology
        </div>
        <div className="mt-2 space-y-1.5">
          <Row label="Dataset" value={dataset.version} />
          <Row label="Scope" value={dataset.scope.area} />
          <Row label="Profile base period" value={profile.basePeriod} />
          <Row label="Weight source" value={profile.weightSource} />
          <Row label="Base set" value={profile.basePeriod} />
        </div>
        <button
          onClick={() => setBasePeriod(from)}
          className="mt-2 text-[11px] underline underline-offset-2"
          style={{ color: C.muted }}
        >
          make {from} the base period
        </button>
        <div className="mt-2 text-[10.5px] leading-relaxed" style={{ color: C.muted }}>
          Personal CPI weights are normalized over the covered basket and applied to each mapped series’ price change
          on a fixed-weight (Laspeyres-type) basis vs the base period. Custom rates compound over the analyzed span.
          Missing months carry the latest published observation. Official CPI uses the published all-items index.
        </div>
      </Card>
    </div>
  )
}