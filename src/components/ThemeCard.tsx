import { ExternalLink, Lock, RotateCcw, Unlock } from 'lucide-react'
import { useBudget } from '../store/useBudget'
import { C, money, pct } from '../theme/tokens'
import { BenchTag, Card, MoneyInput, Row } from './ui'
import { catKeyOf } from './PayFirstStrip'
import type { ResolvedCategory, ResolvedTheme } from '../engine/types'

/**
 * A theme and its categories, as one coupled number.
 *
 * Dragging the theme slider sets a target dollar total and prorates the
 * difference across the theme's *unlocked* categories, in proportion to what
 * they already hold — so raising Housing by $300 when Rent is 54% of it puts
 * ~$162 on Rent. Locked rows sit the move out entirely and the rest absorb
 * their share. Money released this way leaves the theme and waits in the
 * unallocated bucket on the cap card; it is never pushed into other themes.
 */
export function ThemeCard({ t, cap }: { t: ResolvedTheme; cap: number }) {
  const setThemeTotal = useBudget((s) => s.setThemeTotal)
  const toggleLock = useBudget((s) => s.toggleLock)
  const resetTheme = useBudget((s) => s.resetTheme)

  const accent = t.payFirst ? C.green : C.cap
  // The slider cannot go below the theme's locked subtotal, nor above the cap.
  const minPct = cap > 0 ? Math.ceil((t.lockedTotal / cap) * 100) : 0
  const immovable = t.locked || t.fullyLocked

  return (
    <Card accent={t.locked ? C.save : C.border}>
      <div className="flex items-center gap-2">
        <span className="text-[14px] flex-1 truncate" style={{ color: C.text }}>
          {t.label}
        </span>
        {t.payFirst && (
          <span className="text-[9.5px] uppercase tracking-[0.14em]" style={{ color: C.green }}>
            pay first
          </span>
        )}
        <LockBtn
          locked={t.locked}
          onClick={() => toggleLock(t.id)}
          label={`${t.locked ? 'Unlock' : 'Lock'} ${t.label} theme`}
        />
        <button
          onClick={() => resetTheme(t.id)}
          aria-label={`Reset ${t.label} to benchmark`}
          title="Reset this theme to its benchmark seeding"
          className="w-6 h-6 rounded-full border flex items-center justify-center shrink-0"
          style={{ borderColor: C.border, color: C.muted }}
        >
          <RotateCcw size={11} />
        </button>
        <span className="tnum text-[13px] w-12 text-right" style={{ color: accent }}>
          {pct(t.share, 0)}
        </span>
      </div>

      <input
        type="range"
        min={0}
        max={100}
        step={1}
        disabled={immovable}
        value={Math.round(t.share * 100)}
        onChange={(e) => setThemeTotal(t.id, (cap * Math.max(minPct, Number(e.target.value))) / 100)}
        className="lever w-full mt-2 disabled:opacity-40"
        style={{ ['--accent' as string]: t.locked ? C.save : accent }}
        aria-label={`${t.label} share of cap`}
      />

      <div className="mt-2 space-y-1">
        <Row label="Planned" value={money(t.planTotal)} strong />
        {t.lockedTotal > 0 && (
          <Row label="Locked inside" value={money(t.lockedTotal)} color={C.save} />
        )}
      </div>

      <div className="flex items-center gap-2 mt-1.5">
        <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: C.bg }}>
          <div
            className="h-full rounded-full"
            style={{ width: `${Math.max(0, Math.min(1, t.share)) * 100}%`, background: accent }}
          />
        </div>
        <span className="text-[10px] shrink-0 whitespace-nowrap" style={{ color: C.muted }}>
          band avg share {pct(t.benchShare, 0)}
        </span>
      </div>

      {immovable && (
        <div className="text-[10px] mt-1.5 leading-snug" style={{ color: C.save }}>
          {t.locked
            ? 'Theme locked — its total holds while you move everything else.'
            : 'Every category here is locked, so the theme cannot be resized.'}
        </div>
      )}

      <div className="mt-2.5 border-t pt-2" style={{ borderColor: C.border }}>
        {t.cats.map((c) => (
          <CategoryRow key={c.id} c={c} themeLocked={t.locked} />
        ))}
      </div>

      {/* Sources, each linked — under its own theme box. */}
      <div className="mt-2.5 border-t pt-2 space-y-1" style={{ borderColor: C.border }}>
        <div className="text-[9.5px] uppercase tracking-[0.16em]" style={{ color: C.muted }}>
          Where these averages come from
        </div>
        {t.sources.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5">
            <span className="text-[10px] leading-snug" style={{ color: C.muted }}>
              {s.label}
            </span>
            {s.url && (
              <a
                href={s.url}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-0.5 text-[10px] underline underline-offset-2 hover:opacity-70"
                style={{ color: C.cap }}
              >
                source <ExternalLink size={9} />
              </a>
            )}
          </div>
        ))}
      </div>
    </Card>
  )
}

export function LockBtn({
  locked,
  onClick,
  label,
}: {
  locked: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-pressed={locked}
      title={label}
      className="w-6 h-6 rounded-full border flex items-center justify-center shrink-0"
      style={{ borderColor: locked ? C.save : C.border, color: locked ? C.save : C.muted }}
    >
      {locked ? <Lock size={11} /> : <Unlock size={11} />}
    </button>
  )
}

function CategoryRow({ c, themeLocked }: { c: ResolvedCategory; themeLocked: boolean }) {
  const setPlan = useBudget((s) => s.setPlan)
  const toggleLock = useBudget((s) => s.toggleLock)
  const key = catKeyOf(c)

  return (
    <div className="py-2">
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <div
            className="text-[13px] leading-tight flex items-baseline gap-2"
            style={{ color: c.flex ? C.muted : C.text }}
          >
            <span className="truncate">{c.label}</span>
            {c.flex && (
              <span className="text-[9.5px] uppercase shrink-0" style={{ color: C.muted }}>
                flex
              </span>
            )}
          </div>
          <BenchTag
            avg={c.benchAvg}
            median={c.benchMedian}
            medianNote={c.benchMedianNote}
            source={c.benchSource}
            url={c.benchUrl}
          />
        </div>

        <LockBtn
          locked={c.locked}
          onClick={() => toggleLock(key)}
          label={`${c.locked ? 'Unlock' : 'Lock'} ${c.label}`}
        />
        <MoneyInput
          value={c.plan}
          onChange={(v) => setPlan(key, v)}
          label={`${c.label} plan`}
          disabled={c.locked || themeLocked}
          accent={c.locked ? C.save : C.text}
        />
      </div>
    </div>
  )
}
