import { describe, expect, it } from 'vitest'
import { locationForZip } from '../data/metro-cola'

describe('locationForZip — ZIP → area', () => {
  it('resolves major metros by exact ZIP3', () => {
    expect(locationForZip('10001')?.metro).toBe('New York City')
    expect(locationForZip('94107')?.metro).toBe('San Francisco Bay Area')
    expect(locationForZip('30064')?.metro).toBe('Atlanta metro')
    expect(locationForZip('30308')?.metro).toBe('Atlanta metro')
  })

  it('applies the rent factor to high-rent metros (NYC rent >> Marietta)', () => {
    const nyc = locationForZip('10001')!
    const atl = locationForZip('30064')!
    expect(nyc.rentFactor).toBeGreaterThan(atl.rentFactor)
    expect(nyc.cola).toBeGreaterThan(atl.cola)
  })

  it('falls back to a broad regional table for any valid ZIP', () => {
    const midwest = locationForZip('59937')!
    expect(midwest.matched).toBe(true)
    expect(midwest.cola).toBeGreaterThan(0)
    expect(midwest.rentFactor).toBeGreaterThan(0)
  })

  it('ignores formatting and long inputs, taking the first 5 digits', () => {
    expect(locationForZip('10001-1234')?.zip).toBe('10001')
    expect(locationForZip(' 30064 ')).not.toBeNull()
  })

  it('returns null until there are 5 digits', () => {
    expect(locationForZip('')).toBeNull()
    expect(locationForZip('1')).toBeNull()
    expect(locationForZip('abc')).toBeNull()
    expect(locationForZip('3006')).toBeNull()
  })
})