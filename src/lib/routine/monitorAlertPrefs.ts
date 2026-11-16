import { useSyncExternalStore } from 'react'

/**
 * Preferencias de los avisos del monitor de entrenamiento, guardadas en este navegador.
 * `enabled`: avisos dentro de la app. `browser`: además, notificación del navegador cuando la pestaña
 * no está a la vista (necesita el permiso del navegador).
 */
export interface MonitorAlertPrefs {
  enabled: boolean
  browser: boolean
}

const KEY = 'hh-monitor-alerts'
const DEFAULTS: MonitorAlertPrefs = { enabled: true, browser: false }

function read(): MonitorAlertPrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<MonitorAlertPrefs> | null
    return { ...DEFAULTS, ...(raw ?? {}) }
  } catch {
    return DEFAULTS
  }
}

let state = read()
const listeners = new Set<() => void>()

export function setMonitorAlertPrefs(patch: Partial<MonitorAlertPrefs>) {
  state = { ...state, ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // Sin almacenamiento: vale para esta visita.
  }
  listeners.forEach((l) => l())
}

export function useMonitorAlertPrefs(): MonitorAlertPrefs {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => state,
    () => state,
  )
}

/** El navegador puede mostrar notificaciones y ya dio permiso. */
export function browserNotificationsGranted(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted'
}
