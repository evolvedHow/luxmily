import { useId } from 'react'
import type { IndexPoint } from '../../pi/engine'
import { C } from '../../theme/tokens'

/** Two-line SVG index chart: your personal CPI vs the official all-items CPI,
 *  both rebased to 100 at the window start. No external chart lib. */
export function PiiChart({ series }: { series: IndexPoint[] }) {
  const uid = useId().replace(/:/g, '')
  const W = 560
  const H = 180
  const PAD = 8

  if (series.length < 2) return <div className="text-[12px] py-6 text-center" style={{ color: C.muted }}>Not enough data yet.</div>

  const xs = series.map((p) => Number(p.period.replace('-', '')))
  const xMin = Math.min(...xs)
  const xMax = Math.max(...xs)
  const x = (v: number) => PAD + ((v - xMin) / Math.max(1, xMax - xMin)) * (W - PAD * 2)

  const values = series.flatMap((p) => [p.personal, p.official]).filter((v): v is number => v !== null)
  let yMin = Math.min(...values)
  let yMax = Math.max(...values)
  const pad = Math.max((yMax - yMin) * 0.15, 1)
  yMin -= pad
  yMax += pad
  const y = (v: number) => H - PAD - ((v - yMin) / Math.max(0.0001, yMax - yMin)) * (H - PAD * 2)

  const line = (vals: (number | null)[]) =>
    vals
      .map((v, i) => {
        if (v === null) return null
        return `${x(xs[i])},${y(v)}`
      })
      .filter(Boolean)
      .join(' ')

  const personalPts = line(series.map((p) => p.personal))
  const officialPts = line(series.map((p) => p.official))

  return (
    <div className="mt-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Personal CPI vs official CPI, base 100">
        <defs>
          <clipPath id={`c${uid}`}>
            <rect x={PAD} y={PAD} width={W - PAD * 2} height={H - PAD * 2} />
          </clipPath>
        </defs>
        {[25, 50, 75].map((f) => {
          const yy = PAD + ((H - PAD * 2) * f) / 100
          return <line key={f} x1={PAD} x2={W - PAD} y1={yy} y2={yy} stroke={C.border} strokeWidth={1} />
        })}
        <g clipPath={`url(#c${uid})`}>
          <polyline points={officialPts} fill="none" stroke={C.muted} strokeWidth={1.5} className="opacity-80" />
          <polyline points={personalPts} fill="none" stroke={C.cap} strokeWidth={2.25} />
        </g>
      </svg>
      <div className="flex items-center gap-4 mt-1 text-[10.5px]" style={{ color: C.muted }}>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-0.5" style={{ background: C.cap }} /> Personal
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-0.5" style={{ background: C.muted }} /> Official CPI
        </span>
      </div>
    </div>
  )
}