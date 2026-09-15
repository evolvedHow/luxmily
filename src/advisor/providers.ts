/**
 * Advisor provider registry. Luxmi calls the provider directly from the browser
 * (everything in Luxmi.ly is client-side), so each entry carries what the fetch
 * needs — endpoint, request schema, and a link to get a key.
 *
 * Free-tier reality: every cloud API needs *a* key, but several are free with
 * no card on file — Groq, Google AI Studio, and OpenRouter's `:free` models.
 * There is no trustworthy keyless cloud API, so we also offer a fully local,
 * no-key path: Ollama on the user's own machine.
 */

export type RequestKind = 'openai' | 'anthropic'

export interface AdvisorModel {
  id: string
  label: string
  free?: boolean
  note?: string
}

export interface AdvisorProvider {
  id: string
  label: string
  kind: RequestKind
  /** Request URL. For http (Ollama) the browser allows mixed content from http pages only — on Pages this is https, so localhost http calls still work. */
  url: string
  /** "Here's what goes in the key box." */
  keyHint: string
  /** Where to get a key (shows a "get key" link). Empty for keyless providers. */
  keyUrl?: string
  /** Short free-tier guidance shown under the dropdown. */
  note: string
  /** Contribution badge — free tier no card, local, etc. */
  badge?: string
  requireKey: boolean
  /** Fallback model list (used when the live fetch can't run — no key yet, network/CORS error). */
  models: AdvisorModel[]
  defaultModel: string
  headers?: Record<string, string>
  /**
   * Fetch the provider's ACTUAL model list from its API. Throws on failure;
   * the caller falls back to `models`. Provider-specific auth/shape lives in
   * the implementation so each provider's list endpoint gets what it needs.
   */
  fetchModelsList?: (apiKey: string) => Promise<AdvisorModel[]>
}

export const ADVISOR_PROVIDERS: AdvisorProvider[] = [
  {
    id: 'groq',
    label: 'Groq',
    kind: 'openai',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    keyHint: 'Groq API key',
    keyUrl: 'https://console.groq.com/keys',
    note: 'Free tier, no card needed. Fastest option here; quietly rate-limited but plenty for one budget.',
    badge: 'free tier · no card',
    requireKey: true,
    defaultModel: 'openai/gpt-oss-120b',
    models: [
      { id: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B (fast, apt)', free: true },
      { id: 'openai/gpt-oss-20b', label: 'GPT-OSS 20B (lighter)', free: true },
    ],
    fetchModelsList: async (apiKey) => {
      const res = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { authorization: `Bearer ${apiKey}` },
      })
      if (!res.ok) throw new Error(`list models: ${res.status}`)
      const json = (await res.json()) as { data: { id: string }[] }
      const exclude = ['whisper', 'prompt-guard', 'safeguard', 'compound']
      return json.data
        .filter((m) => !exclude.some((e) => m.id.includes(e)))
        .map((m) => ({ id: m.id, label: m.id, free: true }))
    },
  },
  {
    id: 'google',
    label: 'Google (Gemini)',
    kind: 'openai',
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    keyHint: 'Google AI Studio API key',
    keyUrl: 'https://aistudio.google.com/apikey',
    note: 'Gemini free tier key — generous monthly free quota, no card at signup.',
    badge: 'free tier · no card',
    requireKey: true,
    defaultModel: 'gemini-3.5-flash',
    models: [
      { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash (default)', free: true },
    ],
    fetchModelsList: async (apiKey) => {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
      )
      if (!res.ok) throw new Error(`list models: ${res.status}`)
      const data = (await res.json()) as {
        models?: { name: string; displayName?: string; supportedGenerationMethods?: string[] }[]
      }
      return (data.models ?? [])
        .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m) => ({
          id: m.name.replace(/^models\//, ''),
          label: m.displayName || m.name.replace(/^models\//, ''),
          free: true,
        }))
    },
  },
  {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    kind: 'anthropic',
    url: 'https://api.anthropic.com/v1/messages',
    keyHint: 'Anthropic API key',
    keyUrl: 'https://console.anthropic.com/',
    note: 'No free API tier — pay-per-token (a signup credit is often available). Best raw reasoning, priciest.',
    badge: 'paid',
    requireKey: true,
    defaultModel: 'claude-3-5-sonnet-latest',
    headers: {
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    models: [
      { id: 'claude-3-5-sonnet-latest', label: 'Claude 3.5 Sonnet', note: 'best reasoning' },
      { id: 'claude-3-5-haiku-latest', label: 'Claude 3.5 Haiku', note: 'cheap & fast' },
    ],
    fetchModelsList: async (apiKey) => {
      const res = await fetch('https://api.anthropic.com/v1/models', {
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      })
      if (!res.ok) throw new Error(`list models: ${res.status}`)
      const data = (await res.json()) as { data?: { id: string }[] }
      return (data.data ?? []).map((m) => ({ id: m.id, label: m.id }))
    },
  },
  {
    id: 'openai',
    label: 'OpenAI (GPT)',
    kind: 'openai',
    url: 'https://api.openai.com/v1/chat/completions',
    keyHint: 'OpenAI API key',
    keyUrl: 'https://platform.openai.com/api-keys',
    note: 'Pay-as-you-go, no free tier. Fine for testing; some regions block browser CORS.',
    requireKey: true,
    defaultModel: 'gpt-4o-mini',
    models: [
      { id: 'gpt-4o-mini', label: 'GPT-4o mini', note: 'cheapest GPT' },
      { id: 'gpt-4o', label: 'GPT-4o flagship' },
    ],
    fetchModelsList: async (apiKey) => {
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { authorization: `Bearer ${apiKey}` },
      })
      if (!res.ok) throw new Error(`list models: ${res.status}`)
      const data = (await res.json()) as { data?: { id: string }[] }
      return (data.data ?? [])
        .filter((m) => /^(gpt|o\d|chatgpt)/.test(m.id))
        .map((m) => ({ id: m.id, label: m.id }))
    },
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    kind: 'openai',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    keyHint: 'OpenRouter API key',
    keyUrl: 'https://openrouter.ai/keys',
    note: 'One key, many models — several `:free` models cost $0. Great buffet for experimenting.',
    badge: 'has free models',
    requireKey: true,
    defaultModel: 'meta-llama/llama-3.3-70b-instruct:free',
    models: [
      { id: 'meta-llama/llama-3.3-70b-instruct:free', label: 'Llama 3.3 70B :free', free: true },
      { id: 'google/gemma-2-9b-it:free', label: 'Gemma 2 9B :free', free: true },
      { id: 'qwen/qwen-2.5-72b-instruct:free', label: 'Qwen 2.5 72B :free', free: true },
    ],
    fetchModelsList: async (apiKey) => {
      const res = await fetch('https://openrouter.ai/api/v1/models', {
        headers: { authorization: `Bearer ${apiKey}` },
      })
      if (!res.ok) throw new Error(`list models: ${res.status}`)
      const data = (await res.json()) as {
        data?: { id: string; pricing?: { prompt?: string; completion?: string } }[]
      }
      return (data.data ?? [])
        .filter((m) => {
          const p = parseFloat(m.pricing?.prompt ?? '1')
          const c = parseFloat(m.pricing?.completion ?? '1')
          return p === 0 && c === 0
        })
        .slice(0, 40)
        .map((m) => ({ id: m.id, label: m.id, free: true }))
    },
  },
  {
    id: 'ollama',
    label: 'Local · Ollama',
    kind: 'openai',
    url: 'http://localhost:11434/v1/chat/completions',
    keyHint: 'No key — Ollama runs on your machine',
    note: 'Fully local and free: install Ollama, `ollama pull llama3.2`, and pick that model below. No signup, no upload, works offline.',
    badge: '100% free · offline · no key',
    requireKey: false,
    defaultModel: 'llama3.2',
    models: [
      { id: 'llama3.2', label: 'Llama 3.2 (huge for local)', free: true },
      { id: 'llama3.2:3b', label: 'Llama 3.2 3B (fastest)', free: true },
    ],
    fetchModelsList: async () => {
      const res = await fetch('http://localhost:11434/v1/models')
      if (!res.ok) throw new Error(`list models: ${res.status}`)
      const data = (await res.json()) as { data?: { id: string }[] }
      return (data.data ?? []).map((m) => ({ id: m.id, label: m.id, free: true }))
    },
  },
]

export function advisorProvider(id: string): AdvisorProvider {
  return ADVISOR_PROVIDERS.find((p) => p.id === id) ?? ADVISOR_PROVIDERS[0]
}

const modelCache = new Map<string, AdvisorModel[]>()

/**
 * Live model list for a provider — hits their API with the user's key and
 * parses what they actually serve. Falls back to the provider's hardcoded list
 * (no key yet, network/CORS failure, provider doesn't expose one).
 * Cached in-memory per (provider,key-prefix); cleared on reload, which is fine.
 */
export async function fetchAvailableModels(provider: AdvisorProvider, apiKey: string): Promise<AdvisorModel[]> {
  if (!provider.fetchModelsList) return provider.models
  const cacheKey = `${provider.id}:${apiKey.slice(0, 8)}`
  const cached = modelCache.get(cacheKey)
  if (cached) return cached
  try {
    const list = await provider.fetchModelsList(apiKey)
    if (list.length > 0) {
      modelCache.set(cacheKey, list)
      return list
    }
    return provider.models
  } catch {
    return provider.models
  }
}
