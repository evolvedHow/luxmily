import { useState } from 'react'
import { ArrowLeft, TrendingUp } from 'lucide-react'
import { C } from '../../theme/tokens'
import { useActiveProfile, usePii, usePiiDataset } from '../../store/usePii'
import { PiiDashboard } from './PiiDashboard'
import { PiiCategories } from './PiiCategories'
import { PiiScenarios } from './PiiScenarios'
import { PiiForecast } from './PiiForecast'

type Tab = 'dashboard' | 'categories' | 'scenarios' | 'forecast'

export function PiiView({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<Tab>('dashboard')
  const init = usePii((s) => s.init)
  const profile = useActiveProfile()
  const dataset = usePiiDataset()

  // Seed the default profile on first open (cheap; idempotent).
  if (!profile) init()

  const tabs: { id: Tab; label: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'categories', label: 'Categories' },
    { id: 'scenarios', label: 'Scenarios' },
    { id: 'forecast', label: 'Forecast' },
  ]

  return (
    <div>
      <div className="min-h-dvh mx-auto max-w-md md:max-w-2xl px-4 pb-10 no-print" style={{ background: C.bg }}>
        <div className="flex items-center justify-between pt-4 pb-1">
          <div>
            <div className="flex items-center gap-1.5">
              <TrendingUp size={13} style={{ color: C.cap }} />
              <span className="text-[11px] uppercase tracking-[0.2em]" style={{ color: C.cap }}>
                Personal CPI
              </span>
            </div>
            <div className="text-[13px] mt-0.5" style={{ color: C.muted }}>
              {profile ? `${profile.label} · v${profile.version}` : 'Loading…'} · {dataset.version}
            </div>
          </div>
          <button
            onClick={onBack}
            aria-label="Back to budget"
            className="w-9 h-9 rounded-full border flex items-center justify-center transition-colors"
            style={{ background: C.surface, borderColor: C.border, color: C.muted }}
          >
            <ArrowLeft size={15} />
          </button>
        </div>

        <div className="mt-1 flex gap-1.5">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="text-[11.5px] px-3 py-1.5 rounded-full border transition-colors"
              style={{
                background: tab === t.id ? `${C.cap}1a` : C.surface,
                borderColor: tab === t.id ? C.cap : C.border,
                color: tab === t.id ? C.cap : C.muted,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'dashboard' && <PiiDashboard />}
        {tab === 'categories' && <PiiCategories />}
        {tab === 'scenarios' && <PiiScenarios />}
        {tab === 'forecast' && <PiiForecast />}
      </div>
    </div>
  )
}