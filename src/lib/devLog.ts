/** Logs solo en desarrollo (no filtrar datos sensibles en producción). */
export const devLog = {
  warn: (...args: unknown[]) => {
    if (import.meta.env.DEV) console.warn(...args)
  },
  error: (...args: unknown[]) => {
    if (import.meta.env.DEV) console.error(...args)
  },
}
