import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AssetPreviewCard } from '@/components/delivery/AssetPreviewCard'
import type { ParsedDeliveryAsset } from '@/delivery/assetParser'

function asset(overrides: Partial<ParsedDeliveryAsset> = {}): ParsedDeliveryAsset {
  const kind = overrides.kind ?? 'image'
  const extension = overrides.extension ?? '.png'
  const filename = overrides.filename ?? `pin${extension}`

  return {
    uri: `metafile://pin${extension}`,
    pinId: 'pin',
    extension,
    filename,
    kind,
    mimeType: overrides.mimeType,
    previewUrl: 'https://accelerate.example/pin',
    downloadUrl: 'https://download.example/pin',
    fallbackUrl: 'https://fallback.example/pin',
    ...overrides,
  }
}

describe('AssetPreviewCard', () => {
  it('renders image assets as inline images with accelerated preview fallback', () => {
    render(<AssetPreviewCard asset={asset({ kind: 'image', mimeType: 'image/png' })} />)

    const image = screen.getByRole('img', { name: 'pin.png' })
    expect(image).toHaveAttribute('src', 'https://accelerate.example/pin')

    fireEvent.error(image)

    expect(image).toHaveAttribute('src', 'https://fallback.example/pin')
    expect(screen.getByRole('link', { name: '下载' })).toBeInTheDocument()
  })

  it('resets failed image preview state when rerendered with a new asset', () => {
    const { rerender } = render(
      <AssetPreviewCard asset={asset({ kind: 'image', mimeType: 'image/png' })} />,
    )

    const image = screen.getByRole('img', { name: 'pin.png' })
    fireEvent.error(image)
    fireEvent.error(image)
    expect(screen.getByText('预览暂不可用，可打开文件')).toBeInTheDocument()

    rerender(
      <AssetPreviewCard
        asset={asset({
          uri: 'metafile://next.png',
          pinId: 'next',
          filename: 'next.png',
          kind: 'image',
          mimeType: 'image/png',
          previewUrl: 'https://accelerate.example/next',
          downloadUrl: 'https://download.example/next',
          fallbackUrl: 'https://fallback.example/next',
        })}
      />,
    )

    expect(screen.getByRole('img', { name: 'next.png' })).toHaveAttribute(
      'src',
      'https://accelerate.example/next',
    )
    expect(screen.queryByText('预览暂不可用，可打开文件')).not.toBeInTheDocument()
  })

  it('renders video assets as controlled inline video', () => {
    const { container } = render(
      <AssetPreviewCard
        asset={asset({
          kind: 'video',
          extension: '.mp4',
          filename: 'clip.mp4',
          mimeType: 'video/mp4',
        })}
      />,
    )

    const video = container.querySelector('video')
    expect(video).toBeInTheDocument()
    expect(video).toHaveAttribute('controls')
    expect(video).toHaveAttribute('playsinline')
  })

  it('tries video fallback before marking preview unavailable without collapsing actions', () => {
    const { container } = render(
      <AssetPreviewCard
        asset={asset({
          kind: 'video',
          extension: '.mp4',
          filename: 'clip.mp4',
          mimeType: 'video/mp4',
          previewUrl: 'https://accelerate.example/clip',
          fallbackUrl: 'https://fallback.example/clip',
        })}
      />,
    )

    const source = container.querySelector('video source')
    const video = container.querySelector('video')
    expect(source).toHaveAttribute('src', 'https://accelerate.example/clip')
    const previewFrame = container.querySelector('article > div')
    expect(previewFrame).toHaveClass('aspect-[16/9]')

    fireEvent.error(source as Element)

    expect(container.querySelector('video')).not.toBe(video)
    expect(container.querySelector('video source')).toHaveAttribute(
      'src',
      'https://fallback.example/clip',
    )
    expect(screen.getByRole('link', { name: '下载' })).toBeInTheDocument()

    fireEvent.error(container.querySelector('video source') as Element)

    expect(previewFrame).toHaveClass('aspect-[16/9]')
    expect(screen.getByText('预览暂不可用，可打开文件')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '打开' })).toHaveAttribute(
      'href',
      'https://fallback.example/clip',
    )
    expect(screen.getByRole('link', { name: '下载' })).toBeInTheDocument()
  })

  it('renders audio assets as controlled inline audio', () => {
    const { container } = render(
      <AssetPreviewCard
        asset={asset({
          kind: 'audio',
          extension: '.mp3',
          filename: 'voice.mp3',
          mimeType: 'audio/mpeg',
        })}
      />,
    )

    const audio = container.querySelector('audio')
    expect(audio).toBeInTheDocument()
    expect(audio).toHaveAttribute('controls')
  })

  it('tries audio fallback before marking preview unavailable without collapsing actions', () => {
    const { container } = render(
      <AssetPreviewCard
        asset={asset({
          kind: 'audio',
          extension: '.mp3',
          filename: 'voice.mp3',
          mimeType: 'audio/mpeg',
          previewUrl: 'https://accelerate.example/voice',
          fallbackUrl: 'https://fallback.example/voice',
        })}
      />,
    )

    const source = container.querySelector('audio source')
    const audio = container.querySelector('audio')
    expect(source).toHaveAttribute('src', 'https://accelerate.example/voice')
    const previewFrame = container.querySelector('article > div')
    expect(previewFrame).toHaveClass('aspect-[16/9]')

    fireEvent.error(source as Element)

    expect(container.querySelector('audio')).not.toBe(audio)
    expect(container.querySelector('audio source')).toHaveAttribute(
      'src',
      'https://fallback.example/voice',
    )
    expect(screen.getByRole('link', { name: '下载' })).toBeInTheDocument()

    fireEvent.error(container.querySelector('audio source') as Element)

    expect(previewFrame).toHaveClass('aspect-[16/9]')
    expect(screen.getByText('预览暂不可用，可打开文件')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '打开' })).toHaveAttribute(
      'href',
      'https://fallback.example/voice',
    )
    expect(screen.getByRole('link', { name: '下载' })).toBeInTheDocument()
  })

  it('renders document and archive assets as open/download cards without inline preview claims', () => {
    const onPreview = vi.fn()
    const { container } = render(
      <div>
        <AssetPreviewCard
          asset={asset({
            kind: 'document',
            extension: '.pdf',
            filename: 'brief.pdf',
            mimeType: 'application/pdf',
          })}
          onPreview={onPreview}
        />
        <AssetPreviewCard
          asset={asset({
            kind: 'archive',
            extension: '.zip',
            filename: 'bundle.zip',
            mimeType: 'application/zip',
            previewUrl: 'https://accelerate.example/bundle',
            downloadUrl: 'https://download.example/bundle',
            fallbackUrl: 'https://fallback.example/bundle',
          })}
          onPreview={onPreview}
        />
      </div>,
    )

    expect(container.querySelector('img, video, audio')).not.toBeInTheDocument()
    expect(screen.getByText('brief.pdf')).toBeInTheDocument()
    expect(screen.getByText('bundle.zip')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '预览 brief.pdf' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '预览 bundle.zip' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: '打开' })).toHaveLength(2)
    expect(screen.getAllByRole('link', { name: '下载' })).toHaveLength(2)
  })

  it('keeps download links stable and safe for every asset', () => {
    render(<AssetPreviewCard asset={asset()} />)

    const link = screen.getByRole('link', { name: '下载' })
    expect(link).toHaveAttribute('href', 'https://download.example/pin')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
    expect(link).toHaveAttribute('rel', expect.stringContaining('noreferrer'))
  })
})
