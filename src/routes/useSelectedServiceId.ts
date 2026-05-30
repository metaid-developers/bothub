import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

const SERVICE_SEARCH_PARAM = 'service'

export function useSelectedServiceId(): [
  string | undefined,
  (id: string | undefined) => void,
] {
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedServiceId = searchParams.get(SERVICE_SEARCH_PARAM) ?? undefined

  const setSelectedServiceId = useCallback(
    (id: string | undefined) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (id) {
            next.set(SERVICE_SEARCH_PARAM, id)
          } else {
            next.delete(SERVICE_SEARCH_PARAM)
          }
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  return [selectedServiceId, setSelectedServiceId]
}
