import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Card, Alert } from '../ui'
import { C, pct } from '../../theme/tokens'
import { useActiveProfile, usePii, usePiiDataset } from '../../store/usePii'
import { calcPersonalInflation, applyScenario } from '../../pi/engine'
import { validateScenario } from '../../pi/validate'
import type { PiiScenario } from '../../pi/types'

export function PiiScenarios() {
  const profile = useActiveProfile()
  const dataset = usePiiDataset()
  const from = usePii((s) => s.from)
  const to = usePii((s) => s.to)
  const scenarios = usePii((s) => s.scenarios)
  const { addScenario, removeScenario } = usePii()
  const [label, setLabel] = useState('')
  const [sel, setSel] = useState<string | null>(null)

  if (!profile) return null
  const mine = scenarios.filter((s) => s.profileId === profile.id)
  const baseRate = calcPersonalInflation({ profile, dataset, from, to })?.total ?? null

  return (
    <div className="mt-3 space-y-3">
      <Card>
        <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: C.muted }}>
          Create a what-if
        </div>
        <div className="mt-2 flex gap-2">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Medical costs spike, rent stays hot"
            className="flex-1 rounded-xl border bg-transparent px-3 py-2 text-[12px] outline-none"
            style={{ borderColor: C.border, color: C.text }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && label.trim()) {
                addScenario(label.trim())
                setLabel('')
              }
            }}
          />
          <button
            onClick={() => {
              if (!label.trim()) return
              addScenario(label.trim())
              setLabel('')
            }}
            aria-label="Add scenario"
            className="w-9 h-9 rounded-xl border flex items-center justify-center"
            style={{ borderColor: C.cap, color: C.cap }}
          >
            <Plus size={15} />
          </button>
        </div>
        <div className="mt-2 text-[10.5px] leading-snug" style={{ color: C.muted }}>
          Scenarios overlay sparse changes (weights, assumptions, spending) on your current profile — the profile
          itself stays untouched.
        </div>
      </Card>

      {mine.map((sc) => (
        <ScenarioCard
          key={sc.id}
          sc={sc}
          baseRate={baseRate}
          opened={sel === sc.id}
          onToggle={() => setSel(sel === sc.id ? null : sc.id)}
          onRemove={() => removeScenario(sc.id)}
        />
      ))}

      {mine.length === 0 && (
        <div className="text-[12px] text-center py-6" style={{ color: C.muted }}>
          No scenarios yet — “Create a what-if” above.
        </div>
      )}
    </div>
  )
}

function ScenarioCard({
  sc,
  baseRate,
  opened,
  onToggle,
  onRemove,
}: {
  sc: PiiScenario
  baseRate: number | null
  opened: boolean
  onToggle: () => void
  onRemove: () => void
}) {
  const profile = useActiveProfile()!
  const dataset = usePiiDataset()
  const from = usePii((s) => s.from)
  const to = usePii((s) => s.to)
  const updateScenario = usePii((s) => s.updateScenario)
  const [catId, setCatId] = useState<string>('')

  const applied = applyScenario(profile, sc)
  const rate = calcPersonalInflation({ profile: applied, dataset, from, to })
  const issues = validateScenario(profile, sc).filter((i) => i.level === 'error')

  const catOptions = profile.categories.filter((c) => c.mapping.kind !== 'excluded')
  const w = sc.weightOverrides
  const a = sc.assumptionOverrides
  const anyOverrides = Object.keys(w).length + Object.keys(a).length + Object.keys(sc.spendingOverrides).length > 0

  return (
    <Card
      accent={opened ? C.cap : undefined}
    >
      <div className="flex items-center justify-between">
        <button onClick={onToggle} className="min-w-0 text-[12.5px]" style={{ color: C.text }}>
          {sc.label}
        </button>
        <div className="flex items-center gap-2">
          <span className="tnum text-[12.5px]" style={{ color: C.cap }}>
            {rate ? pct(rate.total) : '—'}
            {baseRate !== null && rate ? ` vs ${pct(baseRate)}` : ''}
          </span>
          <button onClick={onRemove} aria-label="Delete scenario" style={{ color: C.muted }}>
            <Trash2 size={13} />
          </button>
        </div>
      </div>
      {!anyOverrides && !opened && (
        <div className="text-[10.5px] mt-1" style={{ color: C.muted }}>
          No edits yet — identical to base.
        </div>
      )}
      {issues.length > 0 && <div className="mt-2"><Alert>{issues[0].message}</Alert></div>}

      {opened && (
        <div className="mt-3 pt-3 border-t space-y-2" style={{ borderColor: C.border }}>
          <div className="flex gap-2">
            <select
              value={catId}
              onChange={(e) => setCatId(e.target.value)}
              className="flex-1 rounded-lg border bg-[#0F0F11] px-2 py-1.5 text-[11.5px] outline-none"
              style={{ borderColor: C.border, color: C.text }}
            >
              <option value="">Choose a category…</option>
              {catOptions
                .filter((c) => !(w[c.id] !== undefined && a[c.id] !== undefined && sc.spendingOverrides[c.id] !== undefined))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
            </select>
            {catId && (
              <button
                onClick={() => {
                  setCatId('')
                }}
                className="text-[11px] underline underline-offset-2"
                style={{ color: C.muted }}
              >
                clear
              </button>
            )}
          </div>

          {catId && (
            <div className="grid grid-cols-3 gap-2">
              <Field label="Weight %" value={w[catId]}
                onChange={(v) => updateScenario(sc.id, { weightOverrides: override(w, catId, v) })}
              />
              <Field label="Assumed %/yr" value={a[catId]}
                onChange={(v) => updateScenario(sc.id, { assumptionOverrides: override(a, catId, v) })}
              />
              <Field label="Spend $/yr" value={sc.spendingOverrides[catId]}
                onChange={(v) => updateScenario(sc.id, { spendingOverrides: override(sc.spendingOverrides, catId, v) })}
              />
            </div>
          )}

          {Object.entries(w).map(([id, val]) => (
            <OverrideRow
              key={id}
              label={`${catLabel(profile, id)} · weight`}
              value={val !== null ? `${Math.round(val * 1000) / 10}%` : ''}
              onClear={() => {
                const next = { ...w }
                delete next[id]
                updateScenario(sc.id, { weightOverrides: next })
              }}
            />
          ))}
          {Object.entries(a).map(([id, val]) => (
            <OverrideRow
              key={id}
              label={`${catLabel(profile, id)} · assumed`}
              value={val !== null ? `${val}%/yr` : ''}
              onClear={() => {
                const next = { ...a }
                delete next[id]
                updateScenario(sc.id, { assumptionOverrides: next })
              }}
            />
          ))}
          {Object.entries(sc.spendingOverrides).map(([id, val]) => (
            <OverrideRow
              key={id}
              label={`${catLabel(profile, id)} · spend`}
              value={val !== null ? `$${Math.round(Number(val) || 0)}` : ''}
              onClear={() => {
                const next = { ...sc.spendingOverrides }
                delete next[id]
                updateScenario(sc.id, { spendingOverrides: next })
              }}
            />
          ))}
        </div>
      )}
    </Card>
  )
}

function Field({ label, value, onChange }: { label: string; value: number | null | undefined; onChange: (v: number | null) => void }) {
  return (
    <label className="block">
      <span className="text-[10px]" style={{ color: C.muted }}>
        {label}
      </span>
      <input
        type="number"
        inputMode="decimal"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        className="tnum mt-0.5 w-full rounded-lg border bg-transparent px-2 py-1 text-[11.5px] outline-none"
        style={{ borderColor: C.border, color: C.text }}
      />
    </label>
  )
}

function OverrideRow({ label, value, onClear }: { label: string; value: string; onClear: () => void }) {
  return (
    <div className="flex items-center justify-between text-[11.5px]">
      <span style={{ color: C.muted }}>{label}</span>
      <span className="flex items-center gap-2">
        <span className="tnum" style={{ color: C.text }}>{value}</span>
        <button onClick={onClear} className="text-[10px] underline underline-offset-2" style={{ color: C.muted }}>
          clear
        </button>
      </span>
    </div>
  )
}

function catLabel(profile: NonNullable<ReturnType<typeof useActiveProfile>>, id: string): string {
  return profile?.categories.find((c) => c.id === id)?.label ?? id
}

/** Write a sparse override; null removes the key (keeps maps number-only). */
function override(map: Record<string, number>, key: string, value: number | null): Record<string, number> {
  if (value === null) {
    const next = { ...map }
    delete next[key]
    return next
  }
  return { ...map, [key]: value }
}