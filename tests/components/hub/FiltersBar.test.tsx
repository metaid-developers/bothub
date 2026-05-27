import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { useState } from 'react'
import { defaultHubFilters, FiltersBar, type HubFilters } from '@/components/hub/FiltersBar'

function ControlledFiltersHarness({
  onChange,
}: {
  onChange: (filters: HubFilters) => void
}) {
  const [value, setValue] = useState<HubFilters>(defaultHubFilters)
  return (
    <FiltersBar
      value={value}
      onChange={(next) => {
        setValue(next)
        onChange(next)
      }}
    />
  )
}

describe('FiltersBar', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('debounces keyword changes before calling onChange', () => {
    const onChange = vi.fn()
    render(<ControlledFiltersHarness onChange={onChange} />)

    const search = screen.getByRole('searchbox', { name: /search services/i })
    fireEvent.change(search, { target: { value: 'fortune' } })

    expect(onChange).not.toHaveBeenCalledWith(
      expect.objectContaining({ keyword: 'fortune' }),
    )

    vi.advanceTimersByTime(300)

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ keyword: 'fortune' }),
    )
  })

  it('updates currency and sort immediately', () => {
    const onChange = vi.fn()
    render(<ControlledFiltersHarness onChange={onChange} />)

    fireEvent.change(screen.getByLabelText('Currency filter'), { target: { value: 'BTC' } })
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ currency: 'BTC' }),
    )

    fireEvent.change(screen.getByLabelText('Sort services'), {
      target: { value: 'updated:desc' },
    })
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ sortBy: 'updated', order: 'desc' }),
    )
  })
})
