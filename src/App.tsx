import { useEffect, useState } from 'react'
import { Info, RotateCcw, Sparkles } from 'lucide-react'
import { AboutSheet } from './components/AboutSheet'
import { AdvisorSheet } from './components/AdvisorSheet'
import { CapCard } from './components/CapCard'
import { ExportMenu } from './components/ExportMenu'
import { Onboarding } from './components/Onboarding'
import { PayFirstStrip } from './components/PayFirstStrip'
import { PiiCard } from './components/PiiCard'
import { PrintSheet } from './components/PrintSheet'
import { ThemeCard } from './components/ThemeCard'
import { C } from './theme/tokens'
import { useBaselineResolved, useBudget, useResolved } from './store/useBudget'
import { fetchBalance, isConfigured, type Balance } from './advisor/worker'

export default function App() {
  const initialized = useBudget((s) => s.initialized)
  if (!initialized) return <Onboarding />
  return <Dashboard />
}

function Dashboard() {
  const r = useResolved()
  const baseline = useBaselineResolved()
  const reset = useBudget((s) => s.reset)
  const [advisorOpen, setAdvisorOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)

  return (
    <div>
      <div className="min-h-dvh mx-auto max-w-md md:max-w-2xl px-4 pb-10 no-print" style={{ background: C.bg }}>
        {/* Header */}
        <div className="flex items-center justify-between pt-4 pb-1">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em]" style={{ color: C.cap }}>
              Luxmi.ly
            </div>
            <div className="text-[13px] mt-0.5" style={{ color: C.muted }}>
              {r.cohortLabel} · {r.incomeMonthly > 0 ? `$${Math.round(r.incomeMonthly).toLocaleString()}/mo income` : ''}
            </div>
            <BalanceBadge />
          </div>
          <div className="flex items-center gap-1.5">
            <IconBtn onClick={() => setAdvisorOpen(true)} label="Ask Luxmi">
              <Sparkles size={15} />
            </IconBtn>
            <IconBtn onClick={() => setAboutOpen(true)} label="About">
              <Info size={15} />
            </IconBtn>
            <IconBtn onClick={reset} label="Reset to baseline">
              <RotateCcw size={15} />
            </IconBtn>
            <ExportMenu />
          </div>
        </div>

        {/* Cap */}
        <div className="mt-1">
          <CapCard r={r} />
        </div>

        {/* Pay first */}
        {r.payFirst.length > 0 && (
          <div className="mt-3">
            <PayFirstStrip rows={r.payFirst} />
          </div>
        )}

        {/* pII — what this allocation's own inflation rate is */}
        <div className="mt-3">
          <PiiCard r={r} baseline={baseline} />
        </div>

        {/* Themes */}
        <div className="mt-3 md:grid md:grid-cols-2 md:gap-3 space-y-3 md:space-y-0">
          {r.themes.map((t) => (
            <ThemeCard key={t.id} t={t} cap={r.cap} />
          ))}
        </div>
      </div>

      {/* Print report — hidden on screen, rendered in print media */}
      <PrintSheet r={r} />

      {/* Luxmi — AI budget advisor */}
      <AdvisorSheet open={advisorOpen} onClose={() => setAdvisorOpen(false)} />

      {/* About — the philosophy, one screen */}
      <AboutSheet open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </div>
  )
}

function IconBtn({
  children,
  onClick,
  active,
  label,
}: {
  children: React.ReactNode
  onClick: () => void
  active?: boolean
  label: string
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="w-9 h-9 rounded-full border flex items-center justify-center transition-colors"
      style={{
        background: active ? `${C.cap}1a` : C.surface,
        borderColor: active ? C.cap : C.border,
        color: active ? C.cap : C.muted,
      }}
    >
      {children}
    </button>
  )
}

/**
 * AI spend badge shown under the header on the dashboard. The worker keeps a
 * Durable Object ledger (budget − accumulated per-request cost, estimated from
 * token usage) because Workers AI exposes no live balance API. Purely
 * decorative — hidden entirely when the worker isn't configured.
 */
function BalanceBadge() {
  const [balance, setBalance] = useState<Balance | null>(null)

  useEffect(() => {
    if (!isConfigured()) return
    let cancelled = false
    const tick = () =>
      fetchBalance().then((b) => {
        if (!cancelled && b) setBalance(b)
      })
    tick()
    const id = setInterval(tick, 60_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  if (!balance) return null

  const frac = balance.budgetUsd > 0 ? balance.balanceUsd / balance.budgetUsd : 0
  const color = frac <= 0 ? C.red : frac <= 0.25 ? C.tension : C.green

  return (
    <div className="mt-1 text-[10.5px] tnum" style={{ color }}>
      ≈ ${balance.balanceUsd.toFixed(2)} left of ${balance.budgetUsd.toFixed(0)} AI budget
    </div>
  )
}