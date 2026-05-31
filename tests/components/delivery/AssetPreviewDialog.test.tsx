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
