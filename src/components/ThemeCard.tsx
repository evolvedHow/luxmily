import { useBudget } from '../store/useBudget'
import { C, money, pct } from '../theme/tokens'
import { Alert, BenchTag, Card, MoneyInput, Pill, Row, StatusDot } from './ui'
import { catKeyOf } from './PayFirstStrip'
import type { ResolvedCategory, ResolvedTheme, Viewpoint } from '../engine/types'
import { ExternalLink } from 'lucide-react'

export function ThemeCard({ t, view }: { t: ResolvedTheme; view: Viewpoint }) {
  const setShare = useBudget((s) => s.setShare)
  const isObserved = view === 'observed'
  const red = t.planOver > 0 || t.observedOverPlan > 0
  const accent = red ? C.red : t.payFirst ? C.green : C.cap

  const entered = t.cats.filter((c) => c.observed > 0).length

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
        {t.payFirst && (
          <Row label="Observed" value={`${money(t.observedTotal)}${t.observedOverPlan > 0 ? `  +${money(t.observedOverPlan)}` : ''}`} color={t.observedOverPlan > 0 ? C.red : C.muted} />
        )}
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
      {t.observedOverPlan > 0 && t.planOver === 0 && (
        <div className="mt-2">
          <Alert accent={C.red}>You're spending {money(t.observedOverPlan)} above plan here — trim it or fund it from another theme.</Alert>
        </div>
      )}
      {t.reallocatable > 0 && (
        <div className="mt-2">
          <Alert accent={C.green}>
            You freed up {money(t.reallocatable)} vs plan — reallocate it to Savings, Travel, or wherever you'll enjoy it most.
          </Alert>
        </div>
      )}

      <div className="mt-2.5 border-t pt-2" style={{ borderColor: C.border }}>
        {t.cats.map((c) => (
          <CategoryRow key={c.id} c={c} view={view} />
        ))}
      </div>

      {/* Sources, each linked — under its own theme box. */}
      <div className="mt-2.5 border-t pt-2 space-y-1" style={{ borderColor: C.border }}>
        <div className="text-[9.5px] uppercase tracking-[0.16em]" style={{ color: C.muted }}>
          {isObserved && entered > 0 ? `Observed on ${entered} of ${t.cats.length} lines` : 'Where these averages come from'}
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

function CategoryRow({ c, view }: { c: ResolvedCategory; view: Viewpoint }) {
  const setPlan = useBudget((s) => s.setPlan)
  const setObserved = useBudget((s) => s.setObserved)
  const isObserved = view === 'observed'
  const key = catKeyOf(c)
  const entered = c.observed > 0

  return (
    <div className="py-2">
      <div className="flex items-center gap-2.5">
        <div className="flex-1 min-w-0">
          <div className="text-[13px] leading-tight flex items-baseline gap-2" style={{ color: c.flex ? C.muted : C.text }}>
            {c.label}
            {c.flex && <span className="text-[9.5px] uppercase" style={{ color: C.muted }}>flex</span>}
          </div>
          <BenchTag avg={c.benchAvg} median={c.benchMedian} medianNote={c.benchMedianNote} source={c.benchSource} url={c.benchUrl} />
        </div>

        {isObserved ? (
          <>
            <div className="w-14 shrink-0 text-right">
              <div className="tnum text-[11px]" style={{ color: C.text }}>{pct(c.observedPct, 1)}</div>
              <div className="text-[9px]" style={{ color: C.muted }}>of cap</div>
            </div>
            <MoneyInput
              value={c.observed}
              onChange={(v) => setObserved(key, v)}
              label={`${c.label} observed`}
              accent={entered && c.delta > 0 ? C.red : C.text}
            />
          </>
        ) : (
          <MoneyInput value={c.plan} onChange={(v) => setPlan(key, v)} label={`${c.label} plan`} />
        )}
      </div>

      {isObserved && c.flex === false && c.observed > 0 && (
        <div className="mt-1 flex justify-end">
          {c.delta > 0 ? (
            <Pill tone="red">+{money(c.delta)} over plan</Pill>
          ) : (
            <Pill tone="green">−{money(-c.delta)} vs plan · free to reallocate</Pill>
          )}
        </div>
      )}
    </div>
  )
}