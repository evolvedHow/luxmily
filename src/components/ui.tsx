import { C, money } from '../theme/tokens'

export function MoneyInput({
  value,
  onChange,
  label,
  accent = C.text,
  className = '',
}: {
  value: number
  onChange: (v: number) => void
  label: string
  accent?: string
  className?: string
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      min={0}
      step={1}
      aria-label={label}
      value={value || ''}
      placeholder="0"
      onChange={(e) => onChange(Number(e.target.value))}
      className={`tnum w-24 rounded-xl border bg-transparent px-2.5 py-2 text-right text-[13px] outline-none transition-colors ${className}`}
      style={{ borderColor: C.border, color: accent }}
      onFocus={(e) => (e.currentTarget.style.borderColor = accent)}
      onBlur={(e) => (e.currentTarget.style.borderColor = C.border)}
    />
  )
}

/** The benchmark rail for a category: avg, and median only where published. */
export function BenchTag({
  avg,
  median,
  medianNote,
  source,
  url,
}: {
  avg: number
  median?: number
  medianNote?: string
  source: string
  url?: string
}) {
  const title = `${source}${median ? ` · median: ${medianNote ?? 'published median'}` : ''}`
  return (
    <span className="text-[10px] text-ash cursor-help inline-flex items-center gap-1" title={title}>
      avg {money(avg)}/mo
      {median !== undefined && <> · med <span className="tnum">{money(median)}</span></>}
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer noopener"
          onClick={(e) => e.stopPropagation()}
          className="underline underline-offset-2 hover:opacity-70"
          title={`Source: ${source}`}
        >
          src
        </a>
      ) : (
        <> · {source}</>
      )}
    </span>
  )
}

export function StatusDot({ ok }: { ok: boolean }) {
  return <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: ok ? C.green : C.red }} />
}

export function Pill({ children, tone }: { children: React.ReactNode; tone: 'red' | 'green' | 'muted' }) {
  const color = tone === 'red' ? C.red : tone === 'green' ? C.green : C.muted
  return (
    <span className="tnum text-[11px] px-2 py-0.5 rounded-full border" style={{ borderColor: color, color }}>
      {children}
    </span>
  )
}

export function Alert({ children, accent }: { children: React.ReactNode; accent?: string }) {
  const col = accent ?? C.red
  return (
    <div className="rounded-xl border px-3 py-2 text-[11.5px] leading-snug" style={{ borderColor: `${col}55`, background: `${col}12`, color: col }}>
      {children}
    </div>
  )
}

export function Row({ label, value, strong, color }: { label: string; value: string; strong?: boolean; color?: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-[12px]" style={{ color: strong ? C.text : C.muted }}>
        {label}
      </span>
      <span className="tnum text-[13px]" style={{ color: color ?? (strong ? C.text : C.muted) }}>
        {value}
      </span>
    </div>
  )
}

export function Card({ children, accent }: { children: React.ReactNode; accent?: string }) {
  return (
    <div
      className="rounded-3xl border p-3.5"
      style={{ background: C.surface, borderColor: accent ?? C.border }}
    >
      {children}
    </div>
  )
}