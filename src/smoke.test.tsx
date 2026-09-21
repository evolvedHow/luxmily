// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import App from './App'
import { useBudget } from './store/useBudget'

/**
 * A real mount, not an SSR string. renderToString runs the tree exactly once, so
 * it cannot see a render loop — which is precisely how an unmemoised zustand
 * selector shipped past the first version of this file.
 */

function resetStore() {
  useBudget.setState({
    initialized: false,
    incomeMonthly: 0,
    takeHome: 0,
    cohortId: 'c3',
    plan: {},
    locked: {},
  })
}

afterEach(() => {
  cleanup()
  localStorage.clear()
  resetStore()
})

async function onboard(income = 10000, cap = 6800) {
  render(<App />)
  fireEvent.change(screen.getByLabelText('Household income before tax per month'), { target: { value: income } })
  fireEvent.change(screen.getByLabelText('Take-home pay per month'), { target: { value: cap } })
  fireEvent.click(screen.getByText('Build my budget'))
}

describe('App — an optimizer, not a tracker', () => {
  it('asks for income and take-home before anything else', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<App />)
    expect(screen.getByText(/Build your budget/)).toBeTruthy()
    expect(screen.getByLabelText('Take-home pay per month')).toBeTruthy()
    expect(err).not.toHaveBeenCalled()
    err.mockRestore()
  })

  it('shows the cohort before building', () => {
    render(<App />)
    fireEvent.change(screen.getByLabelText('Household income before tax per month'), {
      target: { value: 10000 },
    })
    expect(screen.getByText(/\$110k – \$150k/)).toBeTruthy()
    expect(screen.getByText(/top ~22% of households by US household income/)).toBeTruthy()
  })

  it('localizes for a ZIP on onboarding and keeps income percentile + area on the cap card', async () => {
    render(<App />)
    fireEvent.change(screen.getByLabelText('Household income before tax per month'), { target: { value: 10000 } })
    fireEvent.change(screen.getByLabelText('Zip code (optional)'), { target: { value: '10001' } })
    expect(screen.getByText('New York City')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Take-home pay per month'), { target: { value: 6800 } })
    fireEvent.click(screen.getByText('Build my budget'))
    expect(screen.getByText(/top ~22% of households by US household income/)).toBeTruthy()
    expect(screen.getByText('New York City')).toBeTruthy()
    expect(screen.getByText(/≈140% of the local median income/)).toBeTruthy()
  })

  it('includes rideshare under Transportation', async () => {
    await onboard()
    expect(screen.getAllByText(/Rideshare \(Uber \/ Lyft\)/).length).toBeGreaterThan(0)
  })

  it('auto-fills take-home from income when left empty', () => {
    render(<App />)
    fireEvent.change(screen.getByLabelText('Household income before tax per month'), {
      target: { value: 10000 },
    })
    fireEvent.blur(screen.getByLabelText('Take-home pay per month'))
    expect((screen.getByLabelText('Take-home pay per month') as HTMLInputElement).value).toBe('7800')
  })

  it('builds a clean dashboard with pay-first strip and every theme, including Travel', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    await onboard()
    expect(screen.getByText(/Take-home · the Cap/)).toBeTruthy()
    expect(screen.getAllByText(/Pay yourself first/).length).toBeGreaterThan(0)
    // getAllByText: theme names appear on the theme card AND in the pII
    // weight table, which is expected — both are real renders of the name.
    expect(screen.getByText('Savings & Retirement')).toBeTruthy()
    expect(screen.getAllByText('Travel').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Housing').length).toBeGreaterThan(0)
    expect(useBudget.getState().initialized).toBe(true)
    expect(err).not.toHaveBeenCalled()
    err.mockRestore()
  })

  it('goes over cap — not over theme — and never rewrites the plan', async () => {
    await onboard()
    fireEvent.change(screen.getByLabelText('Groceries (food at home) plan'), {
      target: { value: 12000 },
    })
    expect(screen.getByText(/Over the cap/)).toBeTruthy()
    expect(screen.getByText(/asks for more than you take home/)).toBeTruthy()
    expect(useBudget.getState().plan['food.groceries']).toBe(12000)
  })

  it('frees trimmed money into the available-to-allocate bucket', async () => {
    await onboard()
    const before = useBudget.getState().plan['food.groceries']
    fireEvent.change(screen.getByLabelText('Groceries (food at home) plan'), { target: { value: 10 } })
    expect(screen.getByText(/Available to allocate/)).toBeTruthy()
    const bucket = screen.getByLabelText('Unallocated').textContent ?? ''
    expect(bucket).not.toBe('$0')
    expect(useBudget.getState().plan['food.groceries']).toBe(10)
    expect(before).toBeGreaterThan(10)
  })

  it('prorates a theme resize across its categories, in proportion', async () => {
    await onboard()
    const plan = () => useBudget.getState().plan
    const before = { ...plan() }
    const foodBefore = before['food.groceries'] + before['food.dining_out']

    // Halve the Food theme via its slider.
    const slider = screen.getByLabelText('Food share of cap') as HTMLInputElement
    const halved = Math.round((foodBefore / 2 / 6800) * 100)
    fireEvent.change(slider, { target: { value: String(halved) } })

    const after = plan()
    const foodAfter = after['food.groceries'] + after['food.dining_out']
    expect(foodAfter).toBeLessThan(foodBefore)
    // Each line keeps its share of the theme, within rounding.
    const ratioBefore = before['food.groceries'] / foodBefore
    const ratioAfter = after['food.groceries'] / foodAfter
    expect(Math.abs(ratioAfter - ratioBefore)).toBeLessThan(0.02)
    // Other themes are untouched — the delta went to the bucket.
    expect(after['housing.shelter']).toBe(before['housing.shelter'])
  })

  it('a locked category sits out the resize; the rest absorb it', async () => {
    await onboard()
    const plan = () => useBudget.getState().plan
    fireEvent.click(screen.getByLabelText('Lock Groceries (food at home)'))
    const before = { ...plan() }

    const slider = screen.getByLabelText('Food share of cap') as HTMLInputElement
    const target = Math.round(((before['food.groceries'] + before['food.dining_out'] + 400) / 6800) * 100)
    fireEvent.change(slider, { target: { value: String(target) } })

    const after = plan()
    expect(after['food.groceries']).toBe(before['food.groceries']) // pinned
    expect(after['food.dining_out']).toBeGreaterThan(before['food.dining_out']) // absorbed it
  })

  it('locking a category disables its input', async () => {
    await onboard()
    fireEvent.click(screen.getByLabelText('Lock Groceries (food at home)'))
    expect((screen.getByLabelText('Groceries (food at home) plan') as HTMLInputElement).disabled).toBe(true)
  })

  it('resets one theme to its benchmark seeding, leaving others alone', async () => {
    await onboard()
    const plan = () => useBudget.getState().plan
    const pristine = { ...plan() }
    fireEvent.change(screen.getByLabelText('Groceries (food at home) plan'), { target: { value: 4321 } })
    fireEvent.change(screen.getByLabelText('Gasoline plan'), { target: { value: 1234 } })

    fireEvent.click(screen.getByLabelText('Reset Food to benchmark'))
    expect(plan()['food.groceries']).toBe(pristine['food.groceries'])
    expect(plan()['transport.gas']).toBe(1234) // untouched by a Food reset
  })

  it('sweeps the available bucket into the emergency buffer', async () => {
    await onboard()
    fireEvent.change(screen.getByLabelText('Groceries (food at home) plan'), { target: { value: 10 } })
    const emergencyBefore = useBudget.getState().plan['savings.emergency']

    fireEvent.click(screen.getByLabelText('Sweep available cash to emergency buffer'))
    expect(useBudget.getState().plan['savings.emergency']).toBeGreaterThan(emergencyBefore)
    // Everything is now assigned.
    expect(screen.getByLabelText('Unallocated').textContent).toBe('$0')
  })

  it('has no viewpoint toggle — there is one view now', async () => {
    await onboard()
    expect(screen.queryByRole('button', { name: 'View: Top-down' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'View: Planned' })).toBeNull()
  })

  it('never shows an observed/actual view — optimizer only', async () => {
    await onboard()
    expect(screen.queryByRole('button', { name: 'View: Observed' })).toBeNull()
  })

  it('shows pII against the headline CPI, and explains the math on demand', async () => {
    await onboard()
    // Rendered on both the dashboard card and the print sheet — hence getAll.
    expect(screen.getAllByText(/personal Inflation index/).length).toBeGreaterThan(0)
    expect(screen.getByLabelText('pII rate').textContent).toMatch(/%$/)
    expect(screen.getAllByText(/headline CPI-U/).length).toBeGreaterThan(0)

    fireEvent.click(screen.getByLabelText('How pII is calculated'))
    expect(screen.getByText('How pII works')).toBeTruthy()
    expect(screen.getByText(/Weight by your dollars, not the nation's/)).toBeTruthy()
    expect(screen.getByText(/Drop savings from the basket/)).toBeTruthy()
    // The formula is the point of the sheet — it must actually be on screen.
    // It renders with <sub> tags, so match on assembled textContent.
    expect(
      screen.getAllByText((_t, el) => (el?.textContent ?? '').includes('pII = Σ')).length,
    ).toBeGreaterThan(0)
  })

  it('reweights pII when the allocation changes — same rates, different basket', async () => {
    await onboard()
    const readRate = () => screen.getByLabelText('pII rate').textContent ?? ''
    const before = readRate()
    // Pour money into Gasoline, the fastest-rising line in the snapshot.
    fireEvent.change(screen.getByLabelText('Gasoline plan'), { target: { value: 4000 } })
    expect(readRate()).not.toBe(before)
  })

  it('resets back to the benchmark baseline', async () => {
    await onboard()
    fireEvent.change(screen.getByLabelText('Groceries (food at home) plan'), {
      target: { value: 12000 },
    })
    expect(useBudget.getState().plan['food.groceries']).toBe(12000)
    fireEvent.click(screen.getByLabelText('Reset to baseline'))
    expect(useBudget.getState().plan['food.groceries']).toBeLessThan(12000)
  })

  it('exposes the export menu', async () => {
    await onboard()
    fireEvent.click(screen.getByLabelText('Export budget'))
    expect(screen.getByText(/Download CSV/)).toBeTruthy()
    expect(screen.getByText(/Print \/ PDF/)).toBeTruthy()
  })

  it('opens the About sheet and shows the philosophy + cohort standing', async () => {
    await onboard()
    fireEvent.click(screen.getByLabelText('About'))
    expect(screen.getByText(/how the optimizer thinks/)).toBeTruthy()
    expect(screen.getByText(/Top-down, not bottom-up/)).toBeTruthy()
    expect(screen.getByText(/No credit-card debt/)).toBeTruthy()
    expect(screen.getByText(/Where you stand/)).toBeTruthy()
    expect(screen.getAllByText(/top ~22% of households/).length).toBeGreaterThan(0)
    expect(screen.getByText(/Top 1%/)).toBeTruthy()
  })
})