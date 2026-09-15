import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { advisorDefaultModel } from '../advisor/config'
import { ADVISOR_PROVIDERS, advisorProvider } from '../advisor/providers'

/**
 * Advisor settings: which provider/model/key the user typed. Persisted to
 * localStorage (key: luxmily-advisor-v1) so the key stays in their browser —
 * Luxmi is called directly, nothing is proxied.
 */

interface AdvisorState {
  providerId: string
  modelId: string
  /** Free-text model id typed in the UI — wins over modelId when non-empty. */
  customModel: string
  apiKey: string
  /** Optional base URL override (e.g. self-hosted OpenAI-compat servers). */
  baseUrl: string
  setProvider: (id: string) => void
  setModel: (id: string) => void
  setCustomModel: (id: string) => void
  setApiKey: (key: string) => void
  setBaseUrl: (url: string) => void
}

const first = ADVISOR_PROVIDERS[0]

/** The model to send for a provider: private YAML override, else the registry default. */
export function defaultModelFor(providerId: string): string {
  const p = advisorProvider(providerId)
  return advisorDefaultModel(providerId) ?? p.defaultModel
}

/** Whatever is actually POSTed: a typed custom id always wins, else the picker. */
export function effectiveModelId(providerId: string, modelId: string, customModel: string): string {
  return customModel.trim() || (modelId === '__custom' ? '' : modelId) || defaultModelFor(providerId)
}

export const useAdvisor = create<AdvisorState>()(
  persist(
    (set) => ({
      providerId: first.id,
      modelId: defaultModelFor(first.id),
      customModel: '',
      apiKey: '',
      baseUrl: '',

      // Switching provider must also drop a stale base URL override — an
      // override left over from another provider is the classic 405/404/
      // network-error source (the request goes to the wrong host or path).
      // The custom model id is cleared too, for the same reason.
      setProvider: (providerId) => {
        set({ providerId, modelId: defaultModelFor(providerId), customModel: '', baseUrl: '' })
      },
      setModel: (modelId) => set({ modelId }),
      setCustomModel: (customModel) => set({ customModel }),
      setApiKey: (apiKey) => set({ apiKey }),
      setBaseUrl: (baseUrl) => set({ baseUrl }),
    }),
    {
      name: 'luxmily-advisor-v1',
    },
  ),
)