import { useEffect, useRef, useState } from 'react'
import { ExternalLink, Loader2, Sparkles, X } from 'lucide-react'
import { ADVISOR_PROVIDERS, advisorProvider } from '../advisor/providers'
import { buildLuxmiSystem, buildLuxmiUserPrompt } from '../advisor/prompt'
import { streamLuxmi } from '../advisor/stream'
import { useAdvisor } from '../store/useAdvisor'
import { useResolved } from '../store/useBudget'
import { C } from '../theme/tokens'

/**
 * Luxmi — the AI budget advisor. A bottom sheet: pick provider + model, paste
 * a key (or run local Ollama with none), and get a streamed narrative built
 * from the full budget JSON. The system prompt & model params live in
 * src/advisor/luxmi.yaml (private operator config) — not here.
 */

export function AdvisorSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const r = useResolved()
  const { providerId, modelId, apiKey, baseUrl, setProvider, setModel, setApiKey, setBaseUrl } = useAdvisor()
  const provider = advisorProvider(providerId)

  const [text, setText] = useState('')
  const [status, setStatus] = useState<'' | 'streaming' | 'error'>('')
  const [error, setError] = useState('')
  const abortRef = useRef<AbortController | null>(null)
  const proseRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) {
      abortRef.current?.abort()
      setText('')
      setStatus('')
      setError('')
    }
  }, [open])

  useEffect(() => {
    if (status === 'streaming' && proseRef.current) proseRef.current.scrollTop = proseRef.current.scrollHeight
  }, [text, status])

  const ask = async () => {
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    setText('')
    setStatus('streaming')
    setError('')
    try {
      await streamLuxmi({
        kind: provider.kind,
        url: baseUrl.trim() || provider.url,
        apiKey,
        model: modelId,
        system: buildLuxmiSystem(),
        prompt: buildLuxmiUserPrompt(r),
        headers: provider.headers,
        signal: ac.signal,
        onDelta: (t) => setText((prev) => prev + t),
      })
      setStatus('')
    } catch (e) {
      if (ac.signal.aborted) return
      setStatus('error')
      setError(e instanceof Error ? e.message : 'Something went wrong calling the model.')
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

        {/* Settings */}
        <div className="px-4 py-3 border-b space-y-2.5 overflow-y-auto" style={{ borderColor: C.border }}>
          <div className="flex gap-2">
            <div className="flex-1">
              <Label>Provider</Label>
              <select
                value={providerId}
                onChange={(e) => setProvider(e.target.value)}
                className="w-full rounded-xl border px-2.5 py-2 text-[13px] outline-none"
                style={{ background: C.surface, borderColor: C.border, color: C.text }}
                aria-label="Advisor provider"
              >
                {ADVISOR_PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              <div className="mt-1 text-[10.5px] leading-snug" style={{ color: C.muted }}>
                {provider.badge && <span style={{ color: C.green }}>{provider.badge} · </span>}
                {provider.note}
                {provider.keyUrl && (
                  <a href={provider.keyUrl} target="_blank" rel="noreferrer noopener" className="underline underline-offset-2 inline-flex items-center gap-0.5" style={{ color: C.cap }}>
                    {' '}
                    Get a key <ExternalLink size={10} />
                  </a>
                )}
              </div>
            </div>
            <div className="flex-1">
              <Label>Model</Label>
              <select
                value={modelId}
                onChange={(e) => setModel(e.target.value)}
                className="w-full rounded-xl border px-2.5 py-2 text-[13px] outline-none"
                style={{ background: C.surface, borderColor: C.border, color: C.text }}
                aria-label="Advisor model"
              >
                {provider.models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                    {m.free ? ' (≈free)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {provider.requireKey ? (
            <div>
              <Label>API key</Label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={provider.keyHint}
                aria-label="Advisor API key"
                autoComplete="off"
                className="w-full rounded-xl border px-2.5 py-2 text-[13px] outline-none tnum"
                style={{ background: C.surface, borderColor: C.border, color: C.text }}
              />
              <div className="mt-1 text-[10.5px]" style={{ color: C.muted }}>
                Stored only in <span className="tnum">localStorage</span> on this device — the request goes straight to {provider.label}, never through a server.
              </div>
            </div>
          ) : (
            <div className="text-[11px] px-3 py-2 rounded-xl border" style={{ borderColor: `${C.green}44`, background: `${C.green}12`, color: C.green }}>
              No key needed — Ollama runs on your machine. Install it, run <span className="tnum">ollama pull llama3.2</span>, and pick a model above.
            </div>
          )}

          <div>
            <Label>Base URL (optional override)</Label>
            <input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder={provider.url}
              aria-label="Advisor base URL"
              className="w-full rounded-xl border px-2.5 py-2 text-[12px] outline-none tnum"
              style={{ background: C.surface, borderColor: C.border, color: C.text }}
            />
          </div>
        </div>

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

        <div className="px-4 pb-4 pt-1 flex items-center justify-between">
          <span className="text-[10px]" style={{ color: C.muted }}>
            System prompt & model params: private config in <span className="tnum">src/advisor/luxmi.yaml</span>
          </span>
        </div>
      </div>
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] uppercase tracking-[0.14em] mb-1" style={{ color: C.muted }}>
      {children}
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