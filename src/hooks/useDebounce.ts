import { useCallback, useRef } from 'react'

/**
 * Returns a debounced version of `fn` that delays execution by `delay` ms.
 * The reference is stable across renders.
 */
export function useDebounce<T extends (...args: never[]) => void>(fn: T, delay = 600): T {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fnRef  = useRef(fn)
  fnRef.current = fn

  return useCallback((...args: Parameters<T>) => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => { fnRef.current(...args) }, delay)
  }, [delay]) as T
}
