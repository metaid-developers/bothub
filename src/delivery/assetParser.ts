import {
  getMetafileAccelerateContentBaseUrl,
  getMetafileContentBaseUrl,
} from '@/api/config'

export interface ParsedDeliveryAsset {
  uri: string
  pinId: string
  extension: string | null
  filename: string
  kind: 'image' | 'video' | 'audio' | 'document' | 'archive' | 'other'
  mimeType?: string
  previewUrl: string
  downloadUrl: string
  fallbackUrl: string
}

const METAFILE_URI_RE = /metafile:\/\/[^\s<>"'`]+/gi
const METAID_CONTENT_URL_RE =
  /https?:\/\/file\.metaid\.io\/metafile-indexer\/(?:api\/v1\/files\/(?:accelerate\/)?content|content)\/[^\s<>"'`]+/gi

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.gif', '.png', '.webp', '.bmp', '.svg'])
const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.mov'])
const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac'])
const DOCUMENT_EXTENSIONS = new Set([
  '.pdf',
  '.txt',
  '.json',
  '.csv',
  '.md',
  '.html',
  '.xml',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
])
const ARCHIVE_EXTENSIONS = new Set(['.zip', '.tar', '.gz', '.tgz', '.rar', '.7z'])

const MIME_TYPE_BY_EXTENSION = new Map<string, string>([
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
  ['.bmp', 'image/bmp'],
  ['.svg', 'image/svg+xml'],
  ['.mp4', 'video/mp4'],
  ['.webm', 'video/webm'],
  ['.mov', 'video/quicktime'],
  ['.mp3', 'audio/mpeg'],
  ['.wav', 'audio/wav'],
  ['.ogg', 'audio/ogg'],
  ['.flac', 'audio/flac'],
  ['.m4a', 'audio/mp4'],
  ['.aac', 'audio/aac'],
  ['.pdf', 'application/pdf'],
  ['.txt', 'text/plain'],
  ['.json', 'application/json'],
  ['.csv', 'text/csv'],
  ['.md', 'text/markdown'],
  ['.html', 'text/html'],
  ['.xml', 'application/xml'],
  ['.zip', 'application/zip'],
  ['.tar', 'application/x-tar'],
  ['.gz', 'application/gzip'],
  ['.tgz', 'application/gzip'],
  ['.rar', 'application/vnd.rar'],
  ['.7z', 'application/x-7z-compressed'],
])

function normalizeMetafileCandidate(value: string): string {
  return String(value || '')
    .trim()
    .replace(/^[[({【（]+/, '')
    .replace(/[\])}】）,.;:!?，。；：！？]+$/, '')
}

function metafileUriFromContentUrl(rawUrl: string): string {
  const normalizedUrl = normalizeMetafileCandidate(rawUrl)
  try {
    const url = new URL(normalizedUrl)
    if (url.hostname !== 'file.metaid.io') return ''
    const match = url.pathname.match(
      /^\/metafile-indexer\/(?:api\/v1\/files\/(?:accelerate\/)?content|content)\/([^/?#]+)$/i,
    )
    const pinId = match?.[1] ? decodeURIComponent(match[1]).trim() : ''
    return pinId ? `metafile://${pinId}` : ''
  } catch {
    return ''
  }
}

function getAssetKind(extension: string | null): ParsedDeliveryAsset['kind'] {
  if (!extension) return 'other'
  if (IMAGE_EXTENSIONS.has(extension)) return 'image'
  if (VIDEO_EXTENSIONS.has(extension)) return 'video'
  if (AUDIO_EXTENSIONS.has(extension)) return 'audio'
  if (DOCUMENT_EXTENSIONS.has(extension)) return 'document'
  if (ARCHIVE_EXTENSIONS.has(extension)) return 'archive'
  return 'other'
}

export function parseMetafileUri(rawUri: string): ParsedDeliveryAsset | null {
  const uri = normalizeMetafileCandidate(rawUri)
  if (!uri.toLowerCase().startsWith('metafile://')) return null

  const pathPart = uri.slice('metafile://'.length).split(/[?#]/)[0]?.trim() ?? ''
  if (!pathPart) return null

  const lastDotIndex = pathPart.lastIndexOf('.')
  const hasExtension = lastDotIndex > 0 && lastDotIndex < pathPart.length - 1
  const pinId = hasExtension ? pathPart.slice(0, lastDotIndex) : pathPart
  if (!pinId) return null

  const extension = hasExtension
    ? `.${pathPart.slice(lastDotIndex + 1).toLowerCase()}`
    : null
  const filename = extension ? `${pinId}${extension}` : pinId
  const encodedPinId = encodeURIComponent(pinId)
  const previewUrl = `${getMetafileAccelerateContentBaseUrl()}/${encodedPinId}`
  const fallbackUrl = `${getMetafileContentBaseUrl()}/${encodedPinId}`
  const mimeType = extension ? MIME_TYPE_BY_EXTENSION.get(extension) : undefined

  return {
    uri,
    pinId,
    extension,
    filename,
    kind: getAssetKind(extension),
    mimeType,
    previewUrl,
    downloadUrl: previewUrl,
    fallbackUrl,
  }
}

export function extractMetafileAssets(content: string): ParsedDeliveryAsset[] {
  const text = String(content || '')
  const matches = [
    ...(text.match(METAFILE_URI_RE) ?? []),
    ...(text.match(METAID_CONTENT_URL_RE) ?? []).map(metafileUriFromContentUrl).filter(Boolean),
  ]
  const assets: ParsedDeliveryAsset[] = []
  const seen = new Set<string>()

  for (const match of matches) {
    const asset = parseMetafileUri(match)
    if (!asset || seen.has(asset.pinId)) continue
    seen.add(asset.pinId)
    assets.push(asset)
  }

  return assets
}
