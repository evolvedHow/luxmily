import { useMemo, useState } from 'react'
import { cohortForIncome } from '../data/benchmarks'
import { COHORT_STANDING } from '../data/context'
import { locationForZip } from '../data/metro-cola'
import { useBudget } from '../store/useBudget'
import { C, money } from '../theme/tokens'
import { Card } from './ui'

/**
 * The onboarding answers, front and center. Income selects the benchmark cohort;
 * take-home is the hard Cap every theme then lives inside. A ZIP (optional)
 * localizes the averages to the user's area — cost of living on every dollar
 * line, and an extra rent factor on the Rent/Mortgage rail.
 */
export function Onboarding() {
  const onboard = useBudget((s) => s.onboard)
  const [income, setIncome] = useState(useBudget.getState().incomeMonthly)
  const [cap, setCap] = useState(useBudget.getState().takeHome)
  const [zip, setZip] = useState(useBudget.getState().zip)

  const cohort = useMemo(() => cohortForIncome(income || 0), [income])
  const loc = useMemo(() => locationForZip(zip), [zip])
  const canBuild = income > 0 && cap > 0

  const fillCap = () => {
    if (!cap && income > 0) setCap(Math.round(income * 0.78))
  }

  return (
    <div className="min-h-dvh mx-auto max-w-md flex flex-col justify-center px-5" style={{ background: C.bg }}>
      <div className="mb-6">
        <div className="text-[11px] uppercase tracking-[0.2em]" style={{ color: C.cap }}>
          Luxmi.ly
        </div>
        <h1 className="text-2xl font-semibold mt-2" style={{ color: C.text }}>
          Build your budget
          <br />
          the right way up.
        </h1>
        <p className="text-[13px] leading-relaxed mt-2" style={{ color: C.muted }}>
          Top-down: one number you can live within, then benchmark-guided themes.
          Your income picks the averages that steer it.
        </p>
      </div>

      <Card>
        <label className="block text-[12px] mb-1" style={{ color: C.muted }}>
          Household income · before tax / month
        </label>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          placeholder="$"
          aria-label="Household income before tax per month"
          value={income || ''}
          onChange={(e) => setIncome(Number(e.target.value))}
          className="tnum w-full rounded-2xl border px-4 py-3 text-lg outline-none"
          style={{ background: C.bg, borderColor: C.border, color: C.text }}
        />
        {income > 0 && (
          <p className="text-[11px] mt-1.5" style={{ color: C.muted }}>
            Cohort: <span style={{ color: C.cap }}>{cohort.label}</span> — {cohort.source}
          </p>
        )}
        {income > 0 && (
          <p className="text-[11px]" style={{ color: C.cap }}>
            {COHORT_STANDING[cohort.id].label} by US household income
          </p>
        )}

        <div className="h-4" />

        <label className="block text-[12px] mb-1" style={{ color: C.muted }}>
          ZIP code · optional — localizes your averages to your area
        </label>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={5}
          placeholder="NYC? Marietta?"
          aria-label="Zip code (optional)"
          value={zip}
          onChange={(e) => setZip(e.target.value)}
          className="w-full rounded-2xl border px-4 py-3 text-lg outline-none tnum"
          style={{ background: C.bg, borderColor: C.border, color: C.text }}
        />
        {zip && loc && (
          <p className="text-[11px] mt-1.5 leading-snug" style={{ color: C.muted }}>
            Localized for <span style={{ color: C.cap }}>{loc.metro}</span> · {loc.cola.toFixed(2)}× national cost
            of living · rent/mortgage rail {loc.rentFactor.toFixed(2)}× · area median income ≈ {money(loc.medianIncome)}/yr
          </p>
        )}
        {zip && !loc && (
          <p className="text-[11px] mt-1.5" style={{ color: C.muted }}>
            Enter 5 digits to localize the benchmarks.
          </p>
        )}

        <div className="h-4" />

        <label className="block text-[12px] mb-1" style={{ color: C.muted }}>
          Take-home pay · what you can actually spend / month
        </label>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          placeholder="$"
          aria-label="Take-home pay per month"
          value={cap || ''}
          onChange={(e) => setCap(Number(e.target.value))}
          onBlur={fillCap}
          className="tnum w-full rounded-2xl border px-4 py-3 text-lg outline-none"
          style={{ background: C.bg, borderColor: C.border, color: C.cap }}
        />
        <p className="text-[11px] mt-1.5" style={{ color: C.muted }}>
          Everything below must live inside this number. No credit, no exceptions.
        </p>
      </Card>

      <button
        disabled={!canBuild}
        onClick={() => onboard(income, cap, zip)}
        className="mt-4 w-full rounded-2xl px-4 py-3.5 text-[15px] font-semibold transition-opacity disabled:opacity-40"
        style={{ background: C.cap, color: C.bg }}
      >
        Build my budget
      </button>
    </div>
  )
}