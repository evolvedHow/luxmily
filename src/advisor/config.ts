import { load } from 'js-yaml'
import raw from './luxmi.yaml?raw'

/**
 * Typed loader for the PRIVATE advisor config in luxmi.yaml. The YAML is
 * imported as raw text at build time and parsed once here — it is never
 * shown or edited in the app UI. Values fall back to safe defaults so a
 * typo in the YAML degrades gracefully instead of crashing the bundle.
 */

export interface LuxmiConfig {
  system: string
  temperature: number
  max_tokens: number
}

function asRecord(v: unknown): Record<string, unknown> {
  return typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {}
}

function asNumber(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

function asString(v: unknown, fallback: string): string {
  return typeof v === 'string' ? v : fallback
}

export function loadLuxmiConfig(): LuxmiConfig {
  const doc = asRecord(
    (() => {
      try {
        return load(raw)
      } catch {
        return {}
      }
    })(),
  )

  return {
    system: asString(doc.system, 'You are Luxmi — a warm, practical budget advisor.'),
    temperature: asNumber(doc.temperature, 0.4),
    max_tokens: Math.max(1, Math.round(asNumber(doc.max_tokens, 1600))),
  }
}

export const LUXMI_CONFIG = loadLuxmiConfig()

/** The private system prompt, straight from the YAML. */
export function advisorSystem(): string {
  return LUXMI_CONFIG.system
}

/** Generation params from the YAML — shared by every request. */
export function advisorParams(): { temperature: number; max_tokens: number } {
  return { temperature: LUXMI_CONFIG.temperature, max_tokens: LUXMI_CONFIG.max_tokens }
}
