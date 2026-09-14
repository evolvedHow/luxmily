import { useBudget } from '../store/useBudget'
import { C, money, pct } from '../theme/tokens'
import { Alert, BenchTag, Card, MoneyInput, Pill, Row, StatusDot } from './ui'
import type { ResolvedCategory, ResolvedTheme, Viewpoint } from '../engine/types'

export function ThemeCard({ t, view }: { t: ResolvedTheme; view: Viewpoint }) {
  const setShare = useBudget((s) => s.setShare)
  const red = t.planOver > 0 || t.spendOver > 0
  const accent = red ? C.red : t.payFirst ? C.green : C.cap

  return (
    <Card accent={accent}>
      <div className="flex items-center gap-2">
        <StatusDot ok={!red} />
        <span className="text-[14px] flex-1" style={{ color: C.text }}>
          {t.label}
        </span>
        {t.payFirst && (
          <span className="text-[9.5px] uppercase tracking-[0.14em]" style={{ color: C.green }}>
            pay first
          </span>
        )}
        <span className="tnum text-[13px]" style={{ color: accent }}>
          {pct(t.share, 0)}
        </span>
      </div>

      {view === 'top-down' && (
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={Math.round(t.targetShare * 100)}
          onChange={(e) => setShare(t.id, Number(e.target.value) / 100)}
          className="lever w-full mt-2"
          style={{ ['--accent' as string]: accent }}
          aria-label={`${t.label} share of cap`}
        />
      )}

      <div className="mt-2 space-y-1">
        <Row label="Allocated" value={money(t.allocation)} strong />
        <Row
          label="Planned"
          value={`${money(t.planTotal)}${t.planOver > 0 ? `  +${money(t.planOver)}` : ''}`}
          color={t.planOver > 0 ? C.red : C.text}
        />
        <Row
          label="Spent MTD"
          value={`${money(t.actualTotal)}${t.spendOver > 0 ? `  +${money(t.spendOver)}` : ''}`}
          color={t.spendOver > 0 ? C.red : C.muted}
        />
      </div>

      <div className="flex items-center gap-2 mt-1.5">
        <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: C.bg }}>
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.max(0, Math.min(1, t.allocation > 0 ? t.planTotal / t.allocation : 0)) * 100}%`,
              background: t.planOver > 0 ? C.red : C.cap,
            }}
          />
        </div>
        <span className="text-[10px] shrink-0 whitespace-nowrap" style={{ color: C.muted }}>
          band avg share {pct(t.benchShare, 0)}
        </span>
      </div>

      {t.planOver > 0 && (
        <div className="mt-2">
          <Alert>Plans exceed this theme by {money(t.planOver)} — take it from another theme.</Alert>
        </div>
      )}
      {t.spendOver > 0 && t.planOver === 0 && (
        <div className="mt-2">
          <Alert>Spent {money(t.spendOver)} more than planned this month.</Alert>
        </div>
      )}

      <div className="mt-2.5 border-t pt-2" style={{ borderColor: C.border }}>
        {t.cats.map((c) => (
          <CategoryRow key={c.id} c={c} view={view} />
        ))}
      </div>
    </Card>
  )
}

function CategoryRow({ c, view }: { c: ResolvedCategory; view: Viewpoint }) {
  const setPlan = useBudget((s) => s.setPlan)
  const setActual = useBudget((s) => s.setActual)
  const key = `${c.themeId}.${c.id}`
  const over = c.overPlan > 0

  return (
    <div className="py-2">
      <div className="flex items-center gap-2.5">
        {view === 'bottom-up' && <StatusDot ok={!over} />}
        <div className="flex-1 min-w-0">
          <div className="text-[13px] leading-tight flex items-baseline gap-2" style={{ color: c.flex ? C.muted : C.text }}>
            {c.label}
            {c.flex && <span className="text-[9.5px] uppercase" style={{ color: C.muted }}>flex</span>}
          </div>
          <BenchTag avg={c.benchAvg} median={c.benchMedian} medianNote={c.benchMedianNote} source={c.benchSource} />
        </div>

        {view !== 'bottom-up' && (
          <MoneyInput value={c.plan} onChange={(v) => setPlan(key, v)} label={`${c.label} plan`} />
        )}
        <MoneyInput
          value={c.actual}
          onChange={(v) => setActual(key, v)}
          label={`${c.label} actual`}
          accent={view === 'bottom-up' ? (over ? C.red : C.text) : C.muted}
        />
        {view === 'bottom-up' &&
          (over ? (
            <Pill tone="red">+{Math.round(c.overPlan)}</Pill>
          ) : (
            <span className="tnum text-[11px] w-8 text-right" style={{ color: C.green }}>
              ✓
            </span>
          ))}
      </div>
    </div>
  )
}