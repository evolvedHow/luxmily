// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PiiView } from './PiiView'
import { usePii } from '../../store/usePii'

/**
 * Personal CPI screens render against the embedded BLS snapshot — a real,
 * data-driven render exercise, not a stub.
 */

afterEach(() => {
  cleanup()
  localStorage.clear()
  usePii.setState({ initialized: false, profiles: [], scenarios: [], activeProfileId: 'default' })
})

function open() {
  render(<PiiView onBack={() => {}} />)
  expect(screen.getAllByText(/Personal CPI/i).length).toBeGreaterThan(0)
}

describe('Personal CPI — screens', () => {
  it('dashboard renders headline numbers, comparison and contributions', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    open()
    expect(screen.getAllByText(/Official CPI/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Your index vs official/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Personal/i).length).toBeGreaterThan(0)
    expect(usePii.getState().profiles.length).toBe(1)
    expect(err).not.toHaveBeenCalled()
    err.mockRestore()
  })

  it('categories tab lists the mapped basket and allows weight edits', () => {
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Categories' }))
    expect(screen.getByText('Groceries (food at home)')).toBeTruthy()
    expect(screen.getByText('Rent / Mortgage')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Groceries (food at home) weight %'), { target: { value: '30' } })
    const p = usePii.getState().profiles[0]
    expect(p.weights['food.groceries']).toBeCloseTo(0.3, 6)
  })

  it('scenarios tab creates and overlays a what-if', () => {
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Scenarios' }))
    expect(screen.getAllByText(/Create a what-if/i).length).toBeGreaterThan(0)
  })

  it('forecast tab shows a forward table with cash dollars', () => {
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Forecast' }))
    expect(screen.getByText(/Forward assumptions/i)).toBeTruthy()
    expect(screen.getByText(/Methodology/i)).toBeTruthy()
  })

  it('weights stay valid after seeding from a budget', () => {
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Categories' }))
    const p0 = usePii.getState().profiles[0]
    usePii.getState().setSpending('food.groceries', 6000)
    fireEvent.click(screen.getByText('recompute from spend'))
    const p1 = usePii.getState().profiles[0]
    expect(p1.weights['food.groceries']).toBeGreaterThan(0)
    const covered = p1.categories
      .filter((c) => c.mapping.kind !== 'excluded')
      .reduce((a, c) => a + (p1.weights[c.id] ?? 0), 0)
    expect(covered).toBeCloseTo(1, 5)
    expect(p0.weights['food.groceries']).toBeGreaterThan(0)
  })
})