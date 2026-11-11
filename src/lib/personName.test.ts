import { describe, expect, it } from 'vitest'
import { normalizePersonName } from './personName'

describe('normalizePersonName', () => {
  it('todo en mayúscula o minúscula pasa a formato de nombre', () => {
    expect(normalizePersonName('TOMAS FERSTER')).toBe('Tomas Ferster')
    expect(normalizePersonName('bianca anabela trofelli')).toBe('Bianca Anabela Trofelli')
    expect(normalizePersonName('Bianca anabela Trofelli')).toBe('Bianca Anabela Trofelli')
  })

  it('respeta acentos, guiones, apóstrofos y partículas', () => {
    expect(normalizePersonName('JOSÉ ÁLVAREZ')).toBe('José Álvarez')
    expect(normalizePersonName('maría-josé d’angelo')).toBe('María-José D’Angelo')
    expect(normalizePersonName('MARIA DE LA PAZ')).toBe('Maria de la Paz')
    expect(normalizePersonName('de los santos')).toBe('De los Santos')
  })

  it('no toca lo que ya está bien ni las mayúsculas a propósito', () => {
    expect(normalizePersonName('Federico Vazquez Crossetto')).toBe('Federico Vazquez Crossetto')
    expect(normalizePersonName('Ana McDonald')).toBe('Ana McDonald')
    expect(normalizePersonName('Juan Pablo II')).toBe('Juan Pablo II')
  })

  it('limpia espacios de más', () => {
    expect(normalizePersonName('  ana   lópez ')).toBe('Ana López')
  })
})
