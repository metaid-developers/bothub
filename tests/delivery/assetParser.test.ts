import { describe, expect, it } from 'vitest'
import { extractMetafileAssets, parseMetafileUri } from '@/delivery/assetParser'

describe('parseMetafileUri', () => {
  it('parses metafile pin ids and builds default content URLs', () => {
    expect(parseMetafileUri('metafile://abc123i0.mp4')).toEqual({
      uri: 'metafile://abc123i0.mp4',
      pinId: 'abc123i0',
      extension: '.mp4',
      filename: 'abc123i0.mp4',
      kind: 'video',
      mimeType: 'video/mp4',
      previewUrl:
        'https://file.metaid.io/metafile-indexer/api/v1/files/accelerate/content/abc123i0',
      downloadUrl:
        'https://file.metaid.io/metafile-indexer/api/v1/files/accelerate/content/abc123i0',
      fallbackUrl:
        'https://file.metaid.io/metafile-indexer/api/v1/files/content/abc123i0',
    })
  })

  it.each([
    ['metafile://imagepin001i0.png', 'image', 'image/png'],
    ['metafile://videopin001i0.webm', 'video', 'video/webm'],
    ['metafile://audiopin001i0.mp3', 'audio', 'audio/mpeg'],
    ['metafile://docpin001i0.pdf', 'document', 'application/pdf'],
    ['metafile://archivepin001i0.zip', 'archive', 'application/zip'],
    ['metafile://rawpin001i0.unknown', 'other', undefined],
    ['metafile://rawpin001i0', 'other', undefined],
  ] as const)('detects %s as %s', (uri, kind, mimeType) => {
    expect(parseMetafileUri(uri)).toMatchObject({ uri, kind, mimeType })
  })

  it('returns null for non-metafile input', () => {
    expect(parseMetafileUri('https://example.com/file.png')).toBeNull()
  })

  it('ignores trailing square and curly brackets around metafile URIs', () => {
    expect(parseMetafileUri('[metafile://abc123i0.png]')).toMatchObject({
      uri: 'metafile://abc123i0.png',
      pinId: 'abc123i0',
      extension: '.png',
      filename: 'abc123i0.png',
      kind: 'image',
    })

    expect(parseMetafileUri('{metafile://abc123i0.png}')).toMatchObject({
      uri: 'metafile://abc123i0.png',
      pinId: 'abc123i0',
      extension: '.png',
      filename: 'abc123i0.png',
      kind: 'image',
    })
  })
})

describe('extractMetafileAssets', () => {
  it('extracts metafile assets and removes duplicate URIs', () => {
    const assets = extractMetafileAssets(
      'Here metafile://abc123i0.png and metafile://abc123i0.png',
    )

    expect(assets).toHaveLength(1)
    expect(assets[0]).toMatchObject({
      uri: 'metafile://abc123i0.png',
      pinId: 'abc123i0',
      extension: '.png',
      filename: 'abc123i0.png',
      kind: 'image',
      mimeType: 'image/png',
    })
  })

  it('extracts IDBots delivery summary metafile variants and extensionless content links', () => {
    const assets = extractMetafileAssets(`
      数字成果已生成并上传链上交付。
      交付文件: metafile://imagepin001i0.png
      交付文件: metafile://photopin001i0.jpg
      交付文件: metafile://videopin001i0.mp4
      交付文件: metafile://audiopin001i0.mp3
      交付文件: metafile://wavepin001i0.wav
      交付文件: metafile://archivepin001i0.zip
      交付文件: metafile://rawpin001i0
      下载链接: https://file.metaid.io/metafile-indexer/api/v1/files/accelerate/content/rawpin001i0
    `)

    expect(assets.map((asset) => [asset.uri, asset.kind, asset.mimeType])).toEqual([
      ['metafile://imagepin001i0.png', 'image', 'image/png'],
      ['metafile://photopin001i0.jpg', 'image', 'image/jpeg'],
      ['metafile://videopin001i0.mp4', 'video', 'video/mp4'],
      ['metafile://audiopin001i0.mp3', 'audio', 'audio/mpeg'],
      ['metafile://wavepin001i0.wav', 'audio', 'audio/wav'],
      ['metafile://archivepin001i0.zip', 'archive', 'application/zip'],
      ['metafile://rawpin001i0', 'other', undefined],
    ])
  })

  it('extracts extensionless MetaID content links from IDBots summaries', () => {
    const assets = extractMetafileAssets(
      '下载链接: https://file.metaid.io/metafile-indexer/api/v1/files/accelerate/content/linkpin001i0',
    )

    expect(assets).toHaveLength(1)
    expect(assets[0]).toMatchObject({
      uri: 'metafile://linkpin001i0',
      pinId: 'linkpin001i0',
      extension: null,
      filename: 'linkpin001i0',
      kind: 'other',
    })
  })

  it('extracts real metafile forms, trims punctuation, and deduplicates by pin id', () => {
    const assets = extractMetafileAssets(`
      图片：(metafile://realimage001i0.png)，
      视频：metafile://realvideo001i0.mp4。
      音频：[metafile://realaudio001i0.wav];
      文档：{metafile://realdoc001i0.pdf}!
      重复图片：metafile://realimage001i0.png。
      直链：https://file.metaid.io/metafile-indexer/api/v1/files/accelerate/content/realdirect001i0）
      重复直链：https://file.metaid.io/metafile-indexer/api/v1/files/accelerate/content/realdirect001i0。
    `)

    expect(assets.map((asset) => [asset.uri, asset.pinId, asset.kind, asset.mimeType])).toEqual([
      ['metafile://realimage001i0.png', 'realimage001i0', 'image', 'image/png'],
      ['metafile://realvideo001i0.mp4', 'realvideo001i0', 'video', 'video/mp4'],
      ['metafile://realaudio001i0.wav', 'realaudio001i0', 'audio', 'audio/wav'],
      ['metafile://realdoc001i0.pdf', 'realdoc001i0', 'document', 'application/pdf'],
      ['metafile://realdirect001i0', 'realdirect001i0', 'other', undefined],
    ])
  })
})
