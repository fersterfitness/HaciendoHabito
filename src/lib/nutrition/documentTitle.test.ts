import { describe, expect, it } from 'vitest'
import { shortDocumentTitle } from './documentTitle'

describe('shortDocumentTitle', () => {
  it('saca tipo, paciente y mes del título automático', () => {
    expect(shortDocumentTitle('Anamnesis de Gustavo Cabral Anamnesis inicial 11-2026', 'Gustavo Cabral')).toBe('Anamnesis inicial')
    expect(shortDocumentTitle('Estudio · Gustavo Cabral · Hemograma completo 11-2026', 'Gustavo Cabral')).toBe('Hemograma completo')
    expect(shortDocumentTitle('Antropometría Informe Holway octubre 11-2026', 'Gustavo Cabral')).toBe('Informe Holway octubre')
  })
  it('deja igual un título que no sigue el formato', () => {
    expect(shortDocumentTitle('Mi archivo', 'Ana (Pérez)')).toBe('Mi archivo')
    expect(shortDocumentTitle('Antropometría 11-2026', 'Ana')).toBe('Antropometría 11-2026')
  })
})
