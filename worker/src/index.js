/**
 * Luxmi.ly Cloudflare Worker
 *
 * Sits between the GitHub Pages frontend and a Modal Dedicated Endpoint.
 * Responsibilities:
 *   - CORS for the Pages origin
 *   - /api/advise  POST  → proxy Chat Completions to Modal, inject Bearer token,
 *                            append a usage trailer so the frontend knows the cost.
 *   - /api/balance  GET  → return the Durable Object ledger (budget − accumulated spend).
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Range, Accept',
  'Access-Control-Expose-Headers': 'X-Luxmi-Cost, X-Luxmi-Balance',
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}

// ── Routing ────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS })
    }

    if (url.pathname === '/api/advise' && request.method === 'POST') {
      return handleAdvise(request, env)
    }

    if (url.pathname === '/api/balance' && request.method === 'GET') {
      return handleBalance(env)
    }

    return json({ error: 'not found' }, 404)
  },
}

// ── /api/advise ────────────────────────────────────────────────────

async function handleAdvise(request, env) {
  if (!env.MODAL_ENDPOINT || !env.MODAL_PROXY_TOKEN) {
    return json({ error: 'Modal endpoint not configured.' }, 503)
  }

  // ── Parse & re-shape the client body ──────────────────────────────
  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400)
  }

  // Force streaming + usage tracking. Inject model from env so the
  // client never needs to know it.
  body.stream = true
  body.stream_options = { include_usage: true }
  if (env.MODAL_MODEL) body.model = env.MODAL_MODEL

  // ── Forward to Modal ─────────────────────────────────────────────
  const endpoint = env.MODAL_ENDPOINT.replace(/\/+$/, '')
  const res = await fetch(`${endpoint}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      Authorization: `Bearer ${env.MODAL_PROXY_TOKEN}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    return new Response(text, {
      status: res.status,
      headers: { 'Content-Type': 'text/plain', ...CORS_HEADERS },
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
  let buffer = ''

  const stream = new ReadableStream({
    async pull(controller) {
      const { done, value } = await reader.read()
      if (done) {
        // ── Flush remaining buffer ─────────────────────────────────
        if (buffer) {
          const lines = buffer.split('\n')
          for (const line of lines) {
            controller.enqueue(new TextEncoder().encode(line + '\n'))
            const trimmed = line.trim()
            if (trimmed.startsWith('data:')) {
              const payload = trimmed.slice(5).trim()
              if (payload && payload !== '[DONE]') {
                try {
                  const ev = JSON.parse(payload)
                  if (ev.usage) usage = ev.usage
                } catch { /* ignore */ }
              }
            }
          }
        }

        // ── Compute cost & update ledger ───────────────────────────
        let costUsd = 0
        let balanceUsd = null

        if (usage) {
          const inRate  = parseFloat(env.MODAL_IN_PRICE  || '0.12')
          const outRate = parseFloat(env.MODAL_OUT_PRICE || '0.36')
          costUsd = ((usage.prompt_tokens || 0) / 1e6) * inRate
                   + ((usage.completion_tokens || 0) / 1e6) * outRate
          costUsd = Math.round(costUsd * 1e6) / 1e6  // avoid fp noise

          try {
            const id = env.BALANCE.idFromName('luxmi-budget')
            const stub = env.BALANCE.get(id)
            const ledgerRes = await stub.fetch(new Request('http://do/incr', {
              method: 'POST',
              body: JSON.stringify({ costUsd }),
            }))
            const ledger = await ledgerRes.json()
            balanceUsd = ledger.balanceUsd
          } catch {
            // DO unavailable (local dev without --local) — still return usage
          }
        }

        // ── Append usage trailer event ─────────────────────────────
        const trailer = `data: ${JSON.stringify({
          type: 'usage',
          usage: usage || {},
          costUsd: costUsd || 0,
          balanceUsd,
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
            try {
              const ev = JSON.parse(payload)
              if (ev.usage) usage = ev.usage
            } catch { /* ignore */ }
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
    headers: { 'Content-Type': 'text/event-stream', ...CORS_HEADERS },
  })
}

// ── /api/balance ───────────────────────────────────────────────────

async function handleBalance(env) {
  const budgetUsd = parseFloat(env.MODAL_BUDGET_USD || '50')

  try {
    const id = env.BALANCE.idFromName('luxmi-budget')
    const stub = env.BALANCE.get(id)
    const res = await stub.fetch(new Request('http://do/get'))
    const ledger = await res.json()
    return json({
      budgetUsd,
      spentUsd: ledger.spentUsd,
      balanceUsd: budgetUsd - ledger.spentUsd,
      currency: 'usd',
    })
  } catch {
    // Durable Object unavailable (local dev without --local)
    return json({
      budgetUsd,
      spentUsd: 0,
      balanceUsd: budgetUsd,
      currency: 'usd',
      note: 'ledger unavailable (Durable Object not connected)',
    })
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
      return Response.json({ spentUsd: ledger.spentUsd, balanceUsd: 0 })
    }

    if (url.pathname === '/get') {
      return Response.json(ledger)
    }

    return Response.json({ error: 'not found' }, { status: 404 })
  }
}
