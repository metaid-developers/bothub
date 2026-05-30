import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SessionHeader } from '@/components/delivery/SessionHeader'

describe('SessionHeader', () => {
  it('renders provider, service, and status for the selected session', () => {
    render(
      <SessionHeader
        session={{
          peerGlobalMetaId: 'idq1abcdefghijklmnop',
          peerName: 'Provider Bot',
          peerAvatarUrl: 'https://cdn.example/provider.png',
          serviceLabel: 'Image Render',
          status: 'delivered',
        }}
      />,
    )

    expect(screen.getByText('Provider Bot')).toBeInTheDocument()
    expect(screen.getByText('idq1ab…mnop')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Provider Bot avatar' })).toHaveAttribute(
      'src',
      'https://cdn.example/provider.png',
    )
    expect(screen.getByText('Image Render')).toBeInTheDocument()
    expect(screen.getByText('Delivered')).toBeInTheDocument()
  })

  it('uses a stable fallback avatar when profile media is missing', () => {
    render(
      <SessionHeader
        session={{
          peerGlobalMetaId: 'idq1abcdefghijklmnop',
          serviceLabel: 'Image Render',
          status: 'active',
        }}
      />,
    )

    expect(screen.getByLabelText('idq1ab…mnop avatar')).toHaveTextContent('I')
  })

  it('keeps the empty selected state useful', () => {
    render(<SessionHeader session={null} />)

    expect(screen.getByRole('status', { name: 'No delivery session selected' })).toBeInTheDocument()
    expect(screen.getByText('Choose a session to inspect provider status and delivered assets.')).toBeInTheDocument()
  })
})
