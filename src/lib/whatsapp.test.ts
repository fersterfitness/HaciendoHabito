import { describe, expect, it } from 'vitest'
import {
  buildWhatsAppGroupPickUrl,
  normalizeWhatsAppMessage,
  sanitizeMessageForWhatsApp,
  shouldUseClipboardForWhatsAppGroup,
  shouldUseClipboardForWhatsAppDirect,
  buildWhatsAppDirectUrl,
  monthlyFeedbackInviteMessage,
  routineMonthFinishedWhatsAppMessage,
} from '@/lib/whatsapp'

describe('sanitizeMessageForWhatsApp', () => {
  it('conserva emojis y normaliza saltos de línea', () => {
    const raw = 'Hola equipo! 👋\n\nRecordá enviar el check-in 📲\n\nGracias 💪'
    expect(sanitizeMessageForWhatsApp(raw)).toBe(raw)
  })

  it('quita caracteres de reemplazo sin tocar emojis válidos', () => {
    const raw = 'Aviso \uFFFD semanal 📢'
    expect(sanitizeMessageForWhatsApp(raw)).toBe('Aviso  semanal 📢')
  })

  it('codifica emojis correctamente en la URL de WhatsApp (texto corto sin emoji en URL)', () => {
    const msg = 'Hola, recordá el check-in de hoy'
    const url = buildWhatsAppGroupPickUrl(msg)
    const decoded = decodeURIComponent(url.split('text=')[1] ?? '')
    expect(decoded).toBe(msg)
  })
})

describe('shouldUseClipboardForWhatsAppGroup', () => {
  it('usa portapapeles en grupo si hay emojis', () => {
    expect(shouldUseClipboardForWhatsAppGroup('Aviso 📢 semanal')).toBe(true)
    expect(shouldUseClipboardForWhatsAppGroup('Solo texto plano')).toBe(false)
  })
})

describe('shouldUseClipboardForWhatsAppDirect', () => {
  it('chat directo con emojis: copiar y pegar (sin ?text=)', () => {
    expect(shouldUseClipboardForWhatsAppDirect('Hola 👋')).toBe(true)
    expect(shouldUseClipboardForWhatsAppDirect('Hola')).toBe(false)
  })
})

describe('buildWhatsAppDirectUrl', () => {
  it('no incluye parámetro text', () => {
    expect(buildWhatsAppDirectUrl('5491112345678')).toBe('https://wa.me/5491112345678')
  })
})

describe('routineMonthFinishedWhatsAppMessage', () => {
  it('incluye registro de progreso y el cierre de marca', () => {
    const msg = routineMonthFinishedWhatsAppMessage('Ana Pérez')
    expect(msg).toContain('Ana')
    expect(msg).toContain('REGISTRO DE PROGRESO')
    expect(msg).toContain('HACIÉNDOLO HÁBITO')
  })
})

describe('monthlyFeedbackInviteMessage', () => {
  it('incluye el link del formulario mensual', () => {
    const msg = monthlyFeedbackInviteMessage({
      studentName: 'Ana Pérez',
      url: 'https://ejemplo.test/form/check-in/compartido/abc',
    })
    expect(msg).toContain('Ana')
    expect(msg).toContain('FEEDBACK MENSUAL')
    expect(msg).toContain('cerraste el mes')
    expect(msg).toContain('https://ejemplo.test/form/check-in/compartido/abc')
  })

  it('cambia el copy si está en última semana', () => {
    const msg = monthlyFeedbackInviteMessage({
      studentName: 'Ana Pérez',
      url: 'https://ejemplo.test/form',
      reason: 'last_week',
    })
    expect(msg).toContain('última semana')
    expect(msg).not.toContain('cerraste el mes')
  })
})

describe('normalizeWhatsAppMessage', () => {
  it('aplica NFC', () => {
    const composed = 'Aviso \uD83D\uDC4B'
    expect(normalizeWhatsAppMessage(composed)).toBe('Aviso 👋')
  })
})
