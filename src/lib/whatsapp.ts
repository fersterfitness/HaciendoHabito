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
  const text = sanitizeMessageForWhatsApp(message)
  return `https://wa.me/${phoneDigits}?text=${encodeURIComponent(text)}`
}

/** Abre WhatsApp para elegir chat o grupo y pegar el mensaje (sin número fijo). */
export function buildWhatsAppGroupPickUrl(message: string): string {
  const text = sanitizeMessageForWhatsApp(message)
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}

/** Quita emojis y secuencias que en WhatsApp suelen verse como ◇. */
export function sanitizeMessageForWhatsApp(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/\uFE0F/g, '')
    .replace(/[\u200D\u2060\uFEFF]/g, '')
    .replace(/\uFFFD/g, '')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd()
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

/** Mensaje sugerido al marcar el turno como confirmado (preparación para la videollamada). */
export function confirmedVideocallPrepMessage(): string {
  return [
    'Perfecto!',
    '',
    'Ahora que ya tenemos nuestra videollamada pactada. Necesito que vayas pensando algunas cosas para ese día.',
    '',
    'Temas a conversar:',
    '',
    '1-¿Como es un dia habitual tuyo? O generalemnte en la semana.',
    '',
    '2-¿Que comidas estas acostumbrado a realizar?¿En que horarios?',
    '',
    '3-¿En que horario entrenas?',
    '',
    '4-¿En que lugar vas a entrenar?',
    '',
    '5-¿Que es lo que mas te cuesta como habito?',
    '',
    '6-En caso de tener ciclo menstrual. ¿Que dias normalmente menstruas?¿Que tipo de periodo tenes?¿Notas molestias/Dolor/incomodidad en algun momento?',
    '',
    '*Temas secundarios: (Para hablar en videollamada)*',
    '',
    '-Tema grabacion de videos en gym ',
    '',
    '-Habit trackker y como funciona',
  ].join('\n')
}

export function buildAppointmentConfirmedPrepWaUrl(params: { phoneRaw: string | null | undefined }): string | null {
  const digits = normalizePhoneForWhatsApp(params.phoneRaw)
  if (!digits) return null
  return buildWhatsAppUrl(digits, confirmedVideocallPrepMessage())
}

/** Mensaje con un link por alumno (para compartir en grupo de WhatsApp). */
export function checkInGroupMessage(params: {
  formTitle: string
  intro?: string | null
  sharedUrl?: string | null
  entries: { studentName: string; url: string }[]
}): string {
  if (params.sharedUrl?.trim()) {
    return checkInSharedLinkMessage({
      formTitle: params.formTitle,
      url: params.sharedUrl.trim(),
      intro: params.intro,
    })
  }
  const lines = ['Hola,', '', `Check-in: ${params.formTitle.trim()}`]
  if (params.intro?.trim()) {
    lines.push('', params.intro.trim())
  }
  lines.push('', 'Cada uno con su link personal:')
  for (const e of params.entries) {
    lines.push(`• ${e.studentName.trim()}: ${e.url.trim()}`)
  }
  lines.push('', 'Gracias.')
  return lines.join('\n')
}

/** Mensaje al enviar link de check-in por WhatsApp. */
export function checkInInviteMessage(params: {
  studentName: string
  formTitle: string
  url: string
  intro?: string | null
}): string {
  const first = params.studentName.trim().split(/\s+/)[0] || params.studentName.trim()
  const lines = [
    `Hola ${first},`,
    '',
    `Te comparto el link para completar el formulario «${params.formTitle.trim()}»:`,
  ]
  if (params.intro?.trim()) {
    lines.push('', params.intro.trim())
  }
  lines.push('', params.url.trim(), '', 'Cuando puedas, completalo. Gracias!')
  return lines.join('\n')
}

/** Un solo link para todo el grupo; cada uno completa con su correo. */
export function checkInSharedLinkMessage(params: {
  formTitle: string
  url: string
  intro?: string | null
}): string {
  const lines = [
    'Hola,',
    '',
    `Check-in: ${params.formTitle.trim()}`,
    '',
    'Completá el formulario con este link (todos usan el mismo):',
    '',
    params.url.trim(),
  ]
  if (params.intro?.trim()) {
    lines.splice(4, 0, '', params.intro.trim())
  }
  lines.push('', 'Al enviar, ingresá el mismo correo que diste al inscribirte.', '', 'Gracias.')
  return lines.join('\n')
}

/** Mensaje sugerido al compartir un recurso (video, artículo) por WhatsApp. */
export function buildResourceShareMessage(title: string, url: string, note?: string | null): string {
  const lines = [`Te comparto: ${title.trim()}`, '', url.trim()]
  if (note?.trim()) lines.push('', note.trim())
  return lines.join('\n')
}

/** Mensaje al enviar rutina (PDF) al alumno por WhatsApp. */
export function buildRoutinePdfShareMessage(params: {
  studentName: string
  routineName: string
  pdfUrl: string
  extraNote?: string | null
}): string {
  const first = params.studentName.trim().split(/\s+/)[0] || params.studentName.trim()
  const lines = [
    `Hola ${first},`,
    '',
    `Te comparto tu rutina «${params.routineName.trim()}»:`,
    '',
    params.pdfUrl.trim(),
  ]
  if (params.extraNote?.trim()) lines.push('', params.extraNote.trim())
  lines.push('', 'Cualquier duda me escribís. ¡A entrenar!')
  return lines.join('\n')
}

export function buildRoutinePdfShareWaUrl(params: {
  phoneRaw: string | null | undefined
  studentName: string
  routineName: string
  pdfUrl: string
  extraNote?: string | null
}): string | null {
  const digits = normalizePhoneForWhatsApp(params.phoneRaw)
  if (!digits) return null
  const msg = buildRoutinePdfShareMessage({
    studentName: params.studentName,
    routineName: params.routineName,
    pdfUrl: params.pdfUrl,
    extraNote: params.extraNote,
  })
  return buildWhatsAppUrl(digits, msg)
}

export function openWhatsAppUrl(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer')
}
