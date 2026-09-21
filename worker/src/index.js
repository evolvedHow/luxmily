/**
 * Luxmi.ly Cloudflare Worker
 *
 * Sits between the GitHub Pages frontend and Cloudflare Workers AI.
 * Responsibilities:
 *   - CORS for the Pages origin
 *   - /api/advise  POST  → proxy OpenAI-compatible Chat Completions to Workers
 *                            AI (`/ai/v1/chat/completions`), authenticate with
 *                            a Cloudflare API token held as a secret, and append
 *                            a usage trailer so the frontend knows the cost.
 *   - /api/balance  GET  → return the Durable Object ledger (budget − accumulated spend).
 */

/**
 * SECURITY NOTE — this endpoint is unauthenticated by design (a static GitHub
 * Pages frontend has nowhere to hide a credential), so anyone who learns the
 * worker URL can spend the operator's Workers AI allowance. The mitigations
 * here are defence-in-depth, not authentication:
 *   - ALLOWED_ORIGINS  comma-separated origin allowlist (default `*`, which
 *                      preserves the original behaviour — set it in production)
 *   - a hard budget stop, so a runaway caller cannot exceed CFAI_BUDGET_USD
 *   - server-pinned model + clamped max_tokens, so a caller cannot select an
 *     expensive model or ask for an unbounded completion
 * For real protection put Cloudflare Access / WAF rate-limiting in front.
 */

/** Upper bound on a single completion, whatever the client asks for. */
const MAX_TOKENS_CEILING = 4096

function corsHeaders(request, env) {
  const allowed = (env.ALLOWED_ORIGINS || '*').split(',').map((s) => s.trim()).filter(Boolean)
  const origin = request?.headers?.get('Origin') || ''
  const allowOrigin = allowed.includes('*')
    ? '*'
    : allowed.includes(origin)
      ? origin
      : allowed[0] || ''
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Range, Accept',
    'Access-Control-Expose-Headers': 'X-Luxmi-Cost, X-Luxmi-Balance',
  }
}

/** True when the request's Origin is not permitted by ALLOWED_ORIGINS. */
function originBlocked(request, env) {
  const allowed = (env.ALLOWED_ORIGINS || '*').split(',').map((s) => s.trim()).filter(Boolean)
  if (allowed.includes('*')) return false
  const origin = request.headers.get('Origin')
  // No Origin header = a non-browser client (curl). Browsers always send one
  // on cross-origin POSTs, so this only blocks the case we can actually judge.
  return !!origin && !allowed.includes(origin)
}

function json(data, status = 200, cors = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  })
}

// ── Routing ────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const cors = corsHeaders(request, env)

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors })
    }

    if (originBlocked(request, env)) {
      return json({ error: 'origin not allowed' }, 403, cors)
    }

    if (url.pathname === '/api/advise' && request.method === 'POST') {
      return handleAdvise(request, env, cors)
    }

    if (url.pathname === '/api/balance' && request.method === 'GET') {
      return handleBalance(env, cors)
    }

    return json({ error: 'not found' }, 404, cors)
  },
}

// ── /api/advise ────────────────────────────────────────────────────

async function handleAdvise(request, env, cors) {
  const accountId = env.CF_ACCOUNT_ID
  const apiToken = env.CF_AI_API_TOKEN
  if (!accountId || !apiToken) {
    return json({ error: 'Workers AI not configured.' }, 503, cors)
  }

  // ── Parse & re-shape the client body ──────────────────────────────
  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400, cors)
  }

  // Fallback estimate of prompt tokens (chars/4) used only if Workers AI
  // doesn't echo `usage` in the stream. Approximate; the UI already labels
  // these figures with "≈".
  const promptChars = JSON.stringify(body.messages || []).length

  // ── Hard budget stop ──────────────────────────────────────────────
  // The ledger was display-only: it reported overspend but never prevented
  // it. Refuse once the budget is exhausted so an unauthenticated caller
  // cannot run the bill past CFAI_BUDGET_USD.
  const budgetUsd = parseFloat(env.CFAI_BUDGET_USD || '25')
  try {
    const id = env.BALANCE.idFromName('luxmi-budget')
    const stub = env.BALANCE.get(id)
    const ledger = await (await stub.fetch(new Request('http://do/get'))).json()
    if (typeof ledger?.spentUsd === 'number' && ledger.spentUsd >= budgetUsd) {
      return json({ error: 'AI budget exhausted for this deployment.' }, 429, cors)
    }
  } catch {
    // Ledger unavailable (local dev without --local) — fail open, as before.
  }

  // Force streaming + usage tracking. The model is pinned server-side and the
  // completion length is capped, so a hand-rolled request body cannot select a
  // pricier model or ask for an unbounded (and unbounded-cost) completion.
  body.stream = true
  body.stream_options = { include_usage: true }
  body.model = env.CFAI_MODEL || '@cf/meta/llama-3.3-70b-instruct-fp8-fast'
  body.n = 1
  const askedTokens = Number(body.max_tokens)
  body.max_tokens = Number.isFinite(askedTokens) && askedTokens > 0
    ? Math.min(askedTokens, MAX_TOKENS_CEILING)
    : 1600

  // ── Forward to Cloudflare Workers AI (OpenAI-compatible endpoint) ──
  const url =
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/` +
    `ai/v1/chat/completions`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      Authorization: `Bearer ${apiToken}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    return new Response(text, {
      status: res.status,
      headers: { 'Content-Type': 'text/plain', ...cors },
    })
  }

  // ── Stream passthrough + usage intercept ─────────────────────────
  // We read the SSE stream, let deltas flow straight through, and stash
  // the final chunk that carries `usage`.  On stream end we compute cost,
  // update the Durable Object ledger, and append one extra SSE event the
  // frontend can parse for per-request cost + remaining balance.
  const reader = res.body.getReader()
  const decoder = new TextDecoder()

  let usage = null       // { prompt_tokens, completion_tokens, total_tokens }
  let outputChars = 0    // fallback completion-token estimate
  let buffer = ''

  function scanChunk(chunk) {
    // Parses an SSE `data:` payload captured elsewhere. Updates `usage`
    // (OpenAI-style `prompt_tokens`/`completion_tokens`, or Workers AI's
    // `input_tokens`/`output_tokens`) and counts completion chars.
    const ev = chunk
    if (ev.usage) {
      const u = ev.usage
      usage = {
        prompt_tokens: u.prompt_tokens ?? u.input_tokens ?? 0,
        completion_tokens: u.completion_tokens ?? u.output_tokens ?? 0,
        total_tokens: u.total_tokens ?? 0,
      }
      if (!usage.total_tokens) usage.total_tokens = usage.prompt_tokens + usage.completion_tokens
    }
    const delta = ev.choices?.[0]?.delta?.content
    if (typeof delta === 'string') outputChars += delta.length
  }

  const stream = new ReadableStream({
    async pull(controller) {
      const { done, value } = await reader.read()
      if (done) {
        // ── Flush remaining buffer ─────────────────────────────────
        // NOTE: do NOT re-enqueue `buffer` here. Every byte was already
        // forwarded verbatim by `controller.enqueue(value)` below; `buffer` is
        // only a parsing mirror. Re-emitting it duplicated the stream's final
        // partial line (and appended a stray newline) whenever the upstream
        // response did not end on a newline. Scan it, don't resend it.
        if (buffer) {
          for (const line of buffer.split('\n')) {
            const trimmed = line.trim()
            if (trimmed.startsWith('data:')) {
              const payload = trimmed.slice(5).trim()
              if (payload && payload !== '[DONE]') {
                try { scanChunk(JSON.parse(payload)) } catch { /* ignore */ }
              }
            }
          }
        }

        // ── Compute cost & update ledger ───────────────────────────
        let costUsd = 0
        let balanceUsd = null
        let estimated = false

        if (usage) {
          const inRate  = parseFloat(env.CFAI_IN_PRICE  || '0.051')
          const outRate = parseFloat(env.CFAI_OUT_PRICE || '0.335')
          costUsd = ((usage.prompt_tokens || 0) / 1e6) * inRate
                   + ((usage.completion_tokens || 0) / 1e6) * outRate
          costUsd = Math.round(costUsd * 1e6) / 1e6  // avoid fp noise
        } else {
          // Workers AI didn't echo usage — fall back to a chars/4 token
          // estimate so the dashboard still shows a "≈" per-request cost.
          const inRate  = parseFloat(env.CFAI_IN_PRICE  || '0.051')
          const outRate = parseFloat(env.CFAI_OUT_PRICE || '0.335')
          usage = {
            prompt_tokens: Math.max(1, Math.round(promptChars / 4)),
            completion_tokens: Math.max(1, Math.round(outputChars / 4)),
            total_tokens: 0,
          }
          usage.total_tokens = usage.prompt_tokens + usage.completion_tokens
          costUsd = ((usage.prompt_tokens || 0) / 1e6) * inRate
                   + ((usage.completion_tokens || 0) / 1e6) * outRate
          costUsd = Math.round(costUsd * 1e6) / 1e6
          estimated = true
        }

        try {
          const id = env.BALANCE.idFromName('luxmi-budget')
          const stub = env.BALANCE.get(id)
          const ledgerRes = await stub.fetch(new Request('http://do/incr', {
            method: 'POST',
            body: JSON.stringify({ costUsd }),
          }))
          const ledger = await ledgerRes.json()
          const spentUsd = typeof ledger?.spentUsd === 'number' ? ledger.spentUsd : 0
          balanceUsd = Math.max(0, budgetUsd - spentUsd)
        } catch {
          // DO unavailable (local dev without --local) — still return usage
        }

        // ── Append usage trailer event ─────────────────────────────
        const trailer = `data: ${JSON.stringify({
          type: 'usage',
          usage,
          costUsd: costUsd || 0,
          balanceUsd,
          estimated,
        })}\n\n`
        controller.enqueue(new TextEncoder().encode(trailer))
        controller.close()
        return
      }

      // Forward every chunk as-is, and scan for usage in the process.
      controller.enqueue(value)
      buffer += decoder.decode(value, { stream: true })

      // Process complete lines to catch usage events early (most providers
      // send usage in the very last `data:` line before `[DONE]`).
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''  // keep incomplete trailing line
      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.startsWith('data:')) {
          const payload = trimmed.slice(5).trim()
          if (payload && payload !== '[DONE]') {
            try { scanChunk(JSON.parse(payload)) } catch { /* ignore */ }
          }
        }
      }
    },

    cancel() {
      reader.cancel()
    },
  })

  return new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream', ...cors },
  })
}

// ── /api/balance ───────────────────────────────────────────────────

async function handleBalance(env, cors) {
  const budgetUsd = parseFloat(env.CFAI_BUDGET_USD || '25')

  try {
    const id = env.BALANCE.idFromName('luxmi-budget')
    const stub = env.BALANCE.get(id)
    const res = await stub.fetch(new Request('http://do/get'))
    const ledger = await res.json()
    const spentUsd = typeof ledger?.spentUsd === 'number' ? ledger.spentUsd : 0
    return json({
      budgetUsd,
      spentUsd,
      // Clamped at 0 to match the per-request usage trailer, which already
      // used Math.max(0, …). The two disagreed once the budget was exhausted.
      balanceUsd: Math.max(0, budgetUsd - spentUsd),
      currency: 'usd',
    }, 200, cors)
  } catch {
    // Durable Object unavailable (local dev without --local)
    return json({
      budgetUsd,
      spentUsd: 0,
      balanceUsd: budgetUsd,
      currency: 'usd',
      note: 'ledger unavailable (Durable Object not connected)',
    }, 200, cors)
  }
}

// ── Durable Object: Balance Ledger ─────────────────────────────────

export class BalanceDO {
  constructor(state) {
    this.state = state
    this.data = null
  }

  async load() {
    if (this.data === null) {
      this.data = (await this.state.storage.get('ledger')) || { spentUsd: 0 }
    }
    return this.data
  }

  async fetch(request) {
    const url = new URL(request.url)
    const ledger = await this.load()

    if (url.pathname === '/incr' && request.method === 'POST') {
      const { costUsd } = await request.json()
      ledger.spentUsd += costUsd || 0
      await this.state.storage.put('ledger', ledger)
      return Response.json({ spentUsd: ledger.spentUsd })
    }

    if (url.pathname === '/get') {
      return Response.json(ledger)
    }

    return Response.json({ error: 'not found' }, { status: 404 })
  }
}