/**
 * Link «Agregar a Google Calendar»: abre el evento ya cargado en la cuenta de Google de quien lo toca.
 * No necesita conexión del servidor (la sincronización automática es aparte y puede fallar).
 */

const utcStamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

export function googleCalendarEventUrl(ev: {
  title: string
  start: Date
  end: Date
  details?: string | null
  location?: string | null
}): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: ev.title,
    dates: `${utcStamp(ev.start)}/${utcStamp(ev.end)}`,
  })
  if (ev.details?.trim()) params.set('details', ev.details.trim())
  if (ev.location?.trim()) params.set('location', ev.location.trim())
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}
