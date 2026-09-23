import { describe, expect, it } from 'vitest'
import { prorate, type ProrateItem } from './prorate'

const items = (...xs: [string, number, boolean?][]): ProrateItem[] =>
  xs.map(([id, value, locked]) => ({ id, value, locked: !!locked }))

const sum = (v: Record<string, number>) => Object.values(v).reduce((s, n) => s + n, 0)

describe('prorate', () => {
  it('splits a delta in proportion to what each line already holds', () => {
    // The worked example: Housing 2970, Rent 1609 (54%) → +300 puts ~162 on Rent.
    const r = prorate(items(['rent', 1609], ['utilities', 800], ['maint', 400], ['ins', 161]), 3270)
    expect(r.total).toBe(3270)
    expect(r.value.rent).toBe(Math.round(1609 * (3270 / 2970)))
    // Every line keeps its share of the theme.
    expect(r.value.rent / r.total).toBeCloseTo(1609 / 2970, 3)
  })

  it('holds locked lines fixed and puts the whole delta on the rest', () => {
    const r = prorate(items(['a', 500, true], ['b', 300], ['c', 200]), 1200)
    expect(r.value.a).toBe(500) // untouched
    expect(r.value.b + r.value.c).toBe(700) // absorbed all +200
    expect(r.value.b / r.value.c).toBeCloseTo(300 / 200, 1) // still proportional
    expect(r.total).toBe(1200)
  })

  it('treats the locked subtotal as a hard floor', () => {
    // Rent is locked at 1600, so the theme cannot be dragged down to 500.
    const r = prorate(items(['rent', 1600, true], ['food', 400]), 500)
    expect(r.total).toBe(1600)
    expect(r.value.rent).toBe(1600)
    expect(r.value.food).toBe(0)
    expect(r.unapplied).toBe(500 - 1600) // the caller is told it could not comply
  })

  it('cannot move at all when everything is locked', () => {
    const r = prorate(items(['a', 500, true], ['b', 300, true]), 2000)
    expect(r.value).toEqual({ a: 500, b: 300 })
    expect(r.total).toBe(800)
    expect(r.unapplied).toBe(1200)
  })

  it('never drives a line negative', () => {
    const r = prorate(items(['a', 100], ['b', 50]), 0)
    expect(r.value.a).toBe(0)
    expect(r.value.b).toBe(0)
    expect(r.total).toBe(0)
  })

  it('revives a bucket of zeroes by splitting evenly', () => {
    // No proportions to preserve — weight-proportional would leave them at 0.
    const r = prorate(items(['a', 0], ['b', 0], ['c', 0]), 300)
    expect(r.value).toEqual({ a: 100, b: 100, c: 100 })
  })

  it('lands exactly on the target despite whole-dollar rounding', () => {
    // 3 lines into 1000 does not divide cleanly; drift must not leak.
    for (const target of [1000, 999, 1, 7777]) {
      const r = prorate(items(['a', 333], ['b', 333], ['c', 334]), target)
      expect(sum(r.value)).toBe(target)
      expect(r.total).toBe(target)
      expect(r.unapplied).toBe(0)
    }
  })

  it('is stable: re-applying the current total changes nothing', () => {
    const before = items(['a', 1609], ['b', 800], ['c', 561])
    const r = prorate(before, 2970)
    expect(r.value).toEqual({ a: 1609, b: 800, c: 561 })
  })

  it('round-trips a resize back to the original within rounding', () => {
    const start = items(['a', 1609], ['b', 800], ['c', 561])
    const up = prorate(start, 4000)
    const back = prorate(
      start.map((i) => ({ ...i, value: up.value[i.id] })),
      2970,
    )
    expect(back.total).toBe(2970)
    for (const i of start) expect(Math.abs(back.value[i.id] - i.value)).toBeLessThanOrEqual(2)
  })
})
