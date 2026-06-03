import { useCallback, useSyncExternalStore } from 'react'
import { enUS, type EnUS } from './en-US'
import { zhCN } from './zh-CN'

type Primitive = string | number | boolean | null | undefined

type NestedKeyOf<T, Prefix extends string = ''> = T extends Primitive
  ? Prefix extends ''
    ? never
    : Prefix
  : {
      [K in keyof T & string]: T[K] extends Primitive
        ? Prefix extends ''
          ? K
          : `${Prefix}.${K}`
        : NestedKeyOf<T[K], Prefix extends '' ? K : `${Prefix}.${K}`>
    }[keyof T & string]

export type I18nKey = NestedKeyOf<EnUS>
export type SupportedLanguage = 'en-US' | 'zh-CN'

type TranslationParams = Record<string, string | number>

const LANGUAGE_STORAGE_KEY = 'bothub.language'
const DEFAULT_LANGUAGE: SupportedLanguage = 'en-US'
const dictionaries = {
  'en-US': enUS,
  'zh-CN': zhCN,
} as const

const languageOptions: Array<{ value: SupportedLanguage; labelKey: I18nKey }> = [
  { value: 'en-US', labelKey: 'language.english' },
  { value: 'zh-CN', labelKey: 'language.chinese' },
]

const subscribers = new Set<() => void>()
let currentLanguage: SupportedLanguage = readStoredLanguage()

function resolve(obj: Record<string, unknown>, path: string): string {
  const parts = path.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return path
    current = (current as Record<string, unknown>)[part]
  }
  return typeof current === 'string' ? current : path
}

function isSupportedLanguage(value: string | null | undefined): value is SupportedLanguage {
  return value === 'en-US' || value === 'zh-CN'
}

function readStoredLanguage(): SupportedLanguage {
  try {
    const stored = globalThis.localStorage?.getItem(LANGUAGE_STORAGE_KEY)
    return isSupportedLanguage(stored) ? stored : DEFAULT_LANGUAGE
  } catch {
    return DEFAULT_LANGUAGE
  }
}

function persistLanguage(language: SupportedLanguage) {
  try {
    globalThis.localStorage?.setItem(LANGUAGE_STORAGE_KEY, language)
  } catch {
    // localStorage can be unavailable in restricted browser contexts.
  }
}

function emitLanguageChange() {
  subscribers.forEach((subscriber) => subscriber())
}

function interpolate(message: string, params?: TranslationParams): string {
  if (!params) return message
  return message.replace(/\{(\w+)\}/g, (match, name) => {
    const value = params[name]
    return value === undefined ? match : String(value)
  })
}

export function getLanguage(): SupportedLanguage {
  return currentLanguage
}

export function setLanguage(language: SupportedLanguage): void {
  if (currentLanguage === language) return
  currentLanguage = language
  persistLanguage(language)
  emitLanguageChange()
}

function subscribeLanguage(subscriber: () => void): () => void {
  subscribers.add(subscriber)
  return () => subscribers.delete(subscriber)
}

export function useLanguage(): [SupportedLanguage, (language: SupportedLanguage) => void] {
  const language = useSyncExternalStore(subscribeLanguage, getLanguage, getLanguage)
  const updateLanguage = useCallback((nextLanguage: SupportedLanguage) => {
    setLanguage(nextLanguage)
  }, [])
  return [language, updateLanguage]
}

/** Simple typed translator with English as the default UI language. */
export function t(key: I18nKey, params?: TranslationParams): string {
  const dictionary = dictionaries[currentLanguage]
  return interpolate(resolve(dictionary as unknown as Record<string, unknown>, key), params)
}

export function resetLanguageForTests(language: SupportedLanguage = DEFAULT_LANGUAGE): void {
  currentLanguage = language
  try {
    globalThis.localStorage?.removeItem(LANGUAGE_STORAGE_KEY)
  } catch {
    // localStorage can be unavailable in restricted browser contexts.
  }
  emitLanguageChange()
}

export { enUS, languageOptions, zhCN }
