import { useCallback, useEffect, useState } from 'react'

export function useRemote<T>(load: () => Promise<T>, dependencies: unknown[]) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const request = useCallback(() => {
    setLoading(true)
    setError('')
    load().then(setData).catch((cause) => setError(cause instanceof Error ? cause.message : 'Unexpected error'))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies)
  useEffect(request, [request])
  return { data, setData, error, loading, retry: request }
}
