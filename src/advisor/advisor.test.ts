import { describe, expect, it, vi } from 'vitest'
import { LUXMI_CONFIG, advisorParams, advisorSystem, loadLuxmiConfig } from './config'
import { buildLuxmiSystem, buildLuxmiUserPrompt } from './prompt'
import { askAdvisor, fetchBalance, isConfigured, workerUrl } from './worker'
import { buildBudget, scaffold } from '../engine/model'
import { resolve } from '../engine/resolve'
import { cohortById } from '../data/benchmarks'

function sample() {
  const sc = scaffold(6800, 10000, 'c4')
  const b = buildBudget({ incomeMonthly: 10000, takeHome: 6800, cohortId: 'c4', ...sc })
  b.themes.find((t) => t.id === 'food')!.cats[0].observed = 300
  return resolve(b)
}

describe('luxmi config (private YAML)', () => {
  it('loads a system prompt and params with safe defaults', () => {
    const c = loadLuxmiConfig()
    expect(c.system.length).toBeGreaterThan(80)
    expect(c.system).toContain('Luxmi')
    expect(c.temperature).toBeGreaterThanOrEqual(0)
    expect(c.max_tokens).toBeGreaterThanOrEqual(64)
  })

  it('exports the config as a stable singleton', () => {
    expect(advisorSystem()).toBe(LUXMI_CONFIG.system)
    expect(advisorParams().max_tokens).toBe(LUXMI_CONFIG.max_tokens)
    expect(advisorParams().temperature).toBe(LUXMI_CONFIG.temperature)
  })
})

describe('luxmi prompt', () => {
  it('system prompt comes from the private YAML', () => {
    expect(buildLuxmiSystem()).toBe(LUXMI_CONFIG.system)
    expect(buildLuxmiSystem()).not.toBe('')
  })

  it('hands Luxmi the exact downloadable budget JSON', () => {
    const r = sample()
    const prompt = buildLuxmiUserPrompt(r)

    const start = prompt.indexOf('```json')
    const end = prompt.indexOf('```', start + 7)
    expect(start).toBeGreaterThan(-1)
    const json = JSON.parse(prompt.slice(start + 7, end)) as { meta: Record<string, unknown>; themes: { id: string }[] }

    expect(json.meta.takeHome).toBe(6800)
    expect(json.meta.cap).toBe(6800)
    expect(json.meta.cohortLabel).toBe('$110k – $150k')
    expect(json.meta.cohortAvgAnnualSpend).toBe(cohortById('c4').avgAnnualSpend)
    expect(json.themes.map((t) => t.id)).toContain('travel')
    expect(json.themes.length).toBeGreaterThanOrEqual(7)
  })

  it('includes every user input and computed parameter', () => {
    const r = sample()
    const prompt = buildLuxmiUserPrompt(r)
    const start = prompt.indexOf('```json')
    const end = prompt.indexOf('```', start + 7)
    const json = JSON.parse(prompt.slice(start + 7, end)) as {
      meta: Record<string, unknown>
      payYourselfFirst: { observed: number }[]
      themes: { cats: Record<string, unknown>[]; sources: { url?: string }[] }[]
    }
    expect(json.meta.totalObserved).toBe(300)
    expect(json.payYourselfFirst.length).toBeGreaterThan(0)

    const foodCat = json.themes.find((t) => (t.cats[0] as unknown as { id: string }).id === 'groceries')?.cats[0]
    expect(foodCat).toBeTruthy()
    if (foodCat) {
      expect(foodCat.observed).toBe(300)
      expect(foodCat.observedPct).toBeGreaterThan(0)
      expect(foodCat.delta).toBeLessThan(0)
      expect(foodCat.surplus).toBeGreaterThan(0)
      expect(foodCat.benchAvg).toBeGreaterThan(0)
    }
  })
})

function sseStream(body: string): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(new TextEncoder().encode(body))
      c.close()
    },
  })
  return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } })
}

describe('luxmi worker client', () => {
  it('is unconfigured until VITE_LUXMI_WORKER is set', () => {
    expect(isConfigured()).toBe(false)
    expect(workerUrl()).toBe('')
  })

  it('askAdvisor throws when the worker is not configured', async () => {
    await expect(askAdvisor({ system: 's', prompt: 'p', onDelta: () => {} })).rejects.toThrow('worker not configured')
  })

  it('streams OpenAI-compatible deltas and parses the usage trailer', async () => {
    vi.stubEnv('VITE_LUXMI_WORKER', 'https://example.workers.dev/')

    const body = [
      'data: {"choices":[{"delta":{"content":"Hello "}}]}',
      '',
      'data: {"choices":[{"delta":{"content":"world"}}]}',
      '',
      'data: [DONE]',
      '',
      'data: {"type":"usage","usage":{"prompt_tokens":120,"completion_tokens":30,"total_tokens":150},"costUsd":0.000312,"balanceUsd":49.97}',
      '',
      '',
    ].join('\n')

    const ogFetch = globalThis.fetch
    globalThis.fetch = async (input) => {
      expect(input).toBe('https://example.workers.dev/api/advise')
      return sseStream(body)
    }
    try {
      const seen: string[] = []
      const result = await askAdvisor({ system: 's', prompt: 'p', onDelta: (t) => seen.push(t) })
      expect(result.text).toBe('Hello world')
      expect(seen.join('')).toBe('Hello world')
      expect(result.usage?.total_tokens).toBe(150)
      expect(result.costUsd).toBe(0.000312)
      expect(result.balanceUsd).toBe(49.97)
    } finally {
      globalThis.fetch = ogFetch
      vi.unstubAllEnvs()
    }
  })

  it('surfaces a non-OK response shape to the caller', async () => {
    vi.stubEnv('VITE_LUXMI_WORKER', 'https://example.workers.dev')
    const ogFetch = globalThis.fetch
    globalThis.fetch = async () => new Response('{"error":"model not found"}', { status: 502 })
    try {
      await expect(askAdvisor({ system: 's', prompt: 'p', onDelta: () => {} })).rejects.toThrow('model not found')
    } finally {
      globalThis.fetch = ogFetch
      vi.unstubAllEnvs()
    }
  })

  it('fetchBalance returns null when the worker is not configured', async () => {
    expect(await fetchBalance()).toBeNull()
  })

  it('fetchBalance resolves the ledger shape', async () => {
    vi.stubEnv('VITE_LUXMI_WORKER', 'https://example.workers.dev')
    const ogFetch = globalThis.fetch
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ budgetUsd: 25, spentUsd: 0.5, balanceUsd: 24.5, currency: 'usd' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    try {
      const bal = await fetchBalance()
      expect(bal).toEqual({ budgetUsd: 25, spentUsd: 0.5, balanceUsd: 24.5, currency: 'usd' })
    } finally {
      globalThis.fetch = ogFetch
      vi.unstubAllEnvs()
    }
  })
})