import { useEffect, type RefObject } from 'react'

/**
 * En listados con buscador: tecla `/` enfoca el input (no interfiere si ya escribís en un campo).
 */
export function useSlashSearchFocus(inputRef: RefObject<HTMLInputElement | null>, enabled = true) {
  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return
      const t = e.target as Node | null
      if (t && (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || (t as HTMLElement).isContentEditable)) {
        return
      }
      e.preventDefault()
      inputRef.current?.focus()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [enabled, inputRef])
}
