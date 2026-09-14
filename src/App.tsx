import { RotateCcw } from 'lucide-react'
import { CapCard } from './components/CapCard'
import { ExportMenu } from './components/ExportMenu'
import { Onboarding } from './components/Onboarding'
import { PayFirstStrip } from './components/PayFirstStrip'
import { PrintSheet } from './components/PrintSheet'
import { ThemeCard } from './components/ThemeCard'
import { ViewpointToggle } from './components/ViewpointToggle'
import { C } from './theme/tokens'
import { useBudget, useResolved } from './store/useBudget'

export default function App() {
  const initialized = useBudget((s) => s.initialized)
  if (!initialized) return <Onboarding />
  return <Dashboard />
}

function Dashboard() {
  const r = useResolved()
  const view = useBudget((s) => s.view)
  const reset = useBudget((s) => s.reset)

  return (
    <div>
      <div className="min-h-dvh mx-auto max-w-md md:max-w-2xl px-4 pb-10 no-print" style={{ background: C.bg }}>
        {/* Header */}
        <div className="flex items-center justify-between pt-4 pb-1">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em]" style={{ color: C.cap }}>
              LuxMily · Budget Optima
            </div>
            <div className="text-[13px] mt-0.5" style={{ color: C.muted }}>
              {r.cohortLabel} · {r.incomeMonthly > 0 ? `$${Math.round(r.incomeMonthly).toLocaleString()}/mo income` : ''}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
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
            <PayFirstStrip rows={r.payFirst} view={view} />
          </div>
        )}

        {/* Viewpoints */}
        <div className="mt-3">
          <ViewpointToggle />
        </div>

        {/* Themes */}
        <div className="mt-3 md:grid md:grid-cols-2 md:gap-3 space-y-3 md:space-y-0">
          {r.themes.map((t) => (
            <ThemeCard key={t.id} t={t} view={view} />
          ))}
        </div>
      </div>

      {/* Print report — hidden on screen, rendered in print media */}
      <PrintSheet r={r} />
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