import { useEffect, useRef, useState } from 'react'
import { Loader2, Sparkles, X } from 'lucide-react'
import { buildLuxmiSystem, buildLuxmiUserPrompt } from '../advisor/prompt'
import { askAdvisor, fetchBalance, isConfigured, type Balance } from '../advisor/worker'
import { useResolved } from '../store/useBudget'
import { C } from '../theme/tokens'

/**
 * Luxmi — the AI budget advisor. A bottom sheet: one Ask button, streamed
 * narrative built from the full budget JSON. The system prompt & model params
 * live in src/advisor/luxmi.yaml (private operator config) — not here.
 * The model is served by Cloudflare Workers AI and proxied through a
 * Cloudflare Worker (the browser never holds an API key).
 */

export function AdvisorSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const r = useResolved()
  const [text, setText] = useState('')
  const [status, setStatus] = useState<'' | 'streaming' | 'error'>('')
  const [error, setError] = useState('')
  const [costUsd, setCostUsd] = useState<number | null>(null)
  const [balance, setBalance] = useState<Balance | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const proseRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) {
      abortRef.current?.abort()
      setText('')
      setStatus('')
      setError('')
      setCostUsd(null)
    }
  }, [open])

  useEffect(() => {
    if (status === 'streaming' && proseRef.current) proseRef.current.scrollTop = proseRef.current.scrollHeight
  }, [text, status])

  // Fetch balance when the sheet opens.
  useEffect(() => {
    if (!open) return
    fetchBalance().then(setBalance)
  }, [open])

  const ask = async () => {
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    setText('')
    setStatus('streaming')
    setError('')
    setCostUsd(null)
    try {
      const result = await askAdvisor({
        system: buildLuxmiSystem(),
        prompt: buildLuxmiUserPrompt(r),
        signal: ac.signal,
        onDelta: (t) => setText((prev) => prev + t),
      })
      setCostUsd(result.costUsd ?? null)
      fetchBalance().then(setBalance)
      setStatus('')
    } catch (e) {
      if (ac.signal.aborted) return
      setStatus('error')
      setError(e instanceof Error ? e.message : 'Something went wrong calling Luxmi.')
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-md md:max-w-2xl max-h-[85dvh] rounded-t-3xl border-x border-t flex flex-col"
        style={{ background: C.bg, borderColor: C.border }}
        onClick={(e) => e.stopPropagation()}
        aria-labelledby="luxmi-sheet-title"
        role="dialog"
        aria-modal="true"
      >
        {/* Head */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b" style={{ borderColor: C.border }}>
          <div className="flex items-center gap-2">
            <Sparkles size={16} style={{ color: C.cap }} />
            <div id="luxmi-sheet-title" className="text-[14px] font-semibold" style={{ color: C.text }}>
              Luxmi — your budget advisor
            </div>
          </div>
          <button onClick={onClose} aria-label="Close advisor" className="w-8 h-8 rounded-full border flex items-center justify-center" style={{ borderColor: C.border, color: C.muted }}>
            <X size={15} />
          </button>
        </div>

        {!isConfigured() ? (
          <div className="px-4 py-6 text-[12px] leading-relaxed" style={{ color: C.muted }}>
            Luxmi's AI advisor is not configured yet. The site operator needs to
            set <span className="tnum">VITE_LUXMI_WORKER</span> in the build
            environment and deploy the Cloudflare Worker (see worker/README.md).
            See <span className="tnum">worker/README.md</span> for setup.
          </div>
        ) : (
          <>
            {/* Action */}
            <div className="px-4 pt-3">
              <button
                onClick={ask}
                disabled={status === 'streaming'}
                className="w-full rounded-2xl py-3 text-[14px] font-semibold flex items-center justify-center gap-2 transition-opacity disabled:opacity-50"
                style={{ background: C.cap, color: '#1b1b1d' }}
                aria-label="Ask Luxmi"
              >
                {status === 'streaming' ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                {status === 'streaming' ? 'Luxmi is thinking…' : 'Ask Luxmi'}
              </button>
              {status === 'error' && (
                <div className="mt-2 text-[11.5px] leading-snug" style={{ color: C.red }}>
                  {error}
                </div>
              )}
            </div>

            {/* Narrative */}
            <div ref={proseRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2 min-h-24">
              {text ? (
                <Prose text={text} />
              ) : (
                <div className="text-[12px] leading-relaxed" style={{ color: C.muted }}>
                  Luxmi reads your full budget (the exact JSON you can download), compares each theme to your cohort benchmarks, flags anomalies, and suggests reallocations. Try it.
                </div>
              )}
            </div>

            {/* Cost + balance footer */}
            <div className="px-4 pb-4 pt-1 flex items-center justify-between" style={{ color: C.muted }}>
              <span className="text-[10px] tnum">
                {costUsd != null
                  ? `this request ≈ $${costUsd.toFixed(6)}`
                  : 'system prompt & params: private config in luxmi.yaml'}
              </span>
              {balance && (
                <span className="text-[10px] tnum">
                  ≈ ${balance.balanceUsd.toFixed(2)} left of ${balance.budgetUsd.toFixed(0)}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ---------- tiny markdown (headings, bullets, **bold**, `code`, links) ---------- */

function inline(src: string, keyPrefix: string): React.ReactNode[] {
  const parts = src.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean)
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) {
      return <strong key={`${keyPrefix}-${i}`}>{p.slice(2, -2)}</strong>
    }
    if (p.startsWith('`') && p.endsWith('`')) {
      return (
        <code key={`${keyPrefix}-${i}`} className="px-1 rounded" style={{ background: `${C.border}88`, color: C.cap }}>
          {p.slice(1, -1)}
        </code>
      )
    }
    return <span key={`${keyPrefix}-${i}`}>{p}</span>
  })
}

function Prose({ text }: { text: string }) {
  const lines = text.split('\n')
  const out: React.ReactNode[] = []
  let list: { bullet: boolean; items: string[] } | null = null

  const flushList = () => {
    if (!list) return
    out.push(
      <div key={`list-${out.length}`} className="space-y-0.5 pl-1">
        {list.items.map((it, i) => (
          <div key={i} className="flex gap-1.5 text-[12.5px] leading-relaxed" style={{ color: C.text }}>
            <span style={{ color: C.cap }}>{list!.bullet ? '•' : `${i + 1}.`}</span>
            <span>{inline(it, `${out.length}-${i}`)}</span>
          </div>
        ))}
      </div>,
    )
    list = null
  }

  lines.forEach((raw, i) => {
    const line = raw.trim()

    if (line === '') {
      flushList()
      return
    }

    const h = line.match(/^(#{1,3})\s+(.*)$/)
    if (h) {
      flushList()
      out.push(
        <div key={`h-${i}`} className={`font-semibold ${h[1].length === 1 ? 'text-[15px]' : 'text-[13.5px]'}`} style={{ color: C.text, paddingTop: h[1].length === 1 ? 6 : 0 }}>
          {inline(h[2], `h-${i}`)}
        </div>,
      )
      return
    }

    if (/^[-*]\s+/.test(line)) {
      if (!list || !list.bullet) {
        flushList()
        list = { bullet: true, items: [] }
      }
      list.items.push(line.replace(/^[-*]\s+/, ''))
      return
    }

    const num = line.match(/^\d+[.)]\s+(.*)$/)
    if (num) {
      if (!list || list.bullet) {
        flushList()
        list = { bullet: false, items: [] }
      }
      list.items.push(num[1])
      return
    }

    flushList()
    out.push(
      <p key={`p-${i}`} className="text-[12.5px] leading-relaxed" style={{ color: C.text }}>
        {inline(line, `p-${i}`)}
      </p>,
    )
  })
  flushList()

  return <div className="space-y-1.5">{out}</div>
}
