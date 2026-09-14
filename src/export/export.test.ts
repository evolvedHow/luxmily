import { describe, expect, it } from 'vitest'
import { buildBudget, scaffold } from '../engine/model'
import { resolve } from '../engine/resolve'
import { toCSV, toExport, toJSON } from './export'

function sample() {
  const sc = scaffold(6800, 10000, 'c4')
  const b = buildBudget({ incomeMonthly: 10000, takeHome: 6800, cohortId: 'c4', ...sc })
  const food = b.themes.find((t) => t.id === 'food')!
  food.cats[0].observed = 300
  return resolve(b)
}

describe('toExport', () => {
  it('produces a stable flat model', () => {
    const x = toExport(sample())
    expect(x.app).toBe('Luxmi.ly')
    expect(x.meta.takeHome).toBe(6800)
    expect(x.meta.cohortId).toBe('c4')
    expect(x.themes.length).toBeGreaterThan(6)
    expect(x.payYourselfFirst.length).toBeGreaterThan(0)
    expect(x.themes.map((t) => t.id)).toContain('travel')
    expect(x.meta.totalObserved).toBe(300)
    expect(x.themes.find((t) => t.id === 'food')!.cats[0].surplus).toBeGreaterThan(0)
  })
})

describe('toCSV', () => {
  it('renders titles, cohort, and every theme + category row', () => {
    const csv = toCSV(sample())
    expect(csv).toContain('Luxmi.ly')
    expect(csv).toContain('$110k – $150k')
    expect(csv).toContain('Housing')
    expect(csv).toContain('shelter')
    expect(csv).toContain('Observed % of cap')
  })

  it('leaves no undefined in the output', () => {
    expect(toCSV(sample())).not.toContain('undefined')
  })
})

describe('toJSON', () => {
  it('round-trips the key numbers', () => {
    const json = JSON.parse(toJSON(sample()))
    expect(json.meta.takeHome).toBe(6800)
    expect(json.meta.ok).toBe(true)
    expect(json.meta.totalReallocatable).toBeGreaterThan(0)
    expect((json.themes as { id: string }[]).find((t) => t.id === 'travel')).toBeTruthy()
  })
})