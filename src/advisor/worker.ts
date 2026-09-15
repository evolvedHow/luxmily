/**
 * Luxmi advisor API client.
 *
 * Talks to the Cloudflare Worker (`VITE_LUXMI_WORKER`) which proxies
 * requests to Cloudflare Workers AI. The browser never holds an API key.
 *
 * Exports:
 *   WORKER_URL  — the worker origin (empty string = not configured)
 *   askAdvisor  — stream a narrative from Luxmi (SSE deltas + usage trailer)
 *   fetchBalance — GET the Durable Object ledger (budget − spent)
 */

import { advisorParams } from './config'

/**
 * The worker origin, from `VITE_LUXMI_WORKER` (build-time env). Read lazily so
 * tests can stub it. In the browser bundle Vite inlines `import.meta.env`;
 * `process.env` is used as a fallback so vitest's `vi.stubEnv` works in tests.
 * Empty string = not configured.
 */
export function workerUrl(): string {
  const fromMeta = (import.meta as { env?: Record<string, unknown> }).env?.VITE_LUXMI_WORKER
  // vitest runs in node where VITE_* vars live on process.env (no @types/node
  // is installed, so reach it through globalThis). Undefined in the browser.
  const nodeProcess = (globalThis as { process?: { env?: Record<string, unknown> } }).process
  const fromProcess = nodeProcess?.env?.VITE_LUXMI_WORKER
  const raw = typeof fromMeta === 'string' ? fromMeta : typeof fromProcess === 'string' ? fromProcess : ''
  return raw.replace(/\/+$/, '')
}

export function isConfigured(): boolean {
  return workerUrl().length > 0
}

// ── askAdvisor ─────────────────────────────────────────────────────

export interface AdvisorRequest {
  system: string
  prompt: string
  temperature?: number
  maxTokens?: number
  signal?: AbortSignal
  onDelta: (text: string) => void
}

export interface AdvisorResult {
  text: string
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
  costUsd?: number
  balanceUsd?: number | null
}

export async function askAdvisor(req: AdvisorRequest): Promise<AdvisorResult> {
  const url = workerUrl()
  if (!url) throw new Error('Luxmi worker not configured.')

  const { temperature, max_tokens } = advisorParams()

  const res = await fetch(`${url}/api/advise`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({
      temperature: req.temperature ?? temperature,
      max_tokens: req.maxTokens ?? max_tokens,
      stream: true,
      messages: [
        { role: 'system', content: req.system },
        { role: 'user', content: req.prompt },
      ],
    }),
    signal: req.signal,
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(detail || `${res.status} ${res.statusText}`)
  }

  if (!res.body) throw new Error('No response body')

  const decoder = new TextDecoder()
  const reader = res.body.getReader()
  let buffer = ''
  let full = ''
  let usage: AdvisorResult['usage'] = undefined
  let costUsd: number | undefined
  let balanceUsd: number | null | undefined

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    let idx: number
    while ((idx = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, idx)
      buffer = buffer.slice(idx + 1)
      const slim = line.trim()
      if (!slim.startsWith('data:')) continue

      const payload = slim.slice(5).trim()
      if (!payload || payload === '[DONE]') continue

      let ev: Record<string, unknown>
      try { ev = JSON.parse(payload) } catch { continue }

      // Standard Chat Completions delta
      const choices = ev.choices as Array<{ delta?: { content?: string } }> | undefined
      const delta = choices?.[0]?.delta?.content
      if (delta) {
        full += delta
        req.onDelta(delta)
        continue
      }

      // Usage trailer event (appended by the worker after [DONE])
      if (ev.type === 'usage') {
        usage = ev.usage as AdvisorResult['usage']
        costUsd = ev.costUsd as number
        balanceUsd = ev.balanceUsd as number | null
      }
    }
  }

  return { text: full, usage, costUsd, balanceUsd }
}

// ── fetchBalance ───────────────────────────────────────────────────

export interface Balance {
  budgetUsd: number
  spentUsd: number
  balanceUsd: number
  currency: string
  note?: string
}

export async function fetchBalance(): Promise<Balance | null> {
  const url = workerUrl()
  if (!url) return null
  try {
    const res = await fetch(`${url}/api/balance`)
    if (!res.ok) return null
    return (await res.json()) as Balance
  } catch {
    return null
  }
}
