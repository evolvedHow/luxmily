import type { RequestKind } from './providers'
import { advisorParams } from './config'

/**
 * Luxmi speaks to whichever provider the user picked, straight from the browser.
 * Two request schemas cover everything in the registry: OpenAI-compatible chat
 * completions (Groq, Google's OpenAI endpoint, OpenAI, OpenRouter, Ollama) and
 * Anthropic Messages. Both stream Server-Sent Events. Generation params come
 * from the private YAML config (src/advisor/luxmi.yaml).
 */

export interface StreamRequest {
  kind: RequestKind
  url: string
  apiKey: string
  model: string
  system: string
  prompt: string
  headers?: Record<string, string>
  temperature?: number
  maxTokens?: number
  signal?: AbortSignal
  onDelta: (text: string) => void
}

function params(req: StreamRequest): { temperature: number; max_tokens: number } {
  const p = advisorParams()
  return {
    temperature: req.temperature ?? p.temperature,
    max_tokens: req.maxTokens ?? p.max_tokens,
  }
}

function openaiBody(req: StreamRequest) {
  const { temperature, max_tokens } = params(req)
  return {
    model: req.model,
    temperature,
    max_tokens,
    stream: true,
    messages: [
      { role: 'system', content: req.system },
      { role: 'user', content: req.prompt },
    ],
  }
}

function anthropicBody(req: StreamRequest) {
  const { temperature, max_tokens } = params(req)
  return {
    model: req.model,
    max_tokens,
    temperature,
    system: req.system,
    stream: true,
    messages: [{ role: 'user', content: req.prompt }],
  }
}

interface DeltaReader {
  text(ev: Record<string, unknown>): string | undefined
  error(ev: Record<string, unknown>): string | undefined
}

export const OPENAI_DELTA: DeltaReader = {
  text: (ev) =>
    (ev.choices as { delta?: { content?: string }; text?: string }[] | undefined)?.[0]?.delta?.content ??
    (ev.choices as { text?: string }[] | undefined)?.[0]?.text,
  error: () => undefined,
}

export const ANTHROPIC_DELTA: DeltaReader = {
  text: (ev) => (ev.type === 'content_block_delta' ? ((ev.delta as { text?: string } | undefined)?.text ?? '') : undefined),
  error: (ev) => (ev.type === 'error' ? ((ev.error as { message?: string } | undefined)?.message ?? 'Unknown Anthropic error') : undefined),
}

async function parseError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: { message?: string } }
    return j.error?.message ?? `${res.status} ${res.statusText}`
  } catch {
    return `${res.status} ${res.statusText}`
  }
}

/** Reads an SSE body, feeding parsed text deltas through onDelta. */
export async function journey(res: Response, reader: DeltaReader, onDelta: (t: string) => void): Promise<string> {
  if (!res.body) throw new Error('No response body')
  const decoder = new TextDecoder()
  const stream = res.body.getReader() as ReadableStreamDefaultReader<Uint8Array>
  let buffer = ''
  let full = ''

  const flush = (data: string) => {
    const json = data.replace(/^data:\s*/, '').trim()
    if (!json || json === '[DONE]') return
    let ev: Record<string, unknown>
    try {
      ev = JSON.parse(json) as Record<string, unknown>
    } catch {
      return
    }
    const err = reader.error(ev)
    if (err) throw new Error(err)
    const t = reader.text(ev)
    if (t) {
      full += t
      onDelta(t)
    }
  }

  for (;;) {
    const { done, value } = await stream.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let idx: number
    while ((idx = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, idx)
      buffer = buffer.slice(idx + 1)
      const slim = line.trim()
      if (slim.startsWith('data:')) flush(slim)
    }
  }
  return full
}

/** Calls the provider and streams the narrative; resolves with the full text. */
export async function streamLuxmi(req: StreamRequest): Promise<string> {
  const body = req.kind === 'anthropic' ? anthropicBody(req) : openaiBody(req)

  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...(req.kind === 'anthropic'
      ? { 'x-api-key': req.apiKey, ...(req.headers ?? {}) }
      : req.apiKey
        ? { authorization: `Bearer ${req.apiKey}` }
        : {}),
    ...(req.kind === 'openai' ? (req.headers ?? {}) : {}),
  }

  const res = await fetch(req.url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: req.signal,
  })

  if (!res.ok) throw new Error(await parseError(res))

  const reader: DeltaReader = req.kind === 'anthropic' ? ANTHROPIC_DELTA : OPENAI_DELTA
  return journey(res, reader, req.onDelta)
}