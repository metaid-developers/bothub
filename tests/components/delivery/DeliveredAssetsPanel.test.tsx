import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DeliveredAssetsPanel } from '@/components/delivery/DeliveredAssetsPanel'
import type { DeliveryAssetRecord } from '@/delivery/domain'
import type { DeliveryMessage } from '@/delivery/messageStore'

function message(content: string, id = content): DeliveryMessage {
  return {
    id,
    peerGlobalMetaId: 'provider',
    fromGlobalMetaId: 'provider',
    toGlobalMetaId: 'self',
    content,
    rawContent: content,
    encryption: 'none',
    contentType: 'text/plain',
    timestamp: 1,
  }
}

describe('DeliveredAssetsPanel', () => {
  it('shows an empty state before assets are delivered', () => {
    render(<DeliveredAssetsPanel messages={[]} />)

    expect(screen.getByText('还没有收到成果')).toBeInTheDocument()
  })

  it('groups delivered assets by kind and renders preview cards once per asset', () => {
    render(
      <DeliveredAssetsPanel
        messages={[
          message(
            '[DELIVERY:order-1] {"result":"Ready","assets":["metafile://image.png","metafile://clip.mp4","metafile://voice.mp3","metafile://brief.pdf","metafile://image.png"]}',
            'delivery-1',
          ),
        ]}
      />,
    )

    const panel = screen.getByRole('complementary', { name: '交付成果' })
    expect(within(panel).getByText('4 个成果')).toBeInTheDocument()
    expect(within(panel).getByText('图片 1')).toBeInTheDocument()
    expect(within(panel).getByText('视频 1')).toBeInTheDocument()
    expect(within(panel).getByText('音频 1')).toBeInTheDocument()
    expect(within(panel).getByText('文档 1')).toBeInTheDocument()
    expect(within(panel).getByRole('img', { name: 'image.png' })).toBeInTheDocument()
    expect(panel.querySelector('video')).toBeInTheDocument()
    expect(panel.querySelector('audio')).toBeInTheDocument()
    expect(within(panel).getAllByRole('link', { name: '下载' })).toHaveLength(4)
  })

  it('hydrates stored assets for a selected session without live messages', () => {
    const storedAssets: DeliveryAssetRecord[] = [
      {
        id: 'self:provider:order-1:metafile://persisted.png',
        walletGlobalMetaId: 'self',
        sessionId: 'self:provider:order-1',
        messageId: 'delivery-1',
        orderCorrelationId: 'order-1',
        uri: 'metafile://persisted.png',
        pinId: 'persisted',
        filename: 'persisted.png',
        extension: 'png',
        kind: 'image',
        mimeType: 'image/png',
        previewUrl:
          'https://file.metaid.io/metafile-indexer/api/v1/files/accelerate/content/persisted',
        downloadUrl:
          'https://file.metaid.io/metafile-indexer/api/v1/files/accelerate/content/persisted',
        fallbackUrl:
          'https://file.metaid.io/metafile-indexer/api/v1/files/content/persisted',
        createdAt: 1,
      },
    ]

    render(<DeliveredAssetsPanel messages={[]} storedAssets={storedAssets} />)

    const panel = screen.getByRole('complementary', { name: '交付成果' })
    expect(within(panel).getByText('1 个成果')).toBeInTheDocument()
    expect(within(panel).getByRole('img', { name: 'persisted.png' })).toBeInTheDocument()
  })
})
