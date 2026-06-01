import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AssetPreviewDialog } from '@/components/delivery/AssetPreviewDialog'
import type { ParsedDeliveryAsset } from '@/delivery/assetParser'

const imageAsset: ParsedDeliveryAsset = {
  uri: 'metafile://image.png',
  pinId: 'image',
  extension: '.png',
  filename: 'image.png',
  kind: 'image',
  mimeType: 'image/png',
  previewUrl: 'https://preview.example/image.png',
  downloadUrl: 'https://download.example/image.png',
  fallbackUrl: 'https://fallback.example/image.png',
}

describe('AssetPreviewDialog', () => {
  it('renders image preview and actions', () => {
    render(<AssetPreviewDialog asset={imageAsset} open onClose={vi.fn()} />)

    expect(screen.getByRole('dialog', { name: 'image.png' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'image.png' })).toHaveAttribute(
      'src',
      'https://preview.example/image.png',
    )
    expect(screen.getByRole('link', { name: '下载' })).toHaveAttribute(
      'href',
      'https://download.example/image.png',
    )
    expect(screen.getByRole('link', { name: '打开' })).toHaveAttribute(
      'href',
      'https://fallback.example/image.png',
    )
  })

  it('falls back from accelerated image preview to content URL before showing unavailable copy', () => {
    render(<AssetPreviewDialog asset={imageAsset} open onClose={vi.fn()} />)

    const image = screen.getByRole('img', { name: 'image.png' })
    fireEvent.error(image)
    expect(image).toHaveAttribute('src', 'https://fallback.example/image.png')

    fireEvent.error(image)
    expect(screen.getByText('预览暂不可用，可打开文件')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '打开' })).toHaveAttribute(
      'href',
      'https://fallback.example/image.png',
    )
    expect(screen.getByRole('link', { name: '下载' })).toHaveAttribute(
      'href',
      'https://download.example/image.png',
    )
  })

  it('shows a stable buyer-facing fallback when video or audio preview fails', () => {
    const videoAsset: ParsedDeliveryAsset = {
      ...imageAsset,
      uri: 'metafile://clip.mp4',
      pinId: 'clip',
      extension: '.mp4',
      filename: 'clip.mp4',
      kind: 'video',
      mimeType: 'video/mp4',
      previewUrl: 'https://preview.example/clip.mp4',
      downloadUrl: 'https://download.example/clip.mp4',
      fallbackUrl: 'https://fallback.example/clip.mp4',
    }
    const { container } = render(<AssetPreviewDialog asset={videoAsset} open onClose={vi.fn()} />)

    expect(container.querySelector('video')).toBeInTheDocument()
    fireEvent.error(container.querySelector('video source') as Element)
    expect(container.querySelector('video source')).toHaveAttribute(
      'src',
      'https://fallback.example/clip.mp4',
    )
    fireEvent.error(container.querySelector('video source') as Element)

    expect(container.querySelector('video')).not.toBeInTheDocument()
    expect(screen.getByText('预览暂不可用，可打开文件')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '打开' })).toHaveAttribute(
      'href',
      'https://fallback.example/clip.mp4',
    )
    expect(screen.getByRole('link', { name: '下载' })).toHaveAttribute(
      'href',
      'https://download.example/clip.mp4',
    )
  })

  it('renders documents as open/download fallback cards without inline media', () => {
    render(
      <AssetPreviewDialog
        asset={{
          ...imageAsset,
          uri: 'metafile://brief.pdf',
          pinId: 'brief',
          extension: '.pdf',
          filename: 'brief.pdf',
          kind: 'document',
          mimeType: 'application/pdf',
          previewUrl: 'https://preview.example/brief.pdf',
          downloadUrl: 'https://download.example/brief.pdf',
          fallbackUrl: 'https://fallback.example/brief.pdf',
        }}
        open
        onClose={vi.fn()}
      />,
    )

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(document.querySelector('video, audio')).not.toBeInTheDocument()
    expect(screen.getByText('预览暂不可用，可打开文件')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '打开' })).toHaveAttribute(
      'href',
      'https://fallback.example/brief.pdf',
    )
    expect(screen.getByRole('link', { name: '下载' })).toHaveAttribute(
      'href',
      'https://download.example/brief.pdf',
    )
  })

  it('closes with the close button', async () => {
    const onClose = vi.fn()
    render(<AssetPreviewDialog asset={imageAsset} open onClose={onClose} />)

    await fireEvent.click(screen.getByRole('button', { name: '关闭预览' }))

    expect(onClose).toHaveBeenCalled()
  })

  it('renders nothing when closed', () => {
    render(<AssetPreviewDialog asset={imageAsset} open={false} onClose={vi.fn()} />)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
