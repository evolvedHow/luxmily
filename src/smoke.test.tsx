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
    view: 'top-down',
    share: {},
    plan: {},
    catLock: {},
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
    expect(screen.getByText('Savings & Retirement')).toBeTruthy()
    expect(screen.getByText('Travel')).toBeTruthy()
    expect(screen.getByText('Housing')).toBeTruthy()
    expect(useBudget.getState().initialized).toBe(true)
    expect(err).not.toHaveBeenCalled()
    err.mockRestore()
  })

  it('turns a theme red when a category plan overruns its allocation', async () => {
    await onboard()
    fireEvent.change(screen.getByLabelText('Groceries (food at home) plan'), {
      target: { value: 12000 },
    })
    expect(screen.getByText(/Plans exceed this theme/)).toBeTruthy()
    expect(useBudget.getState().plan['food.groceries']).toBe(12000)
  })

  it('never shows an observed/actual view — optimizer only', async () => {
    await onboard()
    expect(screen.queryByRole('button', { name: 'View: Observed' })).toBeNull()
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