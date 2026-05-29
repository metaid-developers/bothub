import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { SkillServiceListItem } from '@/api/aggregator.types'
import { ServiceCard } from '@/components/hub/ServiceCard'
import listFixture from '@/mocks/aggregator/list.json'

const fortuneService = (listFixture.data!.list[0] ?? null) as SkillServiceListItem

describe('ServiceCard', () => {
  it('renders designed fields from a list fixture item', () => {
    render(<ServiceCard service={fortuneService} />)

    expect(screen.getByRole('heading', { name: fortuneService.displayName })).toBeInTheDocument()
    expect(screen.getByText(fortuneService.description)).toBeInTheDocument()
    expect(screen.getByText(fortuneService.serviceName)).toBeInTheDocument()
    expect(screen.getByText(fortuneService.providerSkill)).toBeInTheDocument()
    expect(screen.getByText(fortuneService.providerName!)).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('SPACE')).toBeInTheDocument()
    expect(
      screen.getByLabelText(
        `Rating ${fortuneService.ratingAvg.toFixed(1)} from ${fortuneService.ratingCount} reviews`,
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pay & Request' })).toBeDisabled()
    const icon = document.querySelector(`img[src="${fortuneService.serviceIcon}"]`)
    expect(icon).not.toBeNull()
  })

  it('falls back when provider name is missing', () => {
    const anon = listFixture.data!.list[1] as SkillServiceListItem
    render(<ServiceCard service={anon} />)
    expect(screen.getByText('Unknown Bot')).toBeInTheDocument()
  })

  it('enables Pay & Request when an explicit request handler exists', () => {
    const onRequest = vi.fn()
    const onSelect = vi.fn()
    render(
      <ServiceCard
        service={fortuneService}
        onSelect={onSelect}
        onRequest={onRequest}
      />,
    )

    const button = screen.getByRole('button', { name: 'Pay & Request' })
    expect(button).toBeEnabled()

    fireEvent.click(button)

    expect(onRequest).toHaveBeenCalledWith(fortuneService)
    expect(onSelect).not.toHaveBeenCalled()
  })
})
