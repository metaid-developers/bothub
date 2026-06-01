import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DeliveryAssetLibrary } from '@/components/delivery/DeliveryAssetLibrary'
import type { ParsedDeliveryAsset } from '@/delivery/assetParser'

function asset(overrides: Partial<ParsedDeliveryAsset> = {}): ParsedDeliveryAsset {
  const kind = overrides.kind ?? 'image'
  const extension = overrides.extension ?? '.png'
  const filename = overrides.filename ?? `asset${extension}`
  return {
    uri: `metafile://asset${extension}`,
    pinId: `asset-${kind}`,
    extension,
    filename,
    kind,
    mimeType: overrides.mimeType,
    previewUrl: `https://preview.example/${filename}`,
    downloadUrl: `https://download.example/${filename}`,
    fallbackUrl: `https://fallback.example/${filename}`,
    ...overrides,
  }
}

describe('DeliveryAssetLibrary', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
  })

  it('groups and filters delivered assets', async () => {
    render(
      <DeliveryAssetLibrary
        assets={[
          asset({ kind: 'image', filename: 'image.png', extension: '.png' }),
          asset({ kind: 'video', filename: 'clip.mp4', extension: '.mp4' }),
          asset({ kind: 'document', filename: 'brief.pdf', extension: '.pdf' }),
        ]}
      />,
    )

    expect(screen.getByText('3 个成果')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '图片 1' }))

    expect(screen.getByText('image.png')).toBeInTheDocument()
    expect(screen.queryByText('clip.mp4')).not.toBeInTheDocument()
    expect(screen.queryByText('brief.pdf')).not.toBeInTheDocument()
  })

  it('copies one link and all links', async () => {
    render(
      <DeliveryAssetLibrary
        assets={[
          asset({ filename: 'image.png', downloadUrl: 'https://download.example/image.png' }),
          asset({
            kind: 'audio',
            filename: 'voice.mp3',
            extension: '.mp3',
            downloadUrl: 'https://download.example/voice.mp3',
          }),
        ]}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '复制全部链接' }))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'https://download.example/image.png\nhttps://download.example/voice.mp3',
    )

    const imageCard = screen.getByRole('article', { name: 'image.png' })
    fireEvent.click(within(imageCard).getByRole('button', { name: '复制链接' }))
    expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith(
      'https://download.example/image.png',
    )
  })

  it('does not crash when clipboard is unavailable or rejects', async () => {
    Object.assign(navigator, { clipboard: undefined })
    render(<DeliveryAssetLibrary assets={[asset({ filename: 'image.png' })]} />)

    fireEvent.click(screen.getByRole('button', { name: '复制全部链接' }))

    expect(screen.getByText('复制失败，请手动打开链接。')).toBeInTheDocument()
  })

  it('opens an image preview dialog from a card', async () => {
    render(<DeliveryAssetLibrary assets={[asset({ filename: 'image.png' })]} />)

    fireEvent.click(screen.getByRole('button', { name: '预览 image.png' }))

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
  })

  it('shows a buyer-facing empty state', () => {
    render(<DeliveryAssetLibrary assets={[]} />)

    expect(screen.getByText('还没有收到成果')).toBeInTheDocument()
    expect(
      screen.getByText(
        '服务方完成交付后，图片、视频、音频和附件会显示在这里。',
      ),
    ).toBeInTheDocument()
  })
})
