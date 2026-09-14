import { describe, expect, it } from 'vitest'
import { buildBudget, scaffold } from '../engine/model'
import { resolve } from '../engine/resolve'
import { toCSV, toExport, toJSON } from './export'

function sample() {
  const sc = scaffold(6800, 10000, 'c4')
  const b = buildBudget({ incomeMonthly: 10000, takeHome: 6800, cohortId: 'c4', ...sc })
  return resolve(b, 15, 30)
}

describe('toExport', () => {
  it('produces a stable flat model', () => {
    const x = toExport(sample())
    expect(x.app).toMatch(/^LuxMily Budget/)
    expect(x.meta.takeHome).toBe(6800)
    expect(x.meta.cohortId).toBe('c4')
    expect(x.themes.length).toBeGreaterThan(5)
    expect(x.payYourselfFirst.length).toBeGreaterThan(0)
    expect(x.themes[0].cats.length).toBeGreaterThan(0)
    expect(x.totals.planOver).toBe(0)
  })
})

describe('toCSV', () => {
  it('renders titles, cohort, and every theme + category row', () => {
    const csv = toCSV(sample())
    expect(csv).toContain('LuxMily Budget Optima')
    expect(csv).toContain('$110k – $150k')
    expect(csv).toContain('Housing')
    expect(csv).toContain('shelter')
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
  })
})