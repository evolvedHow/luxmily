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
  apiKey: string
  /** Optional base URL override (e.g. self-hosted OpenAI-compat servers). */
  baseUrl: string
  setProvider: (id: string) => void
  setModel: (id: string) => void
  setApiKey: (key: string) => void
  setBaseUrl: (url: string) => void
}

const first = ADVISOR_PROVIDERS[0]

function defaultModel(providerId: string): string {
  const p = advisorProvider(providerId)
  return advisorDefaultModel(providerId) ?? p.defaultModel
}

export const useAdvisor = create<AdvisorState>()(
  persist(
    (set) => ({
      providerId: first.id,
      modelId: defaultModel(first.id),
      apiKey: '',
      baseUrl: '',

      setProvider: (providerId) => {
        set({ providerId, modelId: defaultModel(providerId) })
      },
      setModel: (modelId) => set({ modelId }),
      setApiKey: (apiKey) => set({ apiKey }),
      setBaseUrl: (baseUrl) => set({ baseUrl }),
    }),
    {
      name: 'luxmily-advisor-v1',
    },
  ),
)