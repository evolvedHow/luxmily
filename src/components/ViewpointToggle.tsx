import { useBudget } from '../store/useBudget'
import { C } from '../theme/tokens'
import type { Viewpoint } from '../engine/types'

const VIEWS: { id: Viewpoint; label: string; hint: string }[] = [
  { id: 'top-down', label: 'Top-down', hint: 'Shares of the cap' },
  { id: 'planned', label: 'Planned', hint: '$ per category' },
]

export function ViewpointToggle() {
  const view = useBudget((s) => s.view)
  const setView = useBudget((s) => s.setView)

  return (
    <div className="grid grid-cols-2 gap-1 rounded-2xl border p-1" style={{ background: C.surface, borderColor: C.border }}>
      {VIEWS.map((v) => {
        const on = v.id === view
        return (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            className="rounded-xl px-1 py-1.5 transition-colors"
            style={{ background: on ? `${C.cap}18` : 'transparent' }}
            aria-pressed={on}
            aria-label={`View: ${v.label}`}
          >
            <div className="text-[12px] leading-tight" style={{ color: on ? C.cap : C.text }}>
              {v.label}
            </div>
            <div className="text-[9.5px] leading-tight" style={{ color: on ? C.cap : C.muted }}>
              {v.hint}
            </div>
          </button>
        )
      })}
    </div>
  )
}