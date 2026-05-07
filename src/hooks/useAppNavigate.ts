import { useNavigate } from 'react-router-dom'

/** Alias de `useNavigate` para navegación coherente en la app (sin prefijos legacy). */
export function useAppNavigate() {
  return useNavigate()
}
