import { describe, expect, it } from 'vitest'
import { buildWhatsAppGroupPickUrl, sanitizeMessageForWhatsApp } from '@/lib/whatsapp'

describe('sanitizeMessageForWhatsApp', () => {
  it('elimina emojis al final de línea', () => {
    const raw = 'Hola equipo!\n\nRecordá enviar el check-in 📲\n\nGracias 💪'
    expect(sanitizeMessageForWhatsApp(raw)).toBe('Hola equipo!\n\nRecordá enviar el check-in\n\nGracias')
  })

  it('no deja caracteres de reemplazo en la URL de WhatsApp', () => {
    const msg = '¡Excelente sábado! Sigamos Haciéndolo el Hábito 🎯'
    const url = buildWhatsAppGroupPickUrl(msg)
    const decoded = decodeURIComponent(url.split('text=')[1] ?? '')
    expect(decoded).not.toMatch(/\uFFFD/)
    expect(decoded).not.toMatch(/\p{Extended_Pictographic}/u)
  })
})
