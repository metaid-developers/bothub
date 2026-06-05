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
        `评分 ${fortuneService.ratingAvg.toFixed(1)}，${fortuneService.ratingCount} 条评价`,
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '下单请求' })).toBeDisabled()
    const icon = document.querySelector(`img[src="${fortuneService.serviceIcon}"]`)
    expect(icon).not.toBeNull()
  })

  it('falls back when provider name is missing', () => {
    const anon = listFixture.data!.list[1] as SkillServiceListItem
    render(<ServiceCard service={anon} />)
    expect(screen.getByText('未知服务方')).toBeInTheDocument()
  })

  it('enables the request action when an explicit request handler exists', () => {
    const onRequest = vi.fn()
    const onSelect = vi.fn()
    render(
      <ServiceCard
        service={fortuneService}
        onSelect={onSelect}
        onRequest={onRequest}
      />,
    )

    const button = screen.getByRole('button', { name: '下单请求' })
    expect(button).toBeEnabled()

    fireEvent.click(button)

    expect(onRequest).toHaveBeenCalledWith(fortuneService)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('renders free services with a request-only action and no zero price', () => {
    render(
      <ServiceCard
        service={{
          ...fortuneService,
          price: '0',
          currency: 'BTC',
        }}
      />,
    )

    expect(screen.getByText('免费')).toBeInTheDocument()
    expect(screen.queryByText('0')).not.toBeInTheDocument()
    expect(screen.queryByText('BTC')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '请求' })).toBeDisabled()
  })
})
