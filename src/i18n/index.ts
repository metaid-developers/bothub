import { zhCN, type ZhCN } from './zh-CN'

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

export type I18nKey = NestedKeyOf<ZhCN>

function resolve(obj: Record<string, unknown>, path: string): string {
  const parts = path.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return path
    current = (current as Record<string, unknown>)[part]
  }
  return typeof current === 'string' ? current : path
}

/** Simple typed translator — zh-CN only for MVP */
export function t(key: I18nKey): string {
  return resolve(zhCN as unknown as Record<string, unknown>, key)
}

export { zhCN }
