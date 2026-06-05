import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import type { SkillServiceListItem } from '@/api/aggregator.types'
import { OnlineBotsSidebar } from '@/components/hub/OnlineBotsSidebar'
import listFixture from '@/mocks/aggregator/list.json'

const service = listFixture.data!.list[0] as SkillServiceListItem

function LocationProbe() {
  const location = useLocation()
  return <p data-testid="location">{`${location.pathname}${location.search}`}</p>
}

describe('OnlineBotsSidebar', () => {
  it('opens Delivery on the selected bot conversation from the private chat icon', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <OnlineBotsSidebar services={[service]} />
        <LocationProbe />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: `私聊 ${service.providerName}` }))

    expect(screen.getByTestId('location')).toHaveTextContent(
      `/delivery?session=${encodeURIComponent(service.providerGlobalMetaId)}`,
    )
  })
})
