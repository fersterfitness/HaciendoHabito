import { describe, expect, it } from 'vitest'
import { parsePlanGeneralNotes, serializePlanGeneralNotes } from './planGeneralNotes'

describe('planGeneralNotes', () => {
  it('parses header and bullet lines', () => {
    const raw = `Intro breve

**Aclaraciones:**

[] Primer punto
- Segundo punto`
    expect(parsePlanGeneralNotes(raw)).toEqual({
      preamble: 'Intro breve',
      aclaraciones: ['Primer punto', 'Segundo punto'],
    })
  })

  it('round-trips serialize', () => {
    const parsed = {
      preamble: 'Contexto',
      aclaraciones: ['Hábitos sólidos', 'Ajustar detalles'],
    }
    const text = serializePlanGeneralNotes(parsed)
    expect(parsePlanGeneralNotes(text)).toEqual(parsed)
  })
})
