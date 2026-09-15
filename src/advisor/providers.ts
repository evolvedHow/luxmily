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
  models: AdvisorModel[]
  defaultModel: string
  headers?: Record<string, string>
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
    defaultModel: 'llama-3.3-70b-versatile',
    models: [
      { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B (fast, apt)', free: true },
      { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B (snappiest)', free: true },
      { id: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B (OpenAI Open Model)', free: true },
    ],
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
      { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash', free: true },
      { id: 'gemini-3.1-pro', label: 'Gemini 3.1 Pro', free: true },
    ],
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
      { id: 'mistral', label: 'Mistral 7B', free: true },
      { id: 'qwen2.5:7b', label: 'Qwen 2.5 7B', free: true },
    ],
  },
]

export function advisorProvider(id: string): AdvisorProvider {
  return ADVISOR_PROVIDERS.find((p) => p.id === id) ?? ADVISOR_PROVIDERS[0]
}
