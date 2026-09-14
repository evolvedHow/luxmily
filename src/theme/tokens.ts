export const C = {
  bg: '#131315',
  surface: '#1E1F22',
  border: '#2A2B30',
  earn: '#8FA89B',
  live: '#D9A07E',
  save: '#7F94A6',
  text: '#ECEAE6',
  muted: '#8E8B85',
  tension: '#C8964F',
  /** Overspend / over-allocation — the number has crossed its line. */
  red: '#DE6B5C',
  /** Within the line — balanced. */
  green: '#7FA98A',
  /** Your allocation accent. */
  cap: '#D9A07E',
} as const

/** Spring curve used for every transition in the app. */
export const SPRING = { type: 'spring', stiffness: 300, damping: 30 } as const

export const LOCK_LABEL: Record<string, string> = {
  hard: 'Hard Lock',
  floor: 'Floor',
  ceiling: 'Ceiling',
  elastic: 'Elastic',
}

export function money(n: number, decimals = 0): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

export function pct(n: number, decimals = 1): string {
  return `${(n * 100).toFixed(decimals)}%`
}