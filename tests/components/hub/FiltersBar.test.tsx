import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { useState } from 'react'
import { FiltersBar } from '@/components/hub/FiltersBar'
import { defaultHubFilters, type HubFilters } from '@/components/hub/filters'

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

    const search = screen.getByRole('searchbox', { name: '搜索服务' })
    fireEvent.change(search, { target: { value: 'fortune' } })

    expect(onChange).not.toHaveBeenCalledWith(
      expect.objectContaining({ keyword: 'fortune' }),
    )

    vi.advanceTimersByTime(300)

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ keyword: 'fortune' }),
    )
  })

  it('updates payment type and sort immediately', () => {
    const onChange = vi.fn()
    render(<ControlledFiltersHarness onChange={onChange} />)

    const paymentType = screen.getByLabelText('支付类型')
    expect(within(paymentType).getByRole('option', { name: '免费' })).toBeInTheDocument()
    expect(within(paymentType).queryByRole('option', { name: '全部币种' })).not.toBeInTheDocument()

    fireEvent.change(paymentType, { target: { value: 'BTC' } })
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ currency: 'BTC', freeOnly: false }),
    )

    fireEvent.change(paymentType, { target: { value: 'free' } })
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ currency: '', freeOnly: true }),
    )

    fireEvent.change(screen.getByLabelText('服务排序'), {
      target: { value: 'updated:desc' },
    })
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ sortBy: 'updated', order: 'desc' }),
    )
  })
})
