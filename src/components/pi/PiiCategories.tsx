import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Card, Alert, Pill } from '../ui'
import { C, money } from '../../theme/tokens'
import { useActiveProfile, usePii } from '../../store/usePii'
import { BLS_SERIES, blsSeriesById } from '../../pi/blsMetadata'
import { weightsFromSpend, renormalize } from '../../pi/engine'
import { validateProfile } from '../../pi/validate'
import { benchmarkSpend, defaultCategories } from '../../pi/defaults'
import type { Mapping, PersonalCategory, PiiProfile } from '../../pi/types'

export function PiiCategories() {
  const profile = useActiveProfile()
  const { setWeight, setSpending, setFuture, setMapping, setPassThrough, addCategory, removeCategory, updateProfile, seedFromBudget } =
    usePii()
  const [name, setName] = useState('')
  const [group, setGroup] = useState('custom')

  if (!profile) return null
  const issues = validateProfile(profile).filter((i) => i.level === 'error')
  const groups: { id: string; label: string }[] = []
  for (const c of profile.categories) {
    if (c.parentId && !groups.some((g) => g.id === c.parentId)) {
      const t = c.parentId
      groups.push({ id: t, label: t.charAt(0).toUpperCase() + t.slice(1) })
    }
  }
  groups.push({ id: 'custom', label: 'Custom' })

  const totalSpend = Object.values(profile.spending).reduce((a, b) => a + b, 0)

  return (
    <div className="mt-3 space-y-3">
      <Card>
        <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: C.muted }}>
          Weight source
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {(['spend', 'custom', 'budget'] as const).map((src) => {
            const used = profile.weightSource === src
            return (
              <button
                key={src}
                onClick={() => updateProfile({ weightSource: src })}
                className="text-[11.5px] px-3 py-1 rounded-full border transition-colors"
                style={{
                  background: used ? `${C.cap}1a` : C.surface,
                  borderColor: used ? C.cap : C.border,
                  color: used ? C.cap : C.muted,
                }}
              >
                {src}
              </button>
            )
          })}
          <button
            onClick={() => {
              const { weights } = weightsFromSpend(profile.categories, profile.spending)
              updateProfile({ weights, weightSource: 'spend' })
            }}
            className="ml-auto text-[11px] underline underline-offset-2"
            style={{ color: C.muted }}
          >
            recompute from spend
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            onClick={() => seedFromBudget('best')}
            className="rounded-xl border px-3 py-2 text-[11.5px] transition-colors"
            style={{ borderColor: C.cap, color: C.cap }}
          >
            Seed from budget (observed → plan)
          </button>
          <button
            onClick={() => seedFromBudget('planned')}
            className="rounded-xl border px-3 py-2 text-[11.5px]"
            style={{ borderColor: C.border, color: C.muted }}
          >
            Seed from planned spend
          </button>
        </div>
        {profile.weightSource === 'budget' && profile.notes && (
          <div className="mt-2">
            <Alert accent={C.green}>{profile.notes}</Alert>
          </div>
        )}

        <div className="mt-3 pt-3 border-t" style={{ borderColor: C.border }}>
          <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: C.muted }}>
            Add a category
          </div>
          <div className="mt-2 flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. College tuition"
              className="flex-1 rounded-xl border bg-transparent px-3 py-2 text-[12px] outline-none"
              style={{ borderColor: C.border, color: C.text }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && name.trim()) {
                  addCategory(name.trim(), group)
                  setName('')
                }
              }}
            />
            <select
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              className="rounded-xl border bg-transparent px-2 py-2 text-[12px] outline-none"
              style={{ borderColor: C.border, color: C.muted }}
              aria-label="Group"
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                if (!name.trim()) return
                addCategory(name.trim(), group)
                setName('')
              }}
              aria-label="Add category"
              className="w-9 h-9 rounded-xl border flex items-center justify-center"
              style={{ borderColor: C.cap, color: C.cap }}
            >
              <Plus size={15} />
            </button>
          </div>
        </div>
      </Card>

      {issues.length > 0 && <Alert>{issues[0].message} — fix above to keep numbers valid.</Alert>}

      {groups.map((g) => {
        const cats = profile.categories.filter((c) => c.parentId === g.id || (g.id === 'custom' && c.parentId === undefined))
        if (cats.length === 0) return null
        return (
          <div key={g.id}>
            <div className="flex items-baseline justify-between px-1 pb-1">
              <span className="text-[11px] uppercase tracking-[0.18em]" style={{ color: C.muted }}>
                {g.label}
              </span>
              <span className="tnum text-[10.5px]" style={{ color: C.muted }}>
                {pctWeight(cats, profile.weights)}
              </span>
            </div>
            <Card>
              <div className="space-y-3">
                {cats.map((c) => (
                  <CategoryRow
                    key={c.id}
                    category={c}
                    weight={profile.weights[c.id] ?? 0}
                    spending={profile.spending[c.id]}
                    future={profile.future[c.id]}
                    onWeight={(w) => setWeight(c.id, w)}
                    onSpending={(v) => setSpending(c.id, v)}
                    onFuture={(f) => setFuture(c.id, f)}
                    onMapping={(m) => setMapping(c.id, m)}
                    onPassThrough={(mode, rate) => setPassThrough(c.id, mode, rate)}
                    onRemove={g.id === 'custom' ? () => removeCategory(c.id) : undefined}
                    totalSpend={totalSpend}
                  />
                ))}
              </div>
            </Card>
          </div>
        )
      })}

      {!profile.categories.some((c) => c.id === 'housing.shelter') && (
        <div className="px-1">
          <button
            onClick={() => {
              const extra = defaultCategories().filter((c) => !profile.categories.some((x) => x.id === c.id))
              const spend = benchmarkSpend()
              updateProfile(sessionRefresh(profile, extra, spend))
            }}
            className="text-[11.5px] underline underline-offset-2"
            style={{ color: C.muted }}
          >
            restore a missing baseline category
          </button>
        </div>
      )}

      <Card>
        <div className="flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-[0.18em]" style={{ color: C.muted }}>
            Spending total
          </span>
          <span className="tnum text-[13px]" style={{ color: C.text }}>
            {money(Math.round(totalSpend))}/yr
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-[0.18em]" style={{ color: C.muted }}>
            Basket coverage
          </span>
          <span className="tnum text-[13px]" style={{ color: C.text }}>
            {pctWeight(profile.categories.filter((c) => c.mapping.kind !== 'excluded'), profile.weights)}
          </span>
        </div>
      </Card>
    </div>
  )
}

function pctWeight(cats: PersonalCategory[], weights: Record<string, number>) {
  const total = Object.values(weights).reduce((a, b) => a + b, 0)
  const sub = cats.reduce((a, c) => a + (weights[c.id] ?? 0), 0)
  return total > 0 ? `${(sub * 100).toFixed(1)}%` : '0%'
}

function sessionRefresh(profile: PiiProfile, extra: PersonalCategory[], spend: Record<string, number>) {
  const w = { ...profile.weights }
  const sp = { ...profile.spending }
  const fu = { ...profile.future }
  for (const c of extra) {
    w[c.id] = spend[c.id] && spend[c.id] > 0 ? 0.001 : 0
    sp[c.id] = spend[c.id] ?? 0
  }
  for (const id of Object.keys(w)) if (w[id] === undefined) w[id] = 0
  const ren = renormalize({ ...profile, weights: w })
  return { version: profile.version + 1, categories: [...profile.categories, ...extra], weights: ren, spending: sp, future: fu }
}

function CategoryRow({
  category,
  weight,
  spending,
  future,
  onWeight,
  onSpending,
  onFuture,
  onMapping,
  onPassThrough,
  onRemove,
  totalSpend,
}: {
  category: PersonalCategory
  weight: number
  spending?: number
  future?: number
  onWeight: (w: number) => void
  onSpending: (v: number) => void
  onFuture: (d: number) => void
  onMapping: (m: Mapping) => void
  onPassThrough: (mode: 'market' | 'fixed' | 'custom', rate?: number) => void
  onRemove?: () => void
  totalSpend: number
}) {
  const [open, setOpen] = useState(false)
  const excluded = category.mapping.kind === 'excluded'

  return (
    <div className="border-b last:border-0 pb-3 last:pb-0" style={{ borderColor: `${C.border}55` }}>
      <div className="flex items-center gap-1.5">
        <button onClick={() => setOpen(!open)} className="flex-1 min-w-0 text-left">
          <span className="text-[12.5px]" style={{ color: C.text }}>
            {category.label}
          </span>
          <span className="block text-[10px]" style={{ color: C.muted }}>
            {mappingSummary(category)}
          </span>
        </button>
        {excluded && <Pill tone="muted">excl</Pill>}
        <input
          type="number"
          inputMode="decimal"
          aria-label={`${category.label} weight %`}
          value={weight > 0 ? Math.round(weight * 1000) / 10 : ''}
          onChange={(e) => onWeight(Number(e.target.value) / 100)}
          className="tnum w-14 rounded-lg border bg-transparent px-1.5 py-1 text-right text-[12px] outline-none"
          style={{ borderColor: C.border, color: excluded ? C.muted : C.cap }}
          placeholder="0"
        />
        <span className="text-[10px]" style={{ color: C.muted }}>
          w
        </span>
        {onRemove && (
          <button onClick={onRemove} aria-label={`Remove ${category.label}`} style={{ color: C.muted }}>
            <Trash2 size={13} />
          </button>
        )}
      </div>

      {open && (
        <div className="mt-2 space-y-2 pt-2 border-t" style={{ borderColor: `${C.border}55` }}>
          <Select
            label="Mapped to"
            value={category.mapping.kind}
            onChange={(k) => {
              if (k === 'series') onMapping({ kind: 'series', seriesId: 'CUUR0000SA0' })
              else if (k === 'composite')
                onMapping({ kind: 'composite', parts: [{ seriesId: 'CUUR0000SAF11', share: 0.5 }, { seriesId: 'CUUR0000SEFV', share: 0.5 }] })
              else if (k === 'custom') onMapping({ kind: 'custom', rate: 3 })
              else onMapping({ kind: 'excluded' })
            }}
            options={[
              ['series', 'BLS series'],
              ['composite', 'Mix of two series'],
              ['custom', 'My own rate'],
              ['excluded', 'Excluded from CPI'],
            ]}
          />
          {category.mapping.kind === 'series' && (
            <Select
              label="Series"
              value={category.mapping.seriesId}
              onChange={(v) => onMapping({ kind: 'series', seriesId: v })}
              options={BLS_SERIES.filter((x) => x.level >= 1).map((x) => [x.id, x.label])}
            />
          )}
          {category.mapping.kind === 'composite' && (() => {
            const composite = category.mapping.parts
            return (
              <div className="grid grid-cols-2 gap-2">
                {composite.slice(0, 2).map((p, i) => (
                <label key={i} className="block">
                  <span className="text-[10px]" style={{ color: C.muted }}>
                    Part {i + 1}
                  </span>
                  <select
                    value={p.seriesId}
                    onChange={(e) => {
                      const parts = [...composite.slice(0, 2)]
                      parts[i] = { ...parts[i], seriesId: e.target.value }
                      onMapping({ kind: 'composite', parts })
                    }}
                    className="mt-1 w-full rounded-lg border bg-transparent px-2 py-1 text-[11.5px] outline-none"
                    style={{ borderColor: C.border, color: C.text }}
                  >
                    {BLS_SERIES.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={Math.round(p.share * 100)}
                    onChange={(e) => {
                      const parts = [...composite.slice(0, 2)]
                      parts[i] = { ...parts[i], share: Number(e.target.value) / 100 }
                      onMapping({ kind: 'composite', parts })
                    }}
                    className="tnum mt-1 w-full rounded-lg border bg-transparent px-2 py-1 text-[11.5px] outline-none"
                    style={{ borderColor: C.border, color: C.text }}
                  />
                </label>
              ))}
              </div>
            )
          })()}
          {category.mapping.kind === 'custom' && (
            <NumInput label="Your inflation (%/yr)" value={category.mapping.rate} onChange={(v) => onMapping({ kind: 'custom', rate: v })} />
          )}
          {excluded && (
            <div className="text-[10.5px] leading-snug" style={{ color: C.muted }}>
              Excluded from the personal CPI basket (e.g. savings). It still counts toward budget inflation.
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 mt-1">
            <NumInput label="Spend ($/yr)" value={spending ?? 0} onChange={onSpending} />
            <NumInput label="Assumed (%/yr)" value={future ?? NaN} onChange={onFuture} empty={future === undefined} hint="blank = latest BLS pace" />
          </div>
          <div className="flex items-center justify-between pt-1">
            <span className="text-[10.5px]" style={{ color: C.muted }}>
              Cash pass-through
            </span>
            <div className="flex items-center gap-1">
              <PillToggle active={category.passThrough.mode === 'market'} onClick={() => onPassThrough('market')}>
                market
              </PillToggle>
              <PillToggle active={category.passThrough.mode === 'fixed'} onClick={() => onPassThrough('fixed')}>
                fixed
              </PillToggle>
              <PillToggle active={category.passThrough.mode === 'custom'} onClick={() => onPassThrough('custom', category.passThrough.mode === 'custom' ? category.passThrough.rate : 3)}>
                custom
              </PillToggle>
              {category.passThrough.mode === 'custom' && (
                <NumInput label="" value={category.passThrough.rate} onChange={(r) => onPassThrough('custom', r)} />
              )}
            </div>
          </div>
          {spending !== undefined && totalSpend > 0 && (
            <div className="text-[10.5px]" style={{ color: C.muted }}>
              ≈ {((spending / totalSpend) * 100).toFixed(1)}% of total spend
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function mappingSummary(c: PersonalCategory): string {
  switch (c.mapping.kind) {
    case 'series':
      return blsSeriesById[c.mapping.seriesId]?.label ?? c.mapping.seriesId
    case 'composite':
      return c.mapping.parts.map((p) => `${blsSeriesById[p.seriesId]?.label ?? p.seriesId} ${Math.round(p.share * 100)}%`).join(' + ')
    case 'custom':
      return `My rate ${c.mapping.rate}%/yr`
    case 'excluded':
      return 'Excluded — not in the CPI basket'
  }
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="flex items-center justify-between gap-2">
      <span className="text-[10.5px]" style={{ color: C.muted }}>
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 max-w-[60%] rounded-lg border bg-[#0F0F11] px-2 py-1 text-[11.5px] outline-none"
        style={{ borderColor: C.border, color: C.text }}
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  )
}

function NumInput({ label, value, onChange, hint, empty }: { label: string; value: number; onChange: (v: number) => void; hint?: string; empty?: boolean }) {
  return (
    <label className="block">
      <span className="text-[10.5px]" style={{ color: C.muted }}>
        {label}
        {hint ? ` · ${hint}` : ''}
      </span>
      <input
        type="number"
        inputMode="decimal"
        value={empty ? '' : Number.isFinite(value) ? value : ''}
        onChange={(e) => onChange(Number(e.target.value))}
        className="tnum mt-1 w-full rounded-lg border bg-transparent px-2 py-1 text-[12px] outline-none"
        style={{ borderColor: C.border, color: C.text }}
        placeholder="—"
      />
    </label>
  )
}

function PillToggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="text-[10.5px] px-2 py-0.5 rounded-full border"
      style={{ borderColor: active ? C.cap : C.border, color: active ? C.cap : C.muted }}
    >
      {children}
    </button>
  )
}