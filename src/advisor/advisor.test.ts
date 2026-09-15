import { describe, expect, it } from 'vitest'
import { LUXMI_CONFIG, advisorDefaultModel, advisorParams, advisorSystem, loadLuxmiConfig } from './config'
import { buildLuxmiSystem, buildLuxmiUserPrompt } from './prompt'
import { ADVISOR_PROVIDERS } from './providers'
import { ANTHROPIC_DELTA, OPENAI_DELTA, journey } from './stream'
import { defaultModelFor, effectiveModelId, useAdvisor } from '../store/useAdvisor'
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
  it('loads a system prompt, params and model overrides', () => {
    const c = loadLuxmiConfig()
    expect(c.system.length).toBeGreaterThan(80)
    expect(c.system).toContain('Luxmi')
    expect(c.temperature).toBeGreaterThanOrEqual(0)
    expect(c.max_tokens).toBeGreaterThanOrEqual(64)
    expect(Object.keys(c.models).length).toBeGreaterThanOrEqual(1)
  })

  it('exports the config as a stable singleton', () => {
    expect(advisorSystem()).toBe(LUXMI_CONFIG.system)
    expect(advisorParams().max_tokens).toBe(LUXMI_CONFIG.max_tokens)
  })

  it('defaults every registered provider to a model', () => {
    for (const p of ADVISOR_PROVIDERS) {
      const m = advisorDefaultModel(p.id) ?? p.defaultModel
      expect(m.length).toBeGreaterThan(0)
      expect(p.models.map((x) => x.id)).toContain(m)
    }
  })
})

describe('luxmi settings hygiene (useAdvisor)', () => {
  it('clears a stale base URL override when the provider changes', () => {
    useAdvisor.setState({ baseUrl: 'http://localhost:11434/v1' })
    useAdvisor.getState().setProvider('google')
    const s = useAdvisor.getState()
    expect(s.baseUrl).toBe('')
    expect(s.modelId).toBe(defaultModelFor('google'))
  })

  it('seeds a model the chosen provider actually offers', () => {
    useAdvisor.getState().setProvider('groq')
    const p = ADVISOR_PROVIDERS.find((x) => x.id === 'groq')!
    expect(p.models.map((m) => m.id)).toContain(useAdvisor.getState().modelId)
  })

  it('resolves a default model for every provider that is in its own list', () => {
    for (const p of ADVISOR_PROVIDERS) {
      expect(p.models.map((m) => m.id)).toContain(defaultModelFor(p.id))
    }
  })

  it('effective model: a typed custom id wins over the picker', () => {
    const p = ADVISOR_PROVIDERS[0]
    expect(effectiveModelId(p.id, p.defaultModel, 'x/my-custom-model')).toBe('x/my-custom-model')
    expect(effectiveModelId(p.id, p.defaultModel, '  ')).toBe(p.defaultModel)
  })

  it('custom model override is cleared on provider switch (no cross-provider leakage)', () => {
    useAdvisor.getState().setProvider('groq')
    useAdvisor.getState().setCustomModel('my/groq-model')
    expect(useAdvisor.getState().customModel).toBe('my/groq-model')
    useAdvisor.getState().setProvider('google')
    const s = useAdvisor.getState()
    expect(s.customModel).toBe('')
    expect(s.baseUrl).toBe('')
    expect(s.modelId).toBe(defaultModelFor('google'))
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

describe('luxmi streaming (SSE)', () => {
  it('parses OpenAI-compatible data: deltas', async () => {
    const body = 'data: {"choices":[{"delta":{"content":"Hello "}}]}\n\ndata: {"choices":[{"delta":{"content":"world"}}]}\n\ndata: [DONE]\n\n'
    const seen: string[] = []
    const full = await journey(sseStream(body), OPENAI_DELTA, (t) => seen.push(t))
    expect(full).toBe('Hello world')
    expect(seen.join('')).toBe('Hello world')
  })

  it('parses Anthropic content_block_delta deltas', async () => {
    const body = 'data: {"type":"content_block_delta","delta":{"text":"Nice "}}\n\ndata: {"type":"content_block_delta","delta":{"text":"plan"}}\n\ndata: {"type":"message_stop"}\n\n'
    const full = await journey(sseStream(body), ANTHROPIC_DELTA, () => {})
    expect(full).toBe('Nice plan')
  })

  it('surfaces errors from the payload', async () => {
    const body = 'data: {"type":"error","error":{"message":"bad widget"}}\n\n'
    await expect(journey(sseStream(body), ANTHROPIC_DELTA, () => {})).rejects.toThrow('bad widget')
  })
})