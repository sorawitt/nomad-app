import { useState, useEffect, useCallback } from 'preact/hooks'

export function useLocalStorage<T>(key: string, initialValue: T) {
  const read = useCallback((): T => {
    if (typeof window === 'undefined') return initialValue
    try {
      const raw = localStorage.getItem(key)
      return raw ? JSON.parse(raw) : initialValue
    } catch {
      return initialValue
    }
  }, [key, initialValue])

  const [value, setValue] = useState<T>(read)

  useEffect(() => {
    setValue(read())
  }, [read])

  const set = useCallback((next: T | ((prev: T) => T)) => {
    setValue(prev => {
      const v = next instanceof Function ? next(prev) : next
      try { localStorage.setItem(key, JSON.stringify(v)) } catch {}
      return v
    })
  }, [key])

  const remove = useCallback(() => {
    try { localStorage.removeItem(key) } catch {}
    setValue(initialValue)
  }, [key, initialValue])

  return [value, set, remove] as const
}
