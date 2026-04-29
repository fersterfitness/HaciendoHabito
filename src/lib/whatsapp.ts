import { format } from 'date-fns'
import { es } from 'date-fns/locale'

import { studentPhoneDigitsForWhatsApp } from '@/lib/studentPhone'

/**
 * Enlaces gratuitos a WhatsApp (https://wa.me) — sin API de negocio.
 * Espera teléfono alumno en formato guardado (+54 XX XXXXXXXX — ver studentPhone.ts).
 */

export function normalizePhoneForWhatsApp(raw: string | null | undefined): string | null {
  return studentPhoneDigitsForWhatsApp(raw)
}

export function buildWhatsAppUrl(phoneDigits: string, message: string): string {
  // Sin emojis: en wa.me algunos clientes las muestran como () — solo texto ASCII + tildes.
  const text = normalizeMessageForWaLink(message)
  return `https://wa.me/${phoneDigits}?text=${encodeURIComponent(text)}`
}

/** Evita BMP raro en algunos previews; preserva español típido. */
function normalizeMessageForWaLink(text: string): string {
  return text.replace(/\r\n/g, '\n').trimEnd()
}

export function confirmationMessage(params: {
  studentName: string
  title: string
  startsAt: Date
  location?: string | null
}): string {
  const when = format(params.startsAt, "EEEE d 'de' MMMM, HH:mm", { locale: es })
  const place = params.location?.trim()
  const lines: string[] = [
    `Hola ${params.studentName}, te escribo para confirmar tu turno:`,
    '',
    `Título: ${params.title}`,
    `Fecha/hora: ${when}`,
    ...(place ? [`Lugar: ${place}`] : []),
    '',
    '¿Podés confirmar que vas a poder asistir? Gracias.',
  ]
  return lines.join('\n')
}

export function postSessionMessage(params: { studentName: string; title: string; sessionAt: Date }): string {
  const when = format(params.sessionAt, "d/M/yyyy 'a las' HH:mm", { locale: es })
  return [
    `Hola ${params.studentName},`,
    '',
    `Sesión: ${params.title}`,
    `Fecha y hora: ${when}`,
    '',
    '¿Cómo te sentiste hoy? Cuando puedas, contame en una línea cómo te fue.',
    '',
    'Gracias!',
  ].join('\n')
}

export function buildAppointmentConfirmationWaUrl(params: {
  phoneRaw: string | null | undefined
  studentName: string
  title: string
  startsAtIso: string
  location?: string | null
}): string | null {
  const digits = normalizePhoneForWhatsApp(params.phoneRaw)
  if (!digits) return null
  const msg = confirmationMessage({
    studentName: params.studentName,
    title: params.title,
    startsAt: new Date(params.startsAtIso),
    location: params.location,
  })
  return buildWhatsAppUrl(digits, msg)
}

export function buildAppointmentFeedbackWaUrl(params: {
  phoneRaw: string | null | undefined
  studentName: string
  title: string
  startsAtIso: string
}): string | null {
  const digits = normalizePhoneForWhatsApp(params.phoneRaw)
  if (!digits) return null
  const msg = postSessionMessage({
    studentName: params.studentName,
    title: params.title,
    sessionAt: new Date(params.startsAtIso),
  })
  return buildWhatsAppUrl(digits, msg)
}
